import { createHash } from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import type { FeedFieldMapping, FeedFormat, NormalizedFeedItem } from "./merchant-feed.types";

const MAX_ITEMS = 5_000;

type FlatRow = Record<string, string>;

// Feed doğrulama/senkron yolu DB veya satıcı servislerini import etmemeli.
// RFC4180 uyumlu bu küçük ayrıştırıcı tırnak içi virgül, çift tırnak ve çok
// satırlı alanları destekler; TSV feed'lerini de ilk satırdan algılar.
function parseDelimitedRecords(text: string, delimiter: string): string[][] {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
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
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      record.push(field);
      records.push(record);
      field = "";
      record = [];
    } else {
      field += char;
    }
  }
  if (inQuotes) throw new Error("CSV içinde kapanmamış tırnak var");
  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  return records;
}

function parseCsvRows(body: Buffer): FlatRow[] {
  const raw = body.toString("utf8");
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/\t/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? "\t" : ",";
  const records = parseDelimitedRecords(text, delimiter);
  if (records.length === 0) return [];
  const headers = records[0]!.map((header) => header.trim());
  if (headers.some((header) => !header)) throw new Error("CSV başlıkları boş olamaz");
  if (new Set(headers).size !== headers.length) throw new Error("CSV başlıkları yinelenemez");
  return records.slice(1)
    .filter((columns) => !(columns.length === 1 && (columns[0] ?? "").trim() === ""))
    .map((columns) => Object.fromEntries(headers.map((header, index) => [header, (columns[index] ?? "").trim()])));
}

const ALIASES = {
  externalId: ["id", "product_id", "productid", "urun_id", "urunid", "model", "mpn"],
  groupId: ["item_group_id", "group_id", "groupid", "variant_group_id", "anaurunid"],
  sku: ["sku", "stock_code", "stockcode", "stok_kodu", "stokkodu", "merchant_sku"],
  barcode: ["barcode", "gtin", "barkod", "ean", "ean13"],
  name: ["title", "name", "product_name", "productname", "urun_adi", "urunadi", "isim"],
  description: ["description", "desc", "aciklama", "urun_aciklama", "detail"],
  brand: ["brand", "marka", "manufacturer"],
  price: ["price", "sale_price", "satis_fiyati", "satisfiyati", "fiyat"],
  compareAtPrice: ["compare_at_price", "list_price", "old_price", "piyasa_fiyati", "eskifiyat"],
  stock: ["stock", "quantity", "qty", "stok", "stok_adedi", "adet", "amount"],
  availability: ["availability", "in_stock", "instock", "stok_durumu", "status"],
  imageUrl: ["image_link", "image_url", "image", "resim", "resim_url", "picture"],
  size: ["size", "beden", "numara"],
  color: ["color", "colour", "renk"],
} as const;

function cleanKey(value: string): string {
  return value.toLocaleLowerCase("tr-TR").replace(/^.*:/, "").replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_|_$/g, "");
}

function scalar(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value).trim();
  if (typeof value === "object" && "#text" in (value as Record<string, unknown>)) return scalar((value as Record<string, unknown>)["#text"]);
  return "";
}

function flatten(value: unknown, prefix = "", out: FlatRow = {}): FlatRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) return out;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const text = scalar(child);
    if (text) {
      out[path] = text;
      if (!(key in out)) out[key] = text;
    }
    if (child && typeof child === "object" && !Array.isArray(child)) flatten(child, path, out);
  }
  return out;
}

function atPath(value: unknown, path: string | undefined): unknown {
  if (!path) return undefined;
  let current = value;
  for (const part of path.split(".")) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function findLargestObjectArray(value: unknown): unknown[] | null {
  let best: unknown[] | null = null;
  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      if (node.length > 0 && node.every((entry) => entry && typeof entry === "object") && (!best || node.length > best.length)) best = node;
      for (const entry of node) visit(entry);
      return;
    }
    if (node && typeof node === "object") for (const child of Object.values(node as Record<string, unknown>)) visit(child);
  };
  visit(value);
  return best;
}

function findLikelySingleItem(value: unknown): Record<string, unknown> | null {
  let bestRow: Record<string, unknown> | null = null;
  let bestScore = -1;
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object" || Array.isArray(node)) return;
    const row = node as Record<string, unknown>;
    const scalarCount = Object.values(row).filter((child) => scalar(child) !== "").length;
    if (scalarCount >= 3 && scalarCount > bestScore) {
      bestRow = row;
      bestScore = scalarCount;
    }
    for (const child of Object.values(row)) visit(child);
  };
  visit(value);
  return bestRow;
}

function objectsFromJson(value: unknown, itemsPath?: string): Record<string, unknown>[] {
  const explicit = itemsPath ? atPath(value, itemsPath) : undefined;
  const rows = Array.isArray(explicit)
    ? explicit
    : explicit && typeof explicit === "object"
      ? [explicit]
      : Array.isArray(value)
        ? value
        : findLargestObjectArray(value) ?? (findLikelySingleItem(value) ? [findLikelySingleItem(value)!] : null);
  if (!rows) throw new Error("Feed içinde ürün satırı dizisi bulunamadı; ürün yolu eşlemesi gerekli");
  return rows.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object" && !Array.isArray(row)));
}

function parseFormat(body: Buffer, requested: FeedFormat, contentType?: string): Exclude<FeedFormat, "auto"> {
  if (requested !== "auto") return requested;
  const type = contentType?.toLowerCase() ?? "";
  if (type.includes("xml") || body.toString("utf8", 0, 64).trimStart().startsWith("<")) return "xml";
  if (type.includes("json") || /^[\s\uFEFF]*[\[{]/.test(body.toString("utf8", 0, 64))) return "json";
  return "csv";
}

function inferMapping(rows: FlatRow[], itemsPath?: string): FeedFieldMapping {
  const keys = [...new Set(rows.slice(0, 20).flatMap((row) => Object.keys(row)))];
  const normalized = keys.map((key) => ({ key, clean: cleanKey(key) }));
  const find = (aliases: readonly string[]) => {
    for (const alias of aliases) {
      const match = normalized.find((candidate) => candidate.clean === alias);
      if (match) return match.key;
    }
    return undefined;
  };
  const salePrice = find(["sale_price", "satis_fiyati", "satisfiyati"]);
  const regularPrice = find(["price", "fiyat", "list_price"]);
  const mapping = {
    itemsPath,
    externalId: find(ALIASES.externalId),
    groupId: find(ALIASES.groupId),
    sku: find(ALIASES.sku),
    barcode: find(ALIASES.barcode),
    name: find(ALIASES.name),
    description: find(ALIASES.description),
    brand: find(ALIASES.brand),
    price: salePrice ?? regularPrice,
    compareAtPrice: salePrice ? regularPrice : find(ALIASES.compareAtPrice),
    stock: find(ALIASES.stock),
    availability: find(ALIASES.availability),
    imageUrl: find(ALIASES.imageUrl),
    size: find(ALIASES.size),
    color: find(ALIASES.color),
  };
  if (!mapping.name || !mapping.price || (!mapping.externalId && !mapping.sku && !mapping.barcode)) {
    throw new Error("Ürün adı, fiyat ve sabit ürün kimliği otomatik eşlenemedi; alan eşlemesi gerekli");
  }
  return mapping as FeedFieldMapping;
}

function value(row: FlatRow, path?: string): string {
  if (!path) return "";
  return (row[path] ?? "").trim();
}

function parseMoney(raw: string, field: string): string {
  let text = raw.replace(/[^\d.,-]/g, "");
  if (!text) throw new Error(`${field} boş veya geçersiz`);
  const comma = text.lastIndexOf(",");
  const dot = text.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    const decimal = comma > dot ? "," : ".";
    text = text.replace(decimal === "," ? /\./g : /,/g, "").replace(decimal, ".");
  } else if (comma >= 0) {
    text = /,\d{1,2}$/.test(text) ? text.replace(/\./g, "").replace(",", ".") : text.replace(/,/g, "");
  } else if ((text.match(/\./g)?.length ?? 0) > 1) {
    const last = text.lastIndexOf(".");
    text = `${text.slice(0, last).replace(/\./g, "")}.${text.slice(last + 1)}`;
  }
  const number = Number(text);
  if (!Number.isFinite(number) || number <= 0 || number > 100_000_000) throw new Error(`${field} geçersiz`);
  return number.toFixed(2);
}

function parseStock(raw: string, availability: string): { stock: number; available: boolean } {
  const state = availability.toLocaleLowerCase("tr-TR").replace(/[\s_-]+/g, " ");
  const unavailable = ["out of stock", "outofstock", "stokta yok", "tukendi", "tükendi", "false", "pasif", "inactive"].includes(state);
  if (unavailable) return { stock: 0, available: false };
  if (raw) {
    const number = Number(raw.replace(/[^\d-]/g, ""));
    if (!Number.isSafeInteger(number) || number < 0 || number > 10_000_000) throw new Error("stok geçersiz");
    return { stock: number, available: number > 0 };
  }
  const available = ["in stock", "instock", "stokta", "true", "aktif", "active", "available"].includes(state);
  // Katalog feed'i yalnız availability veriyorsa konservatif olarak tek adet
  // açılır; gerçek adet icat edilmez.
  return { stock: available ? 1 : 0, available };
}

function safeImageUrl(raw: string): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function normalizeRows(rows: FlatRow[], mapping: FeedFieldMapping): NormalizedFeedItem[] {
  if (rows.length === 0) throw new Error("Feed boş; mevcut ürünler korunarak senkron durduruldu");
  if (rows.length > MAX_ITEMS) throw new Error(`Feed tek kaynak için ${MAX_ITEMS} ürün sınırını aşıyor`);
  const seen = new Set<string>();
  return rows.map((row, index) => {
    const externalKey = value(row, mapping.externalId) || value(row, mapping.sku) || value(row, mapping.barcode);
    const name = value(row, mapping.name);
    if (!externalKey) throw new Error(`Satır ${index + 1}: sabit ürün kimliği/SKU/barkod yok`);
    if (!name) throw new Error(`Satır ${index + 1}: ürün adı yok`);
    if (externalKey.length > 240) throw new Error(`Satır ${index + 1}: ürün kimliği çok uzun`);
    if (seen.has(externalKey)) throw new Error(`Feed içinde yinelenen ürün kimliği var: ${externalKey}`);
    seen.add(externalKey);
    const stock = parseStock(value(row, mapping.stock), value(row, mapping.availability));
    let priceRaw = value(row, mapping.price);
    let compareRaw = value(row, mapping.compareAtPrice);
    // Google/Meta feed'lerinde sale_price sadece indirimli satirlarda bulunur.
    // Haritalama sale_price'i satis fiyati sectiyse normal satir regular price'a
    // geri duser; urun "fiyatsiz" diye tum senkronu bozmaz.
    if (!priceRaw && compareRaw) {
      priceRaw = compareRaw;
      compareRaw = "";
    }
    const price = parseMoney(priceRaw, `Satır ${index + 1} fiyatı`);
    const compareAtPrice = compareRaw ? parseMoney(compareRaw, `Satır ${index + 1} eski fiyatı`) : undefined;
    const base = {
      externalKey,
      groupKey: value(row, mapping.groupId) || undefined,
      sku: value(row, mapping.sku) || undefined,
      barcode: value(row, mapping.barcode) || undefined,
      name: name.slice(0, 300),
      description: value(row, mapping.description).slice(0, 20_000) || undefined,
      brand: value(row, mapping.brand).slice(0, 200) || undefined,
      price,
      compareAtPrice: compareAtPrice && Number(compareAtPrice) > Number(price) ? compareAtPrice : undefined,
      stock: stock.stock,
      available: stock.available,
      imageUrl: safeImageUrl(value(row, mapping.imageUrl)),
      size: value(row, mapping.size).slice(0, 80) || undefined,
      color: value(row, mapping.color).slice(0, 80) || undefined,
    };
    return { ...base, dataHash: createHash("sha256").update(JSON.stringify(base)).digest("hex") };
  });
}

async function parseFeedRows(
  body: Buffer,
  requestedFormat: FeedFormat,
  contentType?: string,
  itemsPath?: string,
): Promise<{ format: Exclude<FeedFormat, "auto">; rows: FlatRow[] }> {
  const format = parseFormat(body, requestedFormat, contentType);
  let flatRows: FlatRow[];
  if (format === "xml") {
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", removeNSPrefix: true, processEntities: false, trimValues: true });
    const parsed = parser.parse(body.toString("utf8")) as unknown;
    flatRows = objectsFromJson(parsed, itemsPath).map((row) => flatten(row));
  } else if (format === "json") {
    const parsed = JSON.parse(body.toString("utf8")) as unknown;
    flatRows = objectsFromJson(parsed, itemsPath).map((row) => flatten(row));
  } else {
    flatRows = parseCsvRows(body);
  }
  return { format, rows: flatRows };
}

export async function detectMerchantFeedColumns(
  body: Buffer,
  requestedFormat: FeedFormat,
  contentType?: string,
  itemsPath?: string,
): Promise<{ format: Exclude<FeedFormat, "auto">; columns: string[]; sample: FlatRow[] }> {
  const parsed = await parseFeedRows(body, requestedFormat, contentType, itemsPath);
  return {
    format: parsed.format,
    columns: [...new Set(parsed.rows.slice(0, 20).flatMap((row) => Object.keys(row)))].slice(0, 200),
    sample: parsed.rows.slice(0, 3),
  };
}

export async function parseMerchantFeed(
  body: Buffer,
  requestedFormat: FeedFormat,
  mapping?: FeedFieldMapping,
  contentType?: string,
): Promise<{ format: Exclude<FeedFormat, "auto">; mapping: FeedFieldMapping; items: NormalizedFeedItem[]; sample: FlatRow[] }> {
  const parsed = await parseFeedRows(body, requestedFormat, contentType, mapping?.itemsPath);
  const resolvedMapping = mapping ?? inferMapping(parsed.rows);
  return { format: parsed.format, mapping: resolvedMapping, items: normalizeRows(parsed.rows, resolvedMapping), sample: parsed.rows.slice(0, 3) };
}
