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

// restoreOrderItemStock TÜM siparişin stoğunu geri yükler (ödeme
// başarısızlığı gibi sipariş-geneli senaryolar için) - satıcının TEK BİR
// kalemi iptal ettiği durumda (bkz. vendor-orders.repository.ts
// updateVendorOrderItemStatus) sadece o kalemin stoğu geri yüklenmeli,
// aynı siparişteki diğer (iptal edilmeyen) kalemler etkilenmemeli.
export async function restoreOrderItemStockSingle(tx: Tx, orderItemId: number) {
  const [item] = await tx
    .select({ variantId: orderItems.variantId, quantity: orderItems.quantity })
    .from(orderItems)
    .where(eq(orderItems.id, orderItemId))
    .limit(1);
  if (!item?.variantId) return;
  await tx
    .update(productVariants)
    .set({ stock: sql`${productVariants.stock} + ${item.quantity}` })
    .where(eq(productVariants.id, item.variantId));
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
      freeShipping: products.freeShipping,
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
  contractSnapshot?: string;
  contractAcceptedAt?: Date;
}

// Mesafeli Satış Sözleşmesi'nin satıcı bloklarını doldurmak için - hem
// checkout önizlemesi hem gerçek sipariş anında sepetteki (tekilleştirilmiş)
// vendorId'ler için çağrılır (bkz. contract-template.ts).
export async function fetchVendorsForCheckout(vendorIds: number[]) {
  if (vendorIds.length === 0) return [];
  return db
    .select({ id: vendors.id, storeName: vendors.storeName, taxId: vendors.taxId, legalAddress: vendors.legalAddress })
    .from(vendors)
    .where(inArray(vendors.id, vendorIds));
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
        contractSnapshot: data.contractSnapshot,
        contractAcceptedAt: data.contractAcceptedAt,
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

// bkz. kullanıcı isteği: "ürünü hazırlama kargolama iptal ve iade işlemleri
// satıcıda olmalı" - admin artık orders.status'u elle değiştirmiyor
// (bkz. admin-orders.repository.ts), her satıcının kendi order_items.
// vendorStatus geçişinden (vendor-orders.service.ts) sonra bu fonksiyon
// çağrılıp genel sipariş durumu satıcı durumlarının BİLEŞKESİNDEN
// (en az ilerlemiş olana göre) yeniden hesaplanır. İptal edilen kalemler
// bileşkeden hariç tutulur - tek kalemi iptal edilen bir siparişin geri
// kalanı hâlâ normal ilerleyebilmeli.
export async function recomputeOrderStatus(tx: Tx, orderId: number) {
  const items = await tx.select({ vendorStatus: orderItems.vendorStatus }).from(orderItems).where(eq(orderItems.orderId, orderId));
  const relevant = items.filter((i) => i.vendorStatus !== "cancelled" && i.vendorStatus !== "refunded");

  let nextStatus: "processing" | "shipped" | "delivered" | "cancelled";
  if (relevant.length === 0) {
    nextStatus = "cancelled";
  } else if (relevant.every((i) => i.vendorStatus === "delivered")) {
    nextStatus = "delivered";
  } else if (relevant.every((i) => i.vendorStatus === "shipped" || i.vendorStatus === "delivered")) {
    nextStatus = "shipped";
  } else {
    nextStatus = "processing";
  }

  await tx.update(orders).set({ status: nextStatus }).where(eq(orders.id, orderId));
}

export async function findOrderByPaymentRef(paymentRef: string) {
  const [row] = await db.select().from(orders).where(eq(orders.paymentRef, paymentRef)).limit(1);
  return row ?? null;
}

// Koşullu geçiş: yalnız 'pending' -> 'paid'. RETURNING ile kaç satırın
// gerçekten geçtiğini döndürür. Bu, eşzamanlı/tekrarlı callback'lerde
// (TOCTOU) satın alma event'lerinin ve satıcı bildirimlerinin YALNIZCA BİR
// KEZ üretilmesini garanti eder (bkz. checkout.service handlePaymentCallback).
export async function markOrderPaid(orderId: number, paymentTransactionId?: string): Promise<boolean> {
  const transitioned = await db
    .update(orders)
    .set({ status: "processing", paymentStatus: "paid", paymentTransactionId })
    .where(and(eq(orders.id, orderId), eq(orders.paymentStatus, "pending")))
    .returning({ id: orders.id });
  return transitioned.length === 1;
}

// İdempotent: webhook/callback aynı token için birden fazla kez tetiklense
// bile stok yalnızca bir kez geri yüklenir (zaten "failed" olan bir
// siparişte hiçbir şey yapılmaz).
export async function markOrderPaymentFailed(orderId: number) {
  await db.transaction(async (tx) => {
    const [order] = await tx.select({ paymentStatus: orders.paymentStatus }).from(orders).where(eq(orders.id, orderId)).limit(1);
    // Yalnız 'pending' -> 'failed'. Zaten 'paid' bir sipariş asla failed
    // yapılmaz (ve stoğu ikinci kez geri yüklenmez); zaten 'failed' ise no-op.
    if (!order || order.paymentStatus !== "pending") return;
    await tx.update(orders).set({ paymentStatus: "failed" }).where(eq(orders.id, orderId));
    await restoreOrderItemStock(tx, orderId);
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

// Sipariş detay ekranı (hesabim/siparisler/[orderNumber]) için kalemleri de
// döner - admin-orders.repository.ts findOrderDetail ile aynı şekil.
async function findOrderItemsForDetail(orderId: number) {
  return db
    .select({
      id: orderItems.id,
      productNameSnapshot: orderItems.productNameSnapshot,
      unitPrice: orderItems.unitPrice,
      quantity: orderItems.quantity,
      total: orderItems.total,
      vendorStatus: orderItems.vendorStatus,
      vendorStoreName: vendors.storeName,
      productId: products.id,
      // bkz. kullanıcı isteği: "satıcı takip kodunu sisteme girecek hem
      // müşteri hem de admin görebilecek" - müşteri sipariş detayında
      // görebilmeli.
      trackingCarrier: orderItems.trackingCarrier,
      trackingNumber: orderItems.trackingNumber,
      shippedAt: orderItems.shippedAt,
    })
    .from(orderItems)
    .innerJoin(vendors, eq(orderItems.vendorId, vendors.id))
    .innerJoin(products, eq(orderItems.productId, products.id))
    .where(eq(orderItems.orderId, orderId));
}

export async function findOrderByNumber(orderNumber: string, customerId: number) {
  const [row] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.orderNumber, orderNumber), eq(orders.customerId, customerId)))
    .limit(1);
  if (!row) return null;
  const items = await findOrderItemsForDetail(row.id);
  return { ...row, items };
}

// Misafir sipariş onay ekranı (siparis-sonucu) için - oturum açmamış bir
// ziyaretçinin hesabı olmadığından customerId ile eşleştirme yapılamaz.
// Sipariş numarası (`GS${timestamp}${random}`) tahmin edilemeyecek kadar
// rastgele olduğu için tek başına yeterli bir erişim anahtarı sayılır -
// eski sitenin order-success.php'sindeki aynı varsayım.
export async function findOrderByNumberPublic(orderNumber: string) {
  const [row] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);
  if (!row) return null;
  const items = await findOrderItemsForDetail(row.id);
  return { ...row, items };
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
