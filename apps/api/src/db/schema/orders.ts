import { sql } from "drizzle-orm";
import { bigint, boolean, check, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { campaignScopeEnum, campaignTypeEnum, couponTypeEnum, orderRefundStatusEnum, orderStatusEnum, paymentStatusEnum } from "./enums";
import { customers } from "./customers";
import { products, productVariants } from "./catalog";
import { vendors } from "./vendors";

// bkz. kullanıcı isteği: "kupon kodu... admin panelde kontrol edebilelim" -
// admin oluşturur/düzenler (bkz. admin-coupons.routes.ts), müşteri sepette/
// ödemede kodu girer (bkz. coupon.service.ts). Sahte/uydurma bir indirim
// yerine gerçek doğrulama (aktif mi, süresi mi, kullanım limiti mi) yapılır.
export const coupons = pgTable("coupons", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  code: text("code").notNull().unique(),
  type: couponTypeEnum("type").notNull(),
  // type='percent' ise 0-100 arası yüzde, type='fixed' ise TL tutarı.
  value: numeric("value", { precision: 10, scale: 2 }).notNull(),
  minOrderAmount: numeric("min_order_amount", { precision: 10, scale: 2 }),
  maxUsesTotal: integer("max_uses_total"),
  maxUsesPerCustomer: integer("max_uses_per_customer").notNull().default(1),
  usedCount: integer("used_count").notNull().default(0),
  startsAt: timestamp("starts_at", { withTimezone: true, precision: 3 }),
  endsAt: timestamp("ends_at", { withTimezone: true, precision: 3 }),
  isActive: boolean("is_active").notNull().default(true),
  // Anasayfadaki "İlk Alışverişine Özel İndirim" kartının hangi kuponu
  // göstereceğini admin seçer - birden fazla aktif kupon olabilir, kartta
  // hepsini listelemek yerine admin'in öne çıkardığı TEK kupon gösterilir.
  isFeatured: boolean("is_featured").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
}, (table) => ({
  valueCheck: check("coupon_value_check", sql`(${table.type} = 'percent' AND ${table.value} > 0 AND ${table.value} <= 100) OR (${table.type} = 'fixed' AND ${table.value} > 0)`),
  minimumCheck: check("coupon_minimum_check", sql`${table.minOrderAmount} IS NULL OR ${table.minOrderAmount} > 0`),
  usageCheck: check("coupon_usage_check", sql`${table.maxUsesPerCustomer} > 0 AND ${table.usedCount} >= 0 AND (${table.maxUsesTotal} IS NULL OR (${table.maxUsesTotal} > 0 AND ${table.usedCount} <= ${table.maxUsesTotal}))`),
  dateCheck: check("coupon_date_check", sql`${table.startsAt} IS NULL OR ${table.endsAt} IS NULL OR ${table.endsAt} > ${table.startsAt}`),
}));

export const campaigns = pgTable("campaigns", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  type: campaignTypeEnum("type").notNull(),
  scope: campaignScopeEnum("scope").notNull().default("all"),
  scopeId: bigint("scope_id", { mode: "number" }),
  value: numeric("value", { precision: 10, scale: 2 }).notNull().default("0.00"),
  minOrderAmount: numeric("min_order_amount", { precision: 10, scale: 2 }),
  startsAt: timestamp("starts_at", { withTimezone: true, precision: 3 }),
  endsAt: timestamp("ends_at", { withTimezone: true, precision: 3 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
}, (table) => ({
  activeIdx: index("idx_campaigns_active").on(table.isActive, table.endsAt),
  scopeTargetCheck: check("campaign_scope_target_check", sql`(${table.scope} = 'all' AND ${table.scopeId} IS NULL) OR (${table.scope} <> 'all' AND ${table.scopeId} IS NOT NULL)`),
  valueCheck: check("campaign_value_check", sql`(${table.type} = 'percent' AND ${table.value} > 0 AND ${table.value} <= 100) OR (${table.type} = 'free_shipping' AND ${table.value} = 0)`),
  dateCheck: check("campaign_date_check", sql`${table.startsAt} IS NULL OR ${table.endsAt} IS NULL OR ${table.endsAt} > ${table.startsAt}`),
  minimumCheck: check("campaign_minimum_check", sql`${table.minOrderAmount} IS NULL OR ${table.minOrderAmount} > 0`),
}));

export const orders = pgTable("orders", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  customerId: bigint("customer_id", { mode: "number" }).notNull().references(() => customers.id),
  orderNumber: text("order_number").notNull().unique(),
  status: orderStatusEnum("status").notNull().default("pending"),
  paymentStatus: paymentStatusEnum("payment_status").notNull().default("pending"),
  paymentProvider: text("payment_provider").notNull().default("iyzico"),
  paymentRef: text("payment_ref"),
  // Tarayıcının tek bir ödeme denemesi boyunca sabit tuttuğu anahtar. Ağ
  // yanıtı kaybolsa veya butona iki kez basılsa da ikinci sipariş/stok
  // rezervasyonu oluşmaz. Form içeriği de başarılı ilk cevabı tekrar
  // döndürebilmek için saklanır.
  checkoutIdempotencyKey: text("checkout_idempotency_key"),
  checkoutRequestHash: text("checkout_request_hash"),
  checkoutFormContent: text("checkout_form_content"),
  // iyzico'nun checkoutForm.retrieve yanitindaki paymentId - refund/iade
  // API'si (refundV2.create) bir odemeyi geri almak icin token'i degil bu
  // ID'yi ister (bkz. iyzico.client.ts refundPayment). Odeme basarili
  // oldugunda markOrderPaid ile birlikte yazilir.
  paymentTransactionId: text("payment_transaction_id"),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  shippingFee: numeric("shipping_fee", { precision: 10, scale: 2 }).notNull(),
  // Bu siparişte kullanılan kupon (varsa) - satıcı/admin denetimi için
  // sipariş üzerinde kalıcı bir kayıt. discountAmount, kuponun o anki
  // subtotal'a göre HESAPLANMIŞ TL karşılığı (kupon sonradan silinse/
  // değişse bile bu sipariş için sabit kalır - product_name_snapshot ile
  // aynı "donmuş kopya" mantığı).
  couponId: bigint("coupon_id", { mode: "number" }).references(() => coupons.id),
  campaignId: bigint("campaign_id", { mode: "number" }).references(() => campaigns.id),
  discountAmount: numeric("discount_amount", { precision: 10, scale: 2 }).notNull().default("0.00"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  shippingAddress: jsonb("shipping_address").notNull(),
  orderNote: text("order_note"),
  // Mesafeli Satış Sözleşmesi + Ön Bilgilendirme Formu'nun, ödeme
  // öncesi müşteriye gösterilen HALİYLE donmuş kopyası - product_name_
  // snapshot ile aynı mantık (satıcı adı/adresi/fiyat sonradan değişse
  // bile bu sipariş için o anki hukuki kayıt sabit kalır). checkout.service.ts
  // startCheckout()'ta iyzico çağrısından ÖNCE, aynı transaction'da yazılır.
  contractAcceptedAt: timestamp("contract_accepted_at", { withTimezone: true, precision: 3 }),
  contractSnapshot: text("contract_snapshot"),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
}, (table) => ({
  customerIdx: index("idx_orders_customer").on(table.customerId, table.createdAt),
  paymentRefUnique: uniqueIndex("uniq_orders_payment_ref").on(table.paymentRef),
  checkoutIdempotencyKeyUnique: uniqueIndex("uniq_orders_checkout_idempotency_key").on(table.checkoutIdempotencyKey),
  moneyCheck: check("order_money_check", sql`${table.subtotal} >= 0 AND ${table.shippingFee} >= 0 AND ${table.discountAmount} >= 0 AND ${table.discountAmount} <= ${table.subtotal} AND ${table.total} = ${table.subtotal} - ${table.discountAmount} + ${table.shippingFee}`),
}));

// Bir müşterinin bir kuponu kaç kez kullandığını (maxUsesPerCustomer
// kontrolü için) ve hangi siparişte kullanıldığını izler.
export const couponRedemptions = pgTable("coupon_redemptions", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  couponId: bigint("coupon_id", { mode: "number" }).notNull().references(() => coupons.id),
  customerId: bigint("customer_id", { mode: "number" }).notNull().references(() => customers.id),
  orderId: bigint("order_id", { mode: "number" }).references(() => orders.id),
  redeemedAt: timestamp("redeemed_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
}, (table) => ({
  couponCustomerIdx: index("idx_coupon_redemptions_coupon_customer").on(table.couponId, table.customerId),
  orderUnique: uniqueIndex("uniq_coupon_redemptions_order").on(table.orderId),
}));

// Bir sipariş birden fazla satıcıya yayılabilir; her satır tek bir
// satıcının ürününü ve o satıcıya özel karşılama (fulfillment) durumunu
// taşır. `orders.status` genel sipariş durumu, `order_items.vendorStatus`
// satıcının kendi kargolama/teslim durumu — ikisi kasıtlı olarak ayrı.
export const orderItems = pgTable("order_items", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  orderId: bigint("order_id", { mode: "number" }).notNull().references(() => orders.id),
  vendorId: bigint("vendor_id", { mode: "number" }).notNull().references(() => vendors.id),
  productId: bigint("product_id", { mode: "number" }).notNull().references(() => products.id),
  // iyzico basket item kimligi ve provider transaction kimligi. Birincisi
  // checkout baslatmadan once UUID olarak uretilir; ikincisi basarili CF
  // Retrieve sonucundan yazilir ve parcali iade bu deger uzerinden yapilir.
  paymentItemRef: text("payment_item_ref"),
  paymentTransactionId: text("payment_transaction_id"),
  variantId: bigint("variant_id", { mode: "number" }).references(() => productVariants.id),
  productNameSnapshot: text("product_name_snapshot").notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull(),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  vendorStatus: orderStatusEnum("vendor_status").notNull().default("pending"),
  // Kargo bilgisi satici tarafindan girilir (urunu satici kargoluyor) -
  // hem musteri hem admin gorebilir. "shipped" durumuna gecerken zorunlu
  // (bkz. vendor-orders.service.ts transitionOrderItemStatus).
  trackingCarrier: text("tracking_carrier"),
  trackingNumber: text("tracking_number"),
  shippedAt: timestamp("shipped_at", { withTimezone: true, precision: 3 }),
}, (table) => ({
  vendorIdx: index("idx_order_items_vendor").on(table.vendorId, table.vendorStatus),
  orderIdx: index("idx_order_items_order").on(table.orderId),
  paymentItemRefUnique: uniqueIndex("uniq_order_items_payment_item_ref").on(table.paymentItemRef),
  moneyCheck: check("order_item_money_check", sql`${table.quantity} > 0 AND ${table.unitPrice} >= 0 AND ${table.total} = ${table.unitPrice} * ${table.quantity}`),
}));

// Müşterinin bir sipariş kalemi için iade talebi - bkz. kullanıcı isteği:
// müşteri sebep+fotoğraf ile talep açar, satıcı onaylar/reddeder, onaylanırsa
// müşteri ürünü kargolayıp takip kodunu girer, satıcı fiziksel teslim aldığını
// işaretler, en son admin gerçek parasal iadeyi (iyzico refund) yapar. Bu
// beş aşama orderRefundStatusEnum + aşağıdaki zaman damgalarıyla izlenir.
export const orderRefunds = pgTable("order_refunds", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  orderItemId: bigint("order_item_id", { mode: "number" }).notNull().references(() => orderItems.id),
  customerId: bigint("customer_id", { mode: "number" }).notNull().references(() => customers.id),
  vendorId: bigint("vendor_id", { mode: "number" }).notNull().references(() => vendors.id),
  reason: text("reason").notNull(),
  // Müşterinin iade talebiyle birlikte yüklediği ürün fotoğrafları (URL
  // listesi) - satıcının kararını (hasarlı/yanlış ürün vb.) fotoğrafsız
  // sadece yazıyla vermesini önler.
  photos: jsonb("photos").notNull().default([]),
  status: orderRefundStatusEnum("status").notNull().default("pending"),
  vendorNote: text("vendor_note"),
  adminNote: text("admin_note"),
  // Müşteri, satıcı onayından sonra ürünü kendi kargoluyor - takip kodunu
  // kendisi girer (bkz. kullanıcı isteği: "iade ederken müşteri kargolayacağı
  // için müşteri takip numarasını girecek").
  returnTrackingCarrier: text("return_tracking_carrier"),
  returnTrackingNumber: text("return_tracking_number"),
  returnShippedAt: timestamp("return_shipped_at", { withTimezone: true, precision: 3 }),
  requestedAt: timestamp("requested_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  // Satıcının onay/red kararını verdiği an.
  processedAt: timestamp("processed_at", { withTimezone: true, precision: 3 }),
  // Satıcının ürünü fiziksel olarak elinde tuttuğunu işaretlediği an -
  // admin'in parasal iadeyi yapması için ön koşul (bkz. kullanıcı isteği:
  // "ürün satıcıya teslim edildiğinden emin olduğumuzda müşteriye parasını
  // iade edeceğiz").
  receivedByVendorAt: timestamp("received_by_vendor_at", { withTimezone: true, precision: 3 }),
  // Admin'in iyzico üzerinden gerçek parasal iadeyi tamamladığı an.
  refundedAt: timestamp("refunded_at", { withTimezone: true, precision: 3 }),
}, (table) => ({
  statusIdx: index("idx_refunds_status").on(table.status),
  vendorIdx: index("idx_refunds_vendor").on(table.vendorId),
  activeRequestUnique: uniqueIndex("uniq_active_refund_per_order_item")
    .on(table.orderItemId)
    .where(sql`${table.status} <> 'rejected'`),
}));

export const vendorEarnings = pgTable("vendor_earnings", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  orderItemId: bigint("order_item_id", { mode: "number" }).notNull().unique().references(() => orderItems.id),
  vendorId: bigint("vendor_id", { mode: "number" }).notNull().references(() => vendors.id),
  grossAmount: numeric("gross_amount", { precision: 10, scale: 2 }).notNull(),
  commissionAmount: numeric("commission_amount", { precision: 10, scale: 2 }).notNull(),
  netAmount: numeric("net_amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
}, (table) => ({
  vendorIdx: index("idx_earnings_vendor").on(table.vendorId),
  moneyCheck: check("vendor_earning_money_check", sql`${table.grossAmount} >= 0 AND ${table.commissionAmount} >= 0 AND ${table.commissionAmount} <= ${table.grossAmount} AND ${table.netAmount} >= 0`),
}));
