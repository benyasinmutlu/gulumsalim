ALTER TABLE "vendors" ADD COLUMN "password_reset_token_hash" text;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "password_reset_expires_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "password_reset_token_hash" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "password_reset_expires_at" timestamp (3) with time zone;