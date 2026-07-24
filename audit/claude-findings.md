# Claude Opus — Güvenlik & Güvenilirlik İnceleme Bulguları

**Kapsam:** `services/discovery` (Go), `infra/` (nginx, systemd, deploy, migration), secrets & supply-chain, servisler-arası trust boundary.
**İnceleyen:** Claude Opus 4.8 (adversarial infra/Go reviewer)
**Branch:** `review/claude-opus`
**Tarih:** 2026-07-24
**Kanonik ağaç:** top-level `apps/`, `services/`, `infra/` (deploy.sh + systemd + drizzle.config bunları işaret eder). `app/` alt-ağacı deploy EDİLMEZ — bkz. CLAUDE-010.

> **Ortam kısıtı:** Go toolchain bu makinede kurulu değil (`go: command not found`). Bu nedenle `go build/test/vet/-race` **yerelde çalıştırılamadı**. Go bulguları statik analizle doğrulandı; kod düzeltmeleri için doğrulama komutları her bulguda verildi ve `infra-release-checklist.md`'de toplandı.

## Özet Tablo

| ID | Severity | Confidence | Component | Status | Test | Commit |
|----|----------|-----------|-----------|--------|------|--------|
| CLAUDE-001 | High | High | nginx/TLS | Open (checklist) | manuel | — |
| CLAUDE-002 | High | High | deploy.sh | Fixed (partial) | shellcheck | pending |
| CLAUDE-003 | Medium | High | discovery/ingest | Fixed | go test (unverified) | pending |
| CLAUDE-004 | Medium | High | discovery/http | Fixed | go test (unverified) | pending |
| CLAUDE-005 | Medium | Medium | postgres/schema | Handoff+migration | psql | pending |
| CLAUDE-006 | Medium | Medium | nginx/host | Fixed | manuel | pending |
| CLAUDE-007 | Medium | High | nginx/headers | Fixed | curl -I | pending |
| CLAUDE-008 | Medium | Medium | nginx/uploads → apps/api | Handoff | manuel | — |
| CLAUDE-009 | Medium | Medium | discovery/redis | Fixed | go test (unverified) | pending |
| CLAUDE-010 | Medium | High | repo/deploy tree | Open (checklist) | manuel | — |
| CLAUDE-011 | Medium | High | discovery/scoring | Fixed | go test (unverified) | pending |
| CLAUDE-012 | Medium | High | systemd | Fixed | systemd-analyze | pending |
| CLAUDE-013 | Medium | Medium | nginx/XFF → apps/api | Handoff | manuel | — |
| CLAUDE-014 | Low | High | discovery/auth | Fixed | go test (unverified) | pending |
| CLAUDE-015 | Low | High | discovery/goroutine | Fixed | go test (unverified) | pending |
| CLAUDE-016 | Low | Medium | discovery/redis | Documented | go test -race | — |
| CLAUDE-017 | Low | High | discovery/authz | Documented | manuel | — |
| CLAUDE-018 | Low | High | postgres/schema | Open (checklist) | psql | — |
| CLAUDE-019 | Low | Medium | postgres/GDPR | Open (checklist) | manuel | — |
| CLAUDE-020 | Low | Medium | postgres/PII | Open (checklist) | manuel | — |
| CLAUDE-021 | Low | High | repo hygiene | Open (checklist) | git | — |
| CLAUDE-023 | Low | High | discovery/health | Fixed | curl | pending |

> "Best practice uygulanmamış" vs "sömürülebilir açık" ayrımı her bulguda **Etki** ve **Sömürü ön koşulu** başlıklarında netleştirildi.

---

## CLAUDE-001 — nginx yalnızca HTTP/80 dinliyor, TLS yok
- **Severity:** High · **Confidence:** High · **Kategori:** CWE-319 (Cleartext Transmission)
- **Dosya:** `infra/nginx/gulumsalim.conf:6` (`listen 80;`, 443 bloğu yok)
- **Sömürü ön koşulu:** Client ile sunucu arasında ağ dinleme (public WiFi, ISP, ara node). Aktif MITM.
- **Etki:** Oturum çerezi (`@fastify/session`), giriş parolaları, iyzico ödeme akışı ve admin paneli tamamen **düz metin**. Pasif dinleyici oturumu çalar (session hijack), aktif MITM içerik enjekte eder. Ödeme işleyen bir pazaryeri için kritik.
- **Kök neden:** Faz-0 test domaini (`ylina.life`) için TLS henüz kurulmamış; conf sadece :80.
- **Düzeltme:** `certbot` ile Let's Encrypt sertifikası, `listen 443 ssl http2;`, `:80 → :443` kalıcı redirect, `Strict-Transport-Security` (yalnızca 443 hazır olduğunda — CLAUDE-007). Conf'a certsiz 443 bloğu eklemek nginx'i başlatmaz; bu yüzden burada EDIT yapılmadı, checklist'e blocker olarak eklendi.
- **Regression testi:** `curl -I http://ylina.life` → 301; `curl -Iv https://ylina.life` → 200 + valid cert; SSL Labs A.
- **Durum:** Open — production blocker (bkz. `infra-release-checklist.md`).

## CLAUDE-002 — deploy.sh: atomik olmayan, rollback'siz, root, frozen-lockfile'sız
- **Severity:** High · **Confidence:** High · **Kategori:** CWE-494 (Download of Code Without Integrity Check) + operasyonel
- **Dosya:** `infra/scripts/deploy.sh:16,24,29,35`
- **Sömürü/arıza ön koşulu:** Her deploy.
- **Etki (çoklu):**
  1. `tar -xzf ... -C /opt/gulumsalim/app` çalışan dizinin **üzerine yerinde açar** (satır 24). Açma sırasında servisler eski binary'yle ama yeni/karışık dosyalarla çalışır — partial-deploy penceresi. Build sonradan patlarsa (`set -e`) servisler restart edilmez ama dosyalar zaten değişmiştir → tutarsız durum, **rollback yok**.
  2. `pnpm install` (satır 29) `--frozen-lockfile` olmadan çalışır: lockfile package.json ile uyuşmazsa sessizce bağımlılık günceller ve **postinstall lifecycle script'leri** her deploy'da ağdan çekilip `gulumsalim` olarak çalışır — supply-chain + tekrarlanamaz build.
  3. Migration adımı yok → şema/kod sırası elle yönetiliyor (migration-before-code riski).
  4. `tar -czf ... .` tüm repoyu paketler: `go/pkg/mod` (1394 dosya), `app/` kopyası, `.config/`, dotfile'lar prod'a gider (bkz. CLAUDE-021).
- **Kök neden:** Basit "rsync üzeri" deploy; release dizini + symlink swap deseni yok.
- **Düzeltme (uygulandı, kısmi):** `set -Eeuo pipefail`, remote'ta `pnpm install --frozen-lockfile`, tar exclude listesine `./go ./app ./.config` eklendi, migration hatırlatma adımı + build-önce/restart-sonra sıralaması netleştirildi. **Atomik release (release/ + symlink) ve rollback** daha büyük değişiklik olduğundan checklist'te önerildi (uygulama davranışını bozmamak için kademeli).
- **Regression testi:** `shellcheck infra/scripts/deploy.sh` temiz; staging'de kasıtlı build-fail → eski sürüm ayakta kalmalı.
- **Durum:** Fixed (partial) — atomik release checklist'te.

## CLAUDE-003 — Consumer başarısız işlemede de XAck yapıyor → event kaybı
- **Severity:** Medium · **Confidence:** High · **Kategori:** CWE-703 (Improper Handling of Exceptional Conditions) / veri bütünlüğü
- **Dosya:** `services/discovery/internal/ingest/consumer.go:63-64`, `70-95`
- **Sömürü/arıza ön koşulu:** `IncrAffinity` sırasında geçici Redis hatası (bağlantı kopması, OOM, timeout).
- **Etki:** Yorum (satır 22-23) *"işlenirken hata alan bir event onaylanmaz ve sonraki taramada tekrar denenir"* diyor. Gerçekte kod `handleMessage`'ın sonucundan **bağımsız olarak her mesajı XAck'ler** (satır 64). `IncrAffinity` hata dönerse event yine onaylanır ve **kalıcı kaybolur** — kişiselleştirme sinyali sessizce eksilir. At-least-once teslimat iddiası yanlış; gerçekte at-most-once.
- **Kök neden:** `handleMessage` `error` döndürmüyor; ack koşulsuz.
- **Düzeltme (uygulandı):** `handleMessage` `error` döndürür; XAck yalnızca `nil` dönüşte yapılır. Parse hatası / misafir event / weight==0 gibi "işlenecek bir şey yok" durumları **başarı** sayılır (ack'lenir), yalnızca gerçek Redis yazma hatası ack'lenmez. Pending giriş birikmesini sınırlamak için `XAutoClaim` ile idle-pending yeniden işleme notu eklendi (checklist).
- **Regression testi:** `consumer_test.go` — sahte store `IncrAffinity` hata döndürünce mesajın XAck edilmediği; başarıda edildiği doğrulanır. `go test ./internal/ingest/...`.
- **Durum:** Fixed (yerelde derlenemedi — Go yok).

## CLAUDE-004 — HTTP sunucusunda timeout yok → Slowloris / kaynak tüketimi
- **Severity:** Medium · **Confidence:** High · **Kategori:** CWE-400 (Uncontrolled Resource Consumption)
- **Dosya:** `services/discovery/cmd/server/main.go:50-53`
- **Sömürü ön koşulu:** Discovery'ye TCP erişebilen bir aktör. Servis `127.0.0.1`'e bağlı olsa da Node API ile aynı host'ta; localhost'a erişen herhangi bir süreç (yan-servis, container escape, SSRF zinciri) yavaş/yarım istek gönderebilir.
- **Etki:** `http.Server` yalnızca `Addr` ve `Handler` ile kuruluyor; `ReadTimeout`, `ReadHeaderTimeout`, `WriteTimeout`, `IdleTimeout`, `MaxHeaderBytes` yok. Yavaş-header (Slowloris) veya asılı bağlantılar goroutine/FD tüketir; 150M `MemoryMax` altında OOM-kill → restart. Savunmasız.
- **Kök neden:** Varsayılan `http.Server` timeout'suzdur.
- **Düzeltme (uygulandı):** `ReadHeaderTimeout=5s`, `ReadTimeout=10s`, `WriteTimeout=15s`, `IdleTimeout=60s`, `MaxHeaderBytes=1<<20`.
- **Regression testi:** `go vet ./...`; manuel `slowhttptest` ile header askısı 5s'de kesilmeli.
- **Durum:** Fixed (yerelde derlenemedi).

## CLAUDE-005 — Para/miktar alanlarında CHECK constraint yok (negatif payout DB'de engellenmiyor)
- **Severity:** Medium · **Confidence:** Medium · **Kategori:** CWE-20 (Improper Input Validation) — defense-in-depth
- **Dosya:** `infra/postgres/migrations/0000_known_tigra.sql:11,30,150,151,164-166,176-178` (ve tüm `numeric` para alanları)
- **Sömürü ön koşulu:** Uygulama katmanı doğrulaması atlanır/hatalıysa (örn. satıcı payout talebi, sepet miktarı). Sömürülebilirlik **apps/api ödeme mantığına bağlı** → GPT-5.6 handoff.
- **Etki:** `vendor_payouts.amount`, `order_items.quantity`/`unit_price`/`total`, `orders.subtotal/total`, `vendor_earnings.*` hiçbir `CHECK (x >= 0)` / `quantity > 0` içermiyor. Uygulama guard'ı bypass edilirse **negatif payout / negatif toplam** cüzdan bakiyesini şişirebilir. `product_reviews.rating` için `CHECK 1..5` yok, `vendors.commission_rate` için `0..100` yok.
- **Kök neden:** Drizzle şemasında CHECK tanımlanmamış.
- **Düzeltme:** Yeni migration önerisi (`00NN_money_checks.sql`) taslağı checklist'te; `NOT VALID` + ayrı `VALIDATE CONSTRAINT` ile mevcut kurulu DB'de kilitsiz uygulama. Ödeme iş kuralıyla çelişmemesi için önce GPT-5.6 ile koordinasyon (handoff).
- **Regression testi:** `INSERT ... amount = -1` → constraint violation.
- **Durum:** Handoff + migration taslağı (checklist).

## CLAUDE-006 — nginx Host header'ı backend'e doğrulanmadan geçiyor (Host injection)
- **Severity:** Medium · **Confidence:** Medium · **Kategori:** CWE-644 (Improper Neutralization of HTTP Headers)
- **Dosya:** `infra/nginx/gulumsalim.conf:20,30` (`proxy_set_header Host $host;`)
- **Sömürü ön koşulu:** Bu server bloğu tek/default blok olduğundan herhangi bir `Host:` değeriyle gelen istek buraya düşer ve `$host` backend'e aktarılır. Node/Next mutlak URL üretiminde (parola sıfırlama linki, kanonik SSR URL, e-posta) `Host`'a güveniyorsa.
- **Etki:** Host header injection → zehirli parola-sıfırlama linkleri, açık yönlendirme, SSR cache poisoning. Gerçek etki apps/api'nin `Host`'u nasıl kullandığına bağlı (handoff notu GPT-5.6).
- **Kök neden:** Katı `server_name` eşleştirmesi + default-server reddi yok.
- **Düzeltme (uygulandı):** Bilinmeyen Host'u reddeden `default_server` + `return 444` bloğu ve `if ($host !~* ^(ylina\.life|www\.ylina\.life)$) { return 421; }` eklendi.
- **Regression testi:** `curl -H 'Host: evil.com' http://<ip>/` → 444/421; geçerli Host → 200.
- **Durum:** Fixed.

## CLAUDE-007 — nginx güvenlik header'ları eksik
- **Severity:** Medium · **Confidence:** High · **Kategori:** CWE-693 (Protection Mechanism Failure)
- **Dosya:** `infra/nginx/gulumsalim.conf` (header yok)
- **Sömürü ön koşulu:** Clickjacking (iframe), MIME-sniffing tabanlı XSS, referrer sızıntısı.
- **Etki:** `X-Frame-Options`/`frame-ancestors` yok → clickjacking; `X-Content-Type-Options: nosniff` yok → `/uploads/` altındaki içeriğin MIME-sniff ile script çalıştırılması (CLAUDE-008 ile birleşince ciddileşir); `Referrer-Policy`, `Permissions-Policy` yok.
- **Düzeltme (uygulandı):** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()` eklendi. `HSTS` ve tam `CSP` **TLS hazır olunca** (CLAUDE-001) eklenmeli — CSP uygulama davranışına bağlı olduğu için körlemesine eklenmedi (web ekibi/GPT-5.6 ile).
- **Regression testi:** `curl -I http://<host>/` header'ları göstermeli.
- **Durum:** Fixed (HSTS/CSP checklist'te).

## CLAUDE-008 — `/uploads/` ham servis: yüklenen HTML/SVG stored XSS
- **Severity:** Medium · **Confidence:** Medium · **Kategori:** CWE-79 (Stored XSS) — trust chain
- **Dosya:** `infra/nginx/gulumsalim.conf:12-16`; asıl kök: `apps/api` upload doğrulaması (GPT-5.6 alanı)
- **Sömürü ön koşulu:** Satıcı/kullanıcı upload'ı içerik-tipi/uzantı doğrulaması olmadan kabul ediyorsa; saldırgan `.html`/`.svg` yükler, kurban linke tıklar.
- **Etki:** `/uploads/` aynı origin'den servis edildiği için yüklenen HTML/SVG içindeki JS aynı-origin çalışır → oturum çalma. nginx `nosniff` (CLAUDE-007) kısmen azaltır ama `Content-Type: image/svg+xml` hâlâ script çalıştırır.
- **Düzeltme:** nginx tarafında `/uploads/` için `add_header Content-Disposition "attachment"` veya `Content-Security-Policy "default-src 'none'"` + `types { }` ile `application/octet-stream` zorlaması. Asıl düzeltme: apps/api'de upload MIME allowlist + sharp ile yeniden-encode (zaten `sharp` bağımlılığı var). → **handoff-to-gpt56.md**.
- **Durum:** Handoff (nginx palyatifi checklist'te).

## CLAUDE-009 — Redis affinity set'leri sınırsız büyüyor (TTL/pruning yok)
- **Severity:** Medium · **Confidence:** Medium · **Kategori:** CWE-400 (Uncontrolled Resource Consumption)
- **Dosya:** `services/discovery/internal/store/redis.go:29-39,56-74`
- **Sömürü/arıza ön koşulu:** Zamanla / kullanıcı sayısı arttıkça doğal büyüme.
- **Etki:** `IncrAffinity` her yeni kategori/satıcı için sorted-set üyesi ekler; `DecayAllAffinities` skoru `*0.98` ile çarpar ama **sıfıra yaklaşan üyeleri asla silmez** ve key'lere **TTL yok**. Terk edilmiş kullanıcılar ve tek-seferlik ilgiler kalıcı kalır → Redis belleği kullanıcı×kategori×satıcı ile sınırsız büyür. Decay döngüsü de her saat tüm üyeleri yeniden yazdığı için maliyeti artar.
- **Düzeltme (uygulandı):** (a) `IncrAffinity` sonrası key'lere kayan `EXPIRE` (90 gün) — aktif kullanıcı yenilenir, terk edilen düşer. (b) `DecayAllAffinities` içinde skoru eşik (`< 0.1`) altına inen üyeler `ZREM` ile budanır. Davranış değişikliği minimal (zaten ~0 skorlu, öneriye girmeyen üyeler).
- **Regression testi:** `redis_test.go` (miniredis) — decay sonrası eşik-altı üye silinir; IncrAffinity sonrası TTL set edilir.
- **Durum:** Fixed (yerelde derlenemedi).

## CLAUDE-010 — İkiz uygulama ağacı (`app/`) deploy drift'i
- **Severity:** Medium · **Confidence:** High · **Kategori:** Operasyonel / konfigürasyon
- **Dosya:** repo kökü `app/` (487 dosya) vs top-level `apps/`+`services/`+`infra/`
- **Sömürü/arıza ön koşulu:** Geliştiricinin yanlış ağaçta değişiklik yapması.
- **Etki:** `app/infra/postgres/migrations` **0032**'ye kadar migration içerir, deploy edilen top-level `infra` yalnızca **0019**'a kadar. İki ağaçta `apps/api` dosya sayıları farklı (166 vs 182). Deploy top-level'i paketler; `app/` deploy edilmez ama tar'a girer. Hangi migration/kod setinin "gerçek" olduğu belirsiz — yanlış ağaçta geliştirme sessizce prod'a yansımaz, doğru ağaçta yapılan da `app/` sananları yanıltır. Şema drift'i veri bütünlüğü riski.
- **Kök neden:** Muhtemelen sunucu home dizininden repo oluşturulurken hem `/opt/gulumsalim/app` hem çalışma kopyası birlikte commit edilmiş.
- **Düzeltme:** Kanonik ağaç netleştirilmeli; `app/` ya silinmeli ya da hangisinin doğru migration seti olduğu belirlenip birleştirilmeli. **Karar gerektirir** — otomatik silmedim. Checklist'te blocker.
- **Durum:** Open (checklist).

## CLAUDE-011 — Non-deterministic ranking (unstable sort, tie-breaker yok)
- **Severity:** Medium · **Confidence:** High · **Kategori:** CWE-697 (Incorrect Comparison) / tutarlılık
- **Dosya:** `services/discovery/internal/scoring/score.go:111`
- **Sömürü/arıza ön koşulu:** Eşit skorlu ürünler (cold-start'ta yaygın; aynı `created_at` konumu).
- **Etki:** `sort.Slice` **stable değildir**; eşit skorlu ürünlerde sıra çağrıdan çağrıya değişir. Aynı kullanıcı her yenilemede farklı sıra görür; SSR/ISR cache ve sayfalama tutarsızlaşır (aynı ürün iki sayfada / hiç görünmez).
- **Düzeltme (uygulandı):** `sort.SliceStable` + ikincil tie-breaker `ProductID DESC`. Deterministik ve tekrarlanabilir.
- **Regression testi:** `score_test.go` — eşit skorlu girdi iki kez sıralanır, çıktı aynı olmalı (table-driven).
- **Durum:** Fixed (yerelde derlenemedi).

## CLAUDE-012 — systemd hardening eksik + restart storm koruması yok
- **Severity:** Medium · **Confidence:** High · **Kategori:** CWE-250 (Execution with Unnecessary Privileges) / dayanıklılık
- **Dosya:** `infra/systemd/gulumsalim-*.service`, `meilisearch.service`
- **Etki:** Mevcut: `NoNewPrivileges`, `PrivateTmp`, `ProtectSystem=strict` var (iyi). Eksik: `ProtectHome`, `RestrictAddressFamilies`, `CapabilityBoundingSet`, `PrivateDevices`, `RestrictNamespaces`, `LockPersonality`, `MemoryDenyWriteExecute`, `SystemCallFilter`. `Restart=on-failure`/`RestartSec=3` var ama `StartLimitIntervalSec/Burst` yok → sürekli çöken servis **restart storm**'a girer. `TimeoutStopSec` yok → graceful shutdown (discovery 5s) ile uyumsuz olabilir.
- **Düzeltme (uygulandı):** Her unit'e `ProtectHome=true`, `PrivateDevices=true`, `RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX`, `RestrictNamespaces=true`, `LockPersonality=true`, `CapabilityBoundingSet=` (boş, tüm cap'ler düşürülür), `SystemCallFilter=@system-service`, `SystemCallErrorNumber=EPERM`, `[Unit] StartLimitIntervalSec=60`/`StartLimitBurst=5`, `[Service] TimeoutStopSec=10` eklendi. `MemoryDenyWriteExecute` **eklenMEDİ** (Node/V8 JIT ve Go bunu bozabilir). discovery için `ReadWritePaths` gerekmiyor (yalnızca ağ); api `/opt/gulumsalim/uploads` korunuyor.
- **Regression testi:** `systemd-analyze security gulumsalim-discovery.service` skoru düşmeli; servis başlamalı (`journalctl -u` EPERM olmamalı).
- **Durum:** Fixed (sunucuda `systemd-analyze` ile doğrulanmalı — checklist).

## CLAUDE-013 — nginx X-Forwarded-For spoof edilebilir
- **Severity:** Medium · **Confidence:** Medium · **Kategori:** CWE-348 (Reliance on Untrusted Inputs)
- **Dosya:** `infra/nginx/gulumsalim.conf:22,33` (`$proxy_add_x_forwarded_for`)
- **Sömürü ön koşulu:** apps/api rate-limit / audit-log / fraud kontrolünde XFF zincirinin **ilk** IP'sine güveniyorsa.
- **Etki:** `$proxy_add_x_forwarded_for` istemcinin gönderdiği XFF'e gerçek peer IP'sini **ekler**; istemcinin uydurduğu değerler zincirde kalır. Backend XFF'i yanlış parse ederse rate-limit bypass / log zehirleme / IP allowlist atlatma. `X-Real-IP=$remote_addr` doğru (gerçek peer).
- **Düzeltme:** Edge'de güvenilir tek IP için `proxy_set_header X-Forwarded-For $remote_addr;` (zinciri sıfırla) önerisi; asıl karar backend'in nasıl parse ettiğine bağlı → **handoff GPT-5.6** (Fastify `trustProxy` ayarı).
- **Durum:** Handoff.

## CLAUDE-014 — Paylaşımlı secret karşılaştırması sabit-zamanlı değil
- **Severity:** Low · **Confidence:** High · **Kategori:** CWE-208 (Observable Timing Discrepancy)
- **Dosya:** `services/discovery/internal/api/router.go:26`
- **Sömürü ön koşulu:** Yerel ağdan secret'ı byte-byte timing ile tahmin (localhost olduğu için pratikte çok düşük).
- **Etki:** `!=` string karşılaştırması erken çıkışlıdır; teorik timing side-channel. Düşük ama ucuz düzeltme.
- **Düzeltme (uygulandı):** `crypto/subtle.ConstantTimeCompare` ile sabit-zamanlı kıyas.
- **Regression testi:** `router_test.go` — yanlış/eksik/doğru secret senaryoları (401 vs 200).
- **Durum:** Fixed (yerelde derlenemedi).

## CLAUDE-015 — Goroutine'lerde panic recovery yok (proses çökmesi)
- **Severity:** Low · **Confidence:** High · **Kategori:** CWE-248 (Uncaught Exception)
- **Dosya:** `services/discovery/cmd/server/main.go:46-47`, `internal/ingest/consumer.go`, `decay.go`
- **Sömürü/arıza ön koşulu:** consumer/decay goroutine'inde beklenmedik panic (nil deref, tip cast).
- **Etki:** `net/http` istek-başına panic'i kurtarır ama **consumer ve decay goroutine'lerinde panic tüm prosesi çökertir** — HTTP sunucu + iki döngü birlikte ölür. systemd restart eder ama zehirli döngü tekrarlarsa (CLAUDE-012 storm koruması olmadan) hizmet kesintisi.
- **Düzeltme (uygulandı):** consumer.Run ve RunDecayLoop döngü gövdelerine `defer recover()` + log; panic tek iterasyonu düşürür, döngü devam eder.
- **Regression testi:** panic enjekte eden sahte store ile döngünün hayatta kaldığı test.
- **Durum:** Fixed (yerelde derlenemedi).

## CLAUDE-016 — Decay lost-update race (ZRange + ZAdd, eşzamanlı ZIncrBy'ı ezer)
- **Severity:** Low · **Confidence:** Medium · **Kategori:** CWE-362 (Race Condition)
- **Dosya:** `services/discovery/internal/store/redis.go:56-74`
- **Etki:** `DecayAllAffinities` bir key'in üyelerini `ZRangeWithScores` ile okur, `ZAdd` ile skoru `*factor` yazar. Okuma-yazma arası eşzamanlı bir `IncrAffinity` (`ZIncrBy`) gelirse decay onu ezer (lost update). Saatte bir, dar pencere → düşük etki, sadece küçük öneri kayması.
- **Düzeltme:** `ZADD GT/XX` veya Lua script ile atomik decay (okuma-değiştir-yaz sunucuda). Şimdilik **dokümante edildi**; CLAUDE-009 budama değişikliğiyle birlikte Lua'ya taşınması önerildi (düşük öncelik, ayrı commit).
- **Durum:** Documented.

## CLAUDE-017 — Discovery `/discover` kullanıcı-bazlı yetki kontrolü yok (defense-in-depth)
- **Severity:** Low · **Confidence:** High · **Kategori:** CWE-639 (Authorization Bypass) — savunma katmanı
- **Dosya:** `services/discovery/internal/api/handlers/discover.go:30`
- **Sömürü ön koşulu:** Saldırgan localhost'a erişir VE shared secret'ı ele geçirirse `?userId=<herhangi>` ile herhangi bir kullanıcının kişiselleştirilmiş ürün-ID listesini alır.
- **Etki:** Yalnızca ürün ID'leri döner (ürün detayı/PII yok) → düşük hassasiyet. Tek çağıran (`discovery.client.ts`) `userId`'yi server-side session'dan geçirir, dış istismar pratikte yok. Trust boundary tamamen "Node güvenilir + secret gizli + localhost" varsayımına dayanıyor.
- **Düzeltme:** Servis dizaynı gereği kabul edilebilir. Belgeye eklendi; secret rotasyonu + Redis/discovery'nin dışa kapalı kaldığının periyodik doğrulaması önerildi.
- **Durum:** Documented (kabul edilen risk).

## CLAUDE-018 — Eksik foreign key: `customer_id` / `order_item_id`
- **Severity:** Low · **Confidence:** High · **Kategori:** CWE-1077 / veri bütünlüğü
- **Dosya:** `0000_known_tigra.sql` — `product_favorites.customer_id`, `product_questions.customer_id`, `product_reviews.customer_id` ve `product_reviews.order_item_id` FK yok
- **Etki:** Silinmiş/olmayan müşteriye referans veren orphan satırlar oluşabilir; review'lar order_item'a bağlanmadığı için "doğrulanmış satın alma" garantisi DB'de yok.
- **Düzeltme:** Yeni migration ile eksik FK'ler (önce orphan temizliği). Checklist'te taslak.
- **Durum:** Open (checklist).

## CLAUDE-019 — Müşteri silme/anonimleştirme stratejisi yok (GDPR/KVKK)
- **Severity:** Low · **Confidence:** Medium · **Kategori:** Veri yönetişimi
- **Dosya:** `0000_known_tigra.sql` — tüm FK'ler `ON DELETE no action`
- **Etki:** Siparişi olan müşteri **silinemez** (FK engeli) ve anonimleştirme akışı yok. KVKK/GDPR "unutulma hakkı" talebinde teknik yol yok; `customers.email/full_name/phone` ve `orders.shipping_address` (jsonb PII) kalıcı.
- **Düzeltme:** Anonimleştirme prosedürü (PII alanlarını tombstone'a çevir, `is_deleted`/anonim e-posta), silme yerine. → veri yönetişimi kararı, checklist.
- **Durum:** Open (checklist).

## CLAUDE-020 — Finansal PII (IBAN, banka bilgisi) düz metin
- **Severity:** Low · **Confidence:** Medium · **Kategori:** CWE-311 (Missing Encryption of Sensitive Data)
- **Dosya:** `0000_known_tigra.sql:12,33-34` (`vendor_payouts.iban`, `vendors.bank_iban/bank_account_holder`)
- **Etki:** DB dump / yedek sızarsa satıcı banka/IBAN bilgisi düz metin ifşa olur.
- **Düzeltme:** Uygulama seviyesi zarf şifreleme (pgcrypto veya app-side AES-GCM) veya en azından erişimi kısıtlı ayrı tablo + audit. Yedek şifrelemesi (checklist).
- **Durum:** Open (checklist).

## CLAUDE-021 — Repo hijyeni: `go/pkg/mod`, `.config/`, home dotfile'ları commit'li
- **Severity:** Low · **Confidence:** High · **Kategori:** Bilgi ifşası / supply-chain yüzeyi
- **Dosya:** `go/` (1394 dosya, Go module cache), `.config/` (Meilisearch/go telemetry/nextjs), `.bashrc`, `.bash_profile`, `.bash_logout`, `.cloud-locale-test.skip`
- **Etki:** Repo bir sunucu home dizininden oluşturulmuş. **Gerçek uygulama secret'ı taranmadı/bulunmadı** (Meilisearch master key yok, dotfile'larda export edilmiş secret yok — teyit edildi). Ancak: (a) module cache commit'li = supply-chain kurcalama yüzeyi + ~MB'larca bloat; (b) `.config`/dotfile'lar sunucu yollarını/ortamını ifşa eder; (c) her deploy bunları prod'a taşır (CLAUDE-002).
- **Düzeltme:** `git rm -r --cached go .config .bashrc .bash_profile .bash_logout .cloud-locale-test.skip app` + `.gitignore` güncelle. **Büyük diff** olduğundan otomatik yapılmadı; komutlar checklist'te.
- **Durum:** Open (checklist).

## CLAUDE-023 — Health endpoint readiness (DB/Redis) kontrolü yok
- **Severity:** Low · **Confidence:** High · **Kategori:** Operasyonel
- **Dosya:** `services/discovery/internal/api/handlers/health.go:11-14`
- **Etki:** `/healthz` bağımlılıklardan bağımsız her zaman `ok` döner. Postgres/Redis kopukken de "sağlıklı" görünür; deploy/systemd yanlış olumlu alır, kırık servise trafik gider.
- **Düzeltme (uygulandı):** `/healthz` liveness olarak korundu (her zaman ok — systemd restart döngüsü tetiklememek için); ayrı `/readyz` eklendi: Postgres `Ping` + Redis `Ping`, biri düşerse 503. Yorumdaki "Faz 0'da eklenecek" TODO'su karşılandı.
- **Regression testi:** DB kapalıyken `/readyz` → 503, `/healthz` → 200.
- **Durum:** Fixed (yerelde derlenemedi).

---

## Pozitif bulgular (doğrulanan iyi uygulamalar)
- Discovery Postgres sorguları **tamamen parametreli** (pgx `$1/$2`, `= ANY($1)`) — SQL injection yok.
- Discovery `127.0.0.1`'e bağlı; nginx 8081'i dışa açmıyor — internal-only doğrulandı.
- `config.Load` `DISCOVERY_SERVICE_SECRET` boşsa başlamıyor — boş-secret bypass yok.
- Event **trust boundary güvenli:** `emitBehavioralEvent` çağıranları `customerId`'yi daima `request.session.customerId` / `order.customerId`'den (server-side) alır — client başka kullanıcı adına event forge edemez.
- Redis event stream `MAXLEN ~ 500000` ile sınırlı — sınırsız değil.
- Redis decay `SCAN` kullanıyor (`KEYS` değil) — Redis'i bloklamıyor.
- Para alanları `numeric(10,2)/(12,2)` — float değil, doğru.
- `seed-admin.ts`: public kayıt yok, env-zorunlu, min 12 karakter, bcrypt cost 12.
- Migration'larda `ADD COLUMN ... NOT NULL` eklemeleri hep `DEFAULT`'lu (kilitsiz), soft-delete/unique çakışması yok, veri-migration'ı yok.
- `.env` git'te değil (yalnızca `.env.example`, placeholder değerler).
