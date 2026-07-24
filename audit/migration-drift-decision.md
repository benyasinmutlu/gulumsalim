# Migration Drift — Karar Matrisi (CLAUDE-010)

**Tarih:** 2026-07-24 · **Durum:** KARAR BEKLİYOR (sahibi + staging doğrulaması). **Hiçbir dosya silinmedi.**

## Kanıt
Repo iki paralel uygulama+migration ağacı içeriyor:

| | Deploy edilen (Pair A) | İleri sürüm (Pair B) |
|---|---|---|
| Kod | top-level `apps/api` (166 dosya) | `app/apps/api` (182 dosya) |
| Migration | `infra/postgres/migrations` (**20**, 0000-0019) | `app/infra/postgres/migrations` (**33**, 0000-0032) |
| Deploy tarafından kullanılan | ✅ deploy.sh + systemd + `drizzle.config out: ../../infra/postgres/migrations` | ❌ tar'a giriyor ama systemd/deploy referans vermiyor |

**Doğrulanan gerçekler:**
- `0000`–`0019` iki ağaçta **byte-birebir aynı** (20/20 identical, 0 farklı).
- `app/` ağacındaki ekstra `0020`–`0032` **tamamen additive**: yeni tablolar (`homepage_section_banners`, `promo_banner_images`, `promo_banner_clicks`, `site_feedback`), yeni kolonlar (categories, collections, products, promo_banners, vendors), yeni type'lar (`order_refund_status`, `vendor_type`, complaint-status). Mevcut tabloyu DROP/rename eden yıkıcı işlem görülmedi.
- Yani **Pair B, Pair A'nın katı üst-kümesi** (şema geriye-uyumlu ilerlemiş).

## Risk analizi
- **Veri kaybı riski:** Düşük — ekstra migration'lar additive (DROP yok). Ama `0025 products ADD COLUMN`, `0030 vendors ADD COLUMN` gibi eklemelerin `NOT NULL`/DEFAULT davranışı tek tek doğrulanmalı (büyük tablo kilidi).
- **Sıra çakışması:** Yok — numaralandırma sürekli (0020→0032), `_journal.json` sıralı.
- **Kod-şema uyumu (KRİTİK):** Pair B kodu (`app/apps/api`) 0020-0032 kolonlarına/tablolarına REFERANS veriyor. Eğer prod DB yalnızca 0019'a kadar migrate edildiyse ama Pair B kodu deploy edilirse → **çalışma-zamanı hatası** (eksik kolon). Tersi (Pair A kodu + Pair B şeması) additive olduğu için genelde güvenli.

## Bilinmeyen (yalnız sahip/sunucu bilir)
- **Prod DB fiilen hangi migration'a kadar uygulandı?** (`SELECT * FROM drizzle.__drizzle_migrations ORDER BY id;` ile teyit.)
- Takım aktif olarak hangi ağaçta geliştiriyor? (`app/` ileri olduğundan muhtemelen orası.)

## Karar matrisi
| Seçenek | Ne yapılır | Artı | Eksi | Ne zaman |
|---|---|---|---|---|
| **A. Pair B'yi kanonik yap** (ÖNERİLEN) | top-level `apps/`+`infra/`'yı `app/` içeriğiyle güncelle; `app/`'i sil; deploy.sh/systemd zaten top-level'e bakıyor | Tek kaynak, en güncel özellikler (13 migration + kod) | Büyük diff; prod DB 0020-0032 migrate edilmeli; staging doğrulaması şart | Takım `app/`'te geliştiriyorsa |
| **B. Pair A'yı kanonik yap** | `app/`'i sil; top-level'de kal (0019) | Küçük, deploy edileni korur | 13 migration + özellik **kaybı** (promo analytics, feedback, refund, vendor types) | `app/` terk edilmiş bir deneme ise |
| **C. Şimdilik dondur** | Karar verilene kadar dokunma; `app/`'i açıkça "DEPLOY EDİLMEZ" işaretle (README/`.deployignore`) | Sıfır risk | Drift + kafa karışıklığı sürer | Kanıt yetersizse |

## Öneri
1. Önce **`SELECT tag FROM drizzle.__drizzle_migrations`** ile prod DB'nin gerçek durumunu tespit et (detection-first).
2. `app/` aktif geliştirme ağacıysa → **Seçenek A**: staging'de 0020-0032'yi uygula, Pair B kodunu doğrula, sonra top-level'i güncelle ve `app/`'i tek commit'te kaldır (`git rm`, geçmiş korunur).
3. Yeterli kanıt yoksa → **Seçenek C**: `app/`'i `.gitignore`/README ile "deploy edilmez" işaretle, bu dosyayı blocker olarak açık bırak.

> Bu turda otomatik silme YAPILMADI (talimat: yeterli kanıt yoksa silme). Karar, prod DB migration durumu netleşince verilmeli.
