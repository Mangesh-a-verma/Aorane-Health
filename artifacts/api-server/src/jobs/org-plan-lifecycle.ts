import cron from "node-cron";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";
import { notifyPlansExpired } from "../lib/planNotify";
import { invalidateUserPlanCache } from "../middlewares/user-auth";
import { ORG_PLAN_GRACE_DAYS } from "../routes/modules/business";

/**
 * Org plan lifecycle — the org-level counterpart to subscription-expiry.
 *
 * subscription-expiry handles a subscription reaching its own expires_at. It
 * cannot handle this case: when an ORGANIZATION stops paying, its employees'
 * subscription rows still carry a far-future expires_at (a year out, or the
 * code's validityDays), so nothing expires them and the whole company keeps
 * a paid tier indefinitely. This job is what closes that.
 *
 * Employees get ORG_PLAN_GRACE_DAYS before losing anything, because the lapse
 * is the organization's and not theirs — see the constant's own comment.
 *
 * State is recomputed from org_payments every run rather than advanced
 * step-by-step, so a missed run (Render's free tier sleeps) self-corrects on
 * the next one instead of leaving orgs stranded mid-transition.
 */

type State = "active" | "grace" | "expired";

const STATE_SQL = `
  SELECT o.id,
         o.name,
         o.plan                       AS org_plan,
         COALESCE(o.plan_status, 'active') AS stored_status,
         CASE
           WHEN MAX(p.window_end) > NOW() THEN 'active'
           WHEN MAX(p.window_end) > NOW() - ($1 || ' days')::interval THEN 'grace'
           ELSE 'expired'
         END AS state
    FROM organizations o
    LEFT JOIN LATERAL (
      SELECT COALESCE(op.expires_at, op.next_renewal_at, '-infinity'::timestamptz) AS window_end
        FROM org_payments op
       WHERE op.org_id = o.id AND op.status = 'success'
    ) p ON TRUE
   WHERE o.is_active
   GROUP BY o.id, o.name, o.plan, o.plan_status`;

/** org.plan is basic | pro | max; legacy "basic" was the old starter tier and
 *  maps to max, matching what /business/enroll grants. */
function orgTierToUserPlan(orgPlan: string | null): "pro" | "max" {
  return orgPlan === "pro" ? "pro" : "max";
}

export async function runOrgPlanLifecycle(): Promise<void> {
  const { rows: orgs } = await pool.query<{
    id: string; name: string; org_plan: string | null; stored_status: string; state: State;
  }>(STATE_SQL, [ORG_PLAN_GRACE_DAYS]);

  let enteredGrace = 0, expired = 0, restored = 0, downgradedMembers = 0, restoredMembers = 0;

  for (const org of orgs) {
    const changed = org.stored_status !== org.state;

    if (org.state === "expired") {
      // Downgrade only subscriptions this organization granted. A member who
      // also bought their own plan keeps it — their purchase has nothing to do
      // with their employer's lapse.
      const { rows: dropped } = await pool.query<{ user_id: string; plan: string }>(
        `UPDATE subscriptions s
            SET status = 'expired', updated_at = NOW()
           FROM org_members m
          WHERE m.org_id = $1
            AND m.user_id = s.user_id
            AND m.is_active
            AND s.source = 'organization'
            AND s.status = 'active'
        RETURNING s.user_id, s.plan`,
        [org.id],
      );
      if (dropped.length) {
        const ids = dropped.map((d) => d.user_id);
        // Only demote users who have no OTHER active subscription left, so a
        // member with their own paid plan is not dropped to free.
        await pool.query(
          `UPDATE users u SET plan = 'free', updated_at = NOW()
            WHERE u.id = ANY($1)
              AND NOT EXISTS (SELECT 1 FROM subscriptions s2
                               WHERE s2.user_id = u.id AND s2.status = 'active')`,
          [ids],
        );
        for (const id of ids) invalidateUserPlanCache(id).catch(() => {});
        downgradedMembers += dropped.length;
        notifyPlansExpired(dropped.map((d) => ({ userId: d.user_id, plan: d.plan }))).catch(() => {});
      }
      if (changed) expired++;
    }

    if (org.state === "active" && org.stored_status !== "active") {
      // The org paid again. Members downgraded (or never granted a plan because
      // they joined while the org was lapsed) are put back on the org's tier.
      // Without this, restoring an organization would silently leave its staff
      // on Free and every one of them would have to re-enter a code.
      const tier = orgTierToUserPlan(org.org_plan);
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      // Two distinct populations, and missing the second one was a real gap:
      //   a) members downgraded by an earlier run — they still have an
      //      'expired' organization subscription to reactivate;
      //   b) members who JOINED while the org was lapsed — enrolment gave them
      //      no subscription row at all, so there is nothing to reactivate and
      //      they would sit on Free forever after the org renewed.
      const { rows: reactivated } = await pool.query<{ user_id: string }>(
        `UPDATE subscriptions s
            SET status = 'active', plan = $2, updated_at = NOW()
           FROM org_members m
          WHERE m.org_id = $1
            AND m.user_id = s.user_id
            AND m.is_active
            AND s.source = 'organization'
            AND s.status = 'expired'
        RETURNING s.user_id`,
        [org.id, tier],
      );
      const { rows: granted } = await pool.query<{ user_id: string }>(
        `INSERT INTO subscriptions (user_id, plan, status, source, expires_at, payment_type, auto_renew, next_renewal_at)
         SELECT m.user_id, $2, 'active', 'organization', $3, 'one_time', false, $3
           FROM org_members m
          WHERE m.org_id = $1
            AND m.is_active
            AND NOT EXISTS (
              SELECT 1 FROM subscriptions s
               WHERE s.user_id = m.user_id AND s.source = 'organization' AND s.status = 'active')
         RETURNING user_id`,
        [org.id, tier, expiresAt],
      );

      const ids = [...new Set([...reactivated, ...granted].map((r) => r.user_id))];
      if (ids.length) {
        // Only lift users who are not already on something better of their
        // own; a member who bought Max themselves must not be pushed down to
        // the org's Pro.
        await pool.query(
          `UPDATE users SET plan = $2, updated_at = NOW()
            WHERE id = ANY($1) AND plan = 'free'`,
          [ids, tier],
        );
        for (const id of ids) invalidateUserPlanCache(id).catch(() => {});
        restoredMembers += ids.length;
      }
      if (changed) restored++;
    }

    if (org.state === "grace" && changed) enteredGrace++;

    if (changed) {
      await pool.query(`UPDATE organizations SET plan_status = $2, updated_at = NOW() WHERE id = $1`,
        [org.id, org.state]);
      logger.info({ orgId: org.id, org: org.name, from: org.stored_status, to: org.state },
        "[OrgPlanLifecycle] Organization plan state changed");
    }
  }

  logger.info(
    { orgsChecked: orgs.length, enteredGrace, expired, restored, downgradedMembers, restoredMembers },
    "[OrgPlanLifecycle] Run complete",
  );
}

export function startOrgPlanLifecycleJob(): void {
  // 00:30 IST — after subscription-expiry (00:00) so individual expiries have
  // already settled and this only has org-driven changes left to make.
  cron.schedule("30 0 * * *", () => {
    logger.info("[Cron] Running org plan lifecycle check...");
    runOrgPlanLifecycle().catch((err) => {
      logger.error({ err }, "[Cron] Org plan lifecycle job failed");
    });
  }, { timezone: "Asia/Kolkata" });
}
