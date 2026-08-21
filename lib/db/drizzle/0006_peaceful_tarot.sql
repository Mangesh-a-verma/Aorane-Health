CREATE TYPE "public"."subscription_event_type" AS ENUM('purchased', 'renewed', 'cancelled', 'expired', 'revoked', 'refunded', 'on_hold', 'in_grace_period', 'recovered', 'paused', 'restarted', 'price_change_confirmed', 'acknowledged', 'deferred', 'verification_failed');--> statement-breakpoint
CREATE TYPE "public"."subscription_provider" AS ENUM('razorpay', 'google_play', 'apple_iap', 'stripe', 'cashfree');--> statement-breakpoint
ALTER TYPE "public"."subscription_status" ADD VALUE 'on_hold';--> statement-breakpoint
ALTER TYPE "public"."subscription_status" ADD VALUE 'in_grace_period';--> statement-breakpoint
ALTER TYPE "public"."subscription_status" ADD VALUE 'paused';--> statement-breakpoint
ALTER TYPE "public"."subscription_status" ADD VALUE 'revoked';--> statement-breakpoint
CREATE TABLE "subscription_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid,
	"user_id" uuid,
	"provider" "subscription_provider" NOT NULL,
	"event_type" "subscription_event_type" NOT NULL,
	"provider_event_id" text NOT NULL,
	"provider_transaction_id" text,
	"metadata" jsonb,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plan_pricing" ADD COLUMN "google_play_product_ids" jsonb;--> statement-breakpoint
ALTER TABLE "plan_pricing" ADD COLUMN "apple_product_ids" jsonb;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "provider" "subscription_provider" DEFAULT 'razorpay' NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "provider_product_id" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "provider_subscription_id" text;--> statement-breakpoint
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_subscription_events_provider_event_id" ON "subscription_events" USING btree ("provider","provider_event_id");--> statement-breakpoint
CREATE INDEX "idx_subscription_events_subscription_id" ON "subscription_events" USING btree ("subscription_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_subscriptions_provider_subscription_id" ON "subscriptions" USING btree ("provider","provider_subscription_id");