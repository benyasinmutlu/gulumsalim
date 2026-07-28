CREATE TYPE "public"."vendor_type" AS ENUM('business', 'individual');--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "vendor_type" "vendor_type" DEFAULT 'business' NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "customer_id" bigint;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "is_second_hand" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendors" ADD CONSTRAINT "vendors_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
