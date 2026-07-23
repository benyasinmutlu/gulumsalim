CREATE TYPE "public"."complaint_status" AS ENUM('pending', 'reviewed', 'dismissed');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_complaints" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vendor_complaints_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"vendor_id" bigint NOT NULL,
	"customer_id" bigint NOT NULL,
	"reason" text NOT NULL,
	"message" text NOT NULL,
	"status" "complaint_status" DEFAULT 'pending' NOT NULL,
	"admin_note" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor_complaints" ADD CONSTRAINT "vendor_complaints_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor_complaints" ADD CONSTRAINT "vendor_complaints_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vendor_complaints_vendor_status" ON "vendor_complaints" USING btree ("vendor_id","status");