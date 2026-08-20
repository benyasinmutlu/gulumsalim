// Ürün zeka (product-intelligence) modülünün paylaşılan tipleri.
// Cascade tasarımı (bkz. docs/architecture/product-intelligence-and-channel-sync.md):
// rule (deterministik) -> ml (opsiyonel) -> ai (opsiyonel). Her alan değeri
// hangi katmandan geldiğini ve güvenini taşır; validasyonun tek doğruluk
// kaynağı RULE katmanıdır (bu modül).

export type FieldSource = "input" | "rule" | "ml" | "ai";

// Normalize edilmiş bir alan: değer + kaynağı + güven (0..1).
export interface FieldValue<T> {
  value: T | null;
  source: FieldSource;
  confidence: number;
}

export type IssueLevel = "error" | "warn";
// error -> kaydı blokla; warn -> satıcıya göster ama kaydet.
export interface Issue {
  field: string;
  level: IssueLevel;
  message: string;
}

// Satıcıdan / dosyadan gelen HAM ürün girdisi (tüm alanlar string, çünkü
// form/CSV/JSON hepsi metin olarak gelir; normalizasyon burada yapılır).
export interface RawProductInput {
  name?: string;
  basePrice?: string;
  compareAtPrice?: string;
  category?: string;
  description?: string;
  brand?: string;
  stock?: string;
  sizes?: string;
  barcode?: string;
}

// Normalize edilmiş ürün: her alan FieldValue, + türetilmiş beden listesi,
// fingerprint (yakın-kopya) ve toplanan sorunlar.
export interface NormalizedProduct {
  name: FieldValue<string>;
  basePrice: FieldValue<string>;
  compareAtPrice: FieldValue<string>;
  categoryId: FieldValue<number>;
  description: FieldValue<string>;
  brand: FieldValue<string>;
  stock: FieldValue<number>;
  sizes: string[];
  barcode: FieldValue<string>;
  fingerprint: string;
  issues: Issue[];
}

// Kategori çözümü DB'ye bağımlıdır; test edilebilirlik için enjekte edilir.
// Bir aday değeri (slug/isim) alıp kategori id'si döndürür (yoksa null).
export type CategoryResolver = (value: string) => Promise<number | null>;

// Güven sabitleri - "sihirli sayı" olmasın diye tek yerde.
export const CONFIDENCE = {
  EXACT: 1, // girdi zaten temizdi
  CLEANED: 0.9, // kural temizledi (₺/TL/binlik ayraç vb.)
  DERIVED: 0.8, // dolaylı türetildi (slugify eşleşmesi vb.)
  NONE: 0,
} as const;
