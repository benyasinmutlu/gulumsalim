import { desc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { customers, orderItems, orderRefunds, orders, vendors } from "../../db/schema/index";

export async function listRefunds(status?: "pending" | "approved" | "rejected") {
  const base = db
    .select({
      id: orderRefunds.id,
      reason: orderRefunds.reason,
      status: orderRefunds.status,
      adminNote: orderRefunds.adminNote,
      requestedAt: orderRefunds.requestedAt,
      processedAt: orderRefunds.processedAt,
      vendorStoreName: vendors.storeName,
      customerName: customers.fullName,
      orderNumber: orders.orderNumber,
      productNameSnapshot: orderItems.productNameSnapshot,
      total: orderItems.total,
    })
    .from(orderRefunds)
    .innerJoin(vendors, eq(orderRefunds.vendorId, vendors.id))
    .innerJoin(customers, eq(orderRefunds.customerId, customers.id))
    .innerJoin(orderItems, eq(orderRefunds.orderItemId, orderItems.id))
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .orderBy(desc(orderRefunds.requestedAt));

  if (status) return base.where(eq(orderRefunds.status, status));
  return base;
}

export async function decideRefund(id: number, status: "approved" | "rejected", adminNote?: string) {
  const [row] = await db
    .update(orderRefunds)
    .set({ status, adminNote, processedAt: new Date() })
    .where(eq(orderRefunds.id, id))
    .returning({ id: orderRefunds.id });
  return row ?? null;
}
