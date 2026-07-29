import cron from "node-cron";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";
import { sendWinBackEmail } from "../lib/welcome-email";

/**
 * Win-back / re-engagement email — targets users whose LAST daily health
 * score entry was exactly 14 days ago. Using an exact day-match (rather
 * than "14+ days inactive") means each inactive user gets exactly one
 * win-back email per inactive stretch, instead of one every single day
 * they remain inactive — matches the same exact-day-match pattern already
 * used in jobs/expiry-reminders.ts.
 *
 * Only targets users who have logged at least once before (never spams
 * someone who signed up and never engaged at all — a separate onboarding
 * nudge would be the right tool for that, not a "we miss you" email).
 */
export function startWinBackJob() {
  cron.schedule("0 11 * * *", async () => {
    logger.info("[Cron] Running win-back / re-engagement email job...");

    try {
      const result = await pool.query(
        `SELECT u.id, u.email, up.full_name, MAX(d.score_date) AS last_logged
           FROM users u
           JOIN daily_health_scores d ON d.user_id = u.id
           LEFT JOIN user_profiles up ON up.user_id = u.id
          WHERE u.email IS NOT NULL AND u.is_active = true
          GROUP BY u.id, u.email, up.full_name
         HAVING MAX(d.score_date) = (CURRENT_DATE - INTERVAL '14 days')::date::text`
      );

      if (!result.rows.length) {
        logger.info("[Cron] No users hit the 14-day inactivity mark today.");
        return;
      }

      for (const row of result.rows) {
        sendWinBackEmail({ toEmail: row.email, name: row.full_name || "", daysInactive: 14 }).catch(() => {});
      }

      logger.info({ count: result.rows.length }, "[Cron] Win-back emails queued");
    } catch (err) {
      logger.error({ err }, "[Cron] Failed to run win-back job");
    }
  }, {
    timezone: "Asia/Kolkata",
  });
}
