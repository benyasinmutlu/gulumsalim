# Recommendation Scoring

Kod: `recommendation/ranking.ts` (skorlayıcı) + `recommendation/discover/pipeline.ts` (hydration, çok-aşamalı blend, diversity).

## Çok-aşamalı skor (X: light + heavy ranker)
```
finalScore = 0.7 * rankerScore + 0.3 * candidate.rawScore
```
- `rankerScore` = açıklanabilir weighted personalized skor (aşağı).
- `candidate.rawScore` = retrieval kaynağının yerel skoru.

## Ranker (ağırlıklı, açıklanabilir) — `DEFAULT_V1_WEIGHTS`
```
score = 0.30*categoryAffinity + 0.15*vendorAffinity + 0.10*colorAffinity
      + 0.10*brandAffinity + 0.10*priceFit + 0.10*recency + 0.10*popularity
      + 0.05*sellerQuality - 0.40*negativeFeedback
```
Ağırlıklar config (`RankingWeights`) — A/B ile değiştirilebilir. Her feature'ın katkısı `explanation`'da (debug/admin); production response'unda hassas iç skor **açılmaz** (yalnız `reasonCode` + toplam `score`).

## Feature hydration (`pipeline.hydrateFeatures`)
- **User×product**: categoryAffinity, brandAffinity, colorAffinity (profil ağırlıkları / max, normalize).
- **priceFit**: kullanıcı fiyat aralığına uzaklık (1 = içinde).
- **recency/freshness**: `createdAt` → 90 günde lineer sönme.
- **popularity/sellerQuality**: katalog/port sağlar.
- **availability**: stok yoksa 0 → eligibility'de elenir.
- **negativeFeedback**: "ilgilenmiyorum" kategorisi → ceza.

## Determinizm kuralları
- Aynı input + aynı config = aynı output (test edildi).
- Sıralama: score DESC, eşitlikte productId DESC (stabil tie-break).
- Float kararsızlığı: normalize edilmiş 0..1 feature'lar + sabit ağırlık; kritik para/eşik yok.

## Post-ranking (diversity + fatigue)
- Satıcı ≤3, marka ≤3, kategori ≤4 (tek marka/satıcı akışı dolduramaz).
- already-seen suppression (eligibility) + bölümler arası tekrar yok.
- exploration kaynağı `discover_new` bölümüne minimum keşif sağlar.

## Test
`ranking.test.ts` (determinizm, diversity, negatif ceza, explanation), `pipeline.test.ts` (uçtan uca).
