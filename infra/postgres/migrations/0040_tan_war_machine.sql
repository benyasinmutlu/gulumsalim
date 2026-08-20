ALTER TABLE "customers" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "google_id" text;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_google_id_unique" UNIQUE("google_id");