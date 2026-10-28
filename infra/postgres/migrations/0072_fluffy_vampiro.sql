ALTER TABLE "vendors" ADD COLUMN "shipping_contact_name" text;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "shipping_contact_phone" text;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "shipping_city" text;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "shipping_district" text;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "shipping_address_line" text;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "weight_grams" integer;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "width_cm" numeric(6, 1);--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "height_cm" numeric(6, 1);--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "length_cm" numeric(6, 1);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "weight_grams" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "width_cm" numeric(6, 1);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "height_cm" numeric(6, 1);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "length_cm" numeric(6, 1);--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "chk_product_variants_weight_grams_range" CHECK ("product_variants"."weight_grams" IS NULL OR ("product_variants"."weight_grams" >= 0 AND "product_variants"."weight_grams" <= 50000));--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "chk_product_variants_width_cm_range" CHECK ("product_variants"."width_cm" IS NULL OR ("product_variants"."width_cm" >= 0 AND "product_variants"."width_cm" <= 500));--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "chk_product_variants_height_cm_range" CHECK ("product_variants"."height_cm" IS NULL OR ("product_variants"."height_cm" >= 0 AND "product_variants"."height_cm" <= 500));--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "chk_product_variants_length_cm_range" CHECK ("product_variants"."length_cm" IS NULL OR ("product_variants"."length_cm" >= 0 AND "product_variants"."length_cm" <= 500));--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "chk_products_weight_grams_range" CHECK ("products"."weight_grams" IS NULL OR ("products"."weight_grams" >= 0 AND "products"."weight_grams" <= 50000));--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "chk_products_width_cm_range" CHECK ("products"."width_cm" IS NULL OR ("products"."width_cm" >= 0 AND "products"."width_cm" <= 500));--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "chk_products_height_cm_range" CHECK ("products"."height_cm" IS NULL OR ("products"."height_cm" >= 0 AND "products"."height_cm" <= 500));--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "chk_products_length_cm_range" CHECK ("products"."length_cm" IS NULL OR ("products"."length_cm" >= 0 AND "products"."length_cm" <= 500));