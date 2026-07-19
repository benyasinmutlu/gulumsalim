import bcrypt from "bcryptjs";
import { createVendor, findVendorByEmail, findVendorBySlug } from "./vendor.repository";
import type { VendorLoginInput, VendorRegisterInput } from "./vendor-auth.schemas";

const SALT_ROUNDS = 12;

export class EmailInUseError extends Error {}
export class SlugInUseError extends Error {}
export class InvalidCredentialsError extends Error {}
export class VendorBannedError extends Error {}

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

export async function verifyVendorCredentials(input: VendorLoginInput) {
  const vendor = await findVendorByEmail(input.email);
  if (!vendor) throw new InvalidCredentialsError();

  const valid = await bcrypt.compare(input.password, vendor.passwordHash);
  if (!valid) throw new InvalidCredentialsError();

  if (vendor.status === "banned") throw new VendorBannedError();

  return vendor;
}
