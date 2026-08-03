import { and, asc, desc, count, eq, inArray } from "drizzle-orm";
import { db } from "../../db/client";
import { customers, orderItems, orderRefunds, orders, productImages, products, productVariants } from "../../db/schema/index";
import { recomputeOrderStatus, restoreOrderItemStockSingle } from "../orders/order.repository";
import { createCustomerNotification } from "../notifications/customer-notifications.repository";

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
// bkz. kullanıcı isteği: "ürün resmi ve daha çok detay ekle satıcı ne
// hazırlayacağını direkt görsün" - satıcının hangi ürünü/bedeni/rengi
// hazırlaması gerektiğini listede AÇMADAN görebilmesi için varyant
// (beden/renk) ve ürün görseli eklendi. Görsel N+1 alt sorgu yerine
// catalog.repository.ts attachPrimaryImages ile AYNI toplu-sorgu deseniyle
// çekiliyor (o yardımcı productId'yi "id" bekliyor, burada satır id'si
// sipariş kalemi olduğu için doğrudan kullanılamıyor, aynı desen elle tekrarlanır).
export async function listVendorOrderItems(vendorId: number) {
  const rows = await db
    .select({
      id: orderItems.id,
      orderId: orderItems.orderId,
      orderNumber: orders.orderNumber,
      productId: orderItems.productId,
      productNameSnapshot: orderItems.productNameSnapshot,
      variantSize: productVariants.size,
      variantColor: productVariants.color,
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
    .leftJoin(productVariants, eq(orderItems.variantId, productVariants.id))
    .where(and(eq(orderItems.vendorId, vendorId), eq(orders.paymentStatus, "paid")))
    .orderBy(desc(orders.createdAt));

  if (rows.length === 0) return [];
  const productIds = [...new Set(rows.map((r) => r.productId))];
  const images = await db
    .select({ productId: productImages.productId, url: productImages.url })
    .from(productImages)
    .where(inArray(productImages.productId, productIds))
    .orderBy(desc(productImages.isPrimary), asc(productImages.sortOrder));
  const imageByProductId = new Map<number, string>();
  for (const img of images) {
    if (!imageByProductId.has(img.productId)) imageByProductId.set(img.productId, img.url);
  }
  return rows.map((row) => ({ ...row, productImageUrl: imageByProductId.get(row.productId) ?? null }));
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
      orderNumber: orders.orderNumber,
      customerId: orders.customerId,
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
      // bkz. kullanıcı isteği: "ürünlerin resimleri de olsun" - kargo
      // durumu e-postalarında da ürün görseli gösterilir.
      productSlug: products.slug,
      productImage: productImages.url,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .leftJoin(products, eq(orderItems.productId, products.id))
    .leftJoin(productImages, and(eq(productImages.productId, orderItems.productId), eq(productImages.isPrimary, true)))
    .where(and(eq(orderItems.id, orderItemId), eq(orderItems.vendorId, vendorId), eq(orders.paymentStatus, "paid")))
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
  if (row) {
    await createCustomerNotification(
      row.customerId,
      decision === "approved" ? "refund_approved" : "refund_rejected",
      decision === "approved" ? "İade Talebiniz Onaylandı" : "İade Talebiniz Reddedildi",
      decision === "approved"
        ? "Satıcı iade talebinizi onayladı. Ürünü kargolayıp takip numarasını girmeyi unutmayın."
        : vendorNote || "Satıcı iade talebinizi reddetti.",
      "/hesabim/siparisler",
    );
  }
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
