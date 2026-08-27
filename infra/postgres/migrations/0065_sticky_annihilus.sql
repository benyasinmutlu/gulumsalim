CREATE TABLE IF NOT EXISTS "vendor_feed_items" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vendor_feed_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"source_id" bigint NOT NULL,
	"external_key" text NOT NULL,
	"group_key" text,
	"product_id" bigint NOT NULL,
	"variant_id" bigint,
	"data_hash" text NOT NULL,
	"missing_runs" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_seen_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_vendor_feed_item_key" UNIQUE("source_id","external_key"),
	CONSTRAINT "vendor_feed_item_missing_check" CHECK ("vendor_feed_items"."missing_runs" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_feed_sources" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vendor_feed_sources_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"vendor_id" bigint NOT NULL,
	"name" text NOT NULL,
	"provider" text DEFAULT 'generic' NOT NULL,
	"format" text DEFAULT 'auto' NOT NULL,
	"feed_host" text NOT NULL,
	"encrypted_url" text NOT NULL,
	"status" text DEFAULT 'paused' NOT NULL,
	"interval_minutes" integer DEFAULT 60 NOT NULL,
	"default_category_id" bigint NOT NULL,
	"field_mapping" jsonb NOT NULL,
	"stock_buffer" integer DEFAULT 0 NOT NULL,
	"missing_grace_runs" integer DEFAULT 3 NOT NULL,
	"stale_after_minutes" integer DEFAULT 180 NOT NULL,
	"last_etag" text,
	"last_modified" text,
	"last_content_hash" text,
	"last_attempt_at" timestamp (3) with time zone,
	"last_success_at" timestamp (3) with time zone,
	"next_sync_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"lease_token" text,
	"lease_expires_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_vendor_feed_source_name" UNIQUE("vendor_id","name"),
	CONSTRAINT "vendor_feed_interval_check" CHECK ("vendor_feed_sources"."interval_minutes" >= 15 AND "vendor_feed_sources"."interval_minutes" <= 1440),
	CONSTRAINT "vendor_feed_stock_buffer_check" CHECK ("vendor_feed_sources"."stock_buffer" >= 0 AND "vendor_feed_sources"."stock_buffer" <= 1000000),
	CONSTRAINT "vendor_feed_missing_grace_check" CHECK ("vendor_feed_sources"."missing_grace_runs" >= 1 AND "vendor_feed_sources"."missing_grace_runs" <= 10),
	CONSTRAINT "vendor_feed_stale_check" CHECK ("vendor_feed_sources"."stale_after_minutes" >= "vendor_feed_sources"."interval_minutes" AND "vendor_feed_sources"."stale_after_minutes" <= 10080)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_feed_sync_runs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vendor_feed_sync_runs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"source_id" bigint NOT NULL,
	"status" text NOT NULL,
	"http_status" integer,
	"content_hash" text,
	"item_count" integer DEFAULT 0 NOT NULL,
	"created_count" integer DEFAULT 0 NOT NULL,
	"updated_count" integer DEFAULT 0 NOT NULL,
	"unchanged_count" integer DEFAULT 0 NOT NULL,
	"deactivated_count" integer DEFAULT 0 NOT NULL,
	"error" text,
	"started_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp (3) with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor_feed_items" ADD CONSTRAINT "vendor_feed_items_source_id_vendor_feed_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."vendor_feed_sources"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor_feed_items" ADD CONSTRAINT "vendor_feed_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor_feed_items" ADD CONSTRAINT "vendor_feed_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor_feed_sources" ADD CONSTRAINT "vendor_feed_sources_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor_feed_sources" ADD CONSTRAINT "vendor_feed_sources_default_category_id_categories_id_fk" FOREIGN KEY ("default_category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor_feed_sync_runs" ADD CONSTRAINT "vendor_feed_sync_runs_source_id_vendor_feed_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."vendor_feed_sources"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vendor_feed_items_group" ON "vendor_feed_items" USING btree ("source_id","group_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vendor_feed_items_product" ON "vendor_feed_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vendor_feed_sources_due" ON "vendor_feed_sources" USING btree ("status","next_sync_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vendor_feed_sources_vendor" ON "vendor_feed_sources" USING btree ("vendor_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vendor_feed_runs_source_started" ON "vendor_feed_sync_runs" USING btree ("source_id","started_at");