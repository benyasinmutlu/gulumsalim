# Consolidated Validation — FAZ 2

**Branch:** `release/yasin-secure-foundation` · **Tarih:** 2026-07-24

## Konsolidasyon sonucu
7 commit `main` (`38cb008`) üzerine temiz cherry-pick edildi, **çakışma yok** (gpt56 `apps/api` ile claude-opus `services/discovery`+`infra`+`audit` ayrık dosya kümeleri). `fc30214` atlandı.

```
933c9b3 docs(audit): add infra/Go security review findings and handoff   (039f3a7)
0c1f08f fix(infra): harden nginx headers, systemd sandbox, deploy         (433fa32)
905d682 fix(discovery): harden HTTP timeouts, event ack, ranking...       (38ef8b9)
b0a7e2d test(api): add payment-callback regressions and test env config   (29ade4b)
dec0cd9 fix(api): pin trustProxy to loopback...                           (d27e9f5)
ebb320b fix(api): enforce login and vendor session controls              (3ffaa26)
f4e0adf fix(api): harden order access and payment callbacks              (d4c1aa0)
38cb008 Gulum Salim webb (base)
```

## Otomatik doğrulamalar (çalıştırıldı)
| Kontrol | Komut | Sonuç |
|---|---|---|
| Frozen install | `pnpm install --frozen-lockfile` | ✅ exit 0 — **lockfile güncel** |
| API typecheck | `pnpm --filter @gulumsalim/api exec tsc --noEmit` | ✅ exit 0 |
| API testleri | `pnpm --filter @gulumsalim/api exec vitest run` | ✅ **42 passed / 7 dosya** |
| Web typecheck | `pnpm --filter @gulumsalim/web exec tsc --noEmit` | ✅ exit 0 |
| deploy.sh syntax | `bash -n infra/scripts/deploy.sh` | ✅ syntax OK |

## Güvenlik regression kontrolleri (bağımsız doğrulandı)
| Kontrol | Sonuç | Yöntem |
|---|---|---|
| XFF spoof ile login rate-limit bypass edilemiyor | ✅ | `trustProxy: "loopback"` (app.ts) — request.ip artık nginx'in eklediği gerçek IP; sol XFF spoof'u yok sayılır |
| Reverse-proxy vs direkt erişim IP davranışı belgeli | ✅ | Yalnızca loopback (nginx@127.0.0.1) güvenilir; API zaten yalnız 127.0.0.1:3000'de |
| Secure cookie davranışı bozulmadı | ✅ | `X-Forwarded-Proto` loopback proxy'den onurlanıyor (session.ts secure cookie) |
| Vendor/customer/admin authz sınırları | ✅ | auth-guard: requireVendor canlı status kontrolü (suspended/banned → 403) |
| Checkout fiyatı istemci payload'ından alınmıyor | ✅ | `hydrateCart` DB fiyatı; cart `request.session.cart` |
| Callback amount/token mismatch reddi | ✅ | `isVerifiedSuccessfulPayment` (BigInt-cent) + service testleri |
| Callback tekrarı idempotent | ✅ | `markOrderPaid` koşullu `WHERE paymentStatus='pending'` + test |
| Stok overselling engeli | ✅ | `UPDATE ... WHERE stock>=qty RETURNING` transaction; 0 satır → rollback |
| Discovery secret sabit-zamanlı | ✅ | `subtle.ConstantTimeCompare` (router.go) |
| Event ack veri kaybı yok | ✅ | XAck yalnız başarıda (consumer.go) |
| /readyz bağımlılık durumu | ✅ | pg.Ping + redis.Ping → 503 (health.go) |
| nginx unknown Host reddi | ✅ | `default_server { return 444; }` |
| systemd cache/upload path'leri engellemiyor | ✅ | ReadWritePaths: uploads (api), .next (web), meili DB — ProtectSystem=strict ile uyumlu |

## Çalıştırılamayan / ortam eksiği kontroller
| Kontrol | Neden | CI için gerekli |
|---|---|---|
| Go `build / test / test -race / vet / gofmt` | **Go toolchain yok** | Go 1.26.2; `cd services/discovery && go build ./... && go vet ./... && go test -race ./...` |
| `shellcheck` deploy.sh | araç yok | `shellcheck infra/scripts/deploy.sh` |
| `nginx -t` config | araç yok | `nginx -t -c infra/nginx/gulumsalim.conf` (include gerektirir) |
| `systemd-analyze security` | araç yok | her unit için skor + `journalctl` EPERM taraması |
| Web `next build` (prod) | ağır + env | CI'da `pnpm --filter @gulumsalim/web build` |
| Canlı DB/Redis entegrasyon + ödeme E2E | servis yok | staging'de gerçek Postgres/Redis + iyzico sandbox |

> Go kodu "çalıştırılmış gibi" raporlanmadı. Değişiklikler statik/manuel derleme-incelemesiyle doğrulandı (importlar, imzalar, tip kullanımları tutarlı); kesin doğrulama yukarıdaki CI komutlarıyla.

## Açık production blocker'ları (özet)
P0: TLS · trustProxy'nin gerçek proxy zinciriyle prod doğrulaması · migration drift · staging ödeme E2E · Go build/race · backup/restore testi. (Detay: `infra-release-checklist.md`, `migration-drift-decision.md`.)
