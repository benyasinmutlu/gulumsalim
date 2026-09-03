ALTER TABLE "vendors" ADD COLUMN "bank_account_changed_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "checkout_idempotency_key" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "checkout_request_hash" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "checkout_form_content" text;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_orders_checkout_idempotency_key" ON "orders" USING btree ("checkout_idempotency_key");