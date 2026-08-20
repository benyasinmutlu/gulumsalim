import { bigint, boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { vendors } from "./vendors";

// Müşterinin kayıtlı beden tercihleri (profilde düzenlenebilir). "Bedenime
// uygun göster" filtresi bunları kullanır: her tip ayrı tutulur çünkü komşu
// beden (±1) adımı tipe göre değişir (ayakkabı 37-38-39 vs kadın 38-40-42).
export type SizePrefs = {
  kadinBeden?: string[]; // "S","M","L" / "38","40"
  ayakkabiNo?: number[]; // 37, 38, 39
  cocukBeden?: string[]; // "5-6 yaş" / "104"
};

// age/heightCm/weightKg: gulumsalim.com'daki hesabım/profil formunun beden
// önerisi için topladığı bilgiler - şu an bunu kullanan bir öneri özelliği
// yeni sitede yok, ama veri toplama alanı birebir aynı olsun diye eklendi.
export const customers = pgTable("customers", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  email: text("email").notNull().unique(),
  // Google ile kayıt olan hesaplarda şifre hiç oluşturulmaz - passwordHash bu
  // yüzden nullable (bkz. auth.service.ts registerWithGoogle). googleId,
  // Google'ın "sub" (subject) alanı - e-postadan farklı olarak asla değişmez,
  // eşleştirme bunun üzerinden yapılır (bkz. loginWithGoogle).
  passwordHash: text("password_hash"),
  googleId: text("google_id").unique(),
  // Google ile ilk kayıtta hesabın profil fotoğrafından doldurulur (bkz.
  // auth.service.ts loginWithGoogle), sonra müşteri kendi fotoğrafını
  // yükleyerek değiştirebilir (bkz. auth.routes.ts POST /auth/me/avatar) -
  // o noktadan sonra Google girişleri bunun üzerine yazmaz.
  avatarUrl: text("avatar_url"),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  age: integer("age"),
  heightCm: integer("height_cm"),
  weightKg: integer("weight_kg"),
  // Beden tercihleri (profil formundan yazılır, "bedenime uygun" filtresi okur).
  sizePrefs: jsonb("size_prefs").$type<SizePrefs>(),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true, precision: 3 }),
  // bkz. kullanıcı isteği: "email doğrulamayı hem müşteri hem de satıcı için
  // zorunlu olmalı" - passwordResetTokenHash ile aynı desen (ham token
  // yerine hash saklanır). Misafir kayıtlarda hiç üretilmez.
  emailVerificationTokenHash: text("email_verification_token_hash"),
  emailVerificationExpiresAt: timestamp("email_verification_expires_at", { withTimezone: true, precision: 3 }),
  // Kayıt formundaki zorunlu "Üyelik Sözleşmesi + KVKK" onayı ile
  // opsiyonel iki ayrı rıza (bkz. avukat belgeleri: Ticari Elektronik İleti
  // Onayı, Açık Rıza Metni). Dolu = onay verilmiş; misafir kayıtlarda
  // (createGuestCustomer) hiçbiri set edilmez çünkü misafir formu hiç görmedi.
  membershipConsentAt: timestamp("membership_consent_at", { withTimezone: true, precision: 3 }),
  marketingConsentAt: timestamp("marketing_consent_at", { withTimezone: true, precision: 3 }),
  analyticsConsentAt: timestamp("analytics_consent_at", { withTimezone: true, precision: 3 }),
  // checkout.php'deki misafir (üyeliksiz) sipariş desteğinin karşılığı -
  // eski site customer_id'yi null bırakıyordu, yeni şemada tüm sipariş/
  // adres/favori sorguları customerId'nin var olduğunu varsaydığı için
  // bunun yerine kayıt formu doldurulmadan arka planda "misafir" bir
  // customer satırı oluşturuluyor (bkz. checkout.service.ts
  // findOrCreateGuestCustomer). Admin panelinde ayırt etmek için bu bayrak var.
  isGuest: boolean("is_guest").notNull().default(false),
  // "Şifremi Unuttum" akışı için - ham token yerine hash saklanır (bkz.
  // auth.service.ts requestPasswordReset), süresi dolan/kullanılan token
  // temizlenir. Tek seferde tek aktif token yeterli, ayrı bir tabloya gerek yok.
  passwordResetTokenHash: text("password_reset_token_hash"),
  passwordResetExpiresAt: timestamp("password_reset_expires_at", { withTimezone: true, precision: 3 }),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  // bkz. kullanıcı isteği (2026-08-02): "müşteri üyelik iptali olacak" -
  // sipariş/değerlendirme geçmişi olan hesaplar kalıcı silinmez (referans
  // bütünlüğü + platform geçmişi), bunun yerine kişisel alanlar
  // anonimleştirilip bu alan doldurulur. Hiç izi olmayan (sipariş/
  // değerlendirme/soru) hesaplar doğrudan silinir (bkz. auth.service.ts
  // deleteCustomerAccount) - o durumda bu alana hiç gerek kalmaz.
  deletedAt: timestamp("deleted_at", { withTimezone: true, precision: 3 }),
});

// Müşteri hesabı bildirim kutusu (sipariş kargoya verildi/teslim edildi,
// iade karar bilgisi vb.) - vendor_notifications ile birebir aynı şema,
// sadece vendorId yerine customerId (bkz. notifications.repository.ts'teki
// satıcı karşılığı).
export const customerNotifications = pgTable("customer_notifications", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  customerId: bigint("customer_id", { mode: "number" }).notNull().references(() => customers.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message"),
  link: text("link"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
}, (table) => ({
  customerIdx: index("idx_customer_notifications_customer").on(table.customerId, table.isRead, table.createdAt),
}));

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

// bkz. kullanıcı isteği: "websitesine her giren kişiye eğer belirli bir
// süre kaldıysa değerlendirme yeri çıkartalım ona tıklayıp bizi
// değerlendirsin eleştiri öneri şikayette bulunsun" - mağaza şikayetinden
// (vendorComplaints) ayrı: bu genel SİTE deneyimi hakkında, giriş şartı yok
// (misafirler de gönderebilir, bkz. site-feedback.routes.ts).
// Çerez tercih panelinin (bkz. cookie-consent-banner.tsx) sunucu tarafı
// kaydı - önceden sadece localStorage'da tutuluyordu, KVKK/denetim
// açısından kanıt sayılmaz. Ek-sadece (append-only): her "Tümünü Kabul
// Et"/"Sadece Zorunlu"/özel tercih kaydı yeni bir satır - biri fikrini
// değiştirirse eski kayıt silinmez, bir denetim izi oluşur. "Zorunlu"
// kolonu yok çünkü her zaman true - satırın var olması zaten kanıt.
export const cookieConsents = pgTable("cookie_consents", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  sessionId: text("session_id").notNull(),
  customerId: bigint("customer_id", { mode: "number" }).references(() => customers.id),
  performance: boolean("performance").notNull().default(false),
  functionality: boolean("functionality").notNull().default(false),
  advertising: boolean("advertising").notNull().default(false),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  decidedAt: timestamp("decided_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
}, (table) => ({
  sessionIdx: index("idx_cookie_consents_session").on(table.sessionId),
}));

export const siteFeedback = pgTable("site_feedback", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  customerId: bigint("customer_id", { mode: "number" }).references(() => customers.id),
  rating: integer("rating"),
  category: text("category"),
  message: text("message").notNull(),
  pageUrl: text("page_url"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
});

// Footer bülten (newsletter) kayıt bandı - contact_messages ile aynı
// gerekçeyle misafir-dostu (giriş şartı yok), tek alan: e-posta.
export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
});
