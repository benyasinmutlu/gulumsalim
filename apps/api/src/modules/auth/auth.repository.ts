import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "../../db/client";
import {
  cookieConsents,
  couponRedemptions,
  customerAddresses,
  customerNotifications,
  customerVendorMessages,
  customers,
  discoverEvents,
  discoverFeedback,
  fitFeedback,
  orderRefunds,
  orders,
  productFavorites,
  productQuestions,
  productReviews,
  siteFeedback,
  vendorComplaints,
  vendorFollowers,
  vendorReviews,
  vendors,
} from "../../db/schema/index";
import type { SizePrefs } from "../../db/schema/customers";

export async function findCustomerByEmail(email: string) {
  const [row] = await db.select().from(customers).where(eq(customers.email, email)).limit(1);
  return row ?? null;
}

export async function findCustomerById(id: number) {
  const [row] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  return row ?? null;
}

export async function findCustomerByGoogleId(googleId: string) {
  const [row] = await db.select().from(customers).where(eq(customers.googleId, googleId)).limit(1);
  return row ?? null;
}

// membershipConsentAt bilerek yok - Google ile anında açılan hesaplarda bu
// onay henüz alınmamıştır (bkz. auth.service.ts loginWithGoogle,
// completeGoogleConsent).
export async function createGoogleCustomer(data: { email: string; fullName: string; googleId: string; emailVerifiedAt: Date; avatarUrl?: string }) {
  const [row] = await db.insert(customers).values(data).returning();
  if (!row) throw new Error("Müşteri oluşturulamadı");
  return row;
}

// bkz. auth.routes.ts POST /auth/me/avatar - müşteri kendi fotoğrafını
// yükleyip Google'dan gelen (veya önceki) fotoğrafın yerine geçirir.
export async function setCustomerAvatar(id: number, avatarUrl: string) {
  const [row] = await db.update(customers).set({ avatarUrl }).where(eq(customers.id, id)).returning();
  if (!row) throw new Error("Müşteri bulunamadı");
  return row;
}

// bkz. auth.service.ts completeGoogleConsent - Google ile anında açılan
// hesabın eksik kalan Üyelik Sözleşmesi/KVKK onayını (ve varsa telefonu)
// girişten sonra tamamlar.
export async function setCustomerConsent(
  id: number,
  data: { membershipConsentAt: Date; marketingConsentAt?: Date; analyticsConsentAt?: Date; phone?: string },
) {
  const [row] = await db.update(customers).set(data).where(eq(customers.id, id)).returning();
  if (!row) throw new Error("Müşteri bulunamadı");
  return row;
}

// Var olan e-posta/şifre hesabıyla aynı e-postaya sahip bir Google hesabıyla
// giriş yapılırsa, iki ayrı hesap yerine mevcut hesaba google_id bağlanır
// (bkz. auth.service.ts loginWithGoogle) - Google e-postayı zaten doğruladığı
// için emailVerifiedAt de bu vesileyle dolduruluyor. avatarUrl de sadece
// müşterinin hiç fotoğrafı yoksa doldurulur (COALESCE) - kendi yüklediği bir
// fotoğraf varsa Google'ınkiyle sessizce değiştirilmez.
export async function linkGoogleId(id: number, googleId: string, avatarUrl: string | null) {
  const [row] = await db
    .update(customers)
    .set({
      googleId,
      emailVerifiedAt: sql`COALESCE(${customers.emailVerifiedAt}, now())`,
      avatarUrl: avatarUrl ? sql`COALESCE(${customers.avatarUrl}, ${avatarUrl})` : customers.avatarUrl,
    })
    .where(eq(customers.id, id))
    .returning();
  if (!row) throw new Error("Müşteri bulunamadı");
  return row;
}

export async function createCustomer(data: {
  email: string;
  passwordHash: string;
  fullName: string;
  phone?: string;
  membershipConsentAt?: Date;
  marketingConsentAt?: Date;
  analyticsConsentAt?: Date;
}) {
  const [row] = await db.insert(customers).values(data).returning();
  if (!row) throw new Error("Müşteri oluşturulamadı");
  return row;
}

export async function createGuestCustomer(data: { email: string; passwordHash: string; fullName: string; phone?: string }) {
  const [row] = await db.insert(customers).values({ ...data, isGuest: true }).returning();
  if (!row) throw new Error("Müşteri oluşturulamadı");
  return row;
}

// bkz. auth.service.ts registerCustomer - doğrulama e-postası gönderimi
// başarısız olursa (ör. Resend domain ayarı eksik), az önce oluşturulan
// (henüz sipariş/sepet/hiçbir bağlı verisi olmayan) hesap geri alınır -
// aksi halde asla doğrulanamayacak, kalıcı kilitli bir hesap kalırdı.
export async function deleteCustomer(id: number) {
  await db.delete(customers).where(eq(customers.id, id));
}

export async function updateGuestCustomerContact(id: number, data: { fullName: string; phone?: string }) {
  const [row] = await db.update(customers).set(data).where(eq(customers.id, id)).returning();
  if (!row) throw new Error("Müşteri bulunamadı");
  return row;
}

export async function updateCustomerProfile(
  id: number,
  data: Partial<{ fullName: string; phone: string; age: number; heightCm: number; weightKg: number; sizePrefs: SizePrefs; passwordHash: string }>,
) {
  const [row] = await db.update(customers).set(data).where(eq(customers.id, id)).returning();
  if (!row) throw new Error("Profil güncellenemedi");
  return row;
}

// "Şifremi Unuttum" akışı - bkz. auth.service.ts requestPasswordReset.
export async function setCustomerResetToken(id: number, tokenHash: string, expiresAt: Date) {
  await db.update(customers).set({ passwordResetTokenHash: tokenHash, passwordResetExpiresAt: expiresAt }).where(eq(customers.id, id));
}

// Token kontrolü, şifre değişimi ve token tüketimi TEK UPDATE içinde yapılır.
// Böylece aynı bağlantıya eşzamanlı iki istek gelse bile yalnızca biri başarılı
// olur; ikinci istek token ilk işlemde temizlendiği için satır güncelleyemez.
export async function consumeCustomerResetToken(tokenHash: string, passwordHash: string) {
  const [row] = await db
    .update(customers)
    .set({ passwordHash, passwordResetTokenHash: null, passwordResetExpiresAt: null })
    .where(and(eq(customers.passwordResetTokenHash, tokenHash), gt(customers.passwordResetExpiresAt, new Date())))
    .returning({ id: customers.id });
  return row ?? null;
}

// E-posta doğrulama - passwordReset* alan çiftiyle birebir aynı desen.
export async function setCustomerEmailVerificationToken(id: number, tokenHash: string, expiresAt: Date) {
  await db.update(customers).set({ emailVerificationTokenHash: tokenHash, emailVerificationExpiresAt: expiresAt }).where(eq(customers.id, id));
}

export async function findCustomerByValidEmailVerificationToken(tokenHash: string) {
  const [row] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.emailVerificationTokenHash, tokenHash), gt(customers.emailVerificationExpiresAt, new Date())))
    .limit(1);
  return row ?? null;
}

export async function markCustomerEmailVerified(id: number) {
  await db
    .update(customers)
    .set({ emailVerifiedAt: new Date(), emailVerificationTokenHash: null, emailVerificationExpiresAt: null })
    .where(eq(customers.id, id));
}

// bkz. kullanıcı isteği (2026-08-02): "müşteri üyelik iptali olacak" - bir
// hesabın platformda "izi" var mı (sipariş/değerlendirme/soru) - varsa
// kalıcı silme yerine anonimleştirme yoluna gidilir (bkz. deleteCustomerAccount,
// auth.service.ts). productReviews/productQuestions customerId'de FK
// kısıtlaması olmasa da (bkz. catalog.ts), satır silindiğinde bu herkese
// açık içerikler sahipsiz kalıp bozuk görünürdü - o yüzden ayrıca kontrol edilir.
export type DeleteCustomerDataResult =
  | { status: "not_found" }
  | { status: "deleted" | "anonymized"; avatarUrl: string | null };

// Hesap izi kontrolü ve silme/anonimleştirme aynı transaction ve satır kilidi
// altında yapılır. Böylece kontrol ile DELETE arasında yeni sipariş/yorum
// eklenmesiyle oluşabilecek yarış ve FK hataları kapanır.
export async function deleteCustomerAccountData(id: number): Promise<DeleteCustomerDataResult> {
  return db.transaction(async (tx) => {
    const [customer] = await tx
      .select({ id: customers.id, avatarUrl: customers.avatarUrl })
      .from(customers)
      .where(eq(customers.id, id))
      .limit(1)
      .for("update");
    if (!customer) return { status: "not_found" };

    const durableChecks = [
      await tx.select({ id: orders.id }).from(orders).where(eq(orders.customerId, id)).limit(1),
      await tx.select({ id: productReviews.id }).from(productReviews).where(eq(productReviews.customerId, id)).limit(1),
      await tx.select({ id: productQuestions.id }).from(productQuestions).where(eq(productQuestions.customerId, id)).limit(1),
      await tx.select({ id: customerVendorMessages.id }).from(customerVendorMessages).where(eq(customerVendorMessages.customerId, id)).limit(1),
      await tx.select({ id: vendorReviews.id }).from(vendorReviews).where(eq(vendorReviews.customerId, id)).limit(1),
      await tx.select({ id: vendorComplaints.id }).from(vendorComplaints).where(eq(vendorComplaints.customerId, id)).limit(1),
      await tx.select({ id: couponRedemptions.id }).from(couponRedemptions).where(eq(couponRedemptions.customerId, id)).limit(1),
      await tx.select({ id: orderRefunds.id }).from(orderRefunds).where(eq(orderRefunds.customerId, id)).limit(1),
      await tx.select({ id: vendors.id }).from(vendors).where(eq(vendors.customerId, id)).limit(1),
    ];
    const hasDurableFootprint = durableChecks.some((rows) => rows.length > 0);

    await tx.delete(customerAddresses).where(eq(customerAddresses.customerId, id));
    await tx.delete(productFavorites).where(eq(productFavorites.customerId, id));
    await tx.delete(vendorFollowers).where(eq(vendorFollowers.customerId, id));
    await tx.delete(customerNotifications).where(eq(customerNotifications.customerId, id));
    await tx.delete(discoverFeedback).where(eq(discoverFeedback.customerId, id));
    await tx.update(discoverEvents).set({ customerId: null }).where(eq(discoverEvents.customerId, id));
    await tx.update(fitFeedback).set({ customerId: null }).where(eq(fitFeedback.customerId, id));
    await tx.update(cookieConsents).set({ customerId: null }).where(eq(cookieConsents.customerId, id));
    await tx.update(siteFeedback).set({ customerId: null }).where(eq(siteFeedback.customerId, id));

    if (!hasDurableFootprint) {
      const deleted = await tx.delete(customers).where(eq(customers.id, id)).returning({ id: customers.id });
      if (deleted.length !== 1) throw new Error("Müşteri silinemedi");
      return { status: "deleted", avatarUrl: customer.avatarUrl };
    }

    await tx
      .update(customers)
      .set({
        fullName: "Silinmiş Kullanıcı",
        email: `silinmis-${id}-${Date.now()}@gulumsalim.local`,
        phone: null,
        passwordHash: null,
        avatarUrl: null,
        googleId: null,
        age: null,
        heightCm: null,
        weightKg: null,
        sizePrefs: null,
        emailVerifiedAt: null,
        emailVerificationTokenHash: null,
        emailVerificationExpiresAt: null,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        marketingConsentAt: null,
        analyticsConsentAt: null,
        deletedAt: new Date(),
      })
      .where(eq(customers.id, id));
    return { status: "anonymized", avatarUrl: customer.avatarUrl };
  });
}
