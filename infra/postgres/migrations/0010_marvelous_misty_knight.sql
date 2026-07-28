CREATE TABLE IF NOT EXISTS "homepage_collection_products" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "homepage_collection_products_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"homepage_collection_id" bigint NOT NULL,
	"product_id" bigint NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "homepage_collections" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "homepage_collections_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"title" text NOT NULL,
	"subtitle" text,
	"text_color" text,
	"link_type" text,
	"link_value" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "homepage_collection_products" ADD CONSTRAINT "homepage_collection_products_homepage_collection_id_homepage_collections_id_fk" FOREIGN KEY ("homepage_collection_id") REFERENCES "public"."homepage_collections"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "homepage_collection_products" ADD CONSTRAINT "homepage_collection_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pk_homepage_collection_products" ON "homepage_collection_products" USING btree ("homepage_collection_id","product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_homepage_collection_products_collection" ON "homepage_collection_products" USING btree ("homepage_collection_id");