import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "node:crypto";
import { env } from "../../config/env";
import { sendMail } from "../../lib/mailer";
import {
  clearCustomerResetToken,
  createCustomer,
  findCustomerByEmail,
  findCustomerById,
  findCustomerByValidResetToken,
  setCustomerResetToken,
  updateCustomerProfile,
} from "./auth.repository";
import type { LoginInput, RegisterInput, UpdateProfileInput } from "./auth.schemas";

const SALT_ROUNDS = 12;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export class EmailInUseError extends Error {}
export class InvalidCredentialsError extends Error {}
export class WrongCurrentPasswordError extends Error {}
export class InvalidResetTokenError extends Error {}

function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function registerCustomer(input: RegisterInput) {
  const existing = await findCustomerByEmail(input.email);
  if (existing) throw new EmailInUseError();

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const now = new Date();
  return createCustomer({
    email: input.email,
    passwordHash,
    fullName: input.fullName,
    phone: input.phone,
    membershipConsentAt: now,
    marketingConsentAt: input.marketingConsent ? now : undefined,
    analyticsConsentAt: input.analyticsConsent ? now : undefined,
  });
}

export async function verifyCustomerCredentials(input: LoginInput) {
  const customer = await findCustomerByEmail(input.email);
  if (!customer) throw new InvalidCredentialsError();

  const valid = await bcrypt.compare(input.password, customer.passwordHash);
  if (!valid) throw new InvalidCredentialsError();

  return customer;
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
  await sendMail(
    customer.email,
    "Şifre Sıfırlama - Gülüm Şalım",
    `<p>Merhaba ${customer.fullName},</p>` +
      `<p>Hesabınızın şifresini sıfırlamak için <a href="${link}">bu bağlantıya</a> tıklayın. Bağlantı 1 saat geçerlidir.</p>` +
      `<p>Bu talebi siz oluşturmadıysanız bu e-postayı görmezden gelebilirsiniz.</p>`,
  );
}

export async function resetPasswordWithToken(token: string, newPassword: string) {
  const customer = await findCustomerByValidResetToken(hashResetToken(token));
  if (!customer) throw new InvalidResetTokenError();

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await updateCustomerProfile(customer.id, { passwordHash });
  await clearCustomerResetToken(customer.id);
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
    passwordHash: string;
  }> = {
    fullName: input.fullName,
    phone: input.phone,
    age: input.age,
    heightCm: input.heightCm,
    weightKg: input.weightKg,
  };

  if (input.newPassword) {
    const customer = await findCustomerById(customerId);
    if (!customer) throw new Error("Müşteri bulunamadı");
    const valid = await bcrypt.compare(input.currentPassword ?? "", customer.passwordHash);
    if (!valid) throw new WrongCurrentPasswordError();
    data.passwordHash = await bcrypt.hash(input.newPassword, SALT_ROUNDS);
  }

  return updateCustomerProfile(customerId, data);
}
