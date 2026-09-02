/**
 * Push notifications for subscription lifecycle events.
 *
 * Expiry WARNINGS already existed (jobs/expiry-reminders.ts: 7/3/1 days out,
 * plus an auto-renewal heads-up). The two ends of the lifecycle did not: a
 * purchase was confirmed only by email, and an expiry that had already
 * happened was never announced on the phone at all — the user simply found
 * features missing.
 *
 * Both live here rather than inline at each call site because a plan can be
 * activated from five different places (one-time payment, recurring
 * subscription create and verify, and two Razorpay hosted-checkout callbacks),
 * and two of those can fire for the SAME payment.
 */
import { logger } from "./logger";
import { cache } from "./redis";
import { sendExpoPushNotifications, getTokensForUsers } from "../routes/modules/support";
import { todayIST } from "./dateUtils";

/** Human plan label: "max" -> "Max". */
function planLabel(plan?: string | null): string {
  const p = (plan || "premium").trim();
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
}

/**
 * Fires at most once per user, per plan, per IST day.
 *
 * /payment/verify and /payment/rzp-callback can both complete for a single
 * purchase — the callback runs server-side while the app also verifies — so
 * without this the user is congratulated twice for one payment. Redis is
 * already the cache for AI results; reusing it avoids a table for a guard.
 * If Redis is down the guard opens and a duplicate is possible, which is the
 * right way for this to fail: a second thank-you beats a silent purchase.
 */
async function onceToday(key: string): Promise<boolean> {
  const cacheKey = `plan-notify:${key}:${todayIST()}`;
  try {
    if (await cache.get(cacheKey)) return false;
    await cache.set(cacheKey, "1", 36 * 60 * 60); // comfortably past midnight IST
  } catch (err) {
    logger.warn({ err, cacheKey }, "[PlanNotify] Dedupe cache unavailable — sending anyway");
  }
  return true;
}

/** "Your Max plan is active" — sent when a payment actually grants the plan. */
export async function notifyPlanActivated(
  userId: string,
  plan: string,
  expiresAt?: Date | string | null,
): Promise<void> {
  try {
    if (!(await onceToday(`activated:${userId}:${plan}`))) return;

    const tokens = await getTokensForUsers([userId]);
    if (!tokens.length) return;

    const until = expiresAt
      ? new Date(expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
      : null;

    await sendExpoPushNotifications(
      tokens,
      `🎉 ${planLabel(plan)} plan is active!`,
      until
        ? `Everything in ${planLabel(plan)} is unlocked, through ${until}. Enjoy!`
        : `Everything in ${planLabel(plan)} is unlocked. Enjoy!`,
      { type: "plan_activated", plan, screen: "/upgrade" },
    );
  } catch (err) {
    // Never let a notification failure affect a payment response.
    logger.warn({ err, userId, plan }, "[PlanNotify] Failed to send plan-activated push");
  }
}

/** "Your Max plan has ended" — sent by the nightly expiry job, after the downgrade. */
export async function notifyPlansExpired(
  expired: Array<{ userId: string; plan: string }>,
): Promise<void> {
  if (!expired.length) return;
  try {
    // One send per plan, so the copy can name it, but still a single Expo call
    // per group rather than one per user.
    const byPlan = new Map<string, string[]>();
    for (const e of expired) {
      if (!(await onceToday(`expired:${e.userId}`))) continue;
      byPlan.set(e.plan, [...(byPlan.get(e.plan) ?? []), e.userId]);
    }

    for (const [plan, userIds] of byPlan) {
      const tokens = await getTokensForUsers(userIds);
      if (!tokens.length) continue;
      await sendExpoPushNotifications(
        tokens,
        `Your ${planLabel(plan)} plan has ended`,
        `You're back on the Free plan. Your data is safe — renew any time to unlock ${planLabel(plan)} again.`,
        { type: "plan_expired", plan, screen: "/upgrade" },
      );
    }
  } catch (err) {
    logger.warn({ err, count: expired.length }, "[PlanNotify] Failed to send plan-expired pushes");
  }
}

/** Rows the expiry job already has in hand, shaped for notifyPlansExpired. */
export function expiredRowsToNotifications(
  rows: Array<{ user_id: string; plan: string }>,
): Array<{ userId: string; plan: string }> {
  return rows.map((r) => ({ userId: r.user_id, plan: r.plan }));
}
