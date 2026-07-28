CREATE TABLE IF NOT EXISTS "cookie_consents" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cookie_consents_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"session_id" text NOT NULL,
	"customer_id" bigint,
	"performance" boolean DEFAULT false NOT NULL,
	"functionality" boolean DEFAULT false NOT NULL,
	"advertising" boolean DEFAULT false NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"decided_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cookie_consents" ADD CONSTRAINT "cookie_consents_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_cookie_consents_session" ON "cookie_consents" USING btree ("session_id");