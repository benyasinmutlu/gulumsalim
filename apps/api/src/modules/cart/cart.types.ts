// Sepette sadece kaynak veri (ürün/varyant/adet) tutulur - fiyat/isim gibi
// türetilmiş alanlar her okumada canlı veritabanından hesaplanır
// (bkz. cart.service.ts hydrateCart). Böylece bir ürünün fiyatı değişirse
// sepetteki eski fiyat asla göstermez.
export interface CartLine {
  productId: number;
  variantId?: number;
  quantity: number;
}
