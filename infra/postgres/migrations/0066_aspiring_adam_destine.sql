CREATE TABLE IF NOT EXISTS "product_question_votes" (
	"question_id" bigint NOT NULL,
	"customer_id" bigint NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "product_question_votes" ADD CONSTRAINT "product_question_votes_question_id_product_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."product_questions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pk_question_votes" ON "product_question_votes" USING btree ("question_id","customer_id");