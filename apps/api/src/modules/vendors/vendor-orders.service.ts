import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { orderItems, vendorEarnings, vendors } from "../../db/schema/index";
import { env } from "../../config/env";
import { emailButton, emailHeading, emailProductRow, renderEmailLayout, sendMail } from "../../lib/mailer";
import { recomputeOrderStatus } from "../orders/order.repository";
import { syncShipmentAfterItemStatusChange } from "../orders/shipment.repository";
import { findCustomerById } from "../auth/auth.repository";
import { createCustomerNotification } from "../notifications/customer-notifications.repository";
import { findVendorOrderItem, updateVendorOrderItemStatus } from "./vendor-orders.repository";
import { DEFAULT_COMMISSION_RATE } from "./commission";

// bkz. kullanıcı isteği: "kargo ... gibi mailler gönderelim" - uygulama içi
// bildirime (createCustomerNotification) ek olarak e-posta da gider.
// E-posta başarısız olursa durum güncellemesini asla bozmaz, sadece
// sessizce loglanır (yutulur) - kargo durumu değişikliği e-postadan daha
// önemli, bir Resend hatası yüzünden geri alınmamalı.
async function sendOrderStatusEmail(customerId: number, subject: string, preheader: string, bodyHtml: string) {
  const customer = await findCustomerById(customerId);
  if (!customer) return;
  await sendMail(customer.email, subject, renderEmailLayout(preheader, bodyHtml)).catch(() => {});
}

export type OrderItemStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";
type Status = OrderItemStatus;

// Sadece ileri yönde ve tek adımlık geçişlere izin verilir - "shipped"
// durumundaki bir kalem doğrudan "pending"e dönemez ya da "delivered"i
// atlayamaz. Kargoya verilmiş/teslim edilmiş bir kalem iptal edilemez.
const ALLOWED_TRANSITIONS: Record<Status, Status[]> = {
  pending: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

export function isTransitionAllowed(current: OrderItemStatus, next: OrderItemStatus): boolean {
  return ALLOWED_TRANSITIONS[current].includes(next);
}

export function calculateEarning(total: string, commissionRatePercent: number | null) {
  const rate = commissionRatePercent ?? DEFAULT_COMMISSION_RATE;
  const grossCents = Math.round(Number(total) * 100);
  const commissionCents = Math.round(grossCents * rate / 100);
  const netCents = grossCents - commissionCents;
  return {
    grossAmount: (grossCents / 100).toFixed(2),
    commissionAmount: (commissionCents / 100).toFixed(2),
    netAmount: (netCents / 100).toFixed(2),
  };
}

export class OrderItemNotFoundError extends Error {}
export class InvalidStatusTransitionError extends Error {}

export class MissingTrackingInfoError extends Error {}

export async function transitionOrderItemStatus(
  vendorId: number,
  orderItemId: number,
  nextStatus: Status,
  tracking?: { carrier: string; number: string },
) {
  const item = await findVendorOrderItem(vendorId, orderItemId);
  if (!item) throw new OrderItemNotFoundError();

  if (!isTransitionAllowed(item.vendorStatus as Status, nextStatus)) {
    throw new InvalidStatusTransitionError(`"${item.vendorStatus}" durumundan "${nextStatus}" durumuna geçilemez`);
  }

  // bkz. kullanıcı isteği: "satıcı takip kodunu sisteme girecek" - zod
  // şeması (vendor-orders.schemas.ts) bunu HTTP gövdesi seviyesinde zaten
  // zorunlu kılıyor, burdaki kontrol servis fonksiyonunun doğrudan
  // çağrıldığı (ör. test) durumlar için ikinci bir güvenlik katmanı.
  if (nextStatus === "shipped" && (!tracking?.carrier || !tracking?.number)) {
    throw new MissingTrackingInfoError();
  }

  if (nextStatus === "delivered") {
    const updated = await markDeliveredAndCreditEarning(vendorId, item.id, item.orderId, item.total);
    await createCustomerNotification(
      item.customerId,
      "order_delivered",
      "Siparişiniz Teslim Edildi",
      `#${item.orderNumber} numaralı siparişinizdeki "${item.productNameSnapshot}" teslim edildi olarak işaretlendi.`,
      `/hesabim/siparisler/${item.orderNumber}`,
    );
    const trackHref = `${env.SITE_URL}/hesabim/siparisler/${item.orderNumber}`;
    await sendOrderStatusEmail(
      item.customerId,
      `Siparişiniz Teslim Edildi - #${item.orderNumber}`,
      `Siparişiniz teslim edildi - #${item.orderNumber}`,
      emailHeading("Siparişiniz Teslim Edildi ✅") +
        `<p>#${item.orderNumber} numaralı siparişinizdeki ürün teslim edildi olarak işaretlendi:</p>` +
        emailProductRow({
          image: item.productImage,
          name: item.productNameSnapshot,
          meta: `${item.quantity} adet`,
          priceHtml: `<strong>${Number(item.total).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</strong>`,
          href: item.productSlug ? `/urun/${item.productSlug}` : undefined,
        }) +
        `<p>Bir sorun varsa sipariş sayfanızdan iade talebi oluşturabilirsiniz.</p>` +
        emailButton(trackHref, "Siparişimi Görüntüle"),
    );
    return updated;
  }

  const updated = await updateVendorOrderItemStatus(
    vendorId,
    orderItemId,
    item.vendorStatus as "pending" | "processing",
    nextStatus as Exclude<Status, "pending">,
    tracking,
  );
  if (!updated) throw new InvalidStatusTransitionError("Sipariş kalemi başka bir işlem tarafından güncellendi");
  if (updated && nextStatus === "shipped") {
    await createCustomerNotification(
      item.customerId,
      "order_shipped",
      "Siparişiniz Kargoya Verildi",
      `#${item.orderNumber} numaralı siparişinizdeki "${item.productNameSnapshot}" kargoya verildi.${tracking ? ` Takip no: ${tracking.number}` : ""}`,
      `/hesabim/siparisler/${item.orderNumber}`,
    );
    const trackHref = `${env.SITE_URL}/hesabim/siparisler/${item.orderNumber}`;
    await sendOrderStatusEmail(
      item.customerId,
      `Siparişiniz Kargoya Verildi - #${item.orderNumber}`,
      `Siparişiniz kargoya verildi - #${item.orderNumber}`,
      emailHeading("Siparişiniz Kargoya Verildi 📦") +
        `<p>#${item.orderNumber} numaralı siparişinizdeki ürün kargoya verildi:</p>` +
        emailProductRow({
          image: item.productImage,
          name: item.productNameSnapshot,
          meta: `${item.quantity} adet`,
          priceHtml: `<strong>${Number(item.total).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</strong>`,
          href: item.productSlug ? `/urun/${item.productSlug}` : undefined,
        }) +
        (tracking ? `<p>Kargo Firması: <strong>${tracking.carrier}</strong><br>Takip No: <strong>${tracking.number}</strong></p>` : "") +
        emailButton(trackHref, "Siparişimi Takip Et"),
    );
  }
  return updated;
}

// Kazanç, teslimat onaylandığı anda cüzdana geçer (iade/anlaşmazlık riskini
// azaltmak için ödeme anında değil) - kalem durumu, kazanç kaydı, cüzdan
// bakiyesi güncellemesi ve genel sipariş durumunun yeniden hesaplanması
// (bkz. order.repository.ts recomputeOrderStatus) tek transaction'da,
// ya hep ya hiç yazılır. vendor_earnings.order_item_id UNIQUE olduğu için
// aynı kalem yanlışlıkla iki kez "delivered"a alınsa bile çifte kazanç
// kredisi imkansızdır.
async function markDeliveredAndCreditEarning(vendorId: number, orderItemId: number, orderId: number, total: string) {
  return db.transaction(async (tx) => {
    const [updatedItem] = await tx
      .update(orderItems)
      .set({ vendorStatus: "delivered" })
      .where(and(eq(orderItems.id, orderItemId), eq(orderItems.vendorId, vendorId), eq(orderItems.vendorStatus, "shipped")))
      .returning();
    if (!updatedItem) throw new InvalidStatusTransitionError("Sipariş kalemi başka bir işlem tarafından güncellendi");

    const [vendor] = await tx
      .select({ commissionRate: vendors.commissionRate })
      .from(vendors)
      .where(eq(vendors.id, vendorId))
      .limit(1);
    const rate = vendor?.commissionRate !== null && vendor?.commissionRate !== undefined
      ? Number(vendor.commissionRate)
      : null;
    const earning = calculateEarning(total, rate);

    await tx.insert(vendorEarnings).values({ orderItemId, vendorId, ...earning });

    await tx
      .update(vendors)
      .set({ walletBalance: sql`${vendors.walletBalance} + ${earning.netAmount}` })
      .where(eq(vendors.id, vendorId));

    await recomputeOrderStatus(tx, orderId);
    // bkz. kargo/PTT denetim raporu Faz 2 (2026-09-10) bölüm 11: kalem
    // teslim edildiğinde bağlı Shipment'ı da senkronize et (tüm kalemleri
    // teslim edilince Shipment de "delivered" olur, bkz. shipment.repository.ts
    // recomputeShipmentStatus).
    await syncShipmentAfterItemStatusChange(tx, updatedItem.shipmentId, "delivered");

    return updatedItem;
  });
}
