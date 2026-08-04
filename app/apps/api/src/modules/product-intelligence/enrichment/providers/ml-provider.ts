import type { EnrichmentProvider } from "./provider";

// ML katmanı iskeleti (lokal sınıflandırıcı/embedding). Model henüz yok ->
// isEnabled()=false; pipeline atlar. Arayüz hazır: model gelince kategori
// tahmini / nitelik çıkarımı buraya bağlanır (rule ile AI arasında, hızlı+ucuz).
export const mlProvider: EnrichmentProvider = {
  name: "ml",
  priority: 1,
  isEnabled: () => false,
};
