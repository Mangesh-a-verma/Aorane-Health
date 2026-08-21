// ─── Google Play Billing routes ─────────────────────────────────────────────
// Android-native subscription purchase/verify/cancel + the Real-time
// Developer Notifications (RTDN) webhook. This is what replaces the
// external-browser Razorpay checkout for the Android app's digital
// subscription flow — see docs/PLAY_BILLING_MIGRATION.md for the full
// migration write-up and Play Console setup steps.
import { Router } from "express";
import { db, subscriptionsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { requireAuth } from "../../middlewares/user-auth";
import type { AuthRequest } from "../../middlewares/user-auth";
import { getSubscriptionProvider } from "../../lib/subscriptionProviders";
import { acknowledgeGooglePurchase, decodeRtdnMessage, RTDN_NOTIFICATION_TYPE, verifyGoogleRtdnToken } from "../../lib/subscriptionProviders/googlePlay";
import { activatePurchase, applyRenewal, applyStatusChange, resolvePlanFromProviderProductId } from "../../lib/subscriptionEngine";

const router = Router();

function redactToken(token: string | undefined): string {
  if (!token || token.length <= 8) return "***";
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

// ─── POST: verify + activate a Google Play purchase ─────────────────────────
// Called by the Android app immediately after react-native-iap resolves a
// requestSubscription() purchase. The client sends ONLY the raw
// productId + purchaseToken it received from Play Billing — plan,
// expiry, and entitlement are all derived server-side from Google's own
// verification response, never trusted from the client.
router.post("/payment/google/verify-purchase", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { productId, purchaseToken } = req.body as { productId?: string; purchaseToken?: string };
    if (!productId || !purchaseToken) {
      res.status(400).json({ error: "productId and purchaseToken are required" });
      return;
    }

    const planMapping = await resolvePlanFromProviderProductId("google_play", productId);
    if (!planMapping) {
      logger.warn({ productId }, "Google Play verify-purchase: productId not mapped to any plan");
      res.status(400).json({ error: "Unrecognized product" });
      return;
    }

    const provider = getSubscriptionProvider("google_play");
    let verified;
    try {
      verified = await provider.verifyPurchase({ productId, purchaseToken, userId: req.userId! });
    } catch (err) {
      logger.warn({ tokenRedacted: redactToken(purchaseToken), err: (err as Error).message }, "Google Play purchase verification failed");
      res.status(400).json({ error: "Purchase could not be verified with Google Play" });
      return;
    }

    if (!verified.isActive) {
      res.status(400).json({ error: `Purchase is not active (status: ${verified.rawStatus})` });
      return;
    }

    // Guard against a signed-in user submitting a purchaseToken that
    // belongs to ANOTHER account's existing active subscription — a
    // purchaseToken must only ever be attributable to the account that
    // bought it.
    const [ownedByOther] = await db.select().from(subscriptionsTable).where(
      and(
        eq(subscriptionsTable.provider, "google_play"),
        eq(subscriptionsTable.providerSubscriptionId, purchaseToken)
      )
    );
    if (ownedByOther && ownedByOther.userId !== req.userId) {
      logger.warn({ tokenRedacted: redactToken(purchaseToken) }, "Google Play purchaseToken claimed by a different user — rejecting");
      res.status(409).json({ error: "This purchase is already linked to a different account" });
      return;
    }

    const result = await activatePurchase({
      userId: req.userId!,
      provider: "google_play",
      providerProductId: productId,
      providerSubscriptionId: purchaseToken,
      planKey: planMapping.planKey,
      billingCycle: planMapping.billingCycle,
      expiresAt: verified.expiresAt,
      autoRenew: verified.autoRenewing,
      // A stable, deterministic id for THIS purchase event (not the
      // notification stream) — reusing the purchaseToken itself as the
      // event id means retried verify calls for the same purchase are
      // naturally idempotent without needing a client-supplied nonce.
      eventId: `purchase:${purchaseToken}`,
    });

    // Acknowledge with Google — required within 3 days or Google
    // auto-refunds. Done after activation succeeds so we never acknowledge
    // a purchase we failed to grant.
    acknowledgeGooglePurchase(productId, purchaseToken).catch((err) => {
      logger.error({ err: (err as Error).message, tokenRedacted: redactToken(purchaseToken) }, "Failed to acknowledge Google Play purchase");
    });

    res.json({
      success: true,
      message: result.alreadyProcessed ? "Purchase already verified" : "Subscription activated",
      plan: result.plan,
      expiresAt: result.expiresAt,
      inviteCode: result.inviteCode,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "Google Play verify-purchase failed");
    res.status(500).json({ error: "Failed to verify purchase" });
  }
});

// ─── DELETE: cancel auto-renew for a Google Play subscription ───────────────
// Google's own guidance is that Play Store subscription management is the
// primary supported cancellation UX — this endpoint is a best-effort
// server-side assist for in-app "Cancel" buttons, and always returns a
// deep link the client can fall back to.
router.delete("/payment/google/cancel", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [sub] = await db.select().from(subscriptionsTable)
      .where(and(eq(subscriptionsTable.userId, req.userId!), eq(subscriptionsTable.provider, "google_play"), eq(subscriptionsTable.status, "active")));
    if (!sub || !sub.providerSubscriptionId || !sub.providerProductId) {
      res.status(404).json({ error: "No active Google Play subscription found" });
      return;
    }
    const provider = getSubscriptionProvider("google_play");
    const result = await provider.cancelSubscription({ purchaseToken: sub.providerSubscriptionId, productId: sub.providerProductId });
    await db.update(subscriptionsTable).set({ autoRenew: false }).where(eq(subscriptionsTable.id, sub.id));
    res.json({
      success: true,
      message: "Auto-renew cancelled. Plan stays active until expiry.",
      expiresAt: sub.expiresAt,
      manageUrl: result.manageUrl,
    });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "Google Play cancel failed");
    res.status(500).json({ error: "Failed to cancel auto-renew" });
  }
});

// ─── POST: Google Play Real-time Developer Notifications (RTDN) ────────────
// Pub/Sub push endpoint. Google explicitly documents that Pub/Sub push
// delivery is at-least-once — the same notification MAY arrive more than
// once, which is exactly what subscriptionEngine's per-event idempotency
// (unique on provider+providerEventId) exists to absorb.
//
// Security: verifies the Pub/Sub push request's signed OIDC bearer token
// (proves the request came from Google's Pub/Sub infrastructure for OUR
// push subscription) before trusting the notification body at all. The
// notification body itself only ever carries a purchaseToken + productId —
// we always re-fetch current state from the Play Developer API rather than
// trusting any status Google may have echoed in the notification, so a
// forged/stale notification body can't be used to grant or revoke access
// even if it somehow got past the token check.
router.post("/webhooks/google-play", async (req, res) => {
  const expectedAudience = process.env["GOOGLE_RTDN_WEBHOOK_URL"];
  if (!expectedAudience) {
    logger.error("GOOGLE_RTDN_WEBHOOK_URL not configured — refusing Google Play RTDN webhook");
    res.status(503).json({ error: "Webhook handler not configured" });
    return;
  }

  const authHeader = req.headers["authorization"] as string | undefined;
  const isValid = await verifyGoogleRtdnToken(authHeader, expectedAudience);
  if (!isValid) {
    logger.warn("Google Play RTDN: invalid or missing OIDC bearer token — rejecting");
    res.status(401).json({ error: "Invalid push authentication" });
    return;
  }

  try {
    const body = req.body as { message?: { data?: string; messageId?: string } };
    const messageData = body.message?.data;
    if (!messageData) {
      // Pub/Sub requires a 2xx to stop retrying malformed test/empty pushes.
      res.status(200).json({ ok: true });
      return;
    }

    const notification = decodeRtdnMessage(messageData);
    if (notification.testNotification) {
      logger.info("Google Play RTDN: test notification received");
      res.status(200).json({ ok: true });
      return;
    }

    const subNotif = notification.subscriptionNotification;
    if (!subNotif) {
      res.status(200).json({ ok: true });
      return;
    }

    // Deterministic idempotency key: Pub/Sub's own messageId if present
    // (guaranteed unique per delivery attempt is NOT guaranteed — Pub/Sub
    // may redeliver with the SAME messageId, which is fine, that's exactly
    // what we want deduped), falling back to a composite of the
    // notification's own fields if messageId is somehow absent.
    const eventId = body.message?.messageId
      ?? `${subNotif.purchaseToken}:${subNotif.notificationType}:${notification.eventTimeMillis}`;

    const provider = getSubscriptionProvider("google_play");
    // Always re-fetch current truth from Google rather than trusting
    // whatever the notification type implies — RTDN notification types can
    // arrive out of order or be redundant with the actual current state.
    const state = await provider.getPurchaseState({
      productId: subNotif.subscriptionId,
      purchaseToken: subNotif.purchaseToken,
    });

    switch (subNotif.notificationType) {
      case RTDN_NOTIFICATION_TYPE.SUBSCRIPTION_PURCHASED: {
        const planMapping = await resolvePlanFromProviderProductId("google_play", state.productId);
        if (planMapping) {
          // RTDN purchase notifications typically race with the client's
          // own verify-purchase call; if we don't yet know the userId (no
          // existing row) we skip — the client-driven verify-purchase path
          // is the authoritative activation path since it carries the
          // authenticated userId. This branch mainly exists so this event
          // still gets its idempotency record + logged for observability.
          const [existing] = await db.select().from(subscriptionsTable)
            .where(and(eq(subscriptionsTable.provider, "google_play"), eq(subscriptionsTable.providerSubscriptionId, subNotif.purchaseToken)));
          if (existing) {
            await applyRenewal({ provider: "google_play", providerSubscriptionId: subNotif.purchaseToken, expiresAt: state.expiresAt, eventId });
          }
        }
        break;
      }
      case RTDN_NOTIFICATION_TYPE.SUBSCRIPTION_RENEWED:
      case RTDN_NOTIFICATION_TYPE.SUBSCRIPTION_RECOVERED:
      case RTDN_NOTIFICATION_TYPE.SUBSCRIPTION_RESTARTED:
        await applyRenewal({ provider: "google_play", providerSubscriptionId: subNotif.purchaseToken, expiresAt: state.expiresAt, eventId });
        break;
      case RTDN_NOTIFICATION_TYPE.SUBSCRIPTION_CANCELED:
        // User (or Google) turned off auto-renew — plan stays active until
        // the already-paid expiry; only auto-renew flips off.
        await applyStatusChange({ provider: "google_play", providerSubscriptionId: subNotif.purchaseToken, eventType: "cancelled", newStatus: "cancelled", eventId, downgradeToFree: false });
        break;
      case RTDN_NOTIFICATION_TYPE.SUBSCRIPTION_ON_HOLD:
        await applyStatusChange({ provider: "google_play", providerSubscriptionId: subNotif.purchaseToken, eventType: "on_hold", newStatus: "on_hold", eventId, downgradeToFree: true });
        break;
      case RTDN_NOTIFICATION_TYPE.SUBSCRIPTION_IN_GRACE_PERIOD:
        // Grace period: payment failed but Google is retrying — we keep the
        // plan active per Google's own recommendation (don't punish users
        // for a card that just needs a retry), only flag the state.
        await applyStatusChange({ provider: "google_play", providerSubscriptionId: subNotif.purchaseToken, eventType: "in_grace_period", newStatus: "in_grace_period", eventId, downgradeToFree: false });
        break;
      case RTDN_NOTIFICATION_TYPE.SUBSCRIPTION_PAUSED:
        await applyStatusChange({ provider: "google_play", providerSubscriptionId: subNotif.purchaseToken, eventType: "paused", newStatus: "paused", eventId, downgradeToFree: true });
        break;
      case RTDN_NOTIFICATION_TYPE.SUBSCRIPTION_REVOKED:
        // Revoked = Google is immediately taking back entitlement (e.g.
        // refund/chargeback) — downgrade right away, unlike a plain cancel.
        await applyStatusChange({ provider: "google_play", providerSubscriptionId: subNotif.purchaseToken, eventType: "revoked", newStatus: "revoked", eventId, downgradeToFree: true });
        break;
      case RTDN_NOTIFICATION_TYPE.SUBSCRIPTION_EXPIRED:
        await applyStatusChange({ provider: "google_play", providerSubscriptionId: subNotif.purchaseToken, eventType: "expired", newStatus: "expired", eventId, downgradeToFree: true });
        break;
      case RTDN_NOTIFICATION_TYPE.SUBSCRIPTION_PRICE_CHANGE_CONFIRMED:
      case RTDN_NOTIFICATION_TYPE.SUBSCRIPTION_DEFERRED:
      case RTDN_NOTIFICATION_TYPE.SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED:
        // Informational only for our purposes — still record for audit trail.
        await applyRenewal({ provider: "google_play", providerSubscriptionId: subNotif.purchaseToken, expiresAt: state.expiresAt, eventId }).catch(() => {});
        break;
      default:
        logger.info({ notificationType: subNotif.notificationType }, "Google Play RTDN: unhandled notification type");
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "Google Play RTDN processing failed");
    // Still 200 to avoid Pub/Sub retry storms for a permanently-failing
    // payload (e.g. malformed data) — genuinely transient failures (DB
    // blip) will naturally self-heal on the next real notification for the
    // same subscription (renewal, expiry, etc. all re-fetch current truth).
    res.status(200).json({ ok: false });
  }
});

export default router;
