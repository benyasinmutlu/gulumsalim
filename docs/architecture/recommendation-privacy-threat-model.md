# Recommendation Privacy & Threat Model (FAZ 8)

Kapsam: davranış event toplama, profil, discover pipeline. Her risk: ön koşul → etki → kontrol → kalan risk → test.

| # | Tehdit | Ön koşul | Etki | Kontrol | Kalan risk | Test |
|---|---|---|---|---|---|---|
| T1 | Sahte event spam | İstemci event endpoint'ine erişir | Profil/collaborative kirlenir | Rate limit + batch limit (50) + dedup + collaborative min-support | Dağıtık bot | `event-security.test.ts` batch/dup |
| T2 | Sahte purchase | İstemci purchase gönderir | Öneri/analitik manipülasyonu | `CLIENT_FORBIDDEN_TYPES` → server-only reddi | — | ✅ server_only_event |
| T3 | Başka customerId ile event | İstemci body'de customerId | Başkasının profilini zehirler | customerId **daima session'dan** | — | ✅ session customerId |
| T4 | Seller self-boost | Satıcı kendi ürününü sahte etkileşimle | Sıralama manipülasyonu | Collaborative min-support + tek-kullanıcı görünmezliği + business boost relevance'i ezmez | Koordineli abuse | aggregate job (tasarım) |
| T5 | Bot view/click | Otomatik trafik | Popülerlik/CTR şişer | Rate limit + zaman decay + conversion-adjusted popularity | Sofistike bot | ⏳ fraud sinyali |
| T6 | IDOR (öneri/try-on) | Kaynak sahiplik kontrolü zayıf | Başka kullanıcının verisi | Session sahiplik; discover yalnız public productId | — | pipeline authz |
| T7 | Profile poisoning | Uzun süreli sahte sinyal | Feed bozulur | Ağırlık sınırı + decay + negatif feedback + tek purchase kilitlemez | Yavaş drift | `profile.test.ts` decay |
| T8 | Recommendation inference | Yanıt gözlemi | Başka kullanıcının davranışı çıkarılır | Collaborative min-support (düşük örneklem yayınlanmaz); yalnız agrege | İstatistiksel çıkarım | aggregate threshold |
| T9 | PII loglama | Log'a hassas veri | Sızıntı | event id/dedup hash; ham IP/PII yok | Log dışı yollar | manuel review |
| T10 | Consent bypass | Rıza yok ama profil yazılır | Gizlilik ihlali | `writeProfile=false` + kişisel kaynak yok + merge yok | — | ✅ consent testleri |
| T11 | Cross-user cache leak | Kişisel yanıt paylaşımlı cache'lenir | Başka kullanıcı görür | `cacheable=false` (kişisel); web private/no-store | Yanlış cache config | ✅ cacheable testi |
| T12 | Unbounded candidate/Redis | Sınırsız liste/anahtar | Bellek/DoS | bounded pool (limit*2), affinity TTL+prune, batch limit | — | CLAUDE-009 |

## Gizlilik ilkeleri
- Rıza ayrımı (personalization vs analytics); rıza yoksa kişisel işlem yok.
- Veri minimizasyonu (hash id, ham PII yok).
- Retention: affinity 90g, profil decay, aggregate yenilenir.
- Silme/anonimleştirme: kullanıcı reset → affinity/profil sil (CLAUDE-019 açık).

## Açık riskler
Fraud sinyal modeli (T4/T5) yalnız tasarım; otomatik engelleme YOK. Collaborative aggregate min-support prod'da zorlanmalı. Müşteri anonimleştirme prosedürü (CLAUDE-019) açık.
