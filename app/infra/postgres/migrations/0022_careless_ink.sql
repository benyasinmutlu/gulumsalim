CREATE TABLE IF NOT EXISTS "promo_banner_images" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "promo_banner_images_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"banner_id" bigint NOT NULL,
	"image" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "promo_banner_images" ADD CONSTRAINT "promo_banner_images_banner_id_promo_banners_id_fk" FOREIGN KEY ("banner_id") REFERENCES "public"."promo_banners"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_promo_banner_images_banner" ON "promo_banner_images" USING btree ("banner_id");