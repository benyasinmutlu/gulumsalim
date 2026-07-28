CREATE TABLE IF NOT EXISTS "customer_addresses" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "customer_addresses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"customer_id" bigint NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"city" text NOT NULL,
	"district" text NOT NULL,
	"address_line" text NOT NULL,
	"zip_code" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_customer_addresses_customer" ON "customer_addresses" USING btree ("customer_id");