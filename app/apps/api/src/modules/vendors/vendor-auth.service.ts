import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "node:crypto";
import { env } from "../../config/env";
import { sendMail } from "../../lib/mailer";
import { slugify } from "../../lib/slugify";
import { findCustomerById } from "../auth/auth.repository";
import {
  clearVendorResetToken,
  createIndividualVendor,
  createVendor,
  findVendorByCustomerId,
  findVendorByEmail,
  findVendorById,
  findVendorBySlug,
  findVendorByValidResetToken,
  setVendorResetToken,
  updateVendorProfile,
} from "./vendor.repository";
import type { UpdateVendorProfileInput, VendorLoginInput, VendorRegisterInput } from "./vendor-auth.schemas";

const SALT_ROUNDS = 12;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export class EmailInUseError extends Error {}
export class SlugInUseError extends Error {}
export class InvalidCredentialsError extends Error {}
export class VendorBannedError extends Error {}
export class WrongCurrentPasswordError extends Error {}
export class InvalidResetTokenError extends Error {}

function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

// bkz. auth.service.ts requestPasswordReset (müşteri eşdeğeri) - aynı
// enumeration korumasi, aynı 1 saatlik token ömrü.
export async function requestVendorPasswordReset(email: string) {
  const vendor = await findVendorByEmail(email);
  if (!vendor) return;

  const token = randomBytes(32).toString("hex");
  await setVendorResetToken(vendor.id, hashResetToken(token), new Date(Date.now() + RESET_TOKEN_TTL_MS));

  const link = `${env.SITE_URL}/satici/sifre-sifirla?token=${token}`;
  await sendMail(
    vendor.email,
    "Şifre Sıfırlama - Gülüm Şalım Satıcı Paneli",
    `<p>Merhaba ${vendor.fullName},</p>` +
      `<p>Satıcı hesabınızın şifresini sıfırlamak için <a href="${link}">bu bağlantıya</a> tıklayın. Bağlantı 1 saat geçerlidir.</p>` +
      `<p>Bu talebi siz oluşturmadıysanız bu e-postayı görmezden gelebilirsiniz.</p>`,
  );
}

export async function resetVendorPasswordWithToken(token: string, newPassword: string) {
  const vendor = await findVendorByValidResetToken(hashResetToken(token));
  if (!vendor) throw new InvalidResetTokenError();

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await updateVendorProfile(vendor.id, { passwordHash });
  await clearVendorResetToken(vendor.id);
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
  return createVendor({
    storeName: input.storeName,
    storeSlug: input.storeSlug,
    email: input.email,
    passwordHash,
    fullName: input.fullName,
    phone: input.phone,
  });
}

export class CustomerNotFoundError extends Error {}

// bkz. kullanıcı isteği: "bireysel olarak müşteri olarak kayıt olan
// kişilerde satış yapabilsin 2. el ürün letgo dolap gibi" - müşteri
// hesabından TEK TIKLA, admin onayı beklemeden, ayrı bir şifre girmeden
// bireysel satıcı hesabı açar (mevcut şifre hash'i doğrudan taşınır).
// Zaten bir bireysel satıcı hesabı varsa (idempotent) onu döner.
export async function becomeIndividualSeller(customerId: number) {
  const existing = await findVendorByCustomerId(customerId);
  if (existing) return existing;

  const customer = await findCustomerById(customerId);
  if (!customer) throw new CustomerNotFoundError();

  const baseSlug = slugify(customer.fullName) || "satici";
  let storeSlug = `${baseSlug}-${randomBytes(3).toString("hex")}`;
  while (await findVendorBySlug(storeSlug)) {
    storeSlug = `${baseSlug}-${randomBytes(3).toString("hex")}`;
  }

  let email = customer.email;
  if (await findVendorByEmail(email)) {
    // Bu e-postayla ayrı bir (kurumsal) satıcı hesabı zaten var - iki hesap
    // birbirinden bağımsız kalmalı, senkronize edilmeye çalışılmaz.
    const [local, domain] = customer.email.split("@");
    email = `${local}+ind${customerId}@${domain}`;
  }

  return createIndividualVendor({
    storeName: customer.fullName,
    storeSlug,
    email,
    passwordHash: customer.passwordHash,
    fullName: customer.fullName,
    phone: customer.phone ?? undefined,
    customerId,
  });
}

export async function verifyVendorCredentials(input: VendorLoginInput) {
  const vendor = await findVendorByEmail(input.email);
  if (!vendor) throw new InvalidCredentialsError();

  const valid = await bcrypt.compare(input.password, vendor.passwordHash);
  if (!valid) throw new InvalidCredentialsError();

  if (vendor.status === "banned") throw new VendorBannedError();

  return vendor;
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
