# X / the-algorithm → E-ticaret Uyarlama Notları

## Lisans notu (ÖNEMLİ)
- `twitter/the-algorithm` **AGPL-3.0** lisanslıdır. `xai-org/x-algorithm` (Phoenix dahil) benzer copyleft koşullar taşır — kullanımdan önce ilgili `LICENSE` dosyası doğrulanmalı.
- Bu çalışmada **hiçbir kaynak kod kopyalanmadı**. Yalnız kamuya açık, iyi belgelenmiş **mimari prensipler** (candidate generation, çok-aşamalı ranking, diversity, mixing, fallback) e-ticaret domain'ine yeniden yazılarak uyarlandı. Mimari fikirler telif kapsamında değildir; kod ise değildir → AGPL bulaşması yoktur.
- Bu turda canlı repo fetch'i **yapılmadı** (token/zaman bütçesi talimatı); uyarlama, the-algorithm'ın kamuya açık mimari dokümantasyonundan yapıldı. İleride birebir kod referansı gerekirse AGPL uyumu (tüm türev AGPL olur) ayrıca değerlendirilmeli — bu ticari repo için muhtemelen **istenmez**.

## Alınan prensipler (uygulandı)
| X prensibi | E-ticaret uyarlaması | Kod |
|---|---|---|
| Candidate generation ≠ ranking | retrieval (kaynaklar) `candidates.ts` ayrı, ranking `ranking.ts`/`pipeline.ts` | ✅ |
| In-network / out-of-network | personal_history (bilinen ilgi) vs exploration (yeni marka/kategori) | ✅ |
| Multi candidate sources + mixing | 4 kaynak + dedup + fallback + 3 bölüm mixer | ✅ |
| Feature hydration | `pipeline.hydrateFeatures` (user×product×cross×context) | ✅ |
| Multi-stage ranking (light+heavy) | retrieval rawScore + personalized ranker `finalScore = 0.7*ranker + 0.3*raw` | ✅ |
| Negative feedback | hide/not_interested → filtre + soft negatif ağırlık | ✅ |
| Author diversity | satıcı/marka/kategori diversity cap | ✅ |
| Feedback fatigue | already-seen suppression + tekrar sınırı | ✅ |
| Visibility filtering | eligibility: stok/yayın/satıcı durumu/gizli | ✅ |
| Observability + fallback | perSource sayımları + graceful partial + popular fallback | ✅ |

## Alınmayan / ertelenen (neden)
| X bileşeni | Neden alınmadı | Ne zaman |
|---|---|---|
| SimClusters / community embeddings | Ölçek + veri yok; açıklanabilirlik önceliği | P4 |
| Heavy ranker (DNN) | ML altyapısı yok; deterministik v1 yeterli | P4 |
| Transformer retrieval/ranking | Veri hacmi + maliyet + latency; kavramsal sınır aşağıda | P4 |
| RealGraph / follow graph | Sosyal graf yok; e-ticarette affinity + co-interaction karşılığı | Kısmi (collaborative) |
| GraphJet / real-time recs | Operasyonel karmaşıklık | Sonra |

## X → E-ticaret kavram eşlemesi
Tweet→Product · Author→Seller/Brand · Follow graph→Brand/category affinity · Engagement→view/favorite/cart/purchase/hide · In-network→bilinen tercih · Out-of-network→keşif adayları · Social proof→toplulaştırılmış co-interaction · Visibility filtering→stok/satıcı/yayın/engel · Author diversity→marka/satıcı/kategori çeşitliliği · Feedback fatigue→ürün/marka tekrar azaltma · Heavy ranker→ileri personalized ranker · Mixer→ana sayfa bölüm/ürün karıştırıcı.

## Sosyal medya varsayımları (taşınMAYAN)
- **Viral/real-time**: e-ticarette envanter sonlu, "viral" yerine stok-sağlıklı trend.
- **Takip grafiği**: yok; affinity + co-purchase ile ikame.
- **Reply/retweet ağı**: karşılığı yok.
- **Kronolojik in-network**: karşılığı "son baktıkların/favorilerin" — ama ticari niyet (satın alma) sinyali sosyal etkileşimden farklı ağırlıklanır (purchase >> view).

## Transformer'a geçiş kriterleri (gelecek)
Aşağıdakiler sağlanınca değerlendirilir: (1) yeterli etiketli etkileşim hacmi (min. aylar), (2) offline replay + A/B altyapısı, (3) latency bütçesi (retrieval < ~50ms), (4) feature store, (5) açıklanabilirlik kaybını telafi edecek guardrail'lar, (6) maliyet/GPU bütçesi. O zamana kadar deterministik weighted scoring + kurallı diversity yeterli ve açıklanabilir.

> Sonraki iterasyon girdisi: mutfak/yemek recommendation projesi (bu turda incelenmedi) — açık kaynak adaptasyon adayı olarak roadmap'e eklendi.
