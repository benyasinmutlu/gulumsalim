import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../../db/client";
import { customers, orderItems, orders, productVariants, products, shipments, vendors } from "../../db/schema/index";
import { env } from "../../config/env";
import { PttClient, PttError, type PttPackage, type PttTrackingResult } from "./ptt.client";

export class PttNotConfiguredError extends Error {}
export class PttShipmentNotFoundError extends Error {}
export class PttShipmentBusyError extends Error {}
export class PttShipmentValidationError extends Error {}

function configuredClient(): PttClient {
  if (!env.PTT_CUSTOMER_ID || !env.PTT_PASSWORD) throw new PttNotConfiguredError("PTT entegrasyonu yapılandırılmamış");
  return new PttClient({
    environment: env.PTT_ENV,
    customerId: env.PTT_CUSTOMER_ID,
    password: env.PTT_PASSWORD,
    timeoutMs: env.PTT_TIMEOUT_MS,
  });
}

function pttReference(shipmentId: number): string {
  return `GS-${env.PTT_ENV === "test" ? "T" : "P"}-${shipmentId}`;
}

function uniqueFileName(shipmentId: number): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const entropy = randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
  return `GS${shipmentId}_${stamp}_${entropy}`.slice(0, 50);
}

function publicShipment(row: typeof shipments.$inferSelect) {
  return {
    id: row.id,
    carrierName: row.carrierName,
    trackingNumber: row.trackingNumber,
    provider: row.provider,
    providerStatus: row.providerStatus,
    providerReference: row.providerReference,
    providerLastError: row.providerLastError,
    providerAttemptCount: row.providerAttemptCount,
    providerRegisteredAt: row.providerRegisteredAt,
    providerLastCheckedAt: row.providerLastCheckedAt,
    providerEvents: row.providerEvents,
  };
}

async function loadShipment(vendorId: number, shipmentId: number) {
  const [row] = await db
    .select({
      shipment: shipments,
      paymentStatus: orders.paymentStatus,
      customerEmail: customers.email,
      vendorEmail: vendors.email,
    })
    .from(shipments)
    .innerJoin(orders, eq(shipments.orderId, orders.id))
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .innerJoin(vendors, eq(shipments.vendorId, vendors.id))
    .where(and(eq(shipments.id, shipmentId), eq(shipments.vendorId, vendorId)))
    .limit(1);
  if (!row || row.paymentStatus !== "paid") throw new PttShipmentNotFoundError();
  return row;
}

async function derivePackage(shipmentId: number): Promise<PttPackage | null> {
  const rows = await db
    .select({
      quantity: orderItems.quantity,
      productWeight: products.weightGrams,
      productWidth: products.widthCm,
      productHeight: products.heightCm,
      productLength: products.lengthCm,
      variantWeight: productVariants.weightGrams,
      variantWidth: productVariants.widthCm,
      variantHeight: productVariants.heightCm,
      variantLength: productVariants.lengthCm,
    })
    .from(orderItems)
    .innerJoin(products, eq(orderItems.productId, products.id))
    .leftJoin(productVariants, eq(orderItems.variantId, productVariants.id))
    .where(eq(orderItems.shipmentId, shipmentId));
  if (rows.length === 0) return null;

  let weightGrams = 0;
  let widthCm = 0;
  let heightCm = 0;
  let lengthCm = 0;
  for (const row of rows) {
    const weight = row.variantWeight ?? row.productWeight;
    if (!weight || weight <= 0) return null;
    weightGrams += weight * row.quantity;
    widthCm = Math.max(widthCm, Number(row.variantWidth ?? row.productWidth ?? 0));
    heightCm = Math.max(heightCm, Number(row.variantHeight ?? row.productHeight ?? 0));
    lengthCm = Math.max(lengthCm, Number(row.variantLength ?? row.productLength ?? 0));
  }
  return {
    weightGrams,
    ...(widthCm > 0 && heightCm > 0 && lengthCm > 0 ? { widthCm, heightCm, lengthCm } : {}),
  };
}

function validateAddress(row: Awaited<ReturnType<typeof loadShipment>>): void {
  const s = row.shipment;
  const missing = [
    [s.senderName, "satıcı gönderici adı"],
    [s.senderPhone, "satıcı telefonu"],
    [s.senderCity, "satıcı ili"],
    [s.senderDistrict, "satıcı ilçesi"],
    [s.senderAddressLine, "satıcı gönderim adresi"],
    [s.recipientName, "alıcı adı"],
    [s.recipientPhone, "alıcı telefonu"],
    [s.recipientCity, "alıcı ili"],
    [s.recipientDistrict, "alıcı ilçesi"],
    [s.recipientAddressLine, "alıcı adresi"],
  ].filter(([value]) => !value).map(([, label]) => label);
  if (missing.length > 0) {
    throw new PttShipmentValidationError(`PTT kaydı için eksik alanlar: ${missing.join(", ")}`);
  }
}

function isPendingStatus(value: string): boolean {
  return value === "registering" || value === "registration_pending";
}

async function saveTracking(shipmentId: number, result: PttTrackingResult) {
  const delivered = Boolean(result.deliveredTo);
  const [updated] = await db
    .update(shipments)
    .set({
      ...(result.barcode ? { trackingNumber: result.barcode, carrierName: "PTT Kargo" } : {}),
      providerStatus: delivered ? "delivered" : "tracking",
      providerLastError: null,
      providerLastCheckedAt: new Date(),
      providerEvents: result.events,
      updatedAt: new Date(),
    })
    .where(eq(shipments.id, shipmentId))
    .returning();
  return updated!;
}

export async function registerPttShipment(vendorId: number, shipmentId: number, packageOverride?: PttPackage) {
  const client = configuredClient();
  const existing = await loadShipment(vendorId, shipmentId);
  validateAddress(existing);
  if (existing.shipment.provider === "ptt" && ["registered", "tracking", "delivered"].includes(existing.shipment.providerStatus)) {
    return publicShipment(existing.shipment);
  }
  if (isPendingStatus(existing.shipment.providerStatus)) {
    throw new PttShipmentBusyError("PTT kaydının sonucu uzlaştırılıyor; yeni kayıt gönderilmedi");
  }

  const packageData = packageOverride ?? await derivePackage(shipmentId);
  if (!packageData?.weightGrams) {
    throw new PttShipmentValidationError("Ürün ağırlığı eksik. Ürüne gram bilgisi girin veya paket ağırlığını belirtin.");
  }
  const reference = existing.shipment.providerReference ?? pttReference(shipmentId);
  const fileName = uniqueFileName(shipmentId);
  const [claimed] = await db
    .update(shipments)
    .set({
      provider: "ptt",
      providerStatus: "registering",
      providerReference: reference,
      providerFileName: fileName,
      providerLastError: null,
      providerAttemptCount: existing.shipment.providerAttemptCount + 1,
      updatedAt: new Date(),
    })
    .where(and(
      eq(shipments.id, shipmentId),
      eq(shipments.vendorId, vendorId),
      inArray(shipments.providerStatus, ["not_registered", "registration_failed"]),
    ))
    .returning();
  if (!claimed) throw new PttShipmentBusyError("Gönderi başka bir işlem tarafından kaydediliyor");

  try {
    const registration = await client.registerShipment({
      fileName,
      reference,
      recipient: {
        name: existing.shipment.recipientName,
        phone: existing.shipment.recipientPhone,
        email: existing.customerEmail,
        city: existing.shipment.recipientCity,
        district: existing.shipment.recipientDistrict,
        address: existing.shipment.recipientAddressLine,
        postalCode: existing.shipment.recipientZipCode ?? undefined,
      },
      sender: {
        name: existing.shipment.senderName!,
        phone: existing.shipment.senderPhone!,
        email: existing.vendorEmail,
        city: existing.shipment.senderCity!,
        district: existing.shipment.senderDistrict!,
        address: existing.shipment.senderAddressLine!,
      },
      package: packageData,
    });

    const updated = await db.transaction(async (tx) => {
      const [shipment] = await tx
        .update(shipments)
        .set({
          carrierName: "PTT Kargo",
          ...(registration.barcode ? { trackingNumber: registration.barcode } : {}),
          providerStatus: "registered",
          providerLastError: null,
          providerRegisteredAt: new Date(),
          providerLastCheckedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(shipments.id, shipmentId), eq(shipments.providerStatus, "registering")))
        .returning();
      if (!shipment) throw new PttShipmentBusyError("PTT sonucu kaydedilirken gönderi durumu değişti");
      if (registration.barcode) {
        await tx
          .update(orderItems)
          .set({ trackingCarrier: "PTT Kargo", trackingNumber: registration.barcode })
          .where(eq(orderItems.shipmentId, shipmentId));
      }
      return shipment;
    });
    return publicShipment(updated);
  } catch (error) {
    const pttError = error instanceof PttError ? error : new PttError("PTT kaydı tamamlanamadı", "PTT_UNKNOWN", true, true);
    await db
      .update(shipments)
      .set({
        providerStatus: pttError.unknownOutcome ? "registration_pending" : "registration_failed",
        providerLastError: `${pttError.code}: ${pttError.message}`.slice(0, 500),
        updatedAt: new Date(),
      })
      .where(and(eq(shipments.id, shipmentId), eq(shipments.providerStatus, "registering")));
    throw pttError;
  }
}

export async function refreshPttShipment(vendorId: number, shipmentId: number) {
  const existing = await loadShipment(vendorId, shipmentId);
  if (existing.shipment.provider !== "ptt" || !existing.shipment.providerReference) {
    throw new PttShipmentValidationError("Bu gönderi henüz PTT'ye kaydedilmemiş");
  }
  const client = configuredClient();
  const result = existing.shipment.trackingNumber
    ? await client.trackByBarcode(existing.shipment.trackingNumber)
    : await client.trackByReference(existing.shipment.providerReference);
  if (!result.found) {
    await db.update(shipments).set({ providerLastCheckedAt: new Date(), updatedAt: new Date() }).where(eq(shipments.id, shipmentId));
    if (existing.shipment.providerStatus === "registration_pending") {
      throw new PttShipmentBusyError("PTT kaydı henüz sorguda görünmüyor; çift kayıt oluşturmamak için bekleniyor");
    }
    return publicShipment(existing.shipment);
  }
  const updated = await saveTracking(shipmentId, result);
  if (result.barcode) {
    await db.update(orderItems).set({ trackingCarrier: "PTT Kargo", trackingNumber: result.barcode }).where(eq(orderItems.shipmentId, shipmentId));
  }
  return publicShipment(updated);
}

// Scheduler doğrudan vendor yetkisi kullanmaz; yalnız daha önce PTT'ye
// kaydedilmiş shipment'ları sınırlı batch ile sorgular. Bir kaydın hatası
// diğerlerini durdurmaz ve hiçbir zaman kabulEkle2'yi otomatik tekrarlamaz.
export async function pollPttTrackingBatch(limit = 25): Promise<{ checked: number; failed: number }> {
  if (!env.PTT_CUSTOMER_ID || !env.PTT_PASSWORD) return { checked: 0, failed: 0 };
  const candidates = await db
    .select({ id: shipments.id, vendorId: shipments.vendorId })
    .from(shipments)
    .where(and(
      eq(shipments.provider, "ptt"),
      isNotNull(shipments.providerReference),
      inArray(shipments.providerStatus, ["registration_pending", "registered", "tracking"]),
    ))
    .orderBy(asc(shipments.providerLastCheckedAt), asc(shipments.id))
    .limit(limit);
  let failed = 0;
  for (const candidate of candidates) {
    try {
      await refreshPttShipment(candidate.vendorId, candidate.id);
    } catch {
      failed += 1;
    }
  }
  return { checked: candidates.length, failed };
}
