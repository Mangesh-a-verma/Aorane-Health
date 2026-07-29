import cron from "node-cron";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";
import { sendMonthlyHealthSummaryEmail } from "../lib/welcome-email";

/**
 * Monthly Health Summary — individual counterpart to the corporate monthly
 * report (see routes/modules/corporate-report.ts). Sends each active user
 * a recap of their average Health Score for the month that just ended,
 * with a comparison to the month before, and how many days they logged.
 *
 * Runs on the 1st of every month at 8 AM IST (before the corporate report,
 * which runs at 9 AM, so infra load is spread out).
 */
export function startMonthlyHealthSummaryJob() {
  cron.schedule("0 8 1 * *", async () => {
    logger.info("[Cron] Running monthly individual health summary job...");

    try {
      // The month that just ended
      const now = new Date();
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      const lastMonthStart = new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1);
      const prevMonthEnd = new Date(lastMonthStart.getFullYear(), lastMonthStart.getMonth(), 0);
      const prevMonthStart = new Date(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), 1);

      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      const monthLabel = lastMonthStart.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
      const daysInMonth = lastMonthEnd.getDate();

      // Only summarize users who actually logged something last month —
      // no point emailing an empty recap, and it avoids spamming inactive
      // users (they get the separate win-back email instead).
      const result = await pool.query(
        `SELECT u.id, u.email, up.full_name,
                ROUND(AVG(d.health_score)) AS avg_score,
                COUNT(DISTINCT d.score_date) AS days_logged
           FROM daily_health_scores d
           JOIN users u ON u.id = d.user_id
           LEFT JOIN user_profiles up ON up.user_id = u.id
          WHERE d.score_date >= $1 AND d.score_date <= $2
            AND u.email IS NOT NULL
            AND u.is_active = true
          GROUP BY u.id, u.email, up.full_name
          HAVING COUNT(DISTINCT d.score_date) >= 3`,
        [fmt(lastMonthStart), fmt(lastMonthEnd)]
      );

      if (!result.rows.length) {
        logger.info("[Cron] No users with enough activity for a monthly summary.");
        return;
      }

      // Previous month's averages, for the "up/down X pts" comparison
      const prevResult = await pool.query(
        `SELECT user_id, ROUND(AVG(health_score)) AS avg_score
           FROM daily_health_scores
          WHERE score_date >= $1 AND score_date <= $2
          GROUP BY user_id`,
        [fmt(prevMonthStart), fmt(prevMonthEnd)]
      );
      const prevScoreByUser = new Map(prevResult.rows.map((r: any) => [r.user_id, Number(r.avg_score)]));

      let sent = 0;
      for (const row of result.rows) {
        const avgScore = Number(row.avg_score);
        const prevScore = prevScoreByUser.get(row.id);
        const scoreDelta = typeof prevScore === "number" ? avgScore - prevScore : 0;
        sendMonthlyHealthSummaryEmail({
          toEmail: row.email,
          name: row.full_name || "",
          monthLabel,
          avgScore,
          scoreDelta,
          daysLogged: Number(row.days_logged),
          daysInMonth,
        }).catch(() => {});
        sent++;
      }

      logger.info({ count: sent }, "[Cron] Monthly health summary emails queued");
    } catch (err) {
      logger.error({ err }, "[Cron] Failed to run monthly health summary job");
    }
  }, {
    timezone: "Asia/Kolkata",
  });
}
