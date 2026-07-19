import bcrypt from "bcryptjs";
import { findAdminByUsername } from "./admin.repository";
import type { AdminLoginInput } from "./admin-auth.schemas";

export class InvalidCredentialsError extends Error {}

export async function verifyAdminCredentials(input: AdminLoginInput) {
  const admin = await findAdminByUsername(input.username);
  if (!admin) throw new InvalidCredentialsError();

  const valid = await bcrypt.compare(input.password, admin.passwordHash);
  if (!valid) throw new InvalidCredentialsError();

  return admin;
}
