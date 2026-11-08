CREATE TABLE "checkout_rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"window_start" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE INDEX "orders_stripe_payment_intent_id_idx" ON "orders" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE INDEX "stripe_events_processed_at_idx" ON "stripe_events" USING btree ("processed_at");