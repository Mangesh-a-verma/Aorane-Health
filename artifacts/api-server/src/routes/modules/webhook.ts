import { Router } from "express";
import { pool } from "@workspace/db";
import { verifyWebhookSignature } from "../../lib/razorpay";
import { createAdminNotif } from "../../lib/notify-admin";
import type { Request, Response } from "express";
import { logger } from "../../lib/logger";

const router = Router();

// Razorpay webhook — handles subscription events (auto-recurring)
// SECURITY-FIX C1+C2: Signature is now MANDATORY. Raw body buffer is mounted in app.ts
// via express.raw() — DO NOT use JSON.stringify(req.body) (key ordering differs from
// the bytes Razorpay actually signed, causing valid webhooks to fail verification).
router.post("/webhooks/razorpay", async (req: Request, res: Response) => {
  const webhookSecret = process.env["RAZORPAY_WEBHOOK_SECRET"];
  const signature = req.headers["x-razorpay-signature"] as string;

  // C1: Secret must be configured in production
  if (!webhookSecret) {
    logger.error("RAZORPAY_WEBHOOK_SECRET not configured — refusing webhook");
    res.status(503).json({ error: "Webhook handler not configured" });
    return;
  }

  // C1: Signature header is mandatory
  if (!signature) {
    logger.warn("Razorpay webhook missing x-razorpay-signature header");
    res.status(400).json({ error: "Missing signature" });
    return;
  }

  // C2: Use raw bytes (Buffer) — express.raw() middleware in app.ts puts the
  // original payload bytes into req.body as a Buffer for this route only.
  const rawBuffer = req.body as unknown as Buffer;
  if (!Buffer.isBuffer(rawBuffer)) {
    logger.error("Webhook body is not a Buffer — express.raw() not mounted?");
    res.status(500).json({ error: "Internal config error" });
    return;
  }
  const rawBody = rawBuffer.toString("utf8");

  const valid = verifyWebhookSignature(rawBody, signature, webhookSecret);
  if (!valid) {
    logger.warn({ signaturePrefix: signature.slice(0, 8) }, "Invalid Razorpay webhook signature");
    res.status(400).json({ error: "Invalid webhook signature" });
    return;
  }

  // Parse the verified raw body for downstream handlers
  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }

  type WebhookBody = {
    event: string;
    payload?: {
      subscription?: { entity?: { id?: string; plan_id?: string; status?: string; current_end?: number } };
      payment?: { entity?: { id?: string; amount?: number; subscription_id?: string } };
    };
  };

  const event = parsedBody as WebhookBody;
  const eventType = event.event || "";
  const subEntity = event.payload?.subscription?.entity;
  const paymentEntity = event.payload?.payment?.entity;

  try {
    if (eventType === "subscription.charged" && subEntity?.id) {
      const subscriptionId = subEntity.id;
      const nextRenewalDate = subEntity.current_end
        ? new Date(subEntity.current_end * 1000)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      // Extend individual user subscriptions
      await pool.query(
        `UPDATE subscriptions SET expires_at = $1, next_renewal_at = $1, status = 'active', updated_at = NOW()
         WHERE razorpay_subscription_id = $2`,
        [nextRenewalDate, subscriptionId]
      ).catch((e: Error) => logger.warn({ err: e.message }, "subscription update failed"));

      // Extend org subscriptions (no updated_at column)
      await pool.query(
        `UPDATE org_payments SET next_renewal_at = $1, status = 'success'
         WHERE razorpay_subscription_id = $2`,
        [nextRenewalDate, subscriptionId]
      ).catch((e: Error) => logger.warn({ err: e.message }, "org_payment update failed"));

      // Keep user plan active
      // BUG-FIX B5: COALESCE prevents NULL plan if subscription record missing/deleted.
      // Also only update when subquery actually returns a row (subquery in WHERE).
      await pool.query(
        `UPDATE users
           SET plan = COALESCE(
                       (SELECT plan FROM subscriptions WHERE razorpay_subscription_id = $1 LIMIT 1),
                       plan
                     ),
               updated_at = NOW()
           WHERE id = (SELECT user_id FROM subscriptions WHERE razorpay_subscription_id = $1 LIMIT 1)`,
        [subscriptionId]
      ).catch((e: Error) => logger.warn({ err: e.message }, "user plan update failed"));

      // ── Admin notification ────────────────────────────────────────────────
      const amtPaise = paymentEntity?.amount ?? 0;
      const amtLabel = amtPaise ? `₹${Math.round(amtPaise / 100)}` : "";
      createAdminNotif(
        "new_payment",
        `💳 Subscription Payment${amtLabel ? ` — ${amtLabel}` : ""}`,
        `Subscription renewed · ${subscriptionId}`,
        { subscriptionId, amountPaise: amtPaise }
      ).catch(() => {});
    }

    if (eventType === "subscription.halted" && subEntity?.id) {
      await pool.query(
        `UPDATE subscriptions SET status = 'expired', auto_renew = FALSE, updated_at = NOW()
         WHERE razorpay_subscription_id = $1`,
        [subEntity.id]
      ).catch(() => {});
      await pool.query(
        `UPDATE org_payments SET auto_renew = FALSE WHERE razorpay_subscription_id = $1`,
        [subEntity.id]
      ).catch(() => {});
    }

    if (eventType === "subscription.cancelled" && subEntity?.id) {
      await pool.query(
        `UPDATE subscriptions SET auto_renew = FALSE, updated_at = NOW()
         WHERE razorpay_subscription_id = $1`,
        [subEntity.id]
      ).catch(() => {});
      await pool.query(
        `UPDATE org_payments SET auto_renew = FALSE WHERE razorpay_subscription_id = $1`,
        [subEntity.id]
      ).catch(() => {});
    }

    if (eventType === "subscription.completed" && subEntity?.id) {
      await pool.query(
        `UPDATE subscriptions SET auto_renew = FALSE, status = 'expired', updated_at = NOW()
         WHERE razorpay_subscription_id = $1`,
        [subEntity.id]
      ).catch(() => {});
    }

    res.json({ success: true, event: eventType });
  } catch (err) {
    logger.error({ err }, "Webhook processing error");
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

export default router;
