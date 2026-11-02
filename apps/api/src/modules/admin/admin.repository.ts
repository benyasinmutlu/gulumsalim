import { and, eq, isNotNull, isNull, lt, or } from "drizzle-orm";
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

export async function enableAdminMfa(
  id: number,
  mfaSecretEncrypted: string,
  mfaRecoveryCodeHashes: string[],
  mfaLastUsedStep: number,
) {
  const [row] = await db
    .update(adminUsers)
    .set({
      mfaSecretEncrypted,
      mfaRecoveryCodeHashes,
      mfaEnabledAt: new Date(),
      mfaLastUsedStep,
    })
    .where(and(eq(adminUsers.id, id), isNull(adminUsers.mfaEnabledAt)))
    .returning();
  return row ?? null;
}

// WHERE koşulu aynı 30 saniyelik TOTP adımını iki eşzamanlı isteğin kabul
// etmesini engeller. Kontrol + yazma tek SQL statement'ında atomiktir.
export async function consumeAdminMfaStep(id: number, step: number): Promise<boolean> {
  const updated = await db
    .update(adminUsers)
    .set({ mfaLastUsedStep: step })
    .where(and(
      eq(adminUsers.id, id),
      isNotNull(adminUsers.mfaEnabledAt),
      or(isNull(adminUsers.mfaLastUsedStep), lt(adminUsers.mfaLastUsedStep, step)),
    ))
    .returning({ id: adminUsers.id });
  return updated.length === 1;
}

// Kurtarma kodu listesi row lock altında okunup eksiltilir. Böylece aynı kod
// paralel iki girişte yalnız bir kez tüketilebilir.
export async function consumeAdminRecoveryCode(id: number, codeHash: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ hashes: adminUsers.mfaRecoveryCodeHashes })
      .from(adminUsers)
      .where(and(eq(adminUsers.id, id), isNotNull(adminUsers.mfaEnabledAt)))
      .limit(1)
      .for("update");
    if (!row || !row.hashes.includes(codeHash)) return false;

    await tx
      .update(adminUsers)
      .set({ mfaRecoveryCodeHashes: row.hashes.filter((hash) => hash !== codeHash) })
      .where(eq(adminUsers.id, id));
    return true;
  });
}

export async function updateAdminProfile(
  id: number,
  data: Partial<{ fullName: string; passwordHash: string }>,
) {
  const [row] = await db.update(adminUsers).set(data).where(eq(adminUsers.id, id)).returning();
  if (!row) throw new Error("Profil güncellenemedi");
  return row;
}
