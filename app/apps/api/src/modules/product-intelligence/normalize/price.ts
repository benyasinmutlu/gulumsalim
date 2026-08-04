import { CONFIDENCE, type FieldValue } from "../types";

// Satıcı elektronik tablolarındaki para biçimlerini toleranslı ayrıştırır:
// "₺1.234,56", "199,90 TL", "1,234.56", " 299.90 " vb. -> "1234.56".
// (Kaynak: vendor-bulk-import.service.ts toPriceString - buraya tek doğruluk
// kaynağı olarak taşındı; TR "1.500"=1500 binlik-ayraç düzeltmesi dahil.)
//
// Dönüş: FieldValue<string> - value "0.00" biçiminde ya da null (geçersiz).
// confidence: temiz girdi -> EXACT; kural temizlediyse -> CLEANED.
export function normalizePrice(raw: string | undefined | null): FieldValue<string> {
  const input = (raw ?? "").trim();
  if (!input) return { value: null, source: "input", confidence: CONFIDENCE.NONE };

  // Para sembolü/harf/boşluk temizle - sadece rakam, nokta, virgül, eksi kalsın.
  let s = input.replace(/[^\d.,-]/g, "");
  const neededCleanup = s !== input;
  if (!s || s === "-") return { value: null, source: "input", confidence: CONFIDENCE.NONE };

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // İki ayraç: en sağdaki ondalık, diğerleri binlik.
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", "."); // TR: 1.234,56
    } else {
      s = s.replace(/,/g, ""); // EN: 1,234.56
    }
  } else if (hasComma) {
    const parts = s.split(",");
    if (parts.length === 2 && parts[1]!.length <= 2) s = parts[0] + "." + parts[1];
    else s = s.replace(/,/g, "");
  } else if (hasDot) {
    // Tek nokta + en çok 2 hane -> ondalık (12.99). Değilse binlik (TR "1.500"=1500).
    const parts = s.split(".");
    if (!(parts.length === 2 && parts[parts.length - 1]!.length <= 2)) s = s.replace(/\./g, "");
  }

  const parsed = Number(s);
  if (!Number.isFinite(parsed) || parsed < 0) return { value: null, source: "input", confidence: CONFIDENCE.NONE };
  return {
    value: parsed.toFixed(2),
    source: neededCleanup ? "rule" : "input",
    confidence: neededCleanup ? CONFIDENCE.CLEANED : CONFIDENCE.EXACT,
  };
}

// Stok adedi: "10", "10 adet" -> 10. Ondalık ("3.5") geçersiz (10x şişmeyi önler).
// Boş -> null (belirtilmemiş; çağıran varsayılan uygular).
export function normalizeStock(raw: string | undefined | null): FieldValue<number> {
  const input = (raw ?? "").trim();
  if (!input) return { value: null, source: "input", confidence: CONFIDENCE.NONE };
  if (/[.,]\d/.test(input)) return { value: null, source: "input", confidence: CONFIDENCE.NONE };
  const digits = input.replace(/[^\d-]/g, "");
  if (!digits) return { value: null, source: "input", confidence: CONFIDENCE.NONE };
  const n = Number(digits);
  if (!Number.isInteger(n) || n < 0) return { value: null, source: "input", confidence: CONFIDENCE.NONE };
  const neededCleanup = digits !== input;
  return { value: n, source: neededCleanup ? "rule" : "input", confidence: neededCleanup ? CONFIDENCE.CLEANED : CONFIDENCE.EXACT };
}
