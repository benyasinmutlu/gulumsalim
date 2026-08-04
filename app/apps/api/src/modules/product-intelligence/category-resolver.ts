import { eq, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { categories } from "../../db/schema/index";
import { slugify } from "../../lib/slugify";
import type { CategoryResolver } from "./types";

// DB-destekli kategori resolver: bir serbest-metin değeri (slug / slugify / isim)
// alıp kategori id'sine çözer. normalize/category.ts'e ve enrichment
// pipeline'ına enjekte edilir. (Kaynak: bulk-import resolveCategoryId -
// paylaşılabilir olması için buraya alındı.)
export const resolveCategoryValue: CategoryResolver = async (value: string): Promise<number | null> => {
  const v = value.trim();
  if (!v) return null;

  const bySlug = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, v)).limit(1);
  if (bySlug[0]) return bySlug[0].id;

  const bySlugified = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, slugify(v))).limit(1);
  if (bySlugified[0]) return bySlugified[0].id;

  const byName = await db
    .select({ id: categories.id })
    .from(categories)
    .where(sql`lower(${categories.name}) = ${v.toLowerCase()}`)
    .limit(1);
  return byName[0]?.id ?? null;
};
