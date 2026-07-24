import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { orderItems, orders, productVariants, products, vendors } from "../../db/schema/index";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class InsufficientStockError extends Error {
  constructor(public productId: number) {
    super("Yetersiz stok");
  }
}

// gulumsalim.com'daki sipariş oluşturma anında stok düşürme davranışının
// karşılığı - eski sistemde eksikti (bkz. re-audit), aşırı satışı önlemek
// için WHERE stock >= quantity koşuluyla tek sorguda hem kontrol hem
// düşürme yapılır; 0 satır dönerse stok yetersiz demektir ve transaction
// rollback olur. Varyantsız kalemler (variantId null) atlanır - yeni
// şemada stok yalnızca varyant seviyesinde tutuluyor.
async function decrementOrderItemStock(tx: Tx, items: CreateOrderItemInput[]) {
  for (const item of items) {
    if (!item.variantId) continue;
    const updated = await tx
      .update(productVariants)
      .set({ stock: sql`${productVariants.stock} - ${item.quantity}` })
      .where(and(eq(productVariants.id, item.variantId), gte(productVariants.stock, item.quantity)))
      .returning({ id: productVariants.id });
    if (updated.length === 0) throw new InsufficientStockError(item.productId);
  }
}

// Ödeme başarısız olduğunda (bkz. checkout.service markOrderPaymentFailed)
// veya admin bir siparişi iptal ettiğinde (bkz. admin-orders.repository
// updateOrderStatus) düşürülen stoğun geri yüklenmesi için ortak fonksiyon.
export async function restoreOrderItemStock(tx: Tx, orderId: number) {
  const items = await tx
    .select({ variantId: orderItems.variantId, quantity: orderItems.quantity })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));
  for (const item of items) {
    if (!item.variantId) continue;
    await tx
      .update(productVariants)
      .set({ stock: sql`${productVariants.stock} + ${item.quantity}` })
      .where(eq(productVariants.id, item.variantId));
  }
}

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
  orderNote?: string;
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
        orderNote: data.orderNote,
      })
      .returning();
    if (!order) throw new Error("Sipariş oluşturulamadı");

    const insertedItems = await tx
      .insert(orderItems)
      .values(data.items.map((item) => ({ ...item, orderId: order.id })))
      .returning();

    await decrementOrderItemStock(tx, data.items);

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
  const transitioned = await db
    .update(orders)
    .set({ status: "processing", paymentStatus: "paid" })
    .where(and(eq(orders.id, orderId), eq(orders.paymentStatus, "pending")))
    .returning({ id: orders.id });
  return transitioned.length === 1;
}

// Koşullu update hem tekrarları hem de eşzamanlı success/failure callback'lerini
// tek bir geçişe indirger. Paid bir sipariş asla failed'a çevrilmez ve stok
// sadece pending -> failed geçişini kazanan transaction tarafından geri yüklenir.
export async function markOrderPaymentFailed(orderId: number) {
  return db.transaction(async (tx) => {
    const transitioned = await tx
      .update(orders)
      .set({ paymentStatus: "failed" })
      .where(and(eq(orders.id, orderId), eq(orders.paymentStatus, "pending")))
      .returning({ id: orders.id });
    if (transitioned.length === 0) return false;
    await restoreOrderItemStock(tx, orderId);
    return true;
  });
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

// Misafir sipariş onay ekranı (siparis-sonucu) için - oturum açmamış bir
// ziyaretçinin hesabı olmadığından customerId ile eşleştirme yapılamaz.
// Sipariş numarası (`GS${timestamp}${random}`) tahmin edilemeyecek kadar
// rastgele olduğu için tek başına yeterli bir erişim anahtarı sayılır -
// eski sitenin order-success.php'sindeki aynı varsayım.
export async function findOrderByNumberPublic(orderNumber: string) {
  const [row] = await db
    .select({
      orderNumber: orders.orderNumber,
      total: orders.total,
      status: orders.status,
    })
    .from(orders)
    .where(eq(orders.orderNumber, orderNumber))
    .limit(1);
  return row ?? null;
}

// gulumsalim.com'daki account.php'nin sipariş geçmişi listesinin karşılığı
// - müşteri başına sipariş sayısı sınırlı olduğundan (binlerce değil) keyset
// pagination yerine basit bir DESC liste yeterli.
export async function findOrdersByCustomer(customerId: number) {
  return db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      total: orders.total,
      createdAt: orders.createdAt,
      itemCount: sql<number>`COUNT(${orderItems.id})`.mapWith(Number),
    })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(eq(orders.customerId, customerId))
    .groupBy(orders.id)
    .orderBy(desc(orders.createdAt));
}
