import cron from "node-cron";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger"; 
import { sendSubscriptionExpiredEmail } from "../lib/welcome-email";

export function startSubscriptionExpiryJob() {
  // Runs daily at 12:00 AM (Asia/Kolkata time)
  cron.schedule("0 0 * * *", async () => {
    logger.info("[Cron] Running daily subscription expiry check...");
    
    try {
      // 1. Mark all active plans whose expiry date has passed as 'expired'
      const result = await pool.query(`
        UPDATE subscriptions 
        SET status = 'expired', updated_at = NOW() 
        WHERE status = 'active' AND expires_at < NOW() 
        RETURNING user_id, plan
      `);

      const expiredUserIds = result.rows.map((row: any) => row.user_id);

      if (expiredUserIds.length > 0) {
        // 2. Downgrade all those users' plan to 'free'
        await pool.query(`
          UPDATE users 
          SET plan = 'free', updated_at = NOW() 
          WHERE id = ANY($1)
        `, [expiredUserIds]);

        // 3. Send confirmation emails (best-effort, doesn't block the downgrade)
        try {
          const contacts = await pool.query(
            `SELECT u.id, u.email, up.full_name
               FROM users u
               LEFT JOIN user_profiles up ON up.user_id = u.id
              WHERE u.id = ANY($1) AND u.email IS NOT NULL`,
            [expiredUserIds]
          );
          const planByUserId = new Map(result.rows.map((r: any) => [r.user_id, r.plan]));
          for (const c of contacts.rows) {
            const plan = (planByUserId.get(c.id) as string) || "Premium";
            const planName = plan.charAt(0).toUpperCase() + plan.slice(1).toLowerCase();
            sendSubscriptionExpiredEmail({ toEmail: c.email, name: c.full_name || "", planName }).catch(() => {});
          }
        } catch (emailErr) {
          logger.warn({ err: emailErr }, "[Cron] Failed to send some subscription-expired emails");
        }

        logger.info({ count: expiredUserIds.length }, "[Cron] Successfully downgraded expired users to free plan");
      } else {
        logger.info("[Cron] No expired subscriptions found today.");
      }
    } catch (err) {
      logger.error({ err }, "[Cron] Failed to run subscription expiry job");
    }
  }, {
    timezone: "Asia/Kolkata"
  });
}