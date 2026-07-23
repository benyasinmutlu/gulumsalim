import { and, count, desc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { customers, orderItems, orderRefunds, orders } from "../../db/schema/index";

// Sidebar'daki "Siparişler" rozeti için - eski sitede bu sayaç vardı,
// yeni panelde hiç kullanılmıyordu (bkz. re-audit bulgusu).
export async function countPendingVendorOrders(vendorId: number) {
  const [row] = await db
    .select({ count: count() })
    .from(orderItems)
    .where(and(eq(orderItems.vendorId, vendorId), eq(orderItems.vendorStatus, "pending")));
  return row?.count ?? 0;
}

// Sadece ödemesi tamamlanmış siparişler satıcıya gösterilir - henüz
// ödenmemiş/başarısız bir sipariş için kargolama beklentisi oluşmamalı.
// vendor/order-detail.php'nin karşılığı - ayrı bir sayfa yerine, satıcı
// paneli listesindeki her satırın açılıp kapanan detay bölümünde
// gösterilecek teslimat adresi/müşteri iletişim/sipariş notu bilgileri.
export async function listVendorOrderItems(vendorId: number) {
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
      orderCreatedAt: orders.createdAt,
      shippingAddress: orders.shippingAddress,
      orderNote: orders.orderNote,
      customerEmail: customers.email,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(and(eq(orderItems.vendorId, vendorId), eq(orders.paymentStatus, "paid")))
    .orderBy(desc(orders.createdAt));
}

export async function findVendorOrderItem(vendorId: number, orderItemId: number) {
  const [row] = await db
    .select()
    .from(orderItems)
    .where(and(eq(orderItems.id, orderItemId), eq(orderItems.vendorId, vendorId)))
    .limit(1);
  return row ?? null;
}

// Satıcı, bir sipariş kalemi için iade talebi açar (ör. müşteri kargoda
// hasarlı ürün bildirdi) - onay/red kararını admin verir (bkz.
// admin-refunds.repository.ts).
export async function createRefundRequest(vendorId: number, orderItemId: number, reason: string) {
  const [item] = await db
    .select({ orderId: orderItems.orderId })
    .from(orderItems)
    .where(and(eq(orderItems.id, orderItemId), eq(orderItems.vendorId, vendorId)))
    .limit(1);
  if (!item) return null;

  const [order] = await db.select({ customerId: orders.customerId }).from(orders).where(eq(orders.id, item.orderId)).limit(1);
  if (!order) return null;

  const [row] = await db
    .insert(orderRefunds)
    .values({ orderItemId, vendorId, customerId: order.customerId, reason })
    .returning();
  return row;
}

export async function listVendorRefunds(vendorId: number) {
  return db
    .select()
    .from(orderRefunds)
    .where(eq(orderRefunds.vendorId, vendorId))
    .orderBy(desc(orderRefunds.requestedAt));
}

export async function updateVendorOrderItemStatus(
  vendorId: number,
  orderItemId: number,
  status: "processing" | "shipped" | "delivered" | "cancelled",
) {
  const [row] = await db
    .update(orderItems)
    .set({ vendorStatus: status })
    .where(and(eq(orderItems.id, orderItemId), eq(orderItems.vendorId, vendorId)))
    .returning();
  return row ?? null;
}
