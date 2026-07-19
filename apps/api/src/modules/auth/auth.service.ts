import bcrypt from "bcryptjs";
import { createCustomer, findCustomerByEmail } from "./auth.repository";
import type { LoginInput, RegisterInput } from "./auth.schemas";

const SALT_ROUNDS = 12;

export class EmailInUseError extends Error {}
export class InvalidCredentialsError extends Error {}

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
