import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  uuid,
  decimal,
  pgEnum,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { organizationsTable } from "./business";

export const paymentStatusEnum = pgEnum("payment_status", ["pending", "success", "failed", "refunded"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", ["active", "expired", "cancelled", "pending", "on_hold", "in_grace_period", "paused", "revoked"]);

// ── Provider-agnostic subscription engine ─────────────────────────────────
// "source" (legacy, string, kept for backward-compat reads) is being
// superseded by "provider" (typed enum). New code should read/write
// `provider` + `providerProductId` + `providerSubscriptionId`; `source` and
// `razorpaySubscriptionId` remain populated for existing Razorpay rows and
// for any code that hasn't migrated yet. This lets Google Play, Apple IAP,
// Razorpay (kept for web/business-portal use), and future gateways
// (Stripe/Cashfree) share one subscriptions table without a breaking
// migration of historical rows.
export const subscriptionProviderEnum = pgEnum("subscription_provider", [
  "razorpay", "google_play", "apple_iap", "stripe", "cashfree",
]);

export const subscriptionsTable = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").references(() => organizationsTable.id, { onDelete: "cascade" }),
  plan: text("plan").notNull(),
  status: subscriptionStatusEnum("status").notNull().default("active"),
  source: text("source").notNull().default("razorpay"),
  // ── Provider-agnostic fields (new) ──────────────────────────────────────
  provider: subscriptionProviderEnum("provider").notNull().default("razorpay"),
  // The SKU/productId the user actually purchased (e.g. "aorane_pro_monthly"
  // for Google Play). This is the server's source of truth for what plan to
  // grant — never trust a client-supplied `plan` field for activation.
  providerProductId: text("provider_product_id"),
  // Generic per-provider subscription/purchase handle:
  //  - google_play: the purchaseToken
  //  - apple_iap:   the originalTransactionId
  //  - razorpay:    the Razorpay subscription id (mirrors razorpaySubscriptionId below)
  //  - stripe/cashfree: their respective subscription id
  providerSubscriptionId: text("provider_subscription_id"),
  seats: integer("seats").notNull().default(1),
  amountPaid: decimal("amount_paid", { precision: 10, scale: 2 }),
  discountPct: integer("discount_pct").notNull().default(0),
  promoCodeUsed: text("promo_code_used"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  razorpaySubscriptionId: text("razorpay_subscription_id"),
  paymentType: text("payment_type").notNull().default("one_time"),
  autoRenew: boolean("auto_renew").notNull().default(false),
  nextRenewalAt: timestamp("next_renewal_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  // routes/modules/webhook.ts: 4 call sites doing
  // `SELECT ... FROM subscriptions WHERE razorpay_subscription_id = $1`
  // inside real-time Razorpay webhook handlers (payment success, renewal,
  // failure, cancellation) — Razorpay retries on slow/failed webhook acks,
  // so this lookup is latency-sensitive. No existing index covers this
  // column (nullable, so a plain non-unique index — some subscriptions
  // have no Razorpay ID, e.g. admin-granted or org-managed plans).
  razorpaySubIdIdx: index("idx_subscriptions_razorpay_subscription_id").on(t.razorpaySubscriptionId),
  // Same latency-sensitive lookup pattern, generalized: Google Play RTDN
  // and the purchase-verification endpoint both look up a subscription by
  // (provider, providerSubscriptionId) — e.g. "does this purchaseToken
  // already have a subscription row?" This is ALSO the idempotency guard
  // that stops the same purchaseToken/originalTransactionId from ever
  // activating two subscription rows (replay / duplicate-activation
  // prevention), so it must be UNIQUE, not just indexed. Nullable-safe:
  // rows without a providerSubscriptionId (e.g. admin-granted plans) are
  // simply excluded from the uniqueness set by Postgres's standard "NULLs
  // are distinct" behavior for unique indexes.
  providerSubUnique: uniqueIndex("uq_subscriptions_provider_subscription_id").on(t.provider, t.providerSubscriptionId),
}));

// ── Subscription event / idempotency log ──────────────────────────────────
// Durable (DB-level) idempotency for every provider callback we process:
// Google Play RTDN (Pub/Sub push, which explicitly may redeliver the same
// notification), Razorpay webhooks, and future Apple Server Notifications
// V2 / Stripe webhooks all land here before any state mutation happens.
// The redis-backed `cache` used elsewhere (see lib/redis.ts) is fine as a
// fast-path short-circuit, but it's TTL-bound and not durable across a
// cache flush — this table is the actual source of truth for "have we
// already processed this exact event", enforced by a real unique
// constraint rather than a best-effort cache check.
export const subscriptionEventTypeEnum = pgEnum("subscription_event_type", [
  "purchased", "renewed", "cancelled", "expired", "revoked", "refunded",
  "on_hold", "in_grace_period", "recovered", "paused", "restarted",
  "price_change_confirmed", "acknowledged", "deferred", "verification_failed",
]);

export const subscriptionEventsTable = pgTable("subscription_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  subscriptionId: uuid("subscription_id").references(() => subscriptionsTable.id, { onDelete: "set null" }),
  userId: uuid("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  provider: subscriptionProviderEnum("provider").notNull(),
  eventType: subscriptionEventTypeEnum("event_type").notNull(),
  // Provider's own event/notification identifier where one exists (Google
  // RTDN doesn't guarantee one on the notification payload itself, so we
  // fall back to a deterministic composite in application code — see
  // lib/subscriptionEngine.ts `buildGoogleEventKey`). Razorpay does supply
  // `x-razorpay-event-id`, used as-is.
  providerEventId: text("provider_event_id").notNull(),
  // The purchaseToken / originalTransactionId this event is about — kept
  // separately from providerEventId for querying "all events for this
  // purchase" without parsing the composite key.
  providerTransactionId: text("provider_transaction_id"),
  // Deliberately minimal + non-sensitive: plan key, raw notification type,
  // expiry timestamp seen. NEVER the purchaseToken/receipt itself, and
  // never full provider payloads — see lib/subscriptionEngine.ts logging
  // notes for why (a leaked purchaseToken is itself a replayable secret).
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  // The actual idempotency guarantee: processing the same provider event
  // twice (Pub/Sub redelivery, Razorpay webhook retry) becomes a no-op
  // insert conflict instead of a second state mutation.
  providerEventUnique: uniqueIndex("uq_subscription_events_provider_event_id").on(t.provider, t.providerEventId),
  subscriptionIdx: index("idx_subscription_events_subscription_id").on(t.subscriptionId),
}));

export const paymentsTable = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  orgId: uuid("org_id").references(() => organizationsTable.id, { onDelete: "set null" }),
  subscriptionId: uuid("subscription_id").references(() => subscriptionsTable.id),
  razorpayOrderId: text("razorpay_order_id"),
  razorpayPaymentId: text("razorpay_payment_id"),
  razorpaySubscriptionId: text("razorpay_subscription_id"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  baseAmount: decimal("base_amount", { precision: 10, scale: 2 }),
  gstAmount: decimal("gst_amount", { precision: 10, scale: 2 }),
  invoiceNumber: text("invoice_number"),
  currency: text("currency").notNull().default("INR"),
  status: paymentStatusEnum("status").notNull().default("pending"),
  plan: text("plan").notNull(),
  // Set once at order-creation time (the caller already knows this — see
  // /payment/order) and read back as-is at verify time, instead of
  // guessing monthly-vs-yearly from the paid amount. That guess
  // (amount >= monthlyPrice * 10) breaks the moment a yearly price is
  // configured below 10x the monthly one, e.g. a "10 months for 12"
  // promo — a real annual subscriber would silently get 30 days instead
  // of a year.
  billingCycle: text("billing_cycle").notNull().default("monthly"),
  seats: integer("seats").notNull().default(1),
  gatewayFee: decimal("gateway_fee", { precision: 8, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const promoCodesTable = pgTable("promo_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  discountPct: integer("discount_pct").notNull(),
  discountType: text("discount_type").notNull().default("percent"),
  applicablePlans: text("applicable_plans").array(),
  usageLimit: integer("usage_limit"),
  usedCount: integer("used_count").notNull().default(0),
  isLifetimeUpgrade: boolean("is_lifetime_upgrade").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const planPricingTable = pgTable("plan_pricing", {
  id: uuid("id").primaryKey().defaultRandom(),
  planKey: text("plan_key").notNull().unique(),
  displayName: text("display_name").notNull(),
  type: text("type").notNull().default("individual"),
  monthlyPrice: decimal("monthly_price", { precision: 10, scale: 2 }).notNull().default("0"),
  yearlyPrice: decimal("yearly_price", { precision: 10, scale: 2 }),
  maxSeats: integer("max_seats"),
  features: jsonb("features").$type<string[]>().notNull().default([]),
  badgeText: text("badge_text"),
  badgeColor: text("badge_color").default("#0077B6"),
  gradientColors: jsonb("gradient_colors").$type<[string, string]>(),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  // ── Offer / Discount fields ───────────────────────────────────────────────
  discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  offerLabel: text("offer_label"),
  offerValidFrom: timestamp("offer_valid_from", { withTimezone: true }),
  offerValidTo: timestamp("offer_valid_to", { withTimezone: true }),
  // ── Store product-ID mapping (server-authoritative plan resolution) ─────
  // A Google Play purchase only ever tells the backend a `productId` (and
  // optionally `basePlanId`) — never a trusted "plan" string. These columns
  // let /payment/google/verify-purchase and the RTDN webhook resolve
  // "productId X == our `planKey` Y" purely from server-side data, so a
  // compromised or tampered client can't claim a cheaper purchase unlocks a
  // more expensive plan. Same idea reserved for Apple ahead of iOS work.
  googlePlayProductIds: jsonb("google_play_product_ids").$type<{ monthly?: string; yearly?: string }>(),
  appleProductIds: jsonb("apple_product_ids").$type<{ monthly?: string; yearly?: string }>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const referralsTable = pgTable("referrals", {
  id: uuid("id").primaryKey().defaultRandom(),
  referrerId: uuid("referrer_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  referredId: uuid("referred_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  rewardStatus: text("reward_status").notNull().default("pending"),
  rewardAmount: decimal("reward_amount", { precision: 8, scale: 2 }),
  rewardedAt: timestamp("rewarded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Subscription = typeof subscriptionsTable.$inferSelect;
export type Payment = typeof paymentsTable.$inferSelect;
export type PromoCode = typeof promoCodesTable.$inferSelect;
export type PlanPricing = typeof planPricingTable.$inferSelect;
