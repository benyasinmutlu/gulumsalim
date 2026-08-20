import { eq, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { categories } from "../../db/schema/index";
import { findProductBySlugAnyVendor, findVendorProductFingerprints, insertVendorProductWithVariants } from "./vendor-products.repository";
import { productFingerprint } from "../product-intelligence/dedupe/fingerprint";
import { slugify } from "../../lib/slugify";
import { normalizeProductInput } from "../product-intelligence/normalize/index";
import type { RawProductInput } from "../product-intelligence/types";
import { enrichProduct } from "../product-intelligence/enrichment/pipeline";

// Tek seferde işlenecek azami satır (timeout/aşırı yük koruması).
const MAX_IMPORT_ROWS = 5000;
export const MAX_AI_ENRICH_ROWS = 100;

// UTF-8 BOM'u (ör. Excel'in kaydettiği CSV) at - aksi halde ilk başlık
// "﻿name" gibi görünüp eşleme kaçar, Türkçe karakterler bozulur.
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

// Bağımlılık eklemeden RFC4180 CSV/TSV ayrıştırıcı - TÜM metni tarar, böylece
// tırnak içi satır sonları (çok satırlı açıklama alanları) ve "" kaçışı doğru
// işlenir. Önceki hali önce \n'e bölüp satır satır parse ettiği için çok
// satırlı alanlar kaydı bozuyordu.
function parseDelimitedRecords(text: string, delimiter: string): string[][] {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      record.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      record.push(field);
      records.push(record);
      field = "";
      record = [];
    } else {
      field += char;
    }
  }
  // Dosya newline ile bitmiyorsa kalan alan/kaydı ekle.
  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  return records;
}

export type CanonicalField =
  | "name"
  | "basePrice"
  | "categorySlug"
  | "description"
  | "brand"
  | "compareAtPrice"
  | "stock"
  | "sizes";
// Kullanıcı eşlemesi: kanonik alan -> dosyadaki HAM başlık adı.
export type ColumnMapping = Partial<Record<CanonicalField, string>>;

export const CANON_FIELDS: CanonicalField[] = [
  "name",
  "basePrice",
  "categorySlug",
  "description",
  "brand",
  "compareAtPrice",
  "stock",
  "sizes",
];

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
  stock: [
    "stock",
    "stock per size",
    "stockpersize",
    "stok",
    "adet",
    "quantity",
    "qty",
    "miktar",
    "adet stok",
    "stok adedi",
    "stok adeti",
    "beden başına stok",
    "beden basina stok",
    "bedenbasinastok",
  ],
  sizes: ["sizes", "size", "beden", "bedenler", "numara", "varyant", "varyantlar", "beden listesi"],
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
  const clean = stripBom(text);
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/\t/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? "\t" : ",";
  const records = parseDelimitedRecords(clean, delimiter);
  if (records.length === 0) return { headers: [], rows: [] };
  const headers = records[0]!.map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < records.length; i++) {
    const cols = records[i]!;
    // Tamamen boş satırları atla (Excel'in bıraktığı sondaki boş satırlar).
    if (cols.length === 1 && (cols[0] ?? "").trim() === "") continue;
    const r: Record<string, string> = {};
    headers.forEach((h, idx) => {
      r[h] = (cols[idx] ?? "").trim();
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
  if (ext === "json") return rawFromObjects(coerceArray(JSON.parse(stripBom(buffer.toString("utf-8")))));
  if (ext === "jsonl" || ext === "ndjson")
    return rawFromObjects(
      stripBom(buffer.toString("utf-8"))
        .split(/\r?\n/)
        .filter((l) => l.trim().length > 0)
        .map((l) => JSON.parse(l) as Record<string, unknown>),
    );
  // exceljs yalnızca .xlsx (OOXML) okuyabilir - eski ikili .xls'i açamaz, o
  // yüzden yanıltıcı bir parse hatası yerine net bir yönerge ver.
  if (ext === "xls")
    throw new Error("Eski .xls biçimi desteklenmiyor. Excel'de 'Farklı Kaydet → .xlsx (veya CSV)' ile kaydedip tekrar yükleyin.");
  if (ext === "xlsx") return parseXlsxRaw(buffer);
  if (ext === "csv" || ext === "tsv") return parseDelimitedRaw(buffer.toString("utf-8"));
  throw new Error("Desteklenmeyen dosya biçimi. CSV, TSV, XLSX, JSON veya JSONL yükleyin.");
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
): Promise<{ columns: string[]; autoMap: ColumnMapping; sample: Record<string, string>[]; rowCount: number }> {
  const { headers, rows } = await parseRawImport(buffer, filename);
  return { columns: headers, autoMap: autoMapHeaders(headers), sample: rows.slice(0, 3), rowCount: rows.length };
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

// Kanonik satırları içe aktarır (dryRun=true -> yalnızca doğrulama).
async function importNormalizedRows(
  vendorId: number,
  rows: Record<CanonicalField, string>[],
  dryRun: boolean,
  enrichMissing: boolean,
): Promise<BulkImportRowResult[]> {
  if (enrichMissing && rows.length > MAX_AI_ENRICH_ROWS) {
    throw new Error(`Akıllı tamamlama tek işlemde en fazla ${MAX_AI_ENRICH_ROWS} ürün için kullanılabilir.`);
  }
  const results: BulkImportRowResult[] = [];
  // Kategori aramalarını önbelleğe al - aynı kategoriden yüzlerce ürün
  // olan dosyalarda satır başına DB sorgusu yapmamak için (perf).
  const catCache = new Map<string, number | null>();
  const resolveCategoryCached = async (value: string): Promise<number | null> => {
    const key = value.trim().toLowerCase();
    const cached = catCache.get(key);
    if (cached !== undefined) return cached;
    const id = await resolveCategoryId(value);
    catCache.set(key, id);
    return id;
  };

  // Kopya tespiti: satıcının mevcut ürün parmak izleri (tek sorgu) + bu dosyada
  // görülenler. Aynı ürünü tekrar (ör. dosyayı iki kez) yüklemeyi yakalar.
  const existingFingerprints = await findVendorProductFingerprints(vendorId);
  const seenFingerprints = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const r = rows[i]!;
    // Tek doğruluk kaynağı motoruyla normalize + validasyon (tekli girişle
    // AYNI kurallar). Kategori cache'li resolver enjekte edilir -> perf korunur.
    const raw: RawProductInput = {
      name: r.name,
      basePrice: r.basePrice,
      compareAtPrice: r.compareAtPrice,
      category: r.categorySlug,
      description: r.description,
      brand: r.brand,
      stock: r.stock,
      sizes: r.sizes,
    };
    const norm = await normalizeProductInput(raw, { resolveCategory: resolveCategoryCached, defaultStock: 0 });
    const enrichment = enrichMissing
      ? await enrichProduct(norm, { vendorId, resolveCategory: resolveCategoryCached })
      : null;

    // Bloklayan hata (ad/fiyat/kategori) -> satırı atla (ilk hata mesajıyla).
    const blocking = norm.issues.find((issue) => issue.level === "error" && !(issue.field === "category" && enrichment?.category?.value));
    if (blocking) {
      results.push({ row: rowNum, name: norm.name.value ?? "?", status: "skipped", reason: blocking.message });
      continue;
    }
    // Parity: geçersiz stok metni girildiyse satırı atla (motor burada uyarı
    // üretip varsayılana çeker; toplu içe-aktarmada eski davranış "atla" idi).
    if (norm.issues.some((x) => x.field === "stock" && x.level === "warn")) {
      results.push({ row: rowNum, name: norm.name.value ?? "?", status: "skipped", reason: `stok geçersiz: ${(r.stock ?? "").trim()}` });
      continue;
    }

    const name = norm.name.value!;
    const categoryId = norm.categoryId.value ?? enrichment?.category?.value;
    if (!categoryId) {
      results.push({ row: rowNum, name, status: "skipped", reason: "kategori önerilemedi" });
      continue;
    }
    const basePrice = norm.basePrice.value!;
    const stock = norm.stock.value ?? 0;
    const sizes = norm.sizes;

    // Kopya tespiti (satıcı-içi): aynı ad + kategori zaten varsa ya da bu
    // dosyada tekrar geçtiyse satırı atla (kaza eseri çift yüklemeyi önler).
    const fingerprint = productFingerprint(vendorId, name, { category: String(categoryId) });
    if (existingFingerprints.has(fingerprint) || seenFingerprints.has(fingerprint)) {
      results.push({ row: rowNum, name, status: "skipped", reason: "olası kopya (aynı ürün zaten var)" });
      continue;
    }
    seenFingerprints.add(fingerprint);

    if (dryRun) {
      results.push({ row: rowNum, name, status: "valid" });
      continue;
    }

    // Sahte/geçersiz indirim (eski fiyat <= satış ya da >20x) motorca uyarılır;
    // tekli girişteki reddetme davranışıyla tutarlı olması için burada da düşülür.
    const badDiscount = norm.issues.some((x) => x.field === "compareAtPrice" && x.level === "warn");
    const compareAtPrice = badDiscount ? undefined : (norm.compareAtPrice.value ?? undefined);
    const description = norm.description.value ?? enrichment?.description?.value ?? undefined;
    const attributes = enrichment?.attributes ?? undefined;
    const brand = norm.brand.value ?? undefined;

    // Slug çakışmasında (nadir) atlamak yerine birkaç kez yeni son ek dene.
    let created: { id: number } | null = null;
    for (let attempt = 0; attempt < 5 && !created; attempt++) {
      const slug = slugify(name) + "-" + Math.random().toString(36).slice(2, 7);
      if (await findProductBySlugAnyVendor(slug)) continue;
      created = await insertVendorProductWithVariants(vendorId, {
        categoryId,
        name,
        slug,
        description,
        attributes,
        brand,
        basePrice,
        compareAtPrice,
        fingerprint,
        // Beden varyantı varsa ürün stoğu varyant toplamından gelir (0 bırakılır);
        // beden yoksa varyantsız ürün doğrudan products.stock kullanır -> stok>0
        // ise ürün satılabilir olur (önceden hep 0'dı, hiç satılamıyordu).
        stock: sizes.length > 0 ? 0 : stock,
      }, sizes.map((size) => ({ size, stock })));
    }
    if (!created) {
      results.push({ row: rowNum, name, status: "skipped", reason: "benzersiz adres üretilemedi, tekrar deneyin" });
      continue;
    }

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
  enrichMissing = false,
): Promise<BulkImportRowResult[]> {
  const raw = await parseRawImport(buffer, filename);
  if (raw.rows.length > MAX_IMPORT_ROWS)
    throw new Error(`Tek seferde en fazla ${MAX_IMPORT_ROWS} satır yüklenebilir (dosyada ${raw.rows.length}). Lütfen dosyayı parçalara bölün.`);
  const map = resolveMapping(raw.headers, mapping);
  return importNormalizedRows(vendorId, raw.rows.map((r) => mapRow(r, map)), dryRun, enrichMissing);
}

// Yapıştırma (ham CSV/TSV metni) - opsiyonel kullanıcı eşlemesiyle.
export async function importProductsFromCsv(
  vendorId: number,
  csvText: string,
  dryRun = false,
  mapping?: ColumnMapping,
  enrichMissing = false,
): Promise<BulkImportRowResult[]> {
  const raw = parseDelimitedRaw(csvText);
  if (raw.rows.length > MAX_IMPORT_ROWS)
    throw new Error(`Tek seferde en fazla ${MAX_IMPORT_ROWS} satır yüklenebilir (${raw.rows.length} bulundu). Lütfen parçalara bölün.`);
  const map = resolveMapping(raw.headers, mapping);
  return importNormalizedRows(vendorId, raw.rows.map((r) => mapRow(r, map)), dryRun, enrichMissing);
}

// --- ASYNC (BullMQ kuyruk) yolu ---
// Async'te tek seferde çok daha fazla satıra izin verilir (istek bloklanmaz).
export const MAX_ASYNC_IMPORT_ROWS = 5000;

// Dosyayı kanonik satırlara çevirir ama İÇE AKTARMAZ - route bunları kuyruğa
// koyar, worker importRows ile işler (büyük dosya HTTP isteğini bloklamaz).
export async function parseFileToRows(
  buffer: Buffer,
  filename: string,
  mapping?: ColumnMapping,
): Promise<Record<CanonicalField, string>[]> {
  const raw = await parseRawImport(buffer, filename);
  const map = resolveMapping(raw.headers, mapping);
  return raw.rows.map((r) => mapRow(r, map));
}

// Worker giriş noktası: kanonik satırları içe aktarır (dryRun=false).
export async function importRows(
  vendorId: number,
  rows: Record<CanonicalField, string>[],
  enrichMissing = false,
): Promise<BulkImportRowResult[]> {
  return importNormalizedRows(vendorId, rows, false, enrichMissing);
}
