ALTER TABLE "orders" DROP CONSTRAINT "orders_total_check";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "currency" SET DEFAULT 'gbp';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_total_check" CHECK ("orders"."subtotal" >= 0 and "orders"."shipping" >= 0 and "orders"."total" >= 0);