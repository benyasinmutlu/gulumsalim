import bcrypt from "bcryptjs";
import { createCustomer, findCustomerByEmail, findCustomerById, updateCustomerProfile } from "./auth.repository";
import type { LoginInput, RegisterInput, UpdateProfileInput } from "./auth.schemas";

const SALT_ROUNDS = 12;

export class EmailInUseError extends Error {}
export class InvalidCredentialsError extends Error {}
export class WrongCurrentPasswordError extends Error {}

export async function registerCustomer(input: RegisterInput) {
  const existing = await findCustomerByEmail(input.email);
  if (existing) throw new EmailInUseError();

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  return createCustomer({
    email: input.email,
    passwordHash,
    fullName: input.fullName,
    phone: input.phone,
  });
}

export async function verifyCustomerCredentials(input: LoginInput) {
  const customer = await findCustomerByEmail(input.email);
  if (!customer) throw new InvalidCredentialsError();

  const valid = await bcrypt.compare(input.password, customer.passwordHash);
  if (!valid) throw new InvalidCredentialsError();

  return customer;
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
