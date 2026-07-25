# Production Canonical Reconciliation

**Tarih:** 2026-07-25 · **Branch:** `release/production-canonical-reconcile` (taban: integration; backup: `backup/before-production-canonical-reconcile`).
Kanıt: salt-okunur production keşfi + local ağaç karşılaştırması. Production'da değişiklik YOK.

## KESİN SONUÇ
**Kanonik ağaç = local `app/` alt-monorepo'su** (kendi `package.json`+`pnpm-workspace.yaml`+`pnpm-lock.yaml`, 487 dosya, 33 migration, 175 .ts). Production `/opt/gulumsalim/app` bununla yapısal olarak örtüşüyor (33 migration, 175 .ts, aynı özellik seti). **Top-level ağaç (20 migration) DAHA ESKİ/BASİT** ve güvenlik fix'leri + discover v1 **yanlışlıkla oraya** geliştirildi.

## 10 sorunun cevabı
1. **Production hangi source root'tan build?** `app/` lineage (33 migration, `packages/shared-contracts` ile). Local `app/` en yakın karşılık; production ayrıca `packages/` içerir (local app/'te yok — aşağıda).
2. **API production entrypoint?** `app/apps/api` (`node_modules/.bin/tsx src/server.ts`), systemd WorkingDirectory `/opt/gulumsalim/app/apps/api`.
3. **Web entrypoint?** `app/apps/web` (`next start -p 3001`).
4. **Go discovery source root?** `app/services/discovery`. **Base app/↔top-level İDENTİK** (yalnız benim 7 fix dosyam farklı).
5. **Shared contract'lar?** Production'da `packages/shared-contracts` VAR **ama `apps/api` ve `apps/web` hiç `@gulumsalim/*` import ETMİYOR** → build bağımlılığı DEĞİL (vestigial/stub). Local iki ağaçta da yok.
6. **33 migration canonical path?** `app/infra/postgres/migrations` (0000-0032). Production DB `drizzle.__drizzle_migrations`=33 ile doğrulandı.
7. **Top-level 20 migration deprecated mi?** **Deprecated/paralel-eski.** 0000-0019 iki ağaçta birebir aynı; app/ 0020-0032 additive özellikler ekler (promo_banner_clicks, refund, vendor_type, SEO, freeShipping, 2.el). Top-level bunları içermez.
8. **Deploy scripti hangi path'leri paketliyor?** `app/infra/scripts/deploy.sh` `.`'i paketler (app/ kökünden). Top-level deploy.sh farklı (benim fix'im orada).
9. **Production `packages/` local karşılığı?** **YOK** — ne local top-level ne local `app/` `packages/shared-contracts` içeriyor. Production'da mevcut ama kod import etmiyor. → Local repo, production artifact'inin TAM kaynağı değil (packages/ eksik). İ̇ncelenmeli.
10. **Fix'ler hangi dosyalara port edilmeli?** Aşağıdaki tablo.

## Ağaç divergensi (ölçülen)
- `app/apps/api/src` vs top-level `apps/api/src`: **116 dosya farklı/tek-tarafta** (recommendation eklentilerim hariç). app/ daha fazla özellik: fazladan lib (mailer/shipping/sql-helpers/slugify/cart-product-index), admin-refunds.service, admin-site-feedback, admin-vendor-complaints, catalog'da iconColor/seo*/freeShipping/2.el.
- app/ **daha az test** (3 dosya, 4 test) — 2'si env eksikliğinden fail (env.ts boot-parse; app/ vitest.config'inde `env:` yok). Top-level'de zengin test suite (benimkiler).
- **app/ build edilebilir:** `cd app && pnpm install --frozen-lockfile` ✓ (535 paket), API `tsc`=0, Web `tsc`=0.

## Port tablosu (kaynak → kanonik karşılık → durum → test → risk)
| Değişiklik | Kanonik hedef (`app/…`) | Port durumu | Test | Risk |
|---|---|---|---|---|
| **Test env** (vitest.config `env:`) | `apps/api/vitest.config.ts` | uygulanacak | app/ vitest yeşile döner | Düşük |
| **Discovery 7 fix + 2 test** (timeouts, XAck, readyz, const-time, TTL/prune, ranking, panic) | `services/discovery/**` | **kopyala** (base identik) | Go build/-race (CI, Go yok local) | Düşük |
| **trustProxy loopback** | `apps/api/src/app.ts` | app/ app.ts farklı → **manuel re-apply** | app/ inject test | Orta |
| **login-rate-limit + vendor-access + auth-guard + session regenerate + banned/suspended** | `apps/api/src/plugins/*`, `modules/{auth,vendors,admin}/*` | yeni dosya kopya + divergent dosyalara re-apply | app/ unit | Orta |
| **checkout/order hardening** (server-side fiyat, callback token/amount BigInt, idempotency, koşullu stok) | `apps/api/src/modules/orders/*` | app/ versiyonu farklı → **dikkatli re-apply** | app/ service test | **Yüksek** (ödeme) |
| **Discover v1 stack** (~25 dosya) | `apps/api/src/modules/recommendation/**` + app.ts wiring | çoğu yeni dosya kopya; import/schema/app.ts adapte | app/ inject + unit | Orta |
| **nginx/systemd/deploy hardening** | `app/infra/**` | app/ versiyonuna re-apply; prod-tls + manual/0001 kopya | nginx -t / systemd-analyze (CI) | Orta |
| **money/stock CHECK** (`manual/0001`) | `app/infra/postgres/manual/` (canonical 33 sonrası) | kopya + kolon adı doğrula | staging psql | Orta |

## Kritik açık nokta (owner kararı)
**Production `packages/shared-contracts` local repo'nun HİÇBİR ağacında yok.** apps/api/web import etmediği için build'i bozmuyor, ama bu, **local repo'nun production artifact'inin tam source-of-truth OLMADIĞINI** gösteriyor. Deploy öncesi: gerçek kanonik kaynak repo teyit edilmeli VEYA `packages/` içeriğinin gerçekten kullanılmadığı doğrulanıp reconcile edilmeli.

## Strateji
`app/` kanonik + build edilebilir olduğundan, fix'ler **app/'e port edilip app/'te doğrulanır** (körlemesine kopyalama YOK — divergent dosyalar manuel re-apply). Top-level ağaç bu turda SİLİNMEZ (owner kararı). Sıra: test-env → discovery (kolay) → API güvenlik (kritik) → discover v1 → infra → constraint. Her adım `cd app && pnpm typecheck && test` ile doğrulanır.
