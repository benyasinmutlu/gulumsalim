import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { customerAddresses, customerNotifications, customers, orders, productFavorites, productQuestions, productReviews, vendorFollowers } from "../../db/schema/index";

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
  data: Partial<{ fullName: string; phone: string; age: number; heightCm: number; weightKg: number; passwordHash: string }>,
) {
  const [row] = await db.update(customers).set(data).where(eq(customers.id, id)).returning();
  if (!row) throw new Error("Profil güncellenemedi");
  return row;
}

// "Şifremi Unuttum" akışı - bkz. auth.service.ts requestPasswordReset.
export async function setCustomerResetToken(id: number, tokenHash: string, expiresAt: Date) {
  await db.update(customers).set({ passwordResetTokenHash: tokenHash, passwordResetExpiresAt: expiresAt }).where(eq(customers.id, id));
}

export async function findCustomerByValidResetToken(tokenHash: string) {
  const [row] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.passwordResetTokenHash, tokenHash), gt(customers.passwordResetExpiresAt, new Date())))
    .limit(1);
  return row ?? null;
}

export async function clearCustomerResetToken(id: number) {
  await db.update(customers).set({ passwordResetTokenHash: null, passwordResetExpiresAt: null }).where(eq(customers.id, id));
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
export async function customerHasFootprint(id: number): Promise<boolean> {
  const [[orderRow], [reviewRow], [questionRow]] = await Promise.all([
    db.select({ id: orders.id }).from(orders).where(eq(orders.customerId, id)).limit(1),
    db.select({ id: productReviews.id }).from(productReviews).where(eq(productReviews.customerId, id)).limit(1),
    db.select({ id: productQuestions.id }).from(productQuestions).where(eq(productQuestions.customerId, id)).limit(1),
  ]);
  return Boolean(orderRow || reviewRow || questionRow);
}

// İz bırakmamış (hiç sipariş/değerlendirme/soru vermemiş) hesap - kalıcı
// silinir, referans bütünlüğünü bozacak bir bağımlılığı yoktur.
export async function hardDeleteCustomer(id: number): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(customerAddresses).where(eq(customerAddresses.customerId, id));
    await tx.delete(productFavorites).where(eq(productFavorites.customerId, id));
    await tx.delete(vendorFollowers).where(eq(vendorFollowers.customerId, id));
    await tx.delete(customerNotifications).where(eq(customerNotifications.customerId, id));
    await tx.delete(customers).where(eq(customers.id, id));
  });
}

// İz bırakmış hesap - kişisel alanlar anonimleştirilir, satır (ve bağlı
// sipariş/değerlendirme/soru geçmişi) korunur. E-posta unique olduğu için
// tekrar kayıt olunabilsin diye benzersiz bir yer tutucuya değiştirilir.
export async function anonymizeCustomer(id: number): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(customerAddresses).where(eq(customerAddresses.customerId, id));
    await tx.delete(productFavorites).where(eq(productFavorites.customerId, id));
    await tx.delete(vendorFollowers).where(eq(vendorFollowers.customerId, id));
    await tx.delete(customerNotifications).where(eq(customerNotifications.customerId, id));
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
        deletedAt: new Date(),
      })
      .where(eq(customers.id, id));
  });
}
