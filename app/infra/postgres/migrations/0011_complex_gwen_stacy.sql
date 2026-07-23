ALTER TABLE "promo_banners" ADD COLUMN "vendor_id" bigint;--> statement-breakpoint
ALTER TABLE "promo_banners" ADD COLUMN "status" "refund_status" DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE "promo_banners" ADD COLUMN "rejection_note" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "promo_banners" ADD CONSTRAINT "promo_banners_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
