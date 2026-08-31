CREATE TYPE "public"."product_condition" AS ENUM('new_with_tags', 'new_without_tags', 'very_good', 'good', 'used');--> statement-breakpoint
ALTER TABLE "product_images" ADD COLUMN "is_defect_photo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "condition" "product_condition";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "has_defect" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "defect_description" text;