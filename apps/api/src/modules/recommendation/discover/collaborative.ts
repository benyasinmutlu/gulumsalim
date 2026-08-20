// =============================================================================
// Collaborative Co-Occurrence (FAZ P1) — item-item "bunu alan bunu da aldı".
// SAF sıralama: ham co-occurrence satırlarını (productId, vendorId, support)
// alır; min-support (gizlilik) uygular, normalize eder, sıralar. DB sorgusu
// adapter'da (discover.repository.ts). CollaborativePort.alsoInteracted bunu kullanır.
// =============================================================================

export interface CoOccurrenceRow {
  productId: number;
  vendorId: number;
  support: number; // seed'i alan KAÇ AYRI müşteri bu ürünü de aldı
}

// Gizlilik + sinyal kalitesi: tek bir kullanıcının davranışını ifşa etmemek
// için en az 2 ayrı müşteri desteği şart (bkz. candidates.ts threat model notu).
export const MIN_SUPPORT = 2;

export function rankCoOccurrence(
  rows: CoOccurrenceRow[],
  limit: number,
): { productId: number; vendorId: number; score: number }[] {
  const filtered = rows.filter((r) => r.support >= MIN_SUPPORT);
  let max = 0;
  for (const r of filtered) if (r.support > max) max = r.support;
  return filtered
    .sort((a, b) => (b.support !== a.support ? b.support - a.support : b.productId - a.productId))
    .slice(0, Math.max(0, limit))
    .map((r) => ({ productId: r.productId, vendorId: r.vendorId, score: max > 0 ? r.support / max : 0 }));
}
