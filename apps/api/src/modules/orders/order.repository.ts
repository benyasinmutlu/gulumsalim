import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db/client";
import { orderItems, orders, products, vendors } from "../../db/schema/index";

export async function fetchProductsForCheckout(productIds: number[]) {
  if (productIds.length === 0) return [];
  return db
    .select({
      id: products.id,
      vendorId: products.vendorId,
      categoryId: products.categoryId,
      status: products.status,
      vendorStatus: vendors.status,
    })
    .from(products)
    .innerJoin(vendors, eq(products.vendorId, vendors.id))
    .where(inArray(products.id, productIds));
}

interface CreateOrderItemInput {
  vendorId: number;
  productId: number;
  variantId?: number;
  productNameSnapshot: string;
  unitPrice: string;
  quantity: number;
  total: string;
}

interface CreateOrderInput {
  customerId: number;
  orderNumber: string;
  subtotal: string;
  shippingFee: string;
  total: string;
  shippingAddress: unknown;
  items: CreateOrderItemInput[];
}

// Sipariş + kalemleri tek transaction'da yazılır: ya hepsi ya hiçbiri -
// yarım kalmış bir sipariş (kalemsiz veya kısmi kalemli) asla oluşamaz.
export async function createOrder(data: CreateOrderInput) {
  return db.transaction(async (tx) => {
    const [order] = await tx
      .insert(orders)
      .values({
        customerId: data.customerId,
        orderNumber: data.orderNumber,
        subtotal: data.subtotal,
        shippingFee: data.shippingFee,
        total: data.total,
        shippingAddress: data.shippingAddress,
      })
      .returning();
    if (!order) throw new Error("Sipariş oluşturulamadı");

    const insertedItems = await tx
      .insert(orderItems)
      .values(data.items.map((item) => ({ ...item, orderId: order.id })))
      .returning();

    return { order, items: insertedItems };
  });
}

export async function setOrderPaymentRef(orderId: number, paymentRef: string) {
  await db.update(orders).set({ paymentRef }).where(eq(orders.id, orderId));
}

export async function findOrderByPaymentRef(paymentRef: string) {
  const [row] = await db.select().from(orders).where(eq(orders.paymentRef, paymentRef)).limit(1);
  return row ?? null;
}

export async function markOrderPaid(orderId: number) {
  await db.update(orders).set({ status: "processing", paymentStatus: "paid" }).where(eq(orders.id, orderId));
}

export async function markOrderPaymentFailed(orderId: number) {
  await db.update(orders).set({ paymentStatus: "failed" }).where(eq(orders.id, orderId));
}

// Satın alma event'lerini (bkz. checkout.service.ts handlePaymentCallback)
// yayınlamak için sipariş kalemlerini kategori bilgisiyle birlikte döner.
export async function findOrderItemsWithProductInfo(orderId: number) {
  return db
    .select({
      productId: orderItems.productId,
      vendorId: orderItems.vendorId,
      categoryId: products.categoryId,
    })
    .from(orderItems)
    .innerJoin(products, eq(orderItems.productId, products.id))
    .where(eq(orderItems.orderId, orderId));
}

export async function findOrderByNumber(orderNumber: string, customerId: number) {
  const [row] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.orderNumber, orderNumber), eq(orders.customerId, customerId)))
    .limit(1);
  return row ?? null;
}
