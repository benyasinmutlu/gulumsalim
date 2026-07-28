import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { categories } from "../../db/schema/index";
import { findProductBySlugAnyVendor, insertVendorProduct } from "./vendor-products.repository";
import { slugify } from "../../lib/slugify";

// Bağımlılık eklemeden RFC4180'e yakın basit bir CSV/TSV satır ayrıştırıcı -
// tırnak içindeki ayraçları/kaçış tırnaklarını doğru şekilde ele alır.
// `delimiter` Excel'den kopyala-yapıştır akışında TAB, dosya yüklemede
// VİRGÜL olur (bkz. parseImportText'teki otomatik tespit).
function parseDelimitedLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map((v) => v.trim());
}

export interface BulkImportRowResult {
  row: number;
  name: string;
  status: "created" | "skipped";
  reason?: string;
}

// Beklenen sütunlar: name,basePrice,categorySlug,description,brand,compareAtPrice
// (description/brand/compareAtPrice opsiyonel). İlk satır başlık kabul edilir.
export async function importProductsFromCsv(vendorId: number, csvText: string): Promise<BulkImportRowResult[]> {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  // Excel'den yapıştırılan metin TAB ile ayrılır, dosyadan yüklenen CSV
  // virgülle - ilk satırda hangisi daha çok geçiyorsa o kullanılır.
  const delimiter = (lines[0]!.match(/\t/g)?.length ?? 0) > (lines[0]!.match(/,/g)?.length ?? 0) ? "\t" : ",";
  const parseCsvLine = (line: string) => parseDelimitedLine(line, delimiter);

  const header = parseCsvLine(lines[0]!).map((h) => h.toLowerCase());
  const nameIdx = header.indexOf("name");
  const priceIdx = header.indexOf("baseprice");
  const categoryIdx = header.indexOf("categoryslug");
  const descIdx = header.indexOf("description");
  const brandIdx = header.indexOf("brand");
  const compareIdx = header.indexOf("compareatprice");

  const results: BulkImportRowResult[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]!);
    const rowNum = i + 1;
    const name = nameIdx >= 0 ? cols[nameIdx] : undefined;
    const basePrice = priceIdx >= 0 ? cols[priceIdx] : undefined;
    const categorySlug = categoryIdx >= 0 ? cols[categoryIdx] : undefined;

    if (!name || !basePrice || !categorySlug) {
      results.push({ row: rowNum, name: name ?? "?", status: "skipped", reason: "name/basePrice/categorySlug zorunlu" });
      continue;
    }
    if (Number.isNaN(Number(basePrice))) {
      results.push({ row: rowNum, name, status: "skipped", reason: "basePrice sayı olmalı" });
      continue;
    }

    const [category] = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, categorySlug)).limit(1);
    if (!category) {
      results.push({ row: rowNum, name, status: "skipped", reason: `kategori bulunamadı: ${categorySlug}` });
      continue;
    }

    const slug = slugify(name) + "-" + Math.random().toString(36).slice(2, 7);
    const existing = await findProductBySlugAnyVendor(slug);
    if (existing) {
      results.push({ row: rowNum, name, status: "skipped", reason: "adres çakışması" });
      continue;
    }

    await insertVendorProduct(vendorId, {
      categoryId: category.id,
      name,
      slug,
      description: descIdx >= 0 ? cols[descIdx] || undefined : undefined,
      brand: brandIdx >= 0 ? cols[brandIdx] || undefined : undefined,
      basePrice,
      compareAtPrice: compareIdx >= 0 ? cols[compareIdx] || undefined : undefined,
    });
    results.push({ row: rowNum, name, status: "created" });
  }

  return results;
}
