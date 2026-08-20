-- Eski ödeme callback kodu payment_status='failed' yapıp stok/kuponu geri
-- veriyordu fakat sipariş ve satıcı kalemi durumlarını pending bırakıyordu.
-- Stok veya kupona burada KESİNLİKLE dokunma: canlıda o telafi zaten yapıldı.
UPDATE "order_items" AS oi
SET "vendor_status" = 'cancelled'
FROM "orders" AS o
WHERE oi."order_id" = o."id"
  AND o."payment_status" = 'failed'
  AND o."status" = 'pending'
  AND oi."vendor_status" <> 'cancelled';
--> statement-breakpoint
UPDATE "orders"
SET "status" = 'cancelled'
WHERE "payment_status" = 'failed'
  AND "status" = 'pending';
