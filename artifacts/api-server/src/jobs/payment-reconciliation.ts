import cron from "node-cron";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";
import { fetchCapturedPayments, isLiveMode } from "../lib/razorpay";
import { createAdminNotif } from "../lib/notify-admin";

/**
 * ISSUE 1 FIX: Payment ↔ Razorpay reconciliation.
 *
 * Why this exists: our /payment/verify and /business/billing/verify handlers
 * only mark a payment "success" if the CLIENT calls back after paying (or the
 * webhook fires). If the app crashes, the network drops, or a webhook delivery
 * is lost, Razorpay can show a payment as "captured" (money taken) while our
 * own DB still shows it "pending" or missing entirely — the exact "paisa kata,
 * service nahi mili" scenario. This job catches that gap within 24h instead of
 * waiting for the customer to complain.
 *
 * This job does NOT auto-activate anything (activating a plan from money
 * movement alone, without our own signature-verified flow, would reintroduce
 * a different risk). It only DETECTS mismatches and raises an admin alert so
 * a human can resolve each case (activate manually, or refund).
 */
export function startPaymentReconciliationJob() {
  // Roz raat 2:00 AM (Asia/Kolkata) — subscription-expiry (midnight) ke baad
  cron.schedule("0 2 * * *", async () => {
    if (!isLiveMode()) {
      logger.info("[Reconciliation] Skipped — not in live mode");
      return;
    }
    logger.info("[Reconciliation] Running daily Razorpay↔DB reconciliation...");
    try {
      const to = Math.floor(Date.now() / 1000);
      const from = to - 26 * 3600; // last 26h window (1h overlap safety margin)

      const rzPayments = await fetchCapturedPayments(from, to);
      if (rzPayments.length === 0) {
        logger.info("[Reconciliation] No captured payments from Razorpay in window");
        return;
      }

      const rzIds = rzPayments.map(p => p.id);

      // Individual-app payments
      const localIndividual = await pool.query(
        `SELECT razorpay_payment_id, status FROM payments WHERE razorpay_payment_id = ANY($1)`,
        [rzIds]
      );
      // Business-portal payments
      const localOrg = await pool.query(
        `SELECT razorpay_payment_id, status FROM org_payments WHERE razorpay_payment_id = ANY($1)`,
        [rzIds]
      );

      const knownIds = new Set<string>([
        ...localIndividual.rows.map((r: { razorpay_payment_id: string }) => r.razorpay_payment_id),
        ...localOrg.rows.map((r: { razorpay_payment_id: string }) => r.razorpay_payment_id),
      ]);
      const localStatusById = new Map<string, string>();
      for (const r of [...localIndividual.rows, ...localOrg.rows] as { razorpay_payment_id: string; status: string }[]) {
        localStatusById.set(r.razorpay_payment_id, r.status);
      }

      const orphaned: RazorpayPaymentEntitySlim[] = [];
      const mismatched: RazorpayPaymentEntitySlim[] = [];

      for (const p of rzPayments) {
        if (!knownIds.has(p.id)) {
          orphaned.push({ id: p.id, amount: p.amount, email: p.email });
        } else if (localStatusById.get(p.id) !== "success") {
          mismatched.push({ id: p.id, amount: p.amount, email: p.email });
        }
      }

      if (orphaned.length > 0 || mismatched.length > 0) {
        logger.error(
          { orphanedCount: orphaned.length, mismatchedCount: mismatched.length, orphaned, mismatched },
          "[Reconciliation] MISMATCH FOUND — Razorpay shows captured payment(s) our DB doesn't reflect as success"
        );
        await createAdminNotif(
          "reconciliation_mismatch",
          `⚠️ Payment reconciliation mismatch — ${orphaned.length + mismatched.length} payment(s)`,
          `${orphaned.length} orphaned (no local record), ${mismatched.length} status-mismatched. Check Razorpay dashboard and activate/refund manually.`,
          { orphaned, mismatched }
        ).catch(() => {});
      } else {
        logger.info({ checked: rzPayments.length }, "[Reconciliation] All captured payments matched — no action needed");
      }
    } catch (err) {
      logger.error({ err }, "[Reconciliation] Job failed to run");
    }
  }, { timezone: "Asia/Kolkata" });
}

interface RazorpayPaymentEntitySlim {
  id: string;
  amount: number;
  email?: string;
}
