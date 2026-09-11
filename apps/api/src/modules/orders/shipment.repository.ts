import { eq, inArray } from "drizzle-orm";
import { db } from "../../db/client";
import { orderItems, shipments, vendors } from "../../db/schema/index";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface RecipientSnapshot {
  fullName: string;
  phone: string;
  city: string;
  district: string;
  addressLine: string;
  zipCode?: string;
}

// bkz. kargo/PTT denetim raporu Faz 2 (2026-09-10): markOrderPaid() ödeme
// onayını (pending->paid) tamamladığı AYNI transaction'da çağrılır - Shipment
// bu yüzden yalnızca GERÇEKTEN ödenmiş siparişler için oluşur, checkout'u
// yarıda bırakan/ödemesi başarısız olan denemeler için asla oluşmaz.
// markOrderPaid zaten "WHERE paymentStatus = 'pending'" koşuluyla tek
// seferlik çalışmayı garanti ediyor - bu fonksiyon o garantiyi miras alır,
// ayrıca idempotency kontrolü YAPMAZ (uniq_shipments_order_vendor DB kısıtı
// defense-in-depth olarak yeterli, bkz. onConflictDoNothing aşağıda).
//
// "100 satıcı = 100 shipment" senaryosu için: burada satıcı sayısı kadar
// (N) INSERT + N UPDATE çalışır - kalem sayısı kadar (item-level N+1) DEĞİL.
// Gerçekçi siparişlerde satıcı sayısı çok düşük olduğu için toplu tek
// INSERT'e (ve RETURNING sırasına güvenmeye) gerek görülmedi - kod açık ve
// doğruluğu kolay denetlenebilir kalsın diye bilinçli bir tercih.
export async function createShipmentsForOrder(
  tx: Tx,
  orderId: number,
  recipient: RecipientSnapshot,
): Promise<void> {
  const items = await tx
    .select({ id: orderItems.id, vendorId: orderItems.vendorId })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));
  if (items.length === 0) return;

  const vendorIds = [...new Set(items.map((item) => item.vendorId))];
  const vendorProfiles = await tx
    .select({
      id: vendors.id,
      shippingContactName: vendors.shippingContactName,
      shippingContactPhone: vendors.shippingContactPhone,
      shippingCity: vendors.shippingCity,
      shippingDistrict: vendors.shippingDistrict,
      shippingAddressLine: vendors.shippingAddressLine,
    })
    .from(vendors)
    .where(inArray(vendors.id, vendorIds));
  const profileByVendorId = new Map(vendorProfiles.map((profile) => [profile.id, profile]));

  for (const vendorId of vendorIds) {
    const vendorItemIds = items.filter((item) => item.vendorId === vendorId).map((item) => item.id);
    if (vendorItemIds.length === 0) continue;

    // Satıcı henüz Faz 1'deki kargo gönderim profilini doldurmamış olabilir
    // (nullable alanlar) - bu, shipment oluşturmayı ASLA engellemez, sender
    // alanları sadece boş kalır (best-effort anlık görüntü).
    const profile = profileByVendorId.get(vendorId);
    const [shipment] = await tx
      .insert(shipments)
      .values({
        orderId,
        vendorId,
        senderName: profile?.shippingContactName ?? undefined,
        senderPhone: profile?.shippingContactPhone ?? undefined,
        senderCity: profile?.shippingCity ?? undefined,
        senderDistrict: profile?.shippingDistrict ?? undefined,
        senderAddressLine: profile?.shippingAddressLine ?? undefined,
        recipientName: recipient.fullName,
        recipientPhone: recipient.phone,
        recipientCity: recipient.city,
        recipientDistrict: recipient.district,
        recipientAddressLine: recipient.addressLine,
        recipientZipCode: recipient.zipCode,
      })
      .onConflictDoNothing({ target: [shipments.orderId, shipments.vendorId] })
      .returning({ id: shipments.id });

    // onConflictDoNothing tetiklendiyse (bu (order,vendor) için shipment
    // zaten var - normal akışta olmaz, bkz. yukarıdaki yorum) hiçbir satır
    // dönmez - bu kalemler zaten ilk çağrıda doğru shipmentId'yi almıştır,
    // burada dokunmadan atlanır.
    if (!shipment) continue;
    await tx.update(orderItems).set({ shipmentId: shipment.id }).where(inArray(orderItems.id, vendorItemIds));
  }
}

// recomputeOrderStatus (order.repository.ts) ile BİREBİR AYNI desen, sadece
// orderId yerine shipmentId ile kapsam daraltılmış. Yeni bir durum-hesaplama
// mimarisi icat etmek yerine kanıtlanmış deseni tekrarlar.
async function recomputeShipmentStatus(tx: Tx, shipmentId: number): Promise<void> {
  const items = await tx.select({ vendorStatus: orderItems.vendorStatus }).from(orderItems).where(eq(orderItems.shipmentId, shipmentId));
  const relevant = items.filter((item) => item.vendorStatus !== "cancelled");

  let nextStatus: "created" | "shipped" | "delivered" | "cancelled";
  if (relevant.length === 0) {
    nextStatus = "cancelled";
  } else if (relevant.every((item) => item.vendorStatus === "delivered")) {
    nextStatus = "delivered";
  } else if (relevant.every((item) => item.vendorStatus === "shipped" || item.vendorStatus === "delivered")) {
    nextStatus = "shipped";
  } else {
    nextStatus = "created";
  }

  await tx
    .update(shipments)
    .set({
      status: nextStatus,
      updatedAt: new Date(),
      ...(nextStatus === "delivered" ? { deliveredAt: new Date() } : {}),
    })
    .where(eq(shipments.id, shipmentId));
}

// bkz. kargo/PTT denetim raporu Faz 2 (2026-09-10) bölüm 11: satıcı panelinde
// bir kalem "shipped" olarak işaretlenip takip bilgisi girildiğinde, bağlı
// Shipment'ın carrier/tracking alanları da senkronize edilir - ESKİ
// (order_items.trackingCarrier/trackingNumber) davranış BOZULMAZ, sadece
// üzerine bu ek senkronizasyon eklenir. Aynı shipment'taki birden fazla
// kalem farklı zamanlarda/farklı takip bilgisiyle kargolanırsa (bugünkü UI
// bunu engellemiyor), shipment üzerindeki bilgi EN SON girilen kalemi
// yansıtır ("son yazan kazanır") - bilinen, kabul edilmiş bir MVP sınırlaması.
export async function syncShipmentAfterItemStatusChange(
  tx: Tx,
  shipmentId: number | null,
  itemStatus: "shipped" | "delivered" | "cancelled",
  tracking?: { carrier: string; number: string },
): Promise<void> {
  if (!shipmentId) return;
  if (itemStatus === "shipped" && tracking) {
    await tx
      .update(shipments)
      .set({ carrierName: tracking.carrier, trackingNumber: tracking.number, shippedAt: new Date(), updatedAt: new Date() })
      .where(eq(shipments.id, shipmentId));
  }
  await recomputeShipmentStatus(tx, shipmentId);
}
