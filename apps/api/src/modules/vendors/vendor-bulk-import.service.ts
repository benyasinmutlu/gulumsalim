import { eq, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { categories } from "../../db/schema/index";
import { findProductBySlugAnyVendor, insertVendorProduct } from "./vendor-products.repository";
import { slugify } from "../../lib/slugify";

// Bağımlılık eklemeden RFC4180'e yakın basit bir CSV/TSV satır ayrıştırıcı.
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

export type CanonicalField = "name" | "basePrice" | "categorySlug" | "description" | "brand" | "compareAtPrice";
// Kullanıcı eşlemesi: kanonik alan -> dosyadaki HAM başlık adı.
export type ColumnMapping = Partial<Record<CanonicalField, string>>;

export const CANON_FIELDS: CanonicalField[] = ["name", "basePrice", "categorySlug", "description", "brand", "compareAtPrice"];

export interface BulkImportRowResult {
  row: number;
  name: string;
  status: "created" | "skipped" | "valid";
  reason?: string;
}

// TR/EN takma-ad listesi - otomatik tahmin için (kullanıcı elle değiştirebilir).
const COLUMN_ALIASES: Record<CanonicalField, string[]> = {
  name: ["name", "ad", "isim", "urun", "ürün", "urun adi", "ürün adı", "ürün ismi", "title", "product", "product name", "baslik", "başlık"],
  basePrice: ["baseprice", "base_price", "price", "fiyat", "satis fiyati", "satış fiyatı", "tutar", "amount", "unit price"],
  categorySlug: ["categoryslug", "category_slug", "category", "kategori", "categoryname", "category name", "kategori adi", "kategori adı"],
  description: ["description", "aciklama", "açıklama", "desc", "detay", "detail"],
  brand: ["brand", "marka", "manufacturer"],
  compareAtPrice: ["compareatprice", "compare_at_price", "compareprice", "indirimli fiyat", "indirimlifiyat", "eski fiyat", "list price", "oldprice", "old price"],
};

function normKey(k: string): string {
  return k.toLowerCase().trim();
}

// Ham ayrıştırma sonucu: dosyadaki başlıklar + başlık->değer satırları (eşleme
// YAPILMADAN - orijinal başlık adları korunur).
interface RawParsed {
  headers: string[];
  rows: Record<string, string>[];
}

function rawFromObjects(objs: Record<string, unknown>[]): RawParsed {
  const headerSet = new Set<string>();
  const rows = objs.map((o) => {
    const r: Record<string, string> = {};
    for (const [k, v] of Object.entries(o)) {
      const key = k.trim();
      headerSet.add(key);
      r[key] = v === null || v === undefined ? "" : String(v).trim();
    }
    return r;
  });
  return { headers: [...headerSet], rows };
}

function parseDelimitedRaw(text: string): RawParsed {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const first = lines[0]!;
  const delimiter = (first.match(/\t/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? "\t" : ",";
  const headers = parseDelimitedLine(first, delimiter);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseDelimitedLine(lines[i]!, delimiter);
    const r: Record<string, string> = {};
    headers.forEach((h, idx) => {
      r[h] = cols[idx] ?? "";
    });
    rows.push(r);
  }
  return { headers, rows };
}

function coerceArray(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object") {
    for (const key of ["products", "items", "data", "rows"]) {
      const val = (data as Record<string, unknown>)[key];
      if (Array.isArray(val)) return val as Record<string, unknown>[];
    }
  }
  throw new Error("JSON bir ürün dizisi olmalı (veya { products: [...] })");
}

function cellToString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("text" in o) return String(o.text ?? "").trim();
    if ("result" in o) return String(o.result ?? "").trim();
    if ("richText" in o && Array.isArray(o.richText)) return (o.richText as { text: string }[]).map((t) => t.text).join("").trim();
    if (v instanceof Date) return v.toISOString();
    return "";
  }
  return String(v).trim();
}

async function parseXlsxRaw(buffer: Buffer): Promise<RawParsed> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
  const ws = wb.worksheets[0];
  if (!ws) return { headers: [], rows: [] };
  const rows: Record<string, string>[] = [];
  let headers: string[] = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const values: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      values.push(cellToString(cell.value));
    });
    if (rowNumber === 1) {
      headers = values;
      return;
    }
    const r: Record<string, string> = {};
    headers.forEach((h, idx) => {
      r[h] = values[idx] ?? "";
    });
    rows.push(r);
  });
  return { headers, rows };
}

// Dosya adına (uzantı) göre biçim tespiti + HAM satırlara dönüştürme.
export async function parseRawImport(buffer: Buffer, filename: string): Promise<RawParsed> {
  const ext = (filename.toLowerCase().split(".").pop() ?? "").trim();
  if (ext === "json") return rawFromObjects(coerceArray(JSON.parse(buffer.toString("utf-8"))));
  if (ext === "jsonl" || ext === "ndjson")
    return rawFromObjects(
      buffer
        .toString("utf-8")
        .split(/\r?\n/)
        .filter((l) => l.trim().length > 0)
        .map((l) => JSON.parse(l) as Record<string, unknown>),
    );
  if (ext === "xlsx" || ext === "xls") return parseXlsxRaw(buffer);
  return parseDelimitedRaw(buffer.toString("utf-8"));
}

// Başlıkları takma-adlarla kanonik alanlara otomatik eşle (ilk eşleşen kazanır).
export function autoMapHeaders(headers: string[]): ColumnMapping {
  const lowerToOrig = new Map<string, string>();
  for (const h of headers) if (!lowerToOrig.has(normKey(h))) lowerToOrig.set(normKey(h), h);
  const m: ColumnMapping = {};
  for (const canon of CANON_FIELDS) {
    for (const alias of COLUMN_ALIASES[canon]) {
      const orig = lowerToOrig.get(alias);
      if (orig) {
        m[canon] = orig;
        break;
      }
    }
  }
  return m;
}

// Ham satırı, eşlemeye göre kanonik alanlara çevir.
function mapRow(raw: Record<string, string>, mapping: ColumnMapping): Record<CanonicalField, string> {
  const out = {} as Record<CanonicalField, string>;
  for (const canon of CANON_FIELDS) {
    const header = mapping[canon];
    out[canon] = header ? (raw[header] ?? "").trim() : "";
  }
  return out;
}

// Frontend'in eşleme ekranı için: dosyadaki ham başlıklar + otomatik tahmin +
// örnek satırlar. Hiçbir ürün eklenmez.
export async function detectImportColumns(
  buffer: Buffer,
  filename: string,
): Promise<{ columns: string[]; autoMap: ColumnMapping; sample: Record<string, string>[] }> {
  const { headers, rows } = await parseRawImport(buffer, filename);
  return { columns: headers, autoMap: autoMapHeaders(headers), sample: rows.slice(0, 3) };
}

async function resolveCategoryId(value: string): Promise<number | null> {
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
}

function toPriceString(raw: string): string | null {
  const parsed = Number(raw.replace(",", "."));
  if (Number.isNaN(parsed) || parsed < 0) return null;
  return parsed.toFixed(2);
}

// Kanonik satırları içe aktarır (dryRun=true -> yalnızca doğrulama).
async function importNormalizedRows(
  vendorId: number,
  rows: Record<CanonicalField, string>[],
  dryRun: boolean,
): Promise<BulkImportRowResult[]> {
  const results: BulkImportRowResult[] = [];
  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const r = rows[i]!;
    const name = (r.name ?? "").trim();
    const basePriceRaw = (r.basePrice ?? "").trim();
    const categoryValue = (r.categorySlug ?? "").trim();

    if (!name || !basePriceRaw || !categoryValue) {
      results.push({ row: rowNum, name: name || "?", status: "skipped", reason: "ad / fiyat / kategori zorunlu" });
      continue;
    }
    const basePrice = toPriceString(basePriceRaw);
    if (basePrice === null) {
      results.push({ row: rowNum, name, status: "skipped", reason: `fiyat geçersiz: ${basePriceRaw}` });
      continue;
    }
    const categoryId = await resolveCategoryId(categoryValue);
    if (!categoryId) {
      results.push({ row: rowNum, name, status: "skipped", reason: `kategori bulunamadı: ${categoryValue}` });
      continue;
    }
    if (dryRun) {
      results.push({ row: rowNum, name, status: "valid" });
      continue;
    }
    const slug = slugify(name) + "-" + Math.random().toString(36).slice(2, 7);
    const existing = await findProductBySlugAnyVendor(slug);
    if (existing) {
      results.push({ row: rowNum, name, status: "skipped", reason: "adres çakışması, tekrar deneyin" });
      continue;
    }
    const compareRaw = (r.compareAtPrice ?? "").trim();
    const compareAtPrice = compareRaw ? (toPriceString(compareRaw) ?? undefined) : undefined;

    await insertVendorProduct(vendorId, {
      categoryId,
      name,
      slug,
      description: (r.description ?? "").trim() || undefined,
      brand: (r.brand ?? "").trim() || undefined,
      basePrice,
      compareAtPrice,
    });
    results.push({ row: rowNum, name, status: "created" });
  }
  return results;
}

// Ham ayrıştırılmış içeriği + eşlemeyi (verilmezse otomatik) içe aktar.
function resolveMapping(headers: string[], mapping?: ColumnMapping): ColumnMapping {
  return mapping && Object.keys(mapping).length > 0 ? mapping : autoMapHeaders(headers);
}

// Dosya tabanlı (çok-format) içe aktarma - opsiyonel kullanıcı eşlemesiyle.
export async function importProductsFromFile(
  vendorId: number,
  buffer: Buffer,
  filename: string,
  dryRun = false,
  mapping?: ColumnMapping,
): Promise<BulkImportRowResult[]> {
  const raw = await parseRawImport(buffer, filename);
  const map = resolveMapping(raw.headers, mapping);
  return importNormalizedRows(vendorId, raw.rows.map((r) => mapRow(r, map)), dryRun);
}

// Yapıştırma (ham CSV/TSV metni) - opsiyonel kullanıcı eşlemesiyle.
export async function importProductsFromCsv(
  vendorId: number,
  csvText: string,
  dryRun = false,
  mapping?: ColumnMapping,
): Promise<BulkImportRowResult[]> {
  const raw = parseDelimitedRaw(csvText);
  const map = resolveMapping(raw.headers, mapping);
  return importNormalizedRows(vendorId, raw.rows.map((r) => mapRow(r, map)), dryRun);
}
