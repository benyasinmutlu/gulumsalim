CREATE TABLE IF NOT EXISTS "promo_banner_clicks" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "promo_banner_clicks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"banner_id" bigint NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "promo_banners" ADD COLUMN "link_type" text DEFAULT 'url' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "promo_banner_clicks" ADD CONSTRAINT "promo_banner_clicks_banner_id_promo_banners_id_fk" FOREIGN KEY ("banner_id") REFERENCES "public"."promo_banners"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_promo_banner_clicks_banner" ON "promo_banner_clicks" USING btree ("banner_id");