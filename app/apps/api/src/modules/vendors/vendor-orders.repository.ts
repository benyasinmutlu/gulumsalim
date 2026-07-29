import { and, asc, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { db } from "../../db/client";
import { customers, orderItems, orderRefunds, orders } from "../../db/schema/index";
import { recomputeOrderStatus, restoreOrderItemStockSingle } from "../orders/order.repository";
import type { OrderListQuery } from "./vendor-orders.schemas";

// Sidebar'daki "Siparişler" rozeti için - eski sitede bu sayaç vardı,
// yeni panelde hiç kullanılmıyordu (bkz. re-audit bulgusu). Aşağıdaki
// listVendorOrderItems ile AYNI paymentStatus='paid' filtresini kullanır -
// aksi halde rozet hiç ödenmemiş siparişleri de sayıp satıcıya "2 bekleyen
// sipariş" gösterirken tıklayınca liste boş çıkıyordu (bkz. kullanıcı
// geri bildirimi: "hep 2 diyor tıklıyorum bir şey yok").
export async function countPendingVendorOrders(vendorId: number) {
  const [row] = await db
    .select({ count: count() })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(and(eq(orderItems.vendorId, vendorId), eq(orderItems.vendorStatus, "pending"), eq(orders.paymentStatus, "paid")));
  return row?.count ?? 0;
}

// Sadece ödemesi tamamlanmış siparişler satıcıya gösterilir - henüz
// ödenmemiş/başarısız bir sipariş için kargolama beklentisi oluşmamalı.
// vendor/order-detail.php'nin karşılığı - ayrı bir sayfa yerine, satıcı
// paneli listesindeki her satırın açılıp kapanan detay bölümünde
// gösterilecek teslimat adresi/müşteri iletişim/sipariş notu bilgileri.
export type VendorOrderItemRow = Awaited<ReturnType<typeof listVendorOrderItems>>[number];

// bkz. kullanıcı isteği: "filtreleme ve analiz" - liste artık durum + arama
// (sipariş no / ürün / müşteri e-postası) ile filtrelenip tarihe göre
// sıralanabilir. Filtre verilmezse eski davranış (en yeni, tüm paid kalemler).
export async function listVendorOrderItems(vendorId: number, filter: OrderListQuery = { sort: "newest" }) {
  const conditions: SQL[] = [eq(orderItems.vendorId, vendorId), eq(orders.paymentStatus, "paid")];
  if (filter.status) conditions.push(eq(orderItems.vendorStatus, filter.status));
  if (filter.search) {
    const q = `%${filter.search}%`;
    const searchMatch = or(
      ilike(orders.orderNumber, q),
      ilike(orderItems.productNameSnapshot, q),
      ilike(customers.email, q),
    );
    if (searchMatch) conditions.push(searchMatch);
  }

  return db
    .select({
      id: orderItems.id,
      orderId: orderItems.orderId,
      orderNumber: orders.orderNumber,
      productId: orderItems.productId,
      productNameSnapshot: orderItems.productNameSnapshot,
      unitPrice: orderItems.unitPrice,
      quantity: orderItems.quantity,
      total: orderItems.total,
      vendorStatus: orderItems.vendorStatus,
      trackingCarrier: orderItems.trackingCarrier,
      trackingNumber: orderItems.trackingNumber,
      shippedAt: orderItems.shippedAt,
      orderCreatedAt: orders.createdAt,
      shippingAddress: orders.shippingAddress,
      orderNote: orders.orderNote,
      customerEmail: customers.email,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(and(...conditions))
    .orderBy(filter.sort === "oldest" ? asc(orders.createdAt) : desc(orders.createdAt));
}

// listVendorOrderItems ile AYNI paymentStatus='paid' şartı - önceki
// denetimde bu fonksiyonun ödeme durumunu HİÇ kontrol etmediği, bu yüzden
// satıcının (ya da orderItemId'yi bilen herhangi birinin) hiç ödenmemiş bir
// siparişin kalemini "shipped"/"delivered"a geçirebildiği tespit edildi -
// gerçekte bu, eski (artık kaldırılan) admin panelin doğrudan durum
// değiştirme özelliğiyle oluşmuş, orders.status ile order_items.vendorStatus
// tutarsız kalmış siparişlere yol açmıştı (bkz. re-audit bulgusu).
export async function findVendorOrderItem(vendorId: number, orderItemId: number) {
  const [row] = await db
    .select({
      id: orderItems.id,
      orderId: orderItems.orderId,
      vendorId: orderItems.vendorId,
      productId: orderItems.productId,
      variantId: orderItems.variantId,
      productNameSnapshot: orderItems.productNameSnapshot,
      unitPrice: orderItems.unitPrice,
      quantity: orderItems.quantity,
      total: orderItems.total,
      vendorStatus: orderItems.vendorStatus,
      trackingCarrier: orderItems.trackingCarrier,
      trackingNumber: orderItems.trackingNumber,
      shippedAt: orderItems.shippedAt,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(and(eq(orderItems.id, orderItemId), eq(orderItems.vendorId, vendorId), eq(orders.paymentStatus, "paid")))
    .limit(1);
  return row ?? null;
}

// Kargo takip e-postası (bkz. lib/emails/shipping-notification.ts) için
// gereken minimum veri. Kalem "shipped"a geçtikten SONRA route katmanında
// best-effort çağrılır. orders.customerId NOT NULL (misafir siparişi de bir
// müşteri kaydı oluşturur) - bu yüzden customers.email tüm siparişleri kapsar.
export async function getShippedItemNotificationData(orderItemId: number) {
  const [row] = await db
    .select({
      customerEmail: customers.email,
      orderNumber: orders.orderNumber,
      productNameSnapshot: orderItems.productNameSnapshot,
      quantity: orderItems.quantity,
      trackingCarrier: orderItems.trackingCarrier,
      trackingNumber: orderItems.trackingNumber,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(eq(orderItems.id, orderItemId))
    .limit(1);
  return row ?? null;
}

export class RefundNotFoundError extends Error {}
export class InvalidRefundStateError extends Error {}

export async function listVendorRefunds(vendorId: number) {
  return db
    .select({
      id: orderRefunds.id,
      orderItemId: orderRefunds.orderItemId,
      reason: orderRefunds.reason,
      photos: orderRefunds.photos,
      status: orderRefunds.status,
      vendorNote: orderRefunds.vendorNote,
      returnTrackingCarrier: orderRefunds.returnTrackingCarrier,
      returnTrackingNumber: orderRefunds.returnTrackingNumber,
      returnShippedAt: orderRefunds.returnShippedAt,
      receivedByVendorAt: orderRefunds.receivedByVendorAt,
      refundedAt: orderRefunds.refundedAt,
      requestedAt: orderRefunds.requestedAt,
      productNameSnapshot: orderItems.productNameSnapshot,
      orderNumber: orders.orderNumber,
      customerEmail: customers.email,
    })
    .from(orderRefunds)
    .innerJoin(orderItems, eq(orderRefunds.orderItemId, orderItems.id))
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(customers, eq(orderRefunds.customerId, customers.id))
    .where(eq(orderRefunds.vendorId, vendorId))
    .orderBy(desc(orderRefunds.requestedAt));
}

// bkz. kullanıcı isteği: "iadeyi onaylarsa satıcı" - onay/red kararı
// satıcıya ait, admin'in rolü sadece nihai parasal iadeyi yapmak
// (bkz. admin-refunds.repository.ts releaseRefund).
export async function decideVendorRefund(
  vendorId: number,
  refundId: number,
  decision: "approved" | "rejected",
  vendorNote?: string,
) {
  const [refund] = await db
    .select({ status: orderRefunds.status })
    .from(orderRefunds)
    .where(and(eq(orderRefunds.id, refundId), eq(orderRefunds.vendorId, vendorId)))
    .limit(1);
  if (!refund) throw new RefundNotFoundError();
  if (refund.status !== "pending") throw new InvalidRefundStateError();

  const [row] = await db
    .update(orderRefunds)
    .set({ status: decision, vendorNote, processedAt: new Date() })
    .where(eq(orderRefunds.id, refundId))
    .returning();
  return row ?? null;
}

// bkz. kullanıcı isteği: "ürün satıcının eline geçtiğinde satıcı panelden
// ürününü aldığını belirtiyor" - müşterinin girdiği kargo takip kodunu
// (bkz. customer-refunds.repository.ts submitReturnTracking) zorunlu
// KILMAZ: satıcı elindeki ürünü fiziksel olarak görüp onaylayan taraf,
// takip kodu girilmemiş olsa bile teslim aldığını işaretleyebilmeli.
export async function markRefundReceivedByVendor(vendorId: number, refundId: number) {
  const [refund] = await db
    .select({ status: orderRefunds.status })
    .from(orderRefunds)
    .where(and(eq(orderRefunds.id, refundId), eq(orderRefunds.vendorId, vendorId)))
    .limit(1);
  if (!refund) throw new RefundNotFoundError();
  if (refund.status !== "approved") throw new InvalidRefundStateError();

  const [row] = await db
    .update(orderRefunds)
    .set({ status: "item_received", receivedByVendorAt: new Date() })
    .where(eq(orderRefunds.id, refundId))
    .returning();
  return row ?? null;
}

// bkz. kullanıcı isteği: "satıcı takip kodunu sisteme girecek hem müşteri
// hem de admin görebilecek" - kalem güncellemesi + genel sipariş
// durumunun yeniden hesaplanması (bkz. order.repository.ts
// recomputeOrderStatus) tek transaction'da, ya hep ya hiç.
export async function updateVendorOrderItemStatus(
  vendorId: number,
  orderItemId: number,
  status: "processing" | "shipped" | "delivered" | "cancelled",
  tracking?: { carrier: string; number: string },
) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(orderItems)
      .set({
        vendorStatus: status,
        ...(status === "shipped" && tracking
          ? { trackingCarrier: tracking.carrier, trackingNumber: tracking.number, shippedAt: new Date() }
          : {}),
      })
      .where(and(eq(orderItems.id, orderItemId), eq(orderItems.vendorId, vendorId)))
      .returning();
    if (!row) return null;
    // bkz. kullanıcı isteği: "iptal ederse ... satıcının ürününü koruyoruz" -
    // satıcı stok fazlasını elinde tutmasın diye, ürün hiç kargolanmadan
    // iptal edildiğinde stok o an geri yüklenir (bkz. restoreOrderItemStockSingle
    // yorumu - sadece BU kalem, siparişteki diğer satıcı kalemleri etkilenmez).
    if (status === "cancelled") {
      await restoreOrderItemStockSingle(tx, orderItemId);
    }
    await recomputeOrderStatus(tx, row.orderId);
    return row;
  });
}
