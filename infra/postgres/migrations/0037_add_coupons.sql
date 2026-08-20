CREATE TYPE "public"."coupon_type" AS ENUM('percent', 'fixed');--> statement-breakpoint
ALTER TYPE "public"."section_algo" ADD VALUE 'flash_sale';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coupon_redemptions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "coupon_redemptions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"coupon_id" bigint NOT NULL,
	"customer_id" bigint NOT NULL,
	"order_id" bigint,
	"redeemed_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coupons" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "coupons_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"type" "coupon_type" NOT NULL,
	"value" numeric(10, 2) NOT NULL,
	"min_order_amount" numeric(10, 2),
	"max_uses_total" integer,
	"max_uses_per_customer" integer DEFAULT 1 NOT NULL,
	"used_count" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp (3) with time zone,
	"ends_at" timestamp (3) with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "coupon_id" bigint;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_coupon_redemptions_coupon_customer" ON "coupon_redemptions" USING btree ("coupon_id","customer_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orders" ADD CONSTRAINT "orders_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
