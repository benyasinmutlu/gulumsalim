ALTER TABLE "products" ADD COLUMN "fingerprint" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_products_fingerprint" ON "products" USING btree ("vendor_id","fingerprint");