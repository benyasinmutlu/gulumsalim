import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { orderItems, orders } from "../../db/schema/index";

// Sadece ödemesi tamamlanmış siparişler satıcıya gösterilir - henüz
// ödenmemiş/başarısız bir sipariş için kargolama beklentisi oluşmamalı.
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
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
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
