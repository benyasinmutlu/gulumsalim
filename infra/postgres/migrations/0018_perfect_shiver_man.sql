CREATE TABLE IF NOT EXISTS "vendor_reviews" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vendor_reviews_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"vendor_id" bigint NOT NULL,
	"customer_id" bigint NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"status" "review_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor_reviews" ADD CONSTRAINT "vendor_reviews_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor_reviews" ADD CONSTRAINT "vendor_reviews_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_vendor_reviews_vendor_customer" ON "vendor_reviews" USING btree ("vendor_id","customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vendor_reviews_vendor_status" ON "vendor_reviews" USING btree ("vendor_id","status");