// =============================================================================
// Negative Feedback (FAZ C) — "İlgilenmiyorum / Gizle" satırlarını profil
// setlerine çevirir. SAF: DB satırları → { hiddenProductIds, notInterestedCategoryIds }.
// Pipeline eligibility (hidden ürünü eler) + ranking (notInterested kategori
// ceza) bunları kullanır. DB erişimi adapter'da (discover.repository.ts).
// =============================================================================

export interface FeedbackRow {
  productId: number | null;
  categoryId: number | null;
}

export function toFeedbackSets(rows: FeedbackRow[]): {
  hiddenProductIds: Set<number>;
  notInterestedCategoryIds: Set<number>;
} {
  const hiddenProductIds = new Set<number>();
  const notInterestedCategoryIds = new Set<number>();
  for (const r of rows) {
    if (r.productId != null) hiddenProductIds.add(r.productId);
    if (r.categoryId != null) notInterestedCategoryIds.add(r.categoryId);
  }
  return { hiddenProductIds, notInterestedCategoryIds };
}
