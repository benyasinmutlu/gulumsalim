DO $$ BEGIN
 CREATE TYPE "public"."campaign_scope" AS ENUM('all', 'category', 'vendor', 'product');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."campaign_type" AS ENUM('percent', 'free_shipping');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "campaigns" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "campaigns_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"type" "campaign_type" NOT NULL,
	"scope" "campaign_scope" DEFAULT 'all' NOT NULL,
	"scope_id" bigint,
	"value" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"min_order_amount" numeric(10, 2),
	"starts_at" timestamp (3) with time zone,
	"ends_at" timestamp (3) with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_scope_target_check" CHECK (("campaigns"."scope" = 'all' AND "campaigns"."scope_id" IS NULL) OR ("campaigns"."scope" <> 'all' AND "campaigns"."scope_id" IS NOT NULL)),
	CONSTRAINT "campaign_value_check" CHECK (("campaigns"."type" = 'percent' AND "campaigns"."value" > 0 AND "campaigns"."value" <= 100) OR ("campaigns"."type" = 'free_shipping' AND "campaigns"."value" = 0)),
	CONSTRAINT "campaign_date_check" CHECK ("campaigns"."starts_at" IS NULL OR "campaigns"."ends_at" IS NULL OR "campaigns"."ends_at" > "campaigns"."starts_at"),
	CONSTRAINT "campaign_minimum_check" CHECK ("campaigns"."min_order_amount" IS NULL OR "campaigns"."min_order_amount" > 0)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campaigns" ADD CONSTRAINT "campaign_scope_target_check" CHECK (("scope" = 'all' AND "scope_id" IS NULL) OR ("scope" <> 'all' AND "scope_id" IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campaigns" ADD CONSTRAINT "campaign_value_check" CHECK (("type" = 'percent' AND "value" > 0 AND "value" <= 100) OR ("type" = 'free_shipping' AND "value" = 0));
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campaigns" ADD CONSTRAINT "campaign_date_check" CHECK ("starts_at" IS NULL OR "ends_at" IS NULL OR "ends_at" > "starts_at");
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campaigns" ADD CONSTRAINT "campaign_minimum_check" CHECK ("min_order_amount" IS NULL OR "min_order_amount" > 0);
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "campaign_id" bigint;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_campaigns_active" ON "campaigns" USING btree ("is_active","ends_at");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orders" ADD CONSTRAINT "orders_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
