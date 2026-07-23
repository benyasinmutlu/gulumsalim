ALTER TYPE "public"."section_algo" ADD VALUE 'vendor_products' BEFORE 'promo_banners';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "homepage_section_banners" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "homepage_section_banners_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"section_id" bigint NOT NULL,
	"banner_id" bigint NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "homepage_sections" ADD COLUMN "seo_slug" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "homepage_section_banners" ADD CONSTRAINT "homepage_section_banners_section_id_homepage_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."homepage_sections"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "homepage_section_banners" ADD CONSTRAINT "homepage_section_banners_banner_id_promo_banners_id_fk" FOREIGN KEY ("banner_id") REFERENCES "public"."promo_banners"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_section_banner" ON "homepage_section_banners" USING btree ("section_id","banner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_section_banners_section" ON "homepage_section_banners" USING btree ("section_id");--> statement-breakpoint
ALTER TABLE "homepage_sections" ADD CONSTRAINT "homepage_sections_seo_slug_unique" UNIQUE("seo_slug");