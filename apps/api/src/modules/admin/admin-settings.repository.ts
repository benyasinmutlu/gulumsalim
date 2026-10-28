import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { settings } from "../../db/schema/index";

// gulumsalim.com'daki admin/settings.php'nin karşılığı - admin panel için
// tüm site ayarları (allowlist yok, sadece admin erişebilir; herkese açık
// tarafta hâlâ content.repository.ts'teki getPublicSettings + allowlist var).
// bkz. content.repository.ts getPublicSettings yorumu - aynı drizzle jsonb
// round-trip hatası (rakam görünümlü string'ler number'a dönüşüyor) burada
// da geçerli. upsertSettings her zaman string yazdığı için String() güvenli.
export async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(settings);
  return Object.fromEntries(rows.map((r) => [r.key, String(r.value)]));
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
