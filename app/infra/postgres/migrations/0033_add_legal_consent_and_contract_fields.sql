ALTER TABLE "vendors" ADD COLUMN "tax_id" text;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "legal_address" text;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "vendor_consent_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "membership_consent_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "marketing_consent_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "analytics_consent_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "contract_accepted_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "contract_snapshot" text;