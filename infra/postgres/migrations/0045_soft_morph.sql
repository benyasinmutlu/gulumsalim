CREATE TYPE "public"."content_analytics_type" AS ENUM('product', 'category', 'collection', 'vendor', 'homepage_section');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "content_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "content_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"content_type" "content_analytics_type" NOT NULL,
	"content_id" bigint NOT NULL,
	"event_type" text NOT NULL,
	"value" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "search_queries" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "search_queries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"query" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_content_events_lookup" ON "content_events" USING btree ("content_type","content_id","event_type","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_search_queries_created" ON "search_queries" USING btree ("created_at");