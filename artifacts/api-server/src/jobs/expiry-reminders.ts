import cron from "node-cron";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";
import { sendExpiryReminderEmail, sendRenewalUpcomingEmail } from "../lib/welcome-email";

// FIX 4: Push notification sender — Expo Push Notifications
// Aapke existing push token infrastructure se connect karta hai
async function sendPushNotification(userId: string, title: string, body: string): Promise<void> {
  try {
    // Users ke push tokens fetch karo DB se
    const result = await pool.query(
      `SELECT push_token FROM user_device_tokens WHERE user_id = $1 AND is_active = true`,
      [userId]
    );
    if (result.rows.length === 0) return;

    const tokens = result.rows.map((r: any) => r.push_token).filter(Boolean);
    if (tokens.length === 0) return;

    // Expo Push API
    const messages = tokens.map((token: string) => ({
      to: token,
      sound: "default",
      title,
      body,
      data: { type: "subscription_reminder", userId },
    }));

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      logger.warn({ userId, status: response.status }, "[PushNotif] Expo push API error");
    } else {
      logger.info({ userId, tokenCount: tokens.length }, "[PushNotif] Sent successfully");
    }
  } catch (err) {
    logger.error({ err, userId }, "[PushNotif] Failed to send push notification");
  }
}

export function startExpiryReminderJob() {
  // Roz subah 10:00 AM chalega (Asia/Kolkata time)
  cron.schedule("0 10 * * *", async () => {
    logger.info("[Cron] Running daily expiry reminders check...");

    try {
      // FIX 4: Correct daysLeft calculation using proper date diff
      // Pehle wale code mein getDate() se sirf din nikal raha tha — month/year ignore ho raha tha
      const result = await pool.query(`
        SELECT s.user_id, u.phone, u.email, up.full_name, u.plan, s.expires_at,
          EXTRACT(DAY FROM (s.expires_at::date - CURRENT_DATE)) AS days_left
        FROM subscriptions s
        JOIN users u ON s.user_id = u.id
        LEFT JOIN user_profiles up ON up.user_id = u.id
        WHERE s.status = 'active'
          AND s.auto_renew = false
          AND (
            DATE(s.expires_at) = CURRENT_DATE + INTERVAL '7 days'
            OR DATE(s.expires_at) = CURRENT_DATE + INTERVAL '3 days'
            OR DATE(s.expires_at) = CURRENT_DATE + INTERVAL '1 day'
          )
      `);

      const usersToRemind = result.rows;

      if (usersToRemind.length > 0) {
        for (const user of usersToRemind) {
          const daysLeft = parseInt(user.days_left, 10);
          const planName = (user.plan || "Premium").toUpperCase();

          // FIX 4: Meaningful, action-oriented messages
          let title: string;
          let message: string;

          if (daysLeft <= 1) {
            title = `⚠️ ${planName} Plan expires TODAY!`;
            message = `Your Aorane ${planName} plan expires today. Renew now to keep enjoying premium features!`;
          } else if (daysLeft <= 3) {
            title = `⏰ ${planName} Plan: ${daysLeft} days left`;
            message = `Your Aorane ${planName} plan expires in ${daysLeft} days. Renew now to keep your health monitoring uninterrupted!`;
          } else {
            title = `📅 ${planName} Plan renewal reminder`;
            message = `Your Aorane ${planName} plan expires in ${daysLeft} days. Renew in time to avoid any interruption!`;
          }

          logger.info({ userId: user.user_id, daysLeft, plan: user.plan }, "[Cron] Sending expiry reminder");

          // FIX 4: Actually send the push notification
          await sendPushNotification(user.user_id, title, message);

          // Also send an email — push notifications are frequently missed or
          // disabled, email is a more reliable channel for renewal reminders.
          if (user.email) {
            const expiryDateStr = new Date(user.expires_at).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
            sendExpiryReminderEmail({
              toEmail: user.email,
              name: user.full_name || "",
              planName: (user.plan || "Premium").charAt(0).toUpperCase() + (user.plan || "Premium").slice(1).toLowerCase(),
              daysLeft,
              expiryDateStr,
            }).catch(() => {});
          }
        }

        logger.info({ count: usersToRemind.length }, "[Cron] Expiry reminders sent");
      } else {
        logger.info("[Cron] No users expiring in 1, 3, or 7 days found today.");
      }
    } catch (err) {
      logger.error({ err }, "[Cron] Failed to run expiry reminders job");
    }
  }, {
    timezone: "Asia/Kolkata",
  });

  // FIX 4: Auto-debit (subscription.charged) reminder — 3 din pehle warn karo
  // Yeh webhook se handle hota hai (subscription.charged event), lekin
  // agar webhook miss ho toh yeh cron backup ka kaam karta hai.
  cron.schedule("0 9 * * *", async () => {
    logger.info("[Cron] Running auto-debit upcoming reminders...");
    try {
      const result = await pool.query(`
        SELECT s.user_id, u.phone, u.email, up.full_name, u.plan, s.next_renewal_at,
          EXTRACT(DAY FROM (s.next_renewal_at::date - CURRENT_DATE)) AS days_to_renewal
        FROM subscriptions s
        JOIN users u ON s.user_id = u.id
        LEFT JOIN user_profiles up ON up.user_id = u.id
        WHERE s.status = 'active'
          AND s.auto_renew = true
          AND s.razorpay_subscription_id IS NOT NULL
          AND DATE(s.next_renewal_at) = CURRENT_DATE + INTERVAL '3 days'
      `);

      for (const user of result.rows) {
        const planName = (user.plan || "Premium").toUpperCase();
        await sendPushNotification(
          user.user_id,
          `🔄 Auto-renewal in 3 days`,
          `Your Aorane ${planName} plan will auto-renew in 3 days. Please make sure your payment method has sufficient balance!`
        );
        if (user.email) {
          sendRenewalUpcomingEmail({
            toEmail: user.email,
            name: user.full_name || "",
            planName: (user.plan || "Premium").charAt(0).toUpperCase() + (user.plan || "Premium").slice(1).toLowerCase(),
          }).catch(() => {});
        }
        logger.info({ userId: user.user_id }, "[Cron] Auto-debit upcoming reminder sent");
      }
    } catch (err) {
      logger.error({ err }, "[Cron] Failed to run auto-debit reminder job");
    }
  }, {
    timezone: "Asia/Kolkata",
  });
}