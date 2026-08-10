import { Router } from "express";
import { pool } from "@workspace/db";
import { verifyWebhookSignature } from "../../lib/razorpay";
import { createAdminNotif } from "../../lib/notify-admin";
import { cache } from "../../lib/redis"; // Added: Redis import for idempotency
import type { Request, Response } from "express";
import { logger } from "../../lib/logger";
import { sendPaymentFailedEmail, sendCorporatePaymentFailedEmail } from "../../lib/welcome-email";

const router = Router();

function formatPlanName(plan: string | null | undefined): string {
  if (!plan) return "Premium";
  return plan.charAt(0).toUpperCase() + plan.slice(1).toLowerCase();
}

// Razorpay webhook — handles subscription events (auto-recurring)
router.post("/webhooks/razorpay", async (req: Request, res: Response) => {
  const webhookSecret = process.env["RAZORPAY_WEBHOOK_SECRET"];
  const signature = req.headers["x-razorpay-signature"] as string;
  const eventId = req.headers["x-razorpay-event-id"] as string; // Added: capture the event ID

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

  // C2: Use raw bytes (Buffer)
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

  // --- FIX H-5: Idempotency Check (Duplicate Webhook Blocker) ---
  if (eventId) {
    const alreadyProcessed = await cache.get(`webhook_event:${eventId}`);
    if (alreadyProcessed) {
      logger.info({ eventId }, "Duplicate webhook ignored (Idempotency check passed)");
      res.json({ success: true, message: "Event already processed" });
      return;
    }
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
      refund?: { entity?: { id?: string; payment_id?: string; amount?: number; status?: string } };
    };
  };

  const event = parsedBody as WebhookBody;
  const eventType = event.event || "";
  const subEntity = event.payload?.subscription?.entity;
  const paymentEntity = event.payload?.payment?.entity;
  const refundEntity = event.payload?.refund?.entity;

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

      // Extend org subscriptions
      await pool.query(
        `UPDATE org_payments SET next_renewal_at = $1, status = 'success'
         WHERE razorpay_subscription_id = $2`,
        [nextRenewalDate, subscriptionId]
      ).catch((e: Error) => logger.warn({ err: e.message }, "org_payment update failed"));

      // Keep user plan active
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
      // Look up who is affected BEFORE downgrading, so we can notify them.
      // A given razorpay_subscription_id belongs to exactly one of these two
      // tables — try individual first, then org.
      try {
        const userRow = await pool.query(
          `SELECT u.email, up.full_name AS "name", s.plan
             FROM subscriptions s
             JOIN users u ON u.id = s.user_id
             LEFT JOIN user_profiles up ON up.user_id = u.id
            WHERE s.razorpay_subscription_id = $1
            LIMIT 1`,
          [subEntity.id]
        );
        if (userRow.rows[0]?.email) {
          const { email, name, plan } = userRow.rows[0];
          sendPaymentFailedEmail({ toEmail: email, name: name || "", planName: formatPlanName(plan) }).catch(() => {});
        } else {
          const orgRow = await pool.query(
            `SELECT oa.email, oa.full_name AS "adminName", o.name AS "orgName", op.plan
               FROM org_payments op
               JOIN organizations o ON o.id = op.org_id
               JOIN org_admins oa ON oa.org_id = o.id
              WHERE op.razorpay_subscription_id = $1
              LIMIT 1`,
            [subEntity.id]
          );
          if (orgRow.rows[0]?.email) {
            const { email, adminName, orgName, plan } = orgRow.rows[0];
            sendCorporatePaymentFailedEmail({ toEmail: email, adminName: adminName || "", orgName, planName: formatPlanName(plan) }).catch(() => {});
          }
        }
      } catch (e) {
        logger.warn({ err: (e as Error).message }, "Failed to look up user/org for payment-failed email — downgrade will still proceed");
      }

      await pool.query(
        `UPDATE subscriptions SET status = 'expired', auto_renew = FALSE, updated_at = NOW()
         WHERE razorpay_subscription_id = $1`,
        [subEntity.id]
      ).catch(() => {});
      await pool.query(
        `UPDATE org_payments SET auto_renew = FALSE WHERE razorpay_subscription_id = $1`,
        [subEntity.id]
      ).catch(() => {});
      
      await pool.query(
        `UPDATE users SET plan = 'free', updated_at = NOW() 
         WHERE id = (SELECT user_id FROM subscriptions WHERE razorpay_subscription_id = $1 LIMIT 1)`,
        [subEntity.id]
      ).catch(() => {});
    }

    if (eventType === "refund.processed" && refundEntity?.payment_id) {
      const rzPaymentId = refundEntity.payment_id;

      // Try individual-app payment first
      const indivPay = await pool.query(
        `UPDATE payments SET status = 'refunded', updated_at = NOW()
         WHERE razorpay_payment_id = $1 AND status != 'refunded'
         RETURNING user_id, plan`,
        [rzPaymentId]
      ).catch(() => ({ rows: [] as { user_id: string; plan: string }[] }));

      if (indivPay.rows.length > 0) {
        const { user_id, plan } = indivPay.rows[0];
        // Deactivate their subscription and downgrade to free — a refund
        // means the service should no longer be entitled, same as expiry.
        await pool.query(
          `UPDATE subscriptions SET status = 'cancelled', auto_renew = FALSE, updated_at = NOW()
           WHERE user_id = $1 AND status = 'active'`,
          [user_id]
        ).catch(() => {});
        await pool.query(
          `UPDATE users SET plan = 'free', updated_at = NOW() WHERE id = $1`,
          [user_id]
        ).catch(() => {});
        createAdminNotif(
          "refund_processed",
          `↩️ Refund processed — individual user`,
          `Payment ${rzPaymentId} (${plan} plan) refunded. User downgraded to free.`,
          { razorpayPaymentId: rzPaymentId, userId: user_id, plan }
        ).catch(() => {});
      } else {
        // Try org (business portal) payment
        const orgPay = await pool.query(
          `UPDATE org_payments SET status = 'refunded'
           WHERE razorpay_payment_id = $1 AND status != 'refunded'
           RETURNING org_id, plan`,
          [rzPaymentId]
        ).catch(() => ({ rows: [] as { org_id: string; plan: string }[] }));
        if (orgPay.rows.length > 0) {
          const { org_id, plan } = orgPay.rows[0];
          await pool.query(
            `UPDATE organizations SET is_verified = FALSE, updated_at = NOW() WHERE id = $1`,
            [org_id]
          ).catch(() => {});
          createAdminNotif(
            "refund_processed",
            `↩️ Refund processed — organization`,
            `Org payment ${rzPaymentId} (${plan} plan) refunded. Org access suspended pending manual review.`,
            { razorpayPaymentId: rzPaymentId, orgId: org_id, plan }
          ).catch(() => {});
        } else {
          // Neither table matched — this is exactly the kind of gap the
          // reconciliation job (jobs/payment-reconciliation.ts) also guards
          // against, but flag it immediately too since we're already here.
          logger.warn({ rzPaymentId }, "[Webhook] refund.processed for unknown payment — no matching local record");
          createAdminNotif(
            "refund_processed",
            `⚠️ Refund for unknown payment`,
            `Razorpay refunded payment ${rzPaymentId} but no matching local record was found.`,
            { razorpayPaymentId: rzPaymentId }
          ).catch(() => {});
        }
      }
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
      
      await pool.query(
        `UPDATE users SET plan = 'free', updated_at = NOW() 
         WHERE id = (SELECT user_id FROM subscriptions WHERE razorpay_subscription_id = $1 LIMIT 1)`,
        [subEntity.id]
      ).catch(() => {});
    }

    // Added: after successful processing, save the event ID in cache (for 7 days)
    if (eventId) {
      await cache.set(`webhook_event:${eventId}`, "processed", 7 * 24 * 3600);
    }

    res.json({ success: true, event: eventType });
  } catch (err) {
    logger.error({ err }, "Webhook processing error");
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

export default router;