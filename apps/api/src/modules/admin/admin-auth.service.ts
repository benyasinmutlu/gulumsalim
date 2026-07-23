import bcrypt from "bcryptjs";
import { findAdminById, findAdminByUsername, updateAdminProfile } from "./admin.repository";
import type { AdminLoginInput } from "./admin-auth.schemas";
import type { UpdateAdminProfileInput } from "./admin-settings.schemas";

const SALT_ROUNDS = 12;

export class InvalidCredentialsError extends Error {}
export class WrongCurrentPasswordError extends Error {}

export async function verifyAdminCredentials(input: AdminLoginInput) {
  const admin = await findAdminByUsername(input.username);
  if (!admin) throw new InvalidCredentialsError();

  const valid = await bcrypt.compare(input.password, admin.passwordHash);
  if (!valid) throw new InvalidCredentialsError();

  return admin;
}

export async function updateAdminOwnProfile(adminId: number, input: UpdateAdminProfileInput) {
  const data: Partial<{ fullName: string; passwordHash: string }> = {};
  if (input.fullName) data.fullName = input.fullName;

  if (input.newPassword) {
    const admin = await findAdminById(adminId);
    if (!admin) throw new Error("Admin bulunamadı");
    const valid = await bcrypt.compare(input.currentPassword ?? "", admin.passwordHash);
    if (!valid) throw new WrongCurrentPasswordError();
    data.passwordHash = await bcrypt.hash(input.newPassword, SALT_ROUNDS);
  }

  return updateAdminProfile(adminId, data);
}
