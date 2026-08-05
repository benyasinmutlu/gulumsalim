CREATE TYPE "public"."channel_sync_status" AS ENUM('pending', 'synced', 'error');--> statement-breakpoint
CREATE TYPE "public"."outbox_status" AS ENUM('pending', 'processing', 'done', 'error');--> statement-breakpoint
CREATE TYPE "public"."sales_channel" AS ENUM('trendyol', 'ikas');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "channel_listings" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "channel_listings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"channel" "sales_channel" NOT NULL,
	"product_id" bigint NOT NULL,
	"variant_id" bigint,
	"external_barcode" text NOT NULL,
	"external_product_id" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_synced_stock" integer,
	"last_synced_at" timestamp (3) with time zone,
	"sync_status" "channel_sync_status" DEFAULT 'pending' NOT NULL,
	"sync_error" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_channel_listing_pv" UNIQUE("channel","product_id","variant_id"),
	CONSTRAINT "uq_channel_listing_barcode" UNIQUE("channel","external_barcode")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_sync_outbox" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stock_sync_outbox_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"listing_id" bigint NOT NULL,
	"target_stock" integer NOT NULL,
	"status" "outbox_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp (3) with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "channel_listings" ADD CONSTRAINT "channel_listings_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "channel_listings" ADD CONSTRAINT "channel_listings_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_sync_outbox" ADD CONSTRAINT "stock_sync_outbox_listing_id_channel_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."channel_listings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_channel_listings_product" ON "channel_listings" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_outbox_due" ON "stock_sync_outbox" USING btree ("status","next_attempt_at") WHERE "stock_sync_outbox"."status" = 'pending';