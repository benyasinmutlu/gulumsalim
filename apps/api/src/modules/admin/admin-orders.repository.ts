import { desc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { customers, orderItems, orders, products, vendors } from "../../db/schema/index";

export class OrderNotFoundError extends Error {}

// bkz. kullanıcı isteği: "ürünü hazırlama kargolama iptal ve iade
// işlemleri satıcıda olmalı" - admin artık orders.status'u veya
// order_items.vendorStatus'u ELLE DEĞİŞTİREMEZ (önceki denetimde tespit
// edilen mantık hatası: admin panel satıcının işini tekrarlıyordu).
// Genel sipariş durumu satıcıların kendi kalem durumlarından otomatik
// hesaplanır (bkz. order.repository.ts recomputeOrderStatus). Bu modül
// artık sadece SALT OKUNUR bir genel bakış sunar.
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

  // trackingCarrier/trackingNumber satıcı tarafından girilir (bkz.
  // vendor-orders.service.ts) - admin burada sadece görüntüler, değiştiremez.
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
      trackingCarrier: orderItems.trackingCarrier,
      trackingNumber: orderItems.trackingNumber,
      shippedAt: orderItems.shippedAt,
    })
    .from(orderItems)
    .innerJoin(vendors, eq(orderItems.vendorId, vendors.id))
    .innerJoin(products, eq(orderItems.productId, products.id))
    .where(eq(orderItems.orderId, id));

  return { ...order, items };
}
