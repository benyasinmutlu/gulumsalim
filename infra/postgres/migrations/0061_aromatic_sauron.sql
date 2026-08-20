CREATE TABLE IF NOT EXISTS "channel_webhook_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "channel_webhook_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"channel" "sales_channel" NOT NULL,
	"event_key" text NOT NULL,
	"payload_hash" text NOT NULL,
	"processed_lines" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_channel_webhook_event" UNIQUE("channel","event_key")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_channel_webhook_events_created" ON "channel_webhook_events" USING btree ("created_at");