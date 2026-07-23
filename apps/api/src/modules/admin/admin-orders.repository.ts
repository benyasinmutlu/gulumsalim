import { desc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { customers, orderItems, orders, products, vendors } from "../../db/schema/index";
import { restoreOrderItemStock } from "../orders/order.repository";

export type AdminOrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";

// gulumsalim.com'daki orders.php/order-detail.php'deki durum dropdown'ının
// karşılığı - satıcının kendi order_items.vendorStatus geçişinden (bkz.
// vendor-orders.service.ts) ayrı, genel sipariş seviyesinde. Kargoya
// verilmiş/teslim edilmiş bir sipariş iptal edilemez; "refunded" durumu
// yalnızca iade onay akışından (admin-refunds) set edilir, burada elle
// seçilemez.
const ALLOWED_TRANSITIONS: Record<AdminOrderStatus, AdminOrderStatus[]> = {
  pending: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

export class OrderNotFoundError extends Error {}
export class InvalidOrderTransitionError extends Error {}

export async function updateOrderStatus(orderId: number, nextStatus: AdminOrderStatus) {
  return db.transaction(async (tx) => {
    const [order] = await tx.select({ status: orders.status }).from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) throw new OrderNotFoundError();

    const current = order.status as AdminOrderStatus;
    if (!ALLOWED_TRANSITIONS[current]?.includes(nextStatus)) {
      throw new InvalidOrderTransitionError(`"${current}" durumundan "${nextStatus}" durumuna geçilemez`);
    }

    await tx.update(orders).set({ status: nextStatus }).where(eq(orders.id, orderId));
    if (nextStatus === "cancelled") {
      await tx.update(orderItems).set({ vendorStatus: "cancelled" }).where(eq(orderItems.orderId, orderId));
      await restoreOrderItemStock(tx, orderId);
    }
  });
}

export async function listAllOrders(status?: string) {
  const base = db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      total: orders.total,
      createdAt: orders.createdAt,
      customerName: customers.fullName,
      customerEmail: customers.email,
    })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .orderBy(desc(orders.createdAt))
    .limit(200);

  if (status) return base.where(eq(orders.status, status as never));
  return base;
}

export async function findOrderDetail(id: number) {
  const [order] = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      paymentProvider: orders.paymentProvider,
      subtotal: orders.subtotal,
      shippingFee: orders.shippingFee,
      total: orders.total,
      shippingAddress: orders.shippingAddress,
      orderNote: orders.orderNote,
      createdAt: orders.createdAt,
      customerName: customers.fullName,
      customerEmail: customers.email,
    })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(eq(orders.id, id))
    .limit(1);
  if (!order) return null;

  const items = await db
    .select({
      id: orderItems.id,
      productNameSnapshot: orderItems.productNameSnapshot,
      unitPrice: orderItems.unitPrice,
      quantity: orderItems.quantity,
      total: orderItems.total,
      vendorStatus: orderItems.vendorStatus,
      vendorStoreName: vendors.storeName,
      productId: products.id,
    })
    .from(orderItems)
    .innerJoin(vendors, eq(orderItems.vendorId, vendors.id))
    .innerJoin(products, eq(orderItems.productId, products.id))
    .where(eq(orderItems.orderId, id));

  return { ...order, items };
}
