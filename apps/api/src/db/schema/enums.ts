import { pgEnum } from "drizzle-orm/pg-core";

export const vendorStatusEnum = pgEnum("vendor_status", [
  "pending",
  "active",
  "suspended",
  "banned",
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

export const messageSenderEnum = pgEnum("message_sender", [
  "admin",
  "vendor",
]);

export const customerMessageSenderEnum = pgEnum("customer_message_sender", [
  "customer",
  "vendor",
]);

export const sectionAlgoEnum = pgEnum("section_algo", [
  "manual",
  "vendor_carousel",
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
