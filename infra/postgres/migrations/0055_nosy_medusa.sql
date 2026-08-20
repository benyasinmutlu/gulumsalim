CREATE TABLE IF NOT EXISTS "discover_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "discover_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"type" text NOT NULL,
	"customer_id" bigint,
	"session_id" text NOT NULL,
	"product_id" bigint,
	"vendor_id" bigint,
	"category_id" bigint,
	"source" text NOT NULL,
	"occurred_at" timestamp (3) with time zone NOT NULL,
	"dedup_key" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "discover_feedback" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "discover_feedback_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"customer_id" bigint NOT NULL,
	"kind" text NOT NULL,
	"product_id" bigint,
	"category_id" bigint,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fit_feedback" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "fit_feedback_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"product_id" bigint NOT NULL,
	"customer_id" bigint,
	"size_numeric" integer NOT NULL,
	"verdict" text NOT NULL,
	"source" text DEFAULT 'explicit' NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_channel_credentials" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vendor_channel_credentials_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"vendor_id" bigint NOT NULL,
	"channel" "sales_channel" NOT NULL,
	"encrypted" text NOT NULL,
	"status" text DEFAULT 'connected' NOT NULL,
	"last_error" text,
	"last_checked_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_vendor_channel_cred" UNIQUE("vendor_id","channel")
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "size_chart" jsonb;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "size_prefs" jsonb;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "discover_feedback" ADD CONSTRAINT "discover_feedback_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "discover_feedback" ADD CONSTRAINT "discover_feedback_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fit_feedback" ADD CONSTRAINT "fit_feedback_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_discover_events_dedup" ON "discover_events" USING btree ("dedup_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_discover_events_lookup" ON "discover_events" USING btree ("type","source","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_discover_feedback_customer" ON "discover_feedback" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_discover_feedback_product" ON "discover_feedback" USING btree ("customer_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_discover_feedback_category" ON "discover_feedback" USING btree ("customer_id","category_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_fit_feedback_product" ON "fit_feedback" USING btree ("product_id");
