import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "node:crypto";
import { env } from "../../config/env";
import { emailButton, emailHeading, emailMuted, renderEmailLayout, sendMail } from "../../lib/mailer";
import { verifyGoogleIdToken } from "../../lib/google-auth";
import {
  consumeCustomerResetToken,
  createCustomer,
  createGoogleCustomer,
  deleteCustomerAccountData,
  deleteCustomer,
  findCustomerByEmail,
  findCustomerByGoogleId,
  findCustomerById,
  findCustomerByValidEmailVerificationToken,
  linkGoogleId,
  markCustomerEmailVerified,
  setCustomerConsent,
  setCustomerEmailVerificationToken,
  setCustomerResetToken,
  updateCustomerProfile,
} from "./auth.repository";
import type { LoginInput, RegisterInput, UpdateProfileInput } from "./auth.schemas";
import type { SizePrefs } from "../../db/schema/customers";
import { deleteObject } from "../../lib/storage";

const SALT_ROUNDS = 12;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

export class EmailInUseError extends Error {}
export class InvalidCredentialsError extends Error {}
export class WrongCurrentPasswordError extends Error {}
export class InvalidResetTokenError extends Error {}
export class EmailNotVerifiedError extends Error {}
export class InvalidVerificationTokenError extends Error {}
export class CustomerNotFoundError extends Error {}

function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function hashVerificationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function sendVerificationEmail(customer: { id: number; email: string; fullName: string }) {
  const token = randomBytes(32).toString("hex");
  await setCustomerEmailVerificationToken(customer.id, hashVerificationToken(token), new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS));

  const link = `${env.SITE_URL}/api/auth/verify-email?token=${token}`;
  const body =
    emailHeading("E-posta Adresinizi Doğrulayın") +
    `<p>Merhaba ${customer.fullName},</p>` +
    `<p>Gülüm Şalım'a hoş geldiniz! Hesabınızı kullanabilmek için e-posta adresinizi doğrulamanız gerekiyor.</p>` +
    emailButton(link, "E-postamı Doğrula") +
    emailMuted(`Bu bağlantı 24 saat geçerlidir. Buton çalışmazsa: <a href="${link}" style="color:#CC7C94;">${link}</a>`) +
    emailMuted("Bu kaydı siz oluşturmadıysanız bu e-postayı görmezden gelebilirsiniz.");
  await sendMail(customer.email, "E-posta Adresinizi Doğrulayın - Gülüm Şalım", renderEmailLayout("Hesabınızı doğrulamak için tıklayın", body));
}

// bkz. kullanıcı isteği: "email doğrulamayı hem müşteri hem de satıcı için
// zorunlu olmalı" - misafir (isGuest) hesaplar hariç, kayıt formunu
// dolduran her yeni üyeye doğrulama e-postası gider; doğrulanana kadar
// giriş yapılamaz (bkz. verifyCustomerCredentials).
export async function registerCustomer(input: RegisterInput) {
  const existing = await findCustomerByEmail(input.email);
  if (existing) throw new EmailInUseError();

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const now = new Date();
  const customer = await createCustomer({
    email: input.email,
    passwordHash,
    fullName: input.fullName,
    phone: input.phone,
    membershipConsentAt: now,
    marketingConsentAt: input.marketingConsent ? now : undefined,
    analyticsConsentAt: input.analyticsConsent ? now : undefined,
  });
  try {
    await sendVerificationEmail(customer);
  } catch (err) {
    await deleteCustomer(customer.id);
    throw err;
  }
  return customer;
}

export async function verifyCustomerCredentials(input: LoginInput) {
  const customer = await findCustomerByEmail(input.email);
  // passwordHash null = hesap sadece Google ile oluşturulmuş, hiç şifresi
  // yok - normal girişte "e-posta veya şifre hatalı" ile aynı genel hataya
  // düşer (bkz. auth.repository.ts createGoogleCustomer), hesabın var
  // olduğunu enumeration'a açacak ayrı bir mesaj verilmez. Silinmiş hesap
  // (bkz. deleteCustomerAccount) da aynı genel hatayla reddedilir - hesabın
  // var olup silindiğini enumeration'a açmaz.
  if (!customer || !customer.passwordHash || customer.deletedAt) throw new InvalidCredentialsError();

  const valid = await bcrypt.compare(input.password, customer.passwordHash);
  if (!valid) throw new InvalidCredentialsError();

  if (!customer.isGuest && !customer.emailVerifiedAt) throw new EmailNotVerifiedError();

  return customer;
}

// bkz. kullanıcı isteği: "google ile giriş yap a tıklayınca direkt kayıt
// yapılsın eksik bilgileri giriş yapınca tamamlatalım" - tek uç hem giriş
// hem kayıt: googleId ile eşleşme aranır; yoksa aynı e-postaya kayıtlı bir
// şifre hesabı varsa (Google e-postayı zaten doğruladığı için güvenle) ona
// bağlanır; o da yoksa YENİ hesap anında açılır. Üyelik Sözleşmesi/KVKK
// onayı bu adımda alınamadığı için (Google popup'ında checkbox yok) yeni
// hesaplarda membershipConsentAt boş kalır - customer.needsConsent alanı
// (bkz. auth.routes.ts publicCustomer) frontend'e bunu tamamlatması
// gerektiğini söyler (bkz. uyelik-tamamla/page.tsx, completeGoogleConsent).
export async function loginWithGoogle(idToken: string) {
  const identity = await verifyGoogleIdToken(idToken);

  const byGoogleId = await findCustomerByGoogleId(identity.googleId);
  if (byGoogleId) return byGoogleId;

  const byEmail = await findCustomerByEmail(identity.email);
  if (byEmail) return linkGoogleId(byEmail.id, identity.googleId, identity.picture);

  return createGoogleCustomer({
    email: identity.email,
    fullName: identity.fullName,
    googleId: identity.googleId,
    emailVerifiedAt: new Date(),
    avatarUrl: identity.picture ?? undefined,
  });
}

// Google ile anında açılan hesaplarda eksik kalan tek zorunlu bilgi -
// Üyelik Sözleşmesi + KVKK onayı. Diğer alanlarla (ad soyad, e-posta,
// telefon) aynı /auth/me formuna değil, ayrı bir uca konuldu çünkü sadece
// bu onay eksikken (needsConsent) bir kere gösterilecek bir akış.
export async function completeGoogleConsent(
  customerId: number,
  consent: { marketingConsent: boolean; analyticsConsent: boolean; phone?: string },
) {
  const now = new Date();
  return setCustomerConsent(customerId, {
    membershipConsentAt: now,
    marketingConsentAt: consent.marketingConsent ? now : undefined,
    analyticsConsentAt: consent.analyticsConsent ? now : undefined,
    phone: consent.phone,
  });
}

export async function verifyCustomerEmailWithToken(token: string) {
  const customer = await findCustomerByValidEmailVerificationToken(hashVerificationToken(token));
  if (!customer) throw new InvalidVerificationTokenError();
  await markCustomerEmailVerified(customer.id);
  return customer;
}

export async function resendCustomerVerificationEmail(email: string) {
  const customer = await findCustomerByEmail(email);
  if (!customer || customer.isGuest || customer.emailVerifiedAt) return;
  await sendVerificationEmail(customer);
}

// Şifremi Unuttum: e-posta kayıtlı bir üye hesabına (misafir değil) aitse
// tek kullanımlık, 1 saat geçerli bir token üretilip mail atılır. E-posta
// kayıtlı olsun olmasın route her zaman aynı genel yanıtı döneceği için
// (bkz. auth.routes.ts) burada sessizce çıkmak enumeration'a karşı yeterli.
export async function requestPasswordReset(email: string) {
  const customer = await findCustomerByEmail(email);
  if (!customer || customer.isGuest) return;

  const token = randomBytes(32).toString("hex");
  await setCustomerResetToken(customer.id, hashResetToken(token), new Date(Date.now() + RESET_TOKEN_TTL_MS));

  const link = `${env.SITE_URL}/sifre-sifirla?token=${token}`;
  const body =
    emailHeading("Şifre Sıfırlama") +
    `<p>Merhaba ${customer.fullName},</p>` +
    `<p>Hesabınızın şifresini sıfırlamak için aşağıdaki butona tıklayın.</p>` +
    emailButton(link, "Şifremi Sıfırla") +
    emailMuted(`Bu bağlantı 1 saat geçerlidir. Buton çalışmazsa: <a href="${link}" style="color:#CC7C94;">${link}</a>`) +
    emailMuted("Bu talebi siz oluşturmadıysanız bu e-postayı görmezden gelebilirsiniz.");
  await sendMail(customer.email, "Şifre Sıfırlama - Gülüm Şalım", renderEmailLayout("Şifrenizi sıfırlamak için tıklayın", body));
}

export async function resetPasswordWithToken(token: string, newPassword: string) {
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  const consumed = await consumeCustomerResetToken(hashResetToken(token), passwordHash);
  if (!consumed) throw new InvalidResetTokenError();
}

// gulumsalim.com'daki hesabım/profil formunun karşılığı - şifre sadece
// mevcut şifre doğru girildiğinde ve yeni şifre alanı doluysa değişir,
// diğer alanlar (ad soyad, telefon) her zaman güncellenebilir.
export async function updateProfile(customerId: number, input: UpdateProfileInput) {
  const data: Partial<{
    fullName: string;
    phone: string;
    age: number;
    heightCm: number;
    weightKg: number;
    sizePrefs: SizePrefs;
    passwordHash: string;
  }> = {
    fullName: input.fullName,
    phone: input.phone,
    age: input.age,
    heightCm: input.heightCm,
    weightKg: input.weightKg,
    sizePrefs: input.sizePrefs,
  };

  if (input.newPassword) {
    const customer = await findCustomerById(customerId);
    if (!customer) throw new Error("Müşteri bulunamadı");
    // passwordHash null = hesap Google ile açılmış, hiç şifresi yok - ilk
    // şifreyi belirlerken karşılaştıracak bir şey olmadığı için
    // currentPassword kontrolü atlanır (bkz. customers.ts googleId yorumu).
    if (customer.passwordHash) {
      const valid = await bcrypt.compare(input.currentPassword ?? "", customer.passwordHash);
      if (!valid) throw new WrongCurrentPasswordError();
    }
    data.passwordHash = await bcrypt.hash(input.newPassword, SALT_ROUNDS);
  }

  return updateCustomerProfile(customerId, data);
}

// bkz. kullanıcı isteği (2026-08-02): "müşteri üyelik iptali olacak" - hiç
// sipariş/değerlendirme/soru izi olmayan hesaplar kalıcı silinir; izi
// olanlar (sipariş geçmişi, satıcı muhasebesi ve platform bütünlüğü için)
// anonimleştirilip pasife düşürülür (bkz. auth.repository.ts
// anonymizeCustomer/hardDeleteCustomer). Çağıran taraf (auth.routes.ts)
// başarılı dönüşten sonra oturumu sonlandırır.
export async function deleteCustomerAccount(customerId: number): Promise<void> {
  const result = await deleteCustomerAccountData(customerId);
  if (result.status === "not_found") throw new CustomerNotFoundError();
  if (result.avatarUrl) deleteObject(result.avatarUrl).catch(() => {});
}
