/**
 * DELETE ACCOUNT — POST /users/delete-account  (requireAuth)
 *
 * Fix: @supabase/supabase-js removed — not installed in api-server.
 * Storage cleanup is handled via SQL CASCADE (all child tables have
 * ON DELETE CASCADE on user_id). Profile photo URL is nulled out.
 * Supabase Storage file purge can be added later as a background job.
 */

import { Router } from "express";
import { pool, db, otpStoreTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { verifyOtpHash, emailOtpKey } from "../../lib/otp";
import { sendAccountDeletedEmail } from "../../lib/welcome-email";
import { cache } from "../../lib/redis";
import { requireAuth } from "../../middlewares/user-auth";
import type { AuthRequest } from "../../middlewares/user-auth";
import { logger } from "../../lib/logger";

const router = Router();

// ─── Helper: validate OTP (phone or email) ───────────────────────────────────

async function validateDeletionOtp(
  otp: string,
  identifier: string
): Promise<{ valid: boolean; reason?: string }> {
  // 1. Check DB-stored OTP
  try {
    const rows = await db
      .select()
      .from(otpStoreTable)
      .where(
        and(
          eq(otpStoreTable.phone, identifier),
          gt(otpStoreTable.expiresAt, new Date())
        )
      )
      .limit(1);

    if (rows.length > 0) {
      if (!verifyOtpHash(otp, rows[0].hashedOtp)) {
        return { valid: false, reason: "Invalid or expired OTP." };
      }
      // Consume OTP — one-time use
      await db.delete(otpStoreTable).where(eq(otpStoreTable.phone, identifier)).catch(() => {});
      return { valid: true };
    }
  } catch { /* fall through to cache */ }

  // 2. Fallback: Redis/memory OTP
  try {
    const cached = await (cache as any).getOtp?.(identifier);
    if (cached && verifyOtpHash(otp, cached)) {
      await (cache as any).deleteOtp?.(identifier).catch(() => {});
      return { valid: true };
    }
  } catch { /* ignore */ }

  return { valid: false, reason: "Invalid or expired OTP. Please request a new code." };
}

// ─── Tables to explicitly delete from (belt + CASCADE suspenders) ────────────

const CHILD_TABLES = [
  "user_auth_providers", // OAuth-linked identities (email, provider ID) — CASCADE never fires on a soft-delete, so this needs explicit cleanup too
  "user_profiles",
  "user_preferences",
  "user_privacy_settings",
  "user_medical_conditions",
  "user_health_goals",
  "exercise_logs",
  "water_logs",
  "medicine_schedules",
  "medicine_logs",
  "food_logs",
  "sleep_logs",
  "stress_logs",
  "period_logs",
  "blood_logs",
  "health_reports",
  "medical_reports",
  "daily_health_scores",
  "daily_food_summaries",
  "notification_preferences",
  "wearable_connections",
  "ai_usage_logs",
] as const;

// ─── Route ───────────────────────────────────────────────────────────────────

router.post("/users/delete-account", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;

  // Rate limit: 3 attempts per hour per user
  const rateLimitKey = `delete_account:${userId}`;
  try {
    const attempts = await cache.incrementRateLimitFixed(rateLimitKey, 3600);
    if (attempts > 3) {
      res.status(429).json({ error: "Too many deletion attempts. Please try again in 1 hour." });
      return;
    }
  } catch { /* Redis unavailable — proceed */ }

  const { otp } = req.body as { otp?: string };

  if (!otp || typeof otp !== "string" || otp.length !== 6) {
    res.status(400).json({ error: "A valid 6-digit OTP is required." });
    return;
  }

  // Fetch user phone + email + name (BEFORE anonymization — needed for the
  // deletion-confirmation email sent once deletion completes below)
  let phone: string | null = null;
  let email: string | null = null;
  let fullName: string | null = null;

  try {
    const userRow = await pool.query(
      `SELECT u.phone, u.email, u.plan, up.full_name
         FROM users u
         LEFT JOIN user_profiles up ON up.user_id = u.id
        WHERE u.id = $1 AND u.is_active = true AND u.deleted_at IS NULL`,
      [userId]
    );
    if (!userRow.rows.length) {
      res.status(404).json({ error: "Account not found or already deleted." });
      return;
    }
    phone = userRow.rows[0].phone ?? null;
    email = userRow.rows[0].email ?? null;
    fullName = userRow.rows[0].full_name ?? null;
  } catch (err) {
    req.log.error({ err }, "[deleteAccount] fetch user failed");
    res.status(500).json({ error: "Failed to verify account. Please try again." });
    return;
  }

  const identifier = phone ?? (email ? emailOtpKey(email) : null);
  if (!identifier) {
    res.status(400).json({ error: "No phone or email associated with this account." });
    return;
  }

  // Validate OTP
  const { valid, reason } = await validateDeletionOtp(otp, identifier);
  if (!valid) {
    res.status(400).json({ error: reason ?? "Invalid OTP." });
    return;
  }

  // ── Begin deletion ──────────────────────────────────────────────────────────
  const deletedAt = new Date();

  try {
    // 1. Soft-delete user row + anonymize PII.
    //    Phone/email are unique-constrained and were previously left
    //    untouched, which (a) retained PII indefinitely after a delete
    //    request — a DPDPA/Play-Store compliance gap — and (b) meant
    //    the same phone/email could never be used to sign up again.
    //    Replacing them with a deterministic, non-PII tombstone value
    //    fixes both: uniqueness is preserved (keyed on userId), and the
    //    original phone/email are gone.
    await pool.query(
      `UPDATE users
       SET deleted_at = $1,
           is_active  = false,
           plan       = 'free',
           phone      = CASE WHEN phone IS NOT NULL THEN 'deleted_' || $2::text ELSE NULL END,
           email      = CASE WHEN email IS NOT NULL THEN 'deleted_' || $2::text || '@deleted.aorane.internal' ELSE NULL END,
           updated_at = NOW()
       WHERE id = $2`,
      [deletedAt, userId]
    );

    // 2. Cancel active subscriptions
    await pool.query(
      `UPDATE subscriptions
       SET status       = 'cancelled',
           cancelled_at = NOW(),
           updated_at   = NOW()
       WHERE user_id = $1 AND status = 'active'`,
      [userId]
    ).catch((err) => req.log.warn({ err }, "[deleteAccount] subscription cancel non-fatal"));

    // 3. Delete child records explicitly
    for (const table of CHILD_TABLES) {
      await pool.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]).catch((err) =>
        req.log.warn({ err, table }, `[deleteAccount] delete ${table} non-fatal`)
      );
    }

    // 4. Consume OTP store for this user
    await pool.query(`DELETE FROM otp_store WHERE phone = $1`, [identifier]).catch(() => {});

    logger.info({ userId }, "[deleteAccount] soft-delete complete");

    // Best-effort confirmation email — uses the ORIGINAL email captured
    // above, before the UPDATE anonymized it in the DB.
    if (email) {
      sendAccountDeletedEmail({ toEmail: email, name: fullName || "" }).catch(() => {});
    }

    res.json({
      success: true,
      message: "Your account has been scheduled for deletion.",
      deletedAt: deletedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err, userId }, "[deleteAccount] deletion failed");
    res.status(500).json({
      error: "Account deletion failed. Please try again or contact support@aorane.com",
    });
  }
});

export default router;