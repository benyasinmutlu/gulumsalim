import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { adminUsers } from "../../db/schema/index";

export async function findAdminByUsername(username: string) {
  const [row] = await db.select().from(adminUsers).where(eq(adminUsers.username, username)).limit(1);
  return row ?? null;
}

export async function findAdminById(id: number) {
  const [row] = await db.select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1);
  return row ?? null;
}
