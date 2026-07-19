import { bigint, index, integer, jsonb, numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { orderStatusEnum, paymentStatusEnum } from "./enums";
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
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  shippingFee: numeric("shipping_fee", { precision: 10, scale: 2 }).notNull(),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  shippingAddress: jsonb("shipping_address").notNull(),
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
}, (table) => ({
  vendorIdx: index("idx_order_items_vendor").on(table.vendorId, table.vendorStatus),
  orderIdx: index("idx_order_items_order").on(table.orderId),
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
