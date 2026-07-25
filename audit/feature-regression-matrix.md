# Feature Regression Matrix — Canonical app/ Port

**Tarih:** 2026-07-25 · **Branch:** `release/production-canonical-reconcile` · **Kanonik ağaç:** `app/` (33 migration).
Amaç: güvenlik + Discover port'ları uygulanırken app/'in gelişmiş ürün özelliklerinde **regresyon olmadığını** doğrulamak. app/ api tsc=0, **114 test**, web tsc=0, web build=0.

| # | Özellik | Kaynak dosya(lar) | Etkilenen port | Test / doğrulama | Sonuç | Kalan risk |
|---|---|---|---|---|---|---|
| 1 | forgot-password request | auth/auth.routes.ts, auth.service | auth cluster (regenerate yalnız login/register) | dosya intact + tsc | ✅ korundu | — |
| 2 | reset token validation | auth.service, auth.repository | — | tsc | ✅ | — |
| 3 | SMTP mailer | lib/mailer.ts | test-env SMTP double | vitest env (gerçek SMTP çağrısı yok) | ✅ | prod SMTP env gerekli |
| 4 | customer refund creation | orders/customer-refunds.* | ödeme portu (DOKUNULMADI) | tsc + intact | ✅ | canlı smoke önerilir |
| 5 | admin refund review | admin/admin-refunds.service, iyzico refundPayment | ödeme portu (dokunulmadı) | tsc | ✅ | canlı smoke |
| 6 | refund status transition | admin-refunds, order.repository | markOrderPaymentFailed **pending-guard** eklendi (paid'i failed yapmaz, çift stock-restore yok) | order.repository intact + 34 payment test | ✅ iyileşti | — |
| 7 | individual seller onboarding | vendors/vendor-auth.routes (become-individual) | auth cluster — regenerate yalnız register/login'e uygulandı, become-seller'a DEĞİL | intact + tsc | ✅ | — |
| 8 | second-hand listing | vendor-auth, catalog (2.el) | — | tsc + web build | ✅ | — |
| 9 | site feedback | admin-site-feedback.routes, site-feedback.repository | — | intact | ✅ | — |
| 10 | vendor complaint | admin-vendor-complaints, vendor-complaints.repository | — | intact | ✅ | — |
| 11 | shipping helper | lib/shipping.ts (getShippingConfig) | checkout server-side pricing bunu kullanır | checkout intact + tsc | ✅ | — |
| 12 | slug generation | lib/slugify.ts | — | tsc | ✅ | — |
| 13 | vendor categories | vendors/vendor-categories.routes | — | intact | ✅ | — |
| 14 | product browsing | catalog.* | — | web build + tsc | ✅ | — |
| 15 | checkout | orders/checkout.service | **server-side price + callback token/amount verify + koşullu stok + idempotency** eklendi | 6 payment regression testi | ✅ güçlendi | canlı sandbox smoke |
| 16 | payment callback | checkout.service, order-security | callback doğrulaması + race-safe transition | 6 test | ✅ güçlendi | — |
| 17 | legacy discover | discovery.routes/service/client | değişmedi | tsc | ✅ | — |
| 18 | Discover v1 (flag OFF) | recommendation/discover/* | yeni, flag-gated | 90+ discover testi; flag OFF → route kayıtsız | ✅ | — |
| 19 | Discover v1 (allowlist) | discover.v1.routes | flag ON | inject testleri (identity/cache/fallback) | ✅ (allowlist flag mantığı P1) | flag kapsamı aşağıda |

## Özet
Güvenlik + Discover port'ları app/'in hiçbir gelişmiş özelliğini **kaldırmadı/bozmadı**. Refund/mailer/2.el/feedback/complaint dosyalarına dokunulmadı; yalnız auth login/register + checkout/order güvenlik kontrolleri minimal eklendi. Ödeme güvenliği **güçlendi** (callback doğrulaması, idempotency, pending-guard). 33-migration şema korundu.

## Kalan (canlı staging'de smoke gerektiren)
Refund oluşturma/onay, checkout sandbox callback, forgot-password e-postası (gerçek SMTP) — kod-seviyesi intact ama canlı bağımlılık (iyzico/SMTP) gerektiren akışlar staging smoke'ta doğrulanmalı.
