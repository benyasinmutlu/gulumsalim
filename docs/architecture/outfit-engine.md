# Outfit / Kombin Engine

## Amaç
Bir ürün (seed) etrafında, satın alınabilir ve **açıklanabilir** kombin önerileri üretmek ("bu üste bu alt ve ayakkabı, çünkü…").

## Kapsam dışı (bu sürüm)
- Embedding/görsel uyum (P4).
- Satın-alma-birlikteliği (market-basket) — event verisi biriktikçe.
- Kişisel stil ağırlıkları (personalization ile birleşme, sonraki sürüm).

## Veri akışı
```
seed Garment + catalog Garment[] ──▶ ruleBasedEngine.suggest() ──▶ OutfitSuggestion[] (items, score, reasons)
                                         │ renk uyumu + slot tamamlama + mevsim + stok
                                         ▼ web PDP "Tamamla" / kombin karuseli
```

## Trust boundary
- Yalnız `status=active` ürün + `vendorStatus=active` (katalog kuralı) katalogda olmalı.
- Stok (`inStock`) kontrol edilir; öneri yalnız satın alınabilir ürünlerden.
- Fiyat/stok kaynağı DB (istemci değil).

## Bileşenler
- `outfit/contract.ts` — `Garment` domain modeli, `OutfitRuleEngine` arayüzü, `ruleBasedEngine()` iskeleti, `colorsHarmonize`.
- (Eksik) Ürün metadata zenginleştirme: `colorFamily, pattern, material, season, occasion, style, fit, silhouette, length, sleeve, neckline` — şu an şemada YOK (bkz. açık kararlar).

## API / contract
- `OutfitRuleEngine.suggest(seed, catalog, {limit, season?}) → OutfitSuggestion[]`.
- `OutfitSuggestion { items: number[], score, reasons: string[] }`.

## Failure modes
- Tamamlayıcı slot doldurulamıyor → boş döner (yanlış kombin önermez).
- Metadata eksik (renk/mevsim) → o ürün elenir; kapsam düşer ama yanlış öneri olmaz.
- Katalog boş → boş.

## Privacy / security
- Kişisel veri kullanmaz (yalnız ürün metadata) — bu sürüm gizlilik-nötr.
- Personalization ile birleşince consent kuralları devreye girer.

## Observability
- Öneri sunum/tıklama, kombin→sepet dönüşümü, kapsam (kaç seed için öneri üretilebildi), boş-öneri oranı.

## Test stratejisi
- Saf/deterministik → unit (mevcut: 5 test): renk uyumu, slot tamamlama, determinizm, eksik-slot boş dönüş.

## Rollout
1. Metadata alanlarını (renk/mevsim/stil) ürün şemasına ekle (migration + satıcı formu).
2. Kurallı motoru PDP'de gölge/az trafikte aç.
3. Tıklama/dönüşüm ölç, kuralları ayarla.
4. Sonraki sürüm: satın-alma-birlikteliği + embedding.

## Rollback
- Feature flag ile kombin bölümünü gizle (UI); motor saf olduğundan yan etki yok.

## Açık kararlar
- **Metadata modeli** (en kritik): hangi alanlar zorunlu, satıcıya nasıl toplatılır (bulk import + validation)?
- Renk uyum tablosu (`COMPLEMENT`) elle mi, veriyle mi genişletilecek?
- Bir seed için birden çok alternatif kombin (varyasyon) üretimi.
