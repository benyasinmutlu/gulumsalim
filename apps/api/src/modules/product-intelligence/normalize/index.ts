import type { CategoryResolver, Issue, NormalizedProduct, RawProductInput } from "../types";
import { productFingerprint } from "../dedupe/fingerprint";
import { normalizePrice, normalizeStock } from "./price";
import { MAX_PRODUCT_SIZES, MAX_SIZE_LABEL_LENGTH, normalizeSizes } from "./size";
import { cleanDescription, normalizeBrand, normalizeTitle } from "./text";
import { normalizeCategory } from "./category";

// İndirim (compareAtPrice) satış fiyatının en fazla bu kat üstünde olabilir -
// "10 TL ürüne 10.000 TL eski fiyat" gibi sahte indirimleri engeller
// (bkz. vendor-products.routes.ts MAX_DISCOUNT_MULTIPLE ile aynı gerekçe).
const MAX_DISCOUNT_MULTIPLE = 20;

export interface NormalizeOptions {
  resolveCategory: CategoryResolver;
  // Varsayılan stok (belirtilmemişse). Bireysel satıcıda 1, kurumsalda 0 vb.
  defaultStock?: number;
}

// HAM ürün girdisini tek doğruluk kaynağı kurallarıyla normalize eder. Tekli
// (form) ve toplu (CSV/JSON) girişin ORTAK giriş kapısıdır. Öneri (ML/AI)
// ÜRETMEZ - sadece deterministik normalize + validasyon.
export async function normalizeProductInput(raw: RawProductInput, opts: NormalizeOptions): Promise<NormalizedProduct> {
  const issues: Issue[] = [];

  const name = normalizeTitle(raw.name);
  if (!name.value) issues.push({ field: "name", level: "error", message: "Ürün adı zorunlu" });

  const basePrice = normalizePrice(raw.basePrice);
  if (!basePrice.value) issues.push({ field: "basePrice", level: "error", message: `Fiyat geçersiz: ${raw.basePrice ?? ""}` });
  else if (Number(basePrice.value) <= 0) issues.push({ field: "basePrice", level: "error", message: "Fiyat 0'dan büyük olmalı" });

  const compareAtPrice = normalizePrice(raw.compareAtPrice);
  if (compareAtPrice.value && basePrice.value) {
    const cmp = Number(compareAtPrice.value);
    const base = Number(basePrice.value);
    if (cmp <= base) issues.push({ field: "compareAtPrice", level: "warn", message: "Eski fiyat satış fiyatından büyük olmalı; yok sayıldı" });
    else if (cmp > base * MAX_DISCOUNT_MULTIPLE)
      issues.push({ field: "compareAtPrice", level: "warn", message: `Eski fiyat çok yüksek (max ${MAX_DISCOUNT_MULTIPLE}x); yok sayıldı` });
  }

  const categoryId = await normalizeCategory(raw.category, opts.resolveCategory);
  if (!categoryId.value) issues.push({ field: "category", level: "error", message: `Kategori bulunamadı: ${raw.category ?? ""}` });

  const description = cleanDescription(raw.description);
  const brand = normalizeBrand(raw.brand);
  const sizes = normalizeSizes(raw.sizes);
  const rawSizeTokens = (raw.sizes ?? "")
    .split(/[,/;|]/)
    .map((value) => value.trim().replace(/\s+/g, " "))
    .filter(Boolean);
  if (rawSizeTokens.length > MAX_PRODUCT_SIZES) {
    issues.push({ field: "sizes", level: "error", message: `En fazla ${MAX_PRODUCT_SIZES} beden/varyant girilebilir` });
  }
  if (rawSizeTokens.some((value) => value.length > MAX_SIZE_LABEL_LENGTH)) {
    issues.push({ field: "sizes", level: "error", message: `Beden etiketi en fazla ${MAX_SIZE_LABEL_LENGTH} karakter olabilir` });
  }

  // Stok: belirtilmemişse defaultStock (yoksa 0). Geçersiz metin -> warn + default.
  const stockField = normalizeStock(raw.stock);
  let stock = stockField;
  if (stockField.value == null && (raw.stock ?? "").trim()) {
    issues.push({ field: "stock", level: "warn", message: `Stok geçersiz: ${raw.stock}; varsayılana çekildi` });
  }
  if (stockField.value == null) {
    stock = { value: opts.defaultStock ?? 0, source: "rule", confidence: 0.5 };
  }

  const barcode = normalizeBrand(raw.barcode); // barkod da kısa-metin temizliği (aynı kural)

  const fingerprint = productFingerprint(0, name.value, {
    price: basePrice.value ?? "",
    category: raw.category ?? "",
  });

  return { name, basePrice, compareAtPrice, categoryId, description, brand, stock, sizes, barcode, fingerprint, issues };
}

// Kaydı bloklayan hata var mı (error seviyeli issue).
export function hasBlockingIssues(p: NormalizedProduct): boolean {
  return p.issues.some((i) => i.level === "error");
}
