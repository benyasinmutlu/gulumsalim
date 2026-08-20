CREATE TYPE "public"."message_sender" AS ENUM('admin', 'vendor');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_admin_messages" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vendor_admin_messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"vendor_id" bigint NOT NULL,
	"sender" "message_sender" NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_notifications" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vendor_notifications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"vendor_id" bigint NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text,
	"link" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "collection_products" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "collection_products_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"collection_id" bigint NOT NULL,
	"product_id" bigint NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "collections" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "collections_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"vendor_id" bigint NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"cover_image" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_refunds" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "order_refunds_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"order_item_id" bigint NOT NULL,
	"customer_id" bigint NOT NULL,
	"vendor_id" bigint NOT NULL,
	"reason" text NOT NULL,
	"status" "refund_status" DEFAULT 'pending' NOT NULL,
	"admin_note" text,
	"requested_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp (3) with time zone
);
--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "store_layout" jsonb DEFAULT '[{"type":"collections","visible":true},{"type":"products","visible":true}]'::jsonb NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor_admin_messages" ADD CONSTRAINT "vendor_admin_messages_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor_notifications" ADD CONSTRAINT "vendor_notifications_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "collection_products" ADD CONSTRAINT "collection_products_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "collection_products" ADD CONSTRAINT "collection_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "collections" ADD CONSTRAINT "collections_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_refunds" ADD CONSTRAINT "order_refunds_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_refunds" ADD CONSTRAINT "order_refunds_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_refunds" ADD CONSTRAINT "order_refunds_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vendor_messages_vendor" ON "vendor_admin_messages" USING btree ("vendor_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vendor_notifications_vendor" ON "vendor_notifications" USING btree ("vendor_id","is_read","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_collection_product" ON "collection_products" USING btree ("collection_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_collections_vendor_slug" ON "collections" USING btree ("vendor_id","slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_refunds_status" ON "order_refunds" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_refunds_vendor" ON "order_refunds" USING btree ("vendor_id");