CREATE TYPE "public"."order_refund_status" AS ENUM('pending', 'approved', 'rejected', 'item_received', 'refunded');--> statement-breakpoint
ALTER TABLE "order_refunds" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "order_refunds" ALTER COLUMN "status" SET DATA TYPE order_refund_status USING "status"::text::order_refund_status;--> statement-breakpoint
ALTER TABLE "order_refunds" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "tracking_carrier" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "tracking_number" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "shipped_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "order_refunds" ADD COLUMN "photos" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "order_refunds" ADD COLUMN "vendor_note" text;--> statement-breakpoint
ALTER TABLE "order_refunds" ADD COLUMN "return_tracking_carrier" text;--> statement-breakpoint
ALTER TABLE "order_refunds" ADD COLUMN "return_tracking_number" text;--> statement-breakpoint
ALTER TABLE "order_refunds" ADD COLUMN "return_shipped_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "order_refunds" ADD COLUMN "received_by_vendor_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "order_refunds" ADD COLUMN "refunded_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_transaction_id" text;