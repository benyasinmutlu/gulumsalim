import { bigint, index, integer, jsonb, numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { orderRefundStatusEnum, orderStatusEnum, paymentStatusEnum } from "./enums";
import { customers } from "./customers";
import { products, productVariants } from "./catalog";
import { vendors } from "./vendors";

export const orders = pgTable("orders", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  customerId: bigint("customer_id", { mode: "number" }).notNull().references(() => customers.id),
  orderNumber: text("order_number").notNull().unique(),
  status: orderStatusEnum("status").notNull().default("pending"),
  paymentStatus: paymentStatusEnum("payment_status").notNull().default("pending"),
  paymentProvider: text("payment_provider").notNull().default("iyzico"),
  paymentRef: text("payment_ref"),
  // iyzico'nun checkoutForm.retrieve yanitindaki paymentId - refund/iade
  // API'si (refundV2.create) bir odemeyi geri almak icin token'i degil bu
  // ID'yi ister (bkz. iyzico.client.ts refundPayment). Odeme basarili
  // oldugunda markOrderPaid ile birlikte yazilir.
  paymentTransactionId: text("payment_transaction_id"),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  shippingFee: numeric("shipping_fee", { precision: 10, scale: 2 }).notNull(),
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
}));
