ALTER TYPE "public"."order_refund_status" ADD VALUE IF NOT EXISTS 'refunding' BEFORE 'refunded';--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "payment_item_ref" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "payment_transaction_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_order_items_payment_item_ref" ON "order_items" USING btree ("payment_item_ref");
