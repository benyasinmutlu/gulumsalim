import { bigint, boolean, index, numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { payoutStatusEnum, vendorStatusEnum } from "./enums";

export const vendors = pgTable("vendors", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  storeName: text("store_name").notNull(),
  storeSlug: text("store_slug").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  status: vendorStatusEnum("status").notNull().default("pending"),
  walletBalance: numeric("wallet_balance", { precision: 12, scale: 2 }).notNull().default("0"),
  commissionRate: numeric("commission_rate", { precision: 5, scale: 2 }),
  bankName: text("bank_name"),
  bankIban: text("bank_iban"),
  bankAccountHolder: text("bank_account_holder"),
  logo: text("logo"),
  isVerified: boolean("is_verified").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
}, (table) => ({
  statusIdx: index("idx_vendors_status").on(table.status),
}));

export const vendorPayouts = pgTable("vendor_payouts", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  vendorId: bigint("vendor_id", { mode: "number" }).notNull().references(() => vendors.id),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  iban: text("iban"),
  note: text("note"),
  status: payoutStatusEnum("status").notNull().default("pending"),
  requestedAt: timestamp("requested_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true, precision: 3 }),
  processedBy: bigint("processed_by", { mode: "number" }),
  rejectionReason: text("rejection_reason"),
}, (table) => ({
  vendorIdx: index("idx_payouts_vendor").on(table.vendorId),
}));
