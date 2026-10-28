ALTER TABLE "shipments" ADD COLUMN "provider" text;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "provider_status" text DEFAULT 'not_registered' NOT NULL;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "provider_reference" text;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "provider_file_name" text;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "provider_last_error" text;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "provider_attempt_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "provider_registered_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "provider_last_checked_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "provider_events" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_shipments_provider_reference" ON "shipments" USING btree ("provider_reference");--> statement-breakpoint
CREATE INDEX "idx_shipments_provider_poll" ON "shipments" USING btree ("provider","provider_status","provider_last_checked_at");--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipment_provider_status_check" CHECK ("shipments"."provider_status" IN ('not_registered', 'registering', 'registration_pending', 'registered', 'registration_failed', 'tracking', 'delivered', 'cancelled'));