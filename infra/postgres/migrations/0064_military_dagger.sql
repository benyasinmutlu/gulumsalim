CREATE UNIQUE INDEX IF NOT EXISTS "uq_channel_listing_external_product" ON "channel_listings" USING btree ("channel","external_product_id") WHERE "channel_listings"."external_product_id" IS NOT NULL;
