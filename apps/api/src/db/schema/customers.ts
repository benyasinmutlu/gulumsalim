import { bigint, boolean, index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { vendors } from "./vendors";

// age/heightCm/weightKg: gulumsalim.com'daki hesabım/profil formunun beden
// önerisi için topladığı bilgiler - şu an bunu kullanan bir öneri özelliği
// yeni sitede yok, ama veri toplama alanı birebir aynı olsun diye eklendi.
export const customers = pgTable("customers", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  age: integer("age"),
  heightCm: integer("height_cm"),
  weightKg: integer("weight_kg"),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true, precision: 3 }),
  // checkout.php'deki misafir (üyeliksiz) sipariş desteğinin karşılığı -
  // eski site customer_id'yi null bırakıyordu, yeni şemada tüm sipariş/
  // adres/favori sorguları customerId'nin var olduğunu varsaydığı için
  // bunun yerine kayıt formu doldurulmadan arka planda "misafir" bir
  // customer satırı oluşturuluyor (bkz. checkout.service.ts
  // findOrCreateGuestCustomer). Admin panelinde ayırt etmek için bu bayrak var.
  isGuest: boolean("is_guest").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
});

// gulumsalim.com'daki hesabım/adres defterinin karşılığı - checkout'taki
// tek seferlik shippingAddress'ten farklı olarak, müşterinin tekrar
// kullanabileceği kayıtlı adresler.
export const customerAddresses = pgTable("customer_addresses", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  customerId: bigint("customer_id", { mode: "number" }).notNull().references(() => customers.id),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  city: text("city").notNull(),
  district: text("district").notNull(),
  addressLine: text("address_line").notNull(),
  zipCode: text("zip_code"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
}, (table) => ({
  customerIdx: index("idx_customer_addresses_customer").on(table.customerId),
}));

// gulumsalim.com'daki follow.php'nin karşılığı - müşteri bir mağazayı
// takip eder, hesabım/takip ettiğim mağazalar sekmesinde listelenir.
export const vendorFollowers = pgTable("vendor_followers", {
  customerId: bigint("customer_id", { mode: "number" }).notNull().references(() => customers.id),
  vendorId: bigint("vendor_id", { mode: "number" }).notNull().references(() => vendors.id),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
}, (table) => ({
  pk: uniqueIndex("pk_vendor_followers").on(table.customerId, table.vendorId),
  vendorIdx: index("idx_vendor_followers_vendor").on(table.vendorId),
}));

export const adminUsers = pgTable("admin_users", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
});

export const contactMessages = pgTable("contact_messages", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
});
