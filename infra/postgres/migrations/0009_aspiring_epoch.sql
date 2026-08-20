CREATE TABLE IF NOT EXISTS "vendor_followers" (
	"customer_id" bigint NOT NULL,
	"vendor_id" bigint NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor_followers" ADD CONSTRAINT "vendor_followers_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor_followers" ADD CONSTRAINT "vendor_followers_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pk_vendor_followers" ON "vendor_followers" USING btree ("customer_id","vendor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vendor_followers_vendor" ON "vendor_followers" USING btree ("vendor_id");