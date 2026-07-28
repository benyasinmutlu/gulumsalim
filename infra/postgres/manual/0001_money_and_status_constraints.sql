-- =============================================================================
-- MANUAL MIGRATION 0001 — Money & quantity CHECK constraints (CLAUDE-005)
-- =============================================================================
-- Bu dosya BİLİNÇLİ olarak drizzle migrations klasörünün DIŞINDA. Drizzle
-- migrator yalnızca meta/_journal.json'daki migration'ları çalıştırır; buraya
-- ham SQL eklemek journal state'ini bozardı. Bu constraint'leri drizzle'a
-- kalıcı almak için ya drizzle-kit ile şemaya CHECK ekleyip generate et, ya da
-- bu SQL'i elle uygulayıp journal'a manuel snapshot ekle.
--
-- STRATEJİ: detection-first → NOT VALID (kilitsiz ekle) → düşük trafikte VALIDATE.
-- Amaç: uygulama guard'ı bypass edilse bile negatif payout/tutar, sıfır/negatif
-- quantity gibi durumları DB'de reddetmek (defense-in-depth).

-- -----------------------------------------------------------------------------
-- ADIM 1 — DETECTION (önce çalıştır; satır dönerse ÖNCE veriyi düzelt, constraint EKLEME)
-- -----------------------------------------------------------------------------
-- \echo 'Bozuk veri taraması:'
-- SELECT 'order_items.quantity<=0'  AS check, count(*) FROM order_items      WHERE quantity <= 0
-- UNION ALL SELECT 'order_items.unit_price<0',  count(*) FROM order_items    WHERE unit_price < 0
-- UNION ALL SELECT 'order_items.total<0',       count(*) FROM order_items    WHERE total < 0
-- UNION ALL SELECT 'orders.subtotal<0',         count(*) FROM orders         WHERE subtotal < 0
-- UNION ALL SELECT 'orders.shipping_fee<0',     count(*) FROM orders         WHERE shipping_fee < 0
-- UNION ALL SELECT 'orders.total<0',            count(*) FROM orders         WHERE total < 0
-- UNION ALL SELECT 'vendor_payouts.amount<0',   count(*) FROM vendor_payouts WHERE amount < 0
-- UNION ALL SELECT 'vendor_earnings.net<0',     count(*) FROM vendor_earnings WHERE net_amount < 0
-- UNION ALL SELECT 'product_reviews.rating',    count(*) FROM product_reviews WHERE rating < 1 OR rating > 5
-- UNION ALL SELECT 'vendors.commission_rate',   count(*) FROM vendors        WHERE commission_rate IS NOT NULL AND (commission_rate < 0 OR commission_rate > 100);

-- -----------------------------------------------------------------------------
-- ADIM 2 — CONSTRAINT EKLE (NOT VALID: mevcut satırları taramaz, tabloyu kilitlemez)
-- -----------------------------------------------------------------------------
BEGIN;
ALTER TABLE order_items     ADD CONSTRAINT chk_oi_qty_pos    CHECK (quantity > 0)        NOT VALID;
ALTER TABLE order_items     ADD CONSTRAINT chk_oi_unit_nonneg CHECK (unit_price >= 0)    NOT VALID;
ALTER TABLE order_items     ADD CONSTRAINT chk_oi_total_nonneg CHECK (total >= 0)        NOT VALID;
ALTER TABLE orders          ADD CONSTRAINT chk_o_subtotal_nonneg CHECK (subtotal >= 0)   NOT VALID;
ALTER TABLE orders          ADD CONSTRAINT chk_o_ship_nonneg  CHECK (shipping_fee >= 0)  NOT VALID;
ALTER TABLE orders          ADD CONSTRAINT chk_o_total_nonneg CHECK (total >= 0)         NOT VALID;
ALTER TABLE vendor_payouts  ADD CONSTRAINT chk_vp_amount_nonneg CHECK (amount >= 0)      NOT VALID;
ALTER TABLE vendor_earnings ADD CONSTRAINT chk_ve_gross_nonneg CHECK (gross_amount >= 0) NOT VALID;
ALTER TABLE vendor_earnings ADD CONSTRAINT chk_ve_comm_nonneg CHECK (commission_amount >= 0) NOT VALID;
ALTER TABLE vendor_earnings ADD CONSTRAINT chk_ve_net_nonneg  CHECK (net_amount >= 0)    NOT VALID;
ALTER TABLE product_reviews ADD CONSTRAINT chk_pr_rating_1_5  CHECK (rating BETWEEN 1 AND 5) NOT VALID;
ALTER TABLE vendors         ADD CONSTRAINT chk_v_commission_0_100
    CHECK (commission_rate IS NULL OR commission_rate BETWEEN 0 AND 100) NOT VALID;
COMMIT;
-- NOT VALID'den itibaren YENİ/GÜNCELLENEN satırlar constraint'e tabidir;
-- mevcut satırlar ADIM 3'e kadar denetlenmez.

-- -----------------------------------------------------------------------------
-- ADIM 3 — VALIDATE (düşük trafikte; SHARE UPDATE EXCLUSIVE, tabloyu tam kilitlemez)
--          ADIM 1 temizse ve iade/kredi mantığı negatif tutar KULLANMIYORSA çalıştır.
-- -----------------------------------------------------------------------------
-- ALTER TABLE order_items     VALIDATE CONSTRAINT chk_oi_qty_pos;
-- ALTER TABLE order_items     VALIDATE CONSTRAINT chk_oi_unit_nonneg;
-- ALTER TABLE order_items     VALIDATE CONSTRAINT chk_oi_total_nonneg;
-- ALTER TABLE orders          VALIDATE CONSTRAINT chk_o_subtotal_nonneg;
-- ALTER TABLE orders          VALIDATE CONSTRAINT chk_o_ship_nonneg;
-- ALTER TABLE orders          VALIDATE CONSTRAINT chk_o_total_nonneg;
-- ALTER TABLE vendor_payouts  VALIDATE CONSTRAINT chk_vp_amount_nonneg;
-- ALTER TABLE vendor_earnings VALIDATE CONSTRAINT chk_ve_gross_nonneg;
-- ALTER TABLE vendor_earnings VALIDATE CONSTRAINT chk_ve_comm_nonneg;
-- ALTER TABLE vendor_earnings VALIDATE CONSTRAINT chk_ve_net_nonneg;
-- ALTER TABLE product_reviews VALIDATE CONSTRAINT chk_pr_rating_1_5;
-- ALTER TABLE vendors         VALIDATE CONSTRAINT chk_v_commission_0_100;

-- -----------------------------------------------------------------------------
-- ROLLBACK (gerekirse) — constraint'ler bağımsız düşürülebilir, veri etkilenmez
-- -----------------------------------------------------------------------------
-- ALTER TABLE order_items     DROP CONSTRAINT IF EXISTS chk_oi_qty_pos;
-- ... (diğerleri aynı şekilde) ...

-- NOT: currency allowlist — şemada currency kolonu yok (tek para birimi TRY,
-- iyzico 'TRY' sabit). Çoklu para birimine geçilirse orders'a `currency` kolonu
-- + CHECK (currency IN ('TRY',...)) eklenmeli. status alanları zaten ENUM
-- (order_status/payment_status/vendor_status) ile state-machine sınırlı.
