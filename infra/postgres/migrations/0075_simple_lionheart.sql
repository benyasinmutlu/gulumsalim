ALTER TABLE "admin_users" ADD COLUMN "mfa_secret_encrypted" text;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "mfa_recovery_code_hashes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "mfa_enabled_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "mfa_last_used_step" bigint;