# Privacy & Threat Model — Intelligent Commerce Engines

## Amaç
Kişiselleştirme, kombin ve virtual try-on motorlarının gizlilik/güvenlik risklerini ve karşı önlemleri tek yerde toplamak (KVKK/GDPR uyumlu tasarım).

## Kapsam
Event toplama, affinity depolama, öneri servisi, fotoğraf upload/try-on pipeline. Ödeme/auth mevcut incelemede kapsandı (bkz. `audit/`).

## Veri sınıflandırması
| Veri | Sınıf | Saklama |
|---|---|---|
| Davranışsal event | Kişisel (pseudonymous) | Redis stream MAXLEN + affinity 90g TTL |
| Affinity skorları | Türetilmiş kişisel | 90g TTL + decay + prune |
| Kullanıcı fotoğrafı | **Hassas biyometrik-yakın** | private storage, kısa retention, silinebilir |
| Try-on çıktısı | Hassas | private, signed URL kısa süre |
| Deney/metric | Agrege/anonim | minimize |

## Trust boundary'ler
- İstemci ↔ nginx (TLS gerekli — CLAUDE-001) ↔ API (127.0.0.1, trustProxy=loopback).
- API ↔ discovery (127.0.0.1 + sabit-zamanlı shared secret).
- API ↔ try-on worker (izole, bounded queue, private storage).
- API ↔ Redis/Postgres (localhost).

## Tehditler ve önlemler (STRIDE özet)
| Tehdit | Senaryo | Önlem |
|---|---|---|
| Spoofing | Başka kullanıcı adına event/rate-limit bypass | customerId server-side; trustProxy=loopback (XFF spoof kapalı) |
| Tampering | Ödeme callback tutarı | BigInt-cent order eşleşmesi (mevcut) |
| Repudiation | İşlem inkarı | audit trail (try-on, admin) |
| Info disclosure | Fotoğraf/URL sızıntısı | private storage, log'a URL/token yazma yok, IDOR sahiplik kontrolü |
| DoS | Upload/event spam, decompression bomb | bounded queue, size/MIME limit, rate limit, quota |
| Elevation | Vendor/admin sınır aşımı | auth-guard canlı status; role guard |
| Cross-user leak | Öneride başka kullanıcı verisi | affinity customerId'ye izole; discovery yalnız productId döner |

## Gizlilik ilkeleri
- **Rıza ayrımı:** `consent.personalization` vs `consent.analytics`. Rıza yoksa kişisel affinity yazılmaz.
- **Veri minimizasyonu:** event id/dedup hash; ham IP/PII loglanmaz.
- **Retention:** affinity 90g; fotoğraf kısa; deney agrege.
- **Silme/anonimleştirme:** kullanıcı reset → affinity key sil; fotoğraf sil; müşteri anonimleştirme (CLAUDE-019 açık).
- **Training kullanımı yok** (açık rıza olmadan).

## Açık riskler (mevcut denetimden)
- CLAUDE-001 TLS yok (P0) → fotoğraf/rıza akışı HTTPS şart.
- CLAUDE-019 müşteri anonimleştirme prosedürü yok.
- CLAUDE-020 IBAN/banka PII düz metin.
- Fotoğraf pipeline henüz yok (tasarım aşaması).

## Test / doğrulama
- IDOR/authz testleri (try-on endpoint eklenince).
- Upload fuzz (MIME spoof, bomb) — worker.
- Consent gating unit (mevcut: event-contract testleri).

## Açık kararlar
- KVKK aydınlatma + açık rıza akışı metinleri.
- Fotoğraf retention süresi + silme SLA.
- Veri işleme envanteri / DPIA (try-on için gerekli).
