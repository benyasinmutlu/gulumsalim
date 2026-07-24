# Infra Release Checklist — Production Öncesi

Claude Opus (infra/Go reviewer). `review/claude-opus` branch'i. Kanonik ağaç: top-level.

## 0. Ortam kısıtı (bu makinede doğrulanamayanlar)
- [ ] **Go toolchain yok** → discovery için aşağıdaki komutlar SUNUCUDA veya Go'lu makinede koşulmalı:
  ```bash
  cd services/discovery
  go build ./...          # CLAUDE-003/004/009/011/014/015/023 kodlarını derle
  go vet ./...
  go test ./...           # score_test.go, events_test.go
  go test -race ./...      # concurrency (consumer XAck, decay) regresyonu
  gofmt -l .              # boş çıktı bekle
  ```
  > Go değişikliklerim yerelde DERLENMEDİ. Production build (`go build ./cmd/server`) test dosyalarını derlemez, bu yüzden test dosyaları deploy'u bozmaz; ama ana dosya değişiklikleri sunucuda `go build` ile doğrulanmalı.

## 1. Production BLOCKER'lar (deploy öncesi çözülmeli)
- [ ] **CLAUDE-001 — TLS:** `certbot` + `listen 443 ssl http2;` + `:80→:443` redirect + HSTS. gulumsalim.com DNS'i çevrilmeden ÖNCE. TLS gelince: nginx'e `add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;` ve session çerezi `secure:true` (H-06).
- [ ] **CLAUDE-010 — İkiz ağaç:** `app/` mı top-level mı kanonik? Migration seti 0019 (deploy edilen) vs 0032 (`app/`). KARAR VER, birleştir, birini sil. Yanlış migration seti = veri bütünlüğü riski.
- [ ] **Checkout güvenliği (yeni görev):** `apps/api` order/checkout — bkz. ayrı rapor. Ödeme kodu tamamlanmadan production yok.

## 2. Uygulanan düzeltmeler — sunucuda doğrula
- [ ] **systemd (CLAUDE-012):** Yeni unit'leri kopyala → `systemctl daemon-reload` → `systemctl restart gulumsalim-*` →
  ```bash
  systemd-analyze security gulumsalim-discovery.service   # skor düşmeli
  journalctl -u gulumsalim-web -n 50                       # EPERM / ISR yazma hatası OLMAMALI
  journalctl -u meilisearch -n 50                          # DB yazma hatası OLMAMALI
  ```
  > `SystemCallFilter=@system-service` Node/Meilisearch'ü kırarsa journalctl'de görünür → ilgili syscall grubunu ekle veya filtreyi gevşet. `ReadWritePaths` web `.next` ve meili DB için eklendi.
- [ ] **nginx (CLAUDE-006/007/008):** `nginx -t` → reload →
  ```bash
  curl -I http://ylina.life/                       # güvenlik header'ları görünmeli
  curl -I -H 'Host: evil.com' http://<ip>/         # 444 dönmeli
  curl -I http://ylina.life/uploads/x.svg          # CSP: default-src 'none'; sandbox
  ```
- [ ] **deploy.sh (CLAUDE-002):** `shellcheck infra/scripts/deploy.sh`. `--frozen-lockfile` fail ederse lockfile senkron değil → `pnpm install` ile yeniden üret + commit (bypass etme).

## 3. Önerilen (bu incelemede taslak, karar/uygulama sizin)
- [ ] **CLAUDE-005 — Para CHECK constraint'leri.** Mevcut kurulu DB'de kilitsiz uygula (H-01 ile koordineli):
  ```sql
  -- 00NN_money_checks.sql (taslak)
  ALTER TABLE order_items    ADD CONSTRAINT chk_oi_qty   CHECK (quantity > 0)      NOT VALID;
  ALTER TABLE order_items    ADD CONSTRAINT chk_oi_price CHECK (unit_price >= 0)   NOT VALID;
  ALTER TABLE order_items    ADD CONSTRAINT chk_oi_total CHECK (total >= 0)        NOT VALID;
  ALTER TABLE orders         ADD CONSTRAINT chk_o_sub    CHECK (subtotal >= 0)     NOT VALID;
  ALTER TABLE orders         ADD CONSTRAINT chk_o_ship   CHECK (shipping_fee >= 0) NOT VALID;
  ALTER TABLE orders         ADD CONSTRAINT chk_o_total  CHECK (total >= 0)        NOT VALID;
  ALTER TABLE vendor_payouts ADD CONSTRAINT chk_vp_amt   CHECK (amount >= 0)       NOT VALID;
  ALTER TABLE vendor_earnings ADD CONSTRAINT chk_ve_net  CHECK (net_amount >= 0)   NOT VALID;
  ALTER TABLE product_reviews ADD CONSTRAINT chk_pr_rate CHECK (rating BETWEEN 1 AND 5) NOT VALID;
  ALTER TABLE vendors        ADD CONSTRAINT chk_v_comm   CHECK (commission_rate IS NULL OR commission_rate BETWEEN 0 AND 100) NOT VALID;
  -- sonra düşük trafikte: ALTER TABLE ... VALIDATE CONSTRAINT ...;
  ```
  > İade/kredi negatif tutar kullanıyorsa (H-01) eşiği ona göre ayarla.
- [ ] **CLAUDE-018 — Eksik FK'ler:** `product_favorites.customer_id`, `product_questions.customer_id`, `product_reviews.customer_id`/`order_item_id` → önce orphan temizliği, sonra FK.
- [ ] **CLAUDE-021 — Repo hijyeni:**
  ```bash
  git rm -r --cached go .config app .bashrc .bash_profile .bash_logout .cloud-locale-test.skip
  # .gitignore'a ekle: /go/  /.config/  /app/  .bash*  .cloud-locale-test.skip
  ```
  > `app/` silmeden önce CLAUDE-010 kararı verilmeli (hangisi kanonik).
- [ ] **CLAUDE-003 follow-up:** Pending entry birikimi için consumer'a `XAutoClaim` (idle > N dk pending'i yeniden işle) ekle.
- [ ] **CLAUDE-016:** Decay'i Lua script ile atomikleştir (lost-update yarışını kapat).
- [ ] **CLAUDE-019/020:** Müşteri anonimleştirme prosedürü (KVKK) + IBAN/banka PII şifreleme + yedek şifreleme.
- [ ] **Atomik release (CLAUDE-002):** `deploy.sh`'i release-dizini + `current` symlink swap + rollback komutu ile yükselt.
- [ ] **Secret perms:** Sunucuda `.env`/EnvironmentFile'lar `chmod 600`, `chown gulumsalim:gulumsalim`. `DISCOVERY_SERVICE_SECRET` ve `SESSION_SECRET` güçlü/rasgele mi teyit.

## 4. Infra rollback planı
- **systemd:** Eski unit dosyaları git'te (`git show HEAD~1:infra/systemd/...`). Sorun → eski dosyayı geri koy, `daemon-reload`, `restart`.
- **nginx:** `nginx -t` fail ederse reload yapılmaz (canlı config korunur). Reload sonrası sorun → önceki conf'u geri koy, `nginx -s reload`.
- **discovery binary:** Yeni binary çökerse → `git revert` + yeniden `go build`; systemd `Restart=on-failure` + StartLimit ile storm'a girmez.
- **migration:** İleri-yönlü; down script yok. Risk → deploy öncesi `pg_dump` yedeği (bkz. §5).

## 5. Veri/migration riskleri
- Migration'lar ileri-yönlü, rollback script'i YOK → her migration öncesi `pg_dump` şart.
- CHECK constraint eklerken `NOT VALID` + ayrı `VALIDATE` ile büyük tablo kilidinden kaçın.
- İkiz migration ağacı (CLAUDE-010) çözülene kadar `db:migrate` HANGİ klasörü kullanıyor teyit et (`drizzle.config.ts out: ../../infra/postgres/migrations` = top-level 0019).

## 6. Çalıştırılan / çalıştırılamayan testler
- ✅ Statik inceleme: tüm discovery Go, migration SQL, nginx, systemd, deploy.sh, .env.example, seed.
- ✅ `git ls-files` ile repo hijyen/secret taraması (gerçek secret bulunmadı).
- ❌ `go build/test/vet/-race` — Go toolchain yok (bu makinede).
- ❌ nginx/systemd canlı doğrulama — sunucu erişimi yok (destructive test yapılmadı, talimat gereği).
- ⚠️ Go kod düzeltmeleri statik olarak doğru ama DERLENMEDİ — §0 komutları zorunlu.
