import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "node:crypto";
import { env } from "../../config/env";
import { emailButton, emailHeading, emailMuted, renderEmailLayout, sendMail } from "../../lib/mailer";
import { deleteObject } from "../../lib/storage";
import { slugify } from "../../lib/slugify";
import { findCustomerById } from "../auth/auth.repository";
import { deleteVendorIfNoBusinessHistory } from "../admin/admin-vendors.repository";
import { notifyVendorActivated } from "../notifications/vendor-activation-notification.service";
import {
  consumeVendorResetToken,
  closeVendorAccount,
  countOpenOrderItemsForVendor,
  createIndividualVendor,
  createVendor,
  deleteVendor,
  findVendorByCustomerId,
  findVendorByEmail,
  findVendorById,
  findVendorBySlug,
  findVendorByValidEmailVerificationToken,
  markVendorEmailVerified,
  setVendorEmailVerificationToken,
  setVendorResetToken,
  updateVendorProfile,
} from "./vendor.repository";
import type { BecomeIndividualSellerInput, UpdateVendorProfileInput, VendorLoginInput, VendorRegisterInput } from "./vendor-auth.schemas";

const SALT_ROUNDS = 12;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

export class EmailInUseError extends Error {}
export class SlugInUseError extends Error {}
export class InvalidCredentialsError extends Error {}
export class VendorBannedError extends Error {}
// bkz. kullanıcı isteği (2026-08-02): "satıcı üyelik iptali olacak" -
// VendorBannedError'dan kasıtlı olarak AYRI: kendi isteğiyle kapatmış bir
// satıcıya "hesabınız yasaklandı" demek yanıltıcı/rahatsız edici olurdu.
export class VendorClosedError extends Error {}
export class WrongCurrentPasswordError extends Error {}
export class InvalidResetTokenError extends Error {}
export class EmailNotVerifiedError extends Error {}
export class VendorNotFoundError extends Error {}
export class VendorHasOpenOrdersError extends Error {}
export class InvalidVerificationTokenError extends Error {}

function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function hashVerificationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function sendVendorVerificationEmail(vendor: { id: number; email: string; fullName: string }) {
  const token = randomBytes(32).toString("hex");
  await setVendorEmailVerificationToken(vendor.id, hashVerificationToken(token), new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS));

  const link = `${env.SITE_URL}/api/vendor/auth/verify-email?token=${token}`;
  const body =
    emailHeading("E-posta Adresinizi Doğrulayın") +
    `<p>Merhaba ${vendor.fullName},</p>` +
    `<p>Gülüm Şalım satıcı ailesine hoş geldiniz! Panelinizi kullanabilmek için e-posta adresinizi doğrulamanız gerekiyor.</p>` +
    emailButton(link, "E-postamı Doğrula") +
    emailMuted(`Bu bağlantı 24 saat geçerlidir. Buton çalışmazsa: <a href="${link}" style="color:#CC7C94;">${link}</a>`) +
    emailMuted("Bu kaydı siz oluşturmadıysanız bu e-postayı görmezden gelebilirsiniz.");
  await sendMail(
    vendor.email,
    "E-posta Adresinizi Doğrulayın - Gülüm Şalım Satıcı Paneli",
    renderEmailLayout("Satıcı hesabınızı doğrulamak için tıklayın", body),
  );
}

// bkz. auth.service.ts requestPasswordReset (müşteri eşdeğeri) - aynı
// enumeration korumasi, aynı 1 saatlik token ömrü.
export async function requestVendorPasswordReset(email: string) {
  const vendor = await findVendorByEmail(email);
  if (!vendor) return;

  const token = randomBytes(32).toString("hex");
  await setVendorResetToken(vendor.id, hashResetToken(token), new Date(Date.now() + RESET_TOKEN_TTL_MS));

  const link = `${env.SITE_URL}/satici/sifre-sifirla?token=${token}`;
  const body =
    emailHeading("Şifre Sıfırlama") +
    `<p>Merhaba ${vendor.fullName},</p>` +
    `<p>Satıcı hesabınızın şifresini sıfırlamak için aşağıdaki butona tıklayın.</p>` +
    emailButton(link, "Şifremi Sıfırla") +
    emailMuted(`Bu bağlantı 1 saat geçerlidir. Buton çalışmazsa: <a href="${link}" style="color:#CC7C94;">${link}</a>`) +
    emailMuted("Bu talebi siz oluşturmadıysanız bu e-postayı görmezden gelebilirsiniz.");
  await sendMail(vendor.email, "Şifre Sıfırlama - Gülüm Şalım Satıcı Paneli", renderEmailLayout("Şifrenizi sıfırlamak için tıklayın", body));
}

export async function resetVendorPasswordWithToken(token: string, newPassword: string) {
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  const consumed = await consumeVendorResetToken(hashResetToken(token), passwordHash);
  if (!consumed) throw new InvalidResetTokenError();
}

export async function registerVendor(input: VendorRegisterInput) {
  const [existingEmail, existingSlug] = await Promise.all([
    findVendorByEmail(input.email),
    findVendorBySlug(input.storeSlug),
  ]);
  if (existingEmail) throw new EmailInUseError();
  if (existingSlug) throw new SlugInUseError();

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  // Yeni satıcılar "pending" durumunda oluşturulur - admin onayı
  // (bkz. Faz 3) olmadan ürünleri hiçbir zaman public listede görünmez
  // (katalog sorguları vendors.status='active' şartı arıyor).
  const vendor = await createVendor({
    storeName: input.storeName,
    storeSlug: input.storeSlug,
    email: input.email,
    passwordHash,
    fullName: input.fullName,
    phone: input.phone,
    taxId: input.taxId,
    legalAddress: input.legalAddress,
    vendorConsentAt: new Date(),
  });
  try {
    await sendVendorVerificationEmail(vendor);
  } catch (err) {
    await deleteVendor(vendor.id);
    throw err;
  }
  return vendor;
}

export class CustomerNotFoundError extends Error {}

// bkz. kullanıcı isteği: "bireysel olarak müşteri olarak kayıt olan
// kişilerde satış yapabilsin 2. el ürün letgo dolap gibi" - müşteri
// hesabından TEK TIKLA, admin onayı beklemeden, ayrı bir şifre girmeden
// bireysel satıcı hesabı açar (mevcut şifre hash'i doğrudan taşınır).
// Zaten bir bireysel satıcı hesabı varsa (idempotent) onu döner.
export async function becomeIndividualSeller(customerId: number, input: BecomeIndividualSellerInput) {
  const existing = await findVendorByCustomerId(customerId);
  if (existing) return existing;

  const customer = await findCustomerById(customerId);
  if (!customer) throw new CustomerNotFoundError();

  const baseSlug = slugify(input.storeName) || "satici";
  let storeSlug = `${baseSlug}-${randomBytes(3).toString("hex")}`;
  while (await findVendorBySlug(storeSlug)) {
    storeSlug = `${baseSlug}-${randomBytes(3).toString("hex")}`;
  }

  // bkz. olay: 2026-08-01 "bireysel satıcı ile normal satıcının mailleri
  // çakışmamalı" - her zaman (sadece çakışma anında değil) namespaced bir
  // e-posta üretilir. Böylece müşterinin çıplak e-postası hiçbir zaman bir
  // vendor satırı tarafından tüketilmez; aynı kişi ileride o e-postayla
  // bağımsız bir kurumsal satıcı hesabı açmak isterse (registerVendor)
  // "e-posta zaten kayıtlı" hatasıyla karşılaşmaz. Gmail/Outlook gibi
  // sağlayıcılarda "+etiket" aynı gelen kutusuna düşer, bu yüzden
  // doğrulama/bildirim e-postaları müşteri hâlâ görür (bkz. aşağıdaki
  // sendVendorVerificationEmail).
  const [local, domain] = customer.email.split("@");
  const email = `${local}+ind${customerId}@${domain}`;

  // Bireysel satıcı hesabı, zaten doğrulanmış bir müşteri hesabının
  // ANINDA (bekleme olmadan) genişletilmiş hali - müşteri tarafında e-posta
  // zaten doğrulandığı için burada ikinci bir doğrulama e-postası
  // beklemek "tek tık, anında satışa başla" iş kuralını bozardı.
  // customer.passwordHash null olabilir (Google ile kayıt olmuş, hiç şifre
  // belirlememiş müşteri - bkz. db/schema/customers.ts googleId yorumu).
  // Satıcı hesabı yine de açılır; rastgele, kimsenin bilmediği bir hash
  // atanır - satıcı girişi müşteri girişinden ayrı bir akış olduğu için bu
  // hesaba "Şifremi Unuttum" ile kendi şifresini belirleyerek girer.
  const vendorPasswordHash = customer.passwordHash ?? (await bcrypt.hash(randomBytes(32).toString("hex"), SALT_ROUNDS));
  const vendor = await createIndividualVendor({
    storeName: input.storeName,
    storeSlug,
    email,
    passwordHash: vendorPasswordHash,
    fullName: customer.fullName,
    phone: customer.phone ?? undefined,
    customerId,
    taxId: input.taxId,
    legalAddress: input.legalAddress,
    vendorConsentAt: new Date(),
  });
  await markVendorEmailVerified(vendor.id);
  await notifyVendorActivated(vendor);
  return vendor;
}

export async function verifyVendorCredentials(input: VendorLoginInput) {
  const vendor = await findVendorByEmail(input.email);
  if (!vendor) throw new InvalidCredentialsError();

  const valid = await bcrypt.compare(input.password, vendor.passwordHash);
  if (!valid) throw new InvalidCredentialsError();

  if (vendor.status === "closed") {
    throw new VendorClosedError();
  }
  if (vendor.status === "banned" || vendor.status === "suspended") {
    throw new VendorBannedError();
  }

  if (!vendor.emailVerifiedAt) throw new EmailNotVerifiedError();

  return vendor;
}

export async function verifyVendorEmailWithToken(token: string) {
  const vendor = await findVendorByValidEmailVerificationToken(hashVerificationToken(token));
  if (!vendor) throw new InvalidVerificationTokenError();
  await markVendorEmailVerified(vendor.id);
  return vendor;
}

export async function resendVendorVerificationEmail(email: string) {
  const vendor = await findVendorByEmail(email);
  if (!vendor || vendor.emailVerifiedAt) return;
  await sendVendorVerificationEmail(vendor);
}

export async function updateVendorAccount(vendorId: number, input: UpdateVendorProfileInput) {
  const { currentPassword, newPassword, ...rest } = input;
  const data: Record<string, unknown> = { ...rest };

  if (newPassword) {
    const vendor = await findVendorById(vendorId);
    if (!vendor) throw new Error("Satıcı bulunamadı");
    const valid = await bcrypt.compare(currentPassword ?? "", vendor.passwordHash);
    if (!valid) throw new WrongCurrentPasswordError();
    data.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  }

  return updateVendorProfile(vendorId, data);
}

// bkz. kullanıcı isteği (2026-08-02): "satıcı üyelik iptali olacak" - hiç
// ürünü olmayan (dolayısıyla hiç siparişi de olamayan) satıcı kalıcı
// silinir (bkz. admin-vendors.repository.ts deleteVendorIfNoBusinessHistory, admin
// panelin kullandığı AYNI fonksiyon); ürünü olan satıcı "closed" durumuna
// alınır, ürünleri pasife düşer, vergi/muhasebe kayıtları korunur (bkz.
// vendor.repository.ts closeVendorAccount). Teslim edilmemiş/tamamlanmamış
// siparişi varsa (pending/processing/shipped) müşteri mağdur olmasın diye
// kapatma tamamen engellenir.
export async function closeVendorSelfAccount(vendorId: number): Promise<void> {
  const vendor = await findVendorById(vendorId);
  if (!vendor) throw new VendorNotFoundError();

  const openOrders = await countOpenOrderItemsForVendor(vendorId);
  if (openOrders > 0) throw new VendorHasOpenOrdersError();

  const result = await deleteVendorIfNoBusinessHistory(vendorId);
  if (result.status === "deleted") {
    for (const url of result.mediaUrls) deleteObject(url).catch(() => {});
  } else {
    await closeVendorAccount(vendorId);
  }
}
