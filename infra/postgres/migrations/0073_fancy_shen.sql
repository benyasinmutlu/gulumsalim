CREATE TYPE "public"."shipment_direction" AS ENUM('outbound', 'return');--> statement-breakpoint
CREATE TYPE "public"."shipment_status" AS ENUM('created', 'shipped', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "shipments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"order_id" bigint NOT NULL,
	"vendor_id" bigint NOT NULL,
	"status" "shipment_status" DEFAULT 'created' NOT NULL,
	"direction" "shipment_direction" DEFAULT 'outbound' NOT NULL,
	"carrier_name" text,
	"tracking_number" text,
	"shipped_at" timestamp (3) with time zone,
	"delivered_at" timestamp (3) with time zone,
	"sender_name" text,
	"sender_phone" text,
	"sender_city" text,
	"sender_district" text,
	"sender_address_line" text,
	"recipient_name" text NOT NULL,
	"recipient_phone" text NOT NULL,
	"recipient_city" text NOT NULL,
	"recipient_district" text NOT NULL,
	"recipient_address_line" text NOT NULL,
	"recipient_zip_code" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "shipment_id" bigint;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_shipments_order" ON "shipments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_shipments_vendor" ON "shipments" USING btree ("vendor_id","status");--> statement-breakpoint
CREATE INDEX "idx_shipments_tracking_number" ON "shipments" USING btree ("tracking_number");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_shipments_order_vendor" ON "shipments" USING btree ("order_id","vendor_id");--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_order_items_shipment" ON "order_items" USING btree ("shipment_id");