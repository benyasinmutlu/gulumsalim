import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { settings } from "../../db/schema/index";

// gulumsalim.com'daki admin/settings.php'nin karşılığı - admin panel için
// tüm site ayarları (allowlist yok, sadece admin erişebilir; herkese açık
// tarafta hâlâ content.repository.ts'teki getPublicSettings + allowlist var).
export async function getAllSettings(): Promise<Record<string, unknown>> {
  const rows = await db.select().from(settings);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function upsertSettings(values: Record<string, string>) {
  for (const [key, value] of Object.entries(values)) {
    await db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } });
  }
}

export async function deleteSetting(key: string) {
  await db.delete(settings).where(eq(settings.key, key));
}
