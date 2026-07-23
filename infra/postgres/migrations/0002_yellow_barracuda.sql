ALTER TABLE "pages" ADD COLUMN "show_in_footer" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;