CREATE TABLE "admin_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "admin_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"actor_id" text,
	"actor_email" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"label" text NOT NULL,
	"changes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "attention_reason" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "status" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Products that existed before statuses were already live: keep them in the store.
UPDATE "products" SET "status" = 'active', "published_at" = "created_at" WHERE "published_at" IS NULL;--> statement-breakpoint
CREATE INDEX "admin_events_entity_idx" ON "admin_events" USING btree ("entity","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "admin_events_created_at_idx" ON "admin_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "orders_attention_idx" ON "orders" USING btree ("created_at") WHERE "orders"."attention_reason" is not null;--> statement-breakpoint
CREATE INDEX "products_status_idx" ON "products" USING btree ("status");--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_status_check" CHECK ("products"."status" in ('draft', 'active', 'archived'));