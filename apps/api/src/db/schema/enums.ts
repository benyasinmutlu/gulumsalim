import { pgEnum } from "drizzle-orm/pg-core";

export const vendorStatusEnum = pgEnum("vendor_status", [
  "pending",
  "active",
  "suspended",
  "banned",
]);

// bkz. kullanıcı isteği: "bireysel olarak müşteri olarak kayıt olan
// kişilerde satış yapabilsin 2. el ürün letgo dolap gibi" - normal
// (kurumsal) satıcı başvurusundan ayrı, bir müşteri hesabından anında
// açılan bireysel/2. el satıcı tipini ayırt eder.
export const vendorTypeEnum = pgEnum("vendor_type", [
  "business",
  "individual",
]);

export const productStatusEnum = pgEnum("product_status", [
  "draft",
  "active",
  "inactive",
  "rejected",
]);

export const reviewStatusEnum = pgEnum("review_status", [
  "pending",
  "approved",
  "rejected",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "paid",
  "failed",
  "refunded",
]);

export const payoutStatusEnum = pgEnum("payout_status", [
  "pending",
  "paid",
  "rejected",
]);

export const refundStatusEnum = pgEnum("refund_status", [
  "pending",
  "approved",
  "rejected",
]);

// order_refunds.status icin ozel enum - promo_banners.status'un kullandigi
// refundStatusEnum ile KARISTIRILMAMALI (ikisi ayni degerlerle basladi ama
// anlamca ilgisiz iki kavram, bkz. kullanici istegi: iade akisi satici
// onayi + fiziksel teslim alma + admin para iadesi asamalarindan geciyor).
// pending: musteri talep etti, satici karar bekliyor
// approved: satici onayladi, musteri urunu geri gondermeyi bekliyor
// rejected: satici reddetti (bitis durumu)
// item_received: satici urunu fiziksel olarak geri aldigini onayladi
// refunded: admin musteriye parayi gercekten iade etti (bitis durumu)
export const orderRefundStatusEnum = pgEnum("order_refund_status", [
  "pending",
  "approved",
  "rejected",
  "item_received",
  "refunded",
]);

export const messageSenderEnum = pgEnum("message_sender", [
  "admin",
  "vendor",
]);

export const customerMessageSenderEnum = pgEnum("customer_message_sender", [
  "customer",
  "vendor",
]);

export const complaintStatusEnum = pgEnum("complaint_status", [
  "pending",
  "reviewed",
  "dismissed",
]);

export const sectionAlgoEnum = pgEnum("section_algo", [
  "manual",
  "vendor_carousel",
  "vendor_products",
  "promo_banners",
  "recently_viewed",
  "related_viewed",
  "trending",
  "discover_personalized",
  "new_arrivals",
  "featured",
  "best_sellers",
  "weekly_best",
]);
