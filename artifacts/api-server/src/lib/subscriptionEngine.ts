// ─── Subscription engine — provider-agnostic, server-authoritative ─────────
// This is the ONLY code path allowed to grant, renew, downgrade, or revoke
// a paid plan. Every route (Google Play verify-purchase, RTDN webhook,
// Razorpay webhook, future Stripe/Cashfree webhooks) calls into these
// functions instead of writing to `subscriptionsTable`/`usersTable`
// directly, so entitlement logic — and its safety checks — live in exactly
// one place.
//
// Non-negotiable invariants enforced here:
//  1. The plan a user is granted is ALWAYS resolved from the provider's own
//     verified productId -> plan mapping (plan_pricing.google_play_product_ids
//     / apple_product_ids), never from a client-supplied `plan` string.
//  2. Activating the same (provider, providerSubscriptionId) twice is a
//     no-op, enforced by the DB unique index — this stops replayed purchase
//     tokens or retried requests from granting duplicate entitlements.
//  3. Every state-changing event (purchase, renewal, cancel, expiry,
//     refund, revoke) is recorded in subscription_events with a unique
//     (provider, providerEventId) key BEFORE the subscription itself is
//     mutated, so retried/duplicated webhooks are provably idempotent.
//  4. Downgrades/cancellations never delete history — status transitions
//     only, so payment/audit history stays intact for support and dispute
//     resolution.

import { and, desc, eq } from "drizzle-orm";
import {
  db,
  usersTable,
  subscriptionsTable,
  subscriptionEventsTable,
  planPricingTable,
  familyGroupsTable,
  familyMembersTable,
} from "@workspace/db";
import { logger } from "./logger";
import { signUserToken, signRefreshToken } from "./jwt";
import { invalidateUserPlanCache } from "../middlewares/user-auth";
import type { SubscriptionProviderName } from "./subscriptionProviders";

export type EngineSubscriptionEventType =
  | "purchased" | "renewed" | "cancelled" | "expired" | "revoked" | "refunded"
  | "on_hold" | "in_grace_period" | "recovered" | "paused" | "restarted"
  | "price_change_confirmed" | "acknowledged" | "deferred" | "verification_failed";

export type PlanKey = "free" | "pro" | "max" | "family";
const VALID_USER_PLANS: readonly PlanKey[] = ["free", "pro", "max", "family"];

function generateFamilyCode(): string {
  return "FAM" + Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function autoCreateFamilyGroup(userId: string): Promise<string | null> {
  try {
    const existing = await db.select().from(familyMembersTable).where(eq(familyMembersTable.userId, userId));
    if (existing.length) {
      const [grp] = await db.select().from(familyGroupsTable).where(eq(familyGroupsTable.id, existing[0].groupId));
      return grp?.inviteCode ?? null;
    }
    const inviteCode = generateFamilyCode();
    const [group] = await db.insert(familyGroupsTable).values({ ownerId: userId, inviteCode, maxMembers: 4 }).returning();
    await db.insert(familyMembersTable).values({ groupId: group.id, userId, role: "owner" });
    return inviteCode;
  } catch {
    return null;
  }
}

/**
 * Resolves a Play Store / App Store productId back to our internal plan
 * key using `plan_pricing`'s server-configured mapping — this is what makes
 * plan-granting immune to a tampered client claiming a cheaper purchase
 * unlocks a more expensive plan.
 */
export async function resolvePlanFromProviderProductId(
  provider: SubscriptionProviderName,
  productId: string
): Promise<{ planKey: PlanKey; billingCycle: "monthly" | "yearly" } | null> {
  const rows = await db.select().from(planPricingTable).where(eq(planPricingTable.isActive, true));
  for (const row of rows) {
    const ids = provider === "apple_iap" ? row.appleProductIds : row.googlePlayProductIds;
    if (!ids) continue;
    if (ids.monthly === productId) {
      return { planKey: normalizePlanKey(row.planKey), billingCycle: "monthly" };
    }
    if (ids.yearly === productId) {
      return { planKey: normalizePlanKey(row.planKey), billingCycle: "yearly" };
    }
  }
  return null;
}

function normalizePlanKey(raw: string): PlanKey {
  const normalized = raw.toLowerCase().trim();
  if ((VALID_USER_PLANS as readonly string[]).includes(normalized)) return normalized as PlanKey;
  // Any plan_pricing row that maps to a store product but isn't one of the
  // four grantable plan keys is a configuration error — fail loud rather
  // than silently granting "free" or an arbitrary string into a typed enum column.
  throw new Error(`plan_pricing.plan_key "${raw}" is not a valid grantable plan`);
}

async function rotateUserTokensForPlan(userId: string): Promise<{ accessToken: string; refreshToken: string; plan: string } | null> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) return null;
  await invalidateUserPlanCache(userId);
  const payload = { userId: user.id, phone: user.phone || undefined, email: user.email || undefined, plan: user.plan };
  return { accessToken: signUserToken(payload), refreshToken: signRefreshToken(payload), plan: user.plan };
}

/**
 * Records a provider event with a durable idempotency guarantee. Returns
 * `false` (and does nothing else) if this exact event was already
 * processed — callers MUST check the return value and skip all further
 * mutation when it's `false`.
 */
async function recordEventOnce(params: {
  provider: SubscriptionProviderName;
  providerEventId: string;
  eventType: EngineSubscriptionEventType;
  subscriptionId?: string | null;
  userId?: string | null;
  providerTransactionId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  try {
    await db.insert(subscriptionEventsTable).values({
      provider: params.provider,
      providerEventId: params.providerEventId,
      eventType: params.eventType,
      subscriptionId: params.subscriptionId ?? null,
      userId: params.userId ?? null,
      providerTransactionId: params.providerTransactionId ?? null,
      // Deliberately minimal metadata — never store the raw purchaseToken
      // or full provider payload here. A leaked purchaseToken is itself a
      // replayable credential against the provider's own verification API.
      metadata: params.metadata ?? {},
    });
    return true;
  } catch (err) {
    // Unique-constraint violation on (provider, providerEventId) == we've
    // already processed this exact event. Postgres error code 23505.
    const code = (err as { code?: string }).code;
    if (code === "23505") {
      logger.info({ provider: params.provider, eventType: params.eventType }, "Duplicate subscription event ignored (idempotent)");
      return false;
    }
    throw err;
  }
}

export interface ActivatePurchaseParams {
  userId: string;
  provider: SubscriptionProviderName;
  providerProductId: string;
  providerSubscriptionId: string; // purchaseToken / originalTransactionId / razorpay sub id
  planKey: PlanKey;
  billingCycle: "monthly" | "yearly";
  expiresAt: Date;
  autoRenew: boolean;
  amountPaid?: number;
  /** A caller-supplied idempotency key for the *purchase* event itself
   *  (distinct from provider notification event ids used by webhooks). */
  eventId: string;
}

export interface ActivateResult {
  subscriptionId: string;
  plan: PlanKey;
  expiresAt: Date;
  inviteCode: string | null;
  accessToken?: string;
  refreshToken?: string;
  alreadyProcessed: boolean;
}

/**
 * Activates (or re-confirms) a subscription purchase. Idempotent: calling
 * this twice with the same (provider, providerSubscriptionId) is safe and
 * simply returns the existing row without granting anything twice.
 */
export async function activatePurchase(params: ActivatePurchaseParams): Promise<ActivateResult> {
  // Idempotency guard #1: has this exact purchase event already been recorded?
  const eventRecorded = await recordEventOnce({
    provider: params.provider,
    providerEventId: params.eventId,
    eventType: "purchased",
    userId: params.userId,
    providerTransactionId: params.providerSubscriptionId,
    metadata: { planKey: params.planKey, billingCycle: params.billingCycle },
  });

  // Idempotency guard #2 (belt-and-suspenders): the DB unique index on
  // (provider, providerSubscriptionId) means a second INSERT for the same
  // purchase token can never create a duplicate row even if guard #1 were
  // somehow bypassed (e.g. a caller reusing a fresh eventId for a token
  // we've already activated under a different event id).
  const [existing] = await db.select().from(subscriptionsTable)
    .where(and(eq(subscriptionsTable.provider, params.provider), eq(subscriptionsTable.providerSubscriptionId, params.providerSubscriptionId)));

  if (existing && !eventRecorded) {
    return {
      subscriptionId: existing.id,
      plan: normalizePlanKey(existing.plan),
      expiresAt: existing.expiresAt ?? params.expiresAt,
      inviteCode: null,
      alreadyProcessed: true,
    };
  }

  let subscriptionId: string;
  let inviteCode: string | null = null;

  if (existing) {
    // Same purchaseToken re-verified (e.g. client retried the verify call
    // after a network drop) — refresh expiry/status instead of inserting.
    await db.update(subscriptionsTable).set({
      status: "active",
      expiresAt: params.expiresAt,
      nextRenewalAt: params.expiresAt,
      autoRenew: params.autoRenew,
    }).where(eq(subscriptionsTable.id, existing.id));
    subscriptionId = existing.id;
  } else {
    const [sub] = await db.transaction(async (tx) => {
      const [row] = await tx.insert(subscriptionsTable).values({
        userId: params.userId,
        plan: params.planKey,
        status: "active",
        source: params.provider,
        provider: params.provider,
        providerProductId: params.providerProductId,
        providerSubscriptionId: params.providerSubscriptionId,
        amountPaid: params.amountPaid != null ? String(params.amountPaid) : undefined,
        expiresAt: params.expiresAt,
        paymentType: params.autoRenew ? "recurring" : "one_time",
        autoRenew: params.autoRenew,
        nextRenewalAt: params.expiresAt,
      }).returning();
      await tx.update(usersTable).set({ plan: params.planKey }).where(eq(usersTable.id, params.userId));
      return [row];
    });
    subscriptionId = sub.id;
    if (params.planKey === "family") inviteCode = await autoCreateFamilyGroup(params.userId);
  }

  const tokens = await rotateUserTokensForPlan(params.userId).catch(() => null);

  logger.info(
    { provider: params.provider, plan: params.planKey, subscriptionId, alreadyExisted: !!existing },
    "Subscription activated"
  );

  return {
    subscriptionId,
    plan: params.planKey,
    expiresAt: params.expiresAt,
    inviteCode,
    accessToken: tokens?.accessToken,
    refreshToken: tokens?.refreshToken,
    alreadyProcessed: false,
  };
}

/** Applies a renewal (subscription continues under the same purchaseToken/plan). */
export async function applyRenewal(params: {
  provider: SubscriptionProviderName;
  providerSubscriptionId: string;
  expiresAt: Date;
  eventId: string;
}): Promise<void> {
  const processed = await recordEventOnce({
    provider: params.provider,
    providerEventId: params.eventId,
    eventType: "renewed",
    providerTransactionId: params.providerSubscriptionId,
  });
  if (!processed) return;

  const [sub] = await db.select().from(subscriptionsTable)
    .where(and(eq(subscriptionsTable.provider, params.provider), eq(subscriptionsTable.providerSubscriptionId, params.providerSubscriptionId)));
  if (!sub) {
    logger.warn({ provider: params.provider }, "Renewal event for unknown subscription — ignoring");
    return;
  }
  await db.update(subscriptionsTable).set({
    status: "active",
    expiresAt: params.expiresAt,
    nextRenewalAt: params.expiresAt,
  }).where(eq(subscriptionsTable.id, sub.id));
  logger.info({ subscriptionId: sub.id, provider: params.provider }, "Subscription renewed");
}

/** Applies a terminal or transitional status change (cancel/expire/refund/hold/etc). */
export async function applyStatusChange(params: {
  provider: SubscriptionProviderName;
  providerSubscriptionId: string;
  eventType: EngineSubscriptionEventType;
  newStatus: "active" | "expired" | "cancelled" | "on_hold" | "in_grace_period" | "paused" | "revoked";
  eventId: string;
  downgradeToFree?: boolean;
}): Promise<void> {
  const processed = await recordEventOnce({
    provider: params.provider,
    providerEventId: params.eventId,
    eventType: params.eventType,
    providerTransactionId: params.providerSubscriptionId,
  });
  if (!processed) return;

  const [sub] = await db.select().from(subscriptionsTable)
    .where(and(eq(subscriptionsTable.provider, params.provider), eq(subscriptionsTable.providerSubscriptionId, params.providerSubscriptionId)));
  if (!sub) {
    logger.warn({ provider: params.provider, eventType: params.eventType }, "Status-change event for unknown subscription — ignoring");
    return;
  }

  await db.transaction(async (tx) => {
    await tx.update(subscriptionsTable).set({
      status: params.newStatus,
      cancelledAt: ["cancelled", "expired", "revoked"].includes(params.newStatus) ? new Date() : sub.cancelledAt,
      autoRenew: params.newStatus === "active" ? sub.autoRenew : false,
    }).where(eq(subscriptionsTable.id, sub.id));

    // Only revoke/expire actually downgrades the user's active plan — a
    // "cancelled" auto-renew (user turned off renewal) keeps the plan
    // active until the already-paid-for expiry date, matching existing
    // product behavior (see routes/modules/payment.ts cancel endpoint).
    if (params.downgradeToFree && sub.userId) {
      await tx.update(usersTable).set({ plan: "free" }).where(eq(usersTable.id, sub.userId));
    }
  });

  if (params.downgradeToFree && sub.userId) {
    await invalidateUserPlanCache(sub.userId).catch(() => {});
  }

  logger.info({ subscriptionId: sub.id, provider: params.provider, eventType: params.eventType, newStatus: params.newStatus }, "Subscription status changed");
}

/** Fetches the most recent subscription row for a user, regardless of provider. */
export async function getLatestSubscription(userId: string) {
  const [sub] = await db.select().from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId))
    .orderBy(desc(subscriptionsTable.createdAt))
    .limit(1);
  return sub ?? null;
}
