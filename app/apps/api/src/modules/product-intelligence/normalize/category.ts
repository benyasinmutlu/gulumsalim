import { CONFIDENCE, type CategoryResolver, type FieldValue } from "../types";

// Kategori çözümü DB'ye bağımlı olduğu için resolver ENJEKTE edilir (test
// edilebilirlik + katman ayrımı). resolver bir değer alıp kategori id'si
// döndürür (slug / isim / slugify eşleşmesi repository katmanında yapılır).
//
// Boş değer -> null alan. Bulunamadı -> null + confidence NONE (çağıran
// "kategori bulunamadı" issue'su ekler). Bulundu -> id + DERIVED güven.
export async function normalizeCategory(
  raw: string | undefined | null,
  resolver: CategoryResolver,
): Promise<FieldValue<number>> {
  const value = (raw ?? "").trim();
  if (!value) return { value: null, source: "input", confidence: CONFIDENCE.NONE };
  const id = await resolver(value);
  if (id == null) return { value: null, source: "input", confidence: CONFIDENCE.NONE };
  return { value: id, source: "rule", confidence: CONFIDENCE.DERIVED };
}
