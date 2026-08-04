ALTER TYPE "public"."vendor_status" ADD VALUE 'closed';--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "deleted_at" timestamp (3) with time zone;