/**
 * Plan-Limits Middleware — DB-backed per-user, per-feature daily limits
 *
 * Reads limits from `plan_features` table (cached 5 min).
 * Tracks usage in `ai_usage_daily` table (persists across restarts).
 * IST midnight reset.
 *
 * Usage:
 *   router.post("/food/scan", requireAuth, planLimit("ai_food_scan_photo_daily"), handler)
 */

import type { Response, NextFunction } from "express";
import { pool } from "@workspace/db";
import type { AuthRequest } from "./user-auth";

// ── Cache: plan_features rows (5-min TTL) ─────────────────────────────────────
interface FeatureRow {
  freeValue: string;
  maxValue: string;
  proValue: string;
  familyValue: string;
  description: string;
  period: "daily" | "weekly" | "monthly";
}
const FEATURE_CACHE = new Map<string, { row: FeatureRow; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000;

async function getFeatureRow(featureName: string): Promise<FeatureRow | null> {
  const now = Date.now();
  const cached = FEATURE_CACHE.get(featureName);
  if (cached && now < cached.expiresAt) return cached.row;

  try {
    const { rows } = await pool.query(
      `SELECT free_value, max_value, pro_value, family_value, description, period
         FROM plan_features WHERE feature_name = $1 LIMIT 1`,
      [featureName]
    );
    if (!rows.length) return null;
    const r = rows[0];
    const period = r.period === "weekly" || r.period === "monthly" ? r.period : "daily";
    const row: FeatureRow = {
      freeValue: r.free_value,
      maxValue: r.max_value,
      proValue: r.pro_value,
      familyValue: r.family_value,
      description: r.description ?? featureName,
      period,
    };
    FEATURE_CACHE.set(featureName, { row, expiresAt: now + CACHE_TTL });
    return row;
  } catch {
    return null;
  }
}

/** Invalidate plan_features cache (call after admin updates) */
export function invalidatePlanLimitsCache(featureName?: string): void {
  if (featureName) FEATURE_CACHE.delete(featureName);
  else FEATURE_CACHE.clear();
}

/**
 * isBooleanFeatureEnabled — check if a boolean plan_features row is enabled for a plan.
 * Does NOT track usage. For features like ads_shown, wearable_sync, ai_predictions_enabled.
 * Returns true (fail-open) if feature not found in DB.
 */
export async function isBooleanFeatureEnabled(
  featureName: string,
  planType: string,
): Promise<boolean> {
  const row = await getFeatureRow(featureName);
  if (!row) return true;
  const plan = (planType || "free").toLowerCase();
  const raw = plan === "max" ? row.maxValue
    : plan === "pro" ? row.proValue
    : plan === "family" ? row.familyValue
    : row.freeValue;
  if (raw === "false" || raw === "0") return false;
  if (raw === "true") return true;
  const n = parseInt(raw, 10);
  return !isNaN(n) && n !== 0;
}

/** Get daily limit for a plan from the feature row */
function getLimitForPlan(row: FeatureRow, plan: string): number {
  const raw = (() => {
    switch ((plan || "free").toLowerCase()) {
      case "max": return row.maxValue;
      case "pro": return row.proValue;
      case "family": return row.familyValue;
      default: return row.freeValue;
    }
  })();
  const n = parseInt(raw, 10);
  return isNaN(n) ? 0 : n;
}

/** Today's date string in IST */
function todayIST(): Date {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  return new Date(now.getTime() + istOffset);
}

/**
 * Returns the "bucket" date string for a given period, anchored to IST.
 * - daily:   today's date                     → resets every midnight IST
 * - weekly:  this week's Monday                → resets every Monday midnight IST
 * - monthly: 1st of this month                 → resets on the 1st of each month
 * This bucket string is what gets stored in ai_usage_daily.usage_date —
 * the column name is historical (predates weekly/monthly support) but
 * works fine as a generic "period bucket start date".
 */
function periodBucket(period: "daily" | "weekly" | "monthly"): string {
  const ist = todayIST();
  if (period === "monthly") {
    const firstOfMonth = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1));
    return firstOfMonth.toISOString().slice(0, 10);
  }
  if (period === "weekly") {
    // ISO week: Monday start. getUTCDay(): 0=Sun..6=Sat.
    const day = ist.getUTCDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    const monday = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() - diffToMonday));
    return monday.toISOString().slice(0, 10);
  }
  return ist.toISOString().slice(0, 10);
}

/** Human-readable "resets at" string for error messages */
function resetsAtLabel(period: "daily" | "weekly" | "monthly"): string {
  if (period === "monthly") return "1st of next month (IST)";
  if (period === "weekly") return "next Monday midnight (IST)";
  return "midnight IST";
}

/** Get current usage count from ai_usage_daily */
async function getUsageCount(userId: string, featureName: string, date: string): Promise<number> {
  try {
    const { rows } = await pool.query(
      `SELECT usage_count FROM ai_usage_daily
         WHERE user_id = $1 AND feature_name = $2 AND usage_date = $3`,
      [userId, featureName, date]
    );
    return rows.length ? (rows[0].usage_count as number) : 0;
  } catch {
    return 0;
  }
}

/** Increment usage count (upsert) — call AFTER successful AI response */
export async function incrementUsage(
  userId: string,
  featureName: string,
  period: "daily" | "weekly" | "monthly" = "daily"
): Promise<void> {
  const date = periodBucket(period);
  try {
    await pool.query(
      `INSERT INTO ai_usage_daily (user_id, feature_name, usage_date, usage_count)
         VALUES ($1, $2, $3, 1)
         ON CONFLICT (user_id, feature_name, usage_date)
         DO UPDATE SET usage_count = ai_usage_daily.usage_count + 1`,
      [userId, featureName, date]
    );
  } catch {
    // Non-fatal — don't block the response
  }
}

/**
 * planLimit(featureName) — Middleware factory
 *
 * - Looks up limit from plan_features based on user's plan
 * - Checks ai_usage_daily for today's count
 * - Blocks with 429 if over limit
 * - Attaches `planLimitFeature` to req for post-handler increment
 * - -1 = unlimited, 0 = blocked for plan, positive = count limit
 */
export function planLimit(featureName: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.userId;
    if (!userId) { next(); return; }

    try {
      const row = await getFeatureRow(featureName);
      if (!row) {
        // Feature not in plan_features → allow through
        next();
        return;
      }

      const plan = (req.userPlan || "free").toLowerCase();
      const limit = getLimitForPlan(row, plan);

      // -1 = unlimited
      if (limit === -1) {
        next();
        return;
      }

      // 0 = feature disabled for this plan
      if (limit === 0) {
        res.status(403).json({
          error: `${row.description} is not available on the ${plan.toUpperCase()} plan. Please upgrade.`,
          feature: featureName,
          reason: "plan_not_supported",
          currentPlan: plan,
          upgradeSuggested: true,
        });
        return;
      }

      // Check usage for this feature's period (daily/weekly/monthly)
      const date = periodBucket(row.period);
      const used = await getUsageCount(userId, featureName, date);

      if (used >= limit) {
        res.status(429).json({
          error: `Limit reached for ${row.description}. Limit: ${limit} per ${row.period.replace("ly", "")} on ${plan.toUpperCase()} plan. Resets ${resetsAtLabel(row.period)}.`,
          feature: featureName,
          limitPerDay: limit,
          usedToday: used,
          period: row.period,
          currentPlan: plan,
          resetsAt: resetsAtLabel(row.period),
          upgradeSuggested: plan === "free",
        });
        return;
      }

      // Auto-increment usage when response is successful (2xx)
      res.on("finish", () => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          incrementUsage(userId, featureName, row.period).catch(() => {});
        }
      });

      // Set headers
      res.setHeader("X-Plan-Limit-Feature", featureName);
      res.setHeader("X-Plan-Limit-Limit", String(limit));
      res.setHeader("X-Plan-Limit-Remaining", String(Math.max(0, limit - used - 1)));
      res.setHeader("X-Plan-Limit-Plan", plan);

      next();
    } catch {
      // On DB error, allow through (fail-open for user experience)
      next();
    }
  };
}

/** Get usage summary for a user (for profile/usage screen) */
export async function getUserUsageSummary(userId: string): Promise<Array<{
  featureName: string;
  description: string;
  usedToday: number;
  limitToday: number;
  unlimited: boolean;
  period: "daily" | "weekly" | "monthly";
}>> {
  try {
    const featuresRes = await pool.query(
      `SELECT feature_name, free_value, max_value, pro_value, family_value, description, period FROM plan_features ORDER BY feature_name`
    );

    // Group features by period so we only run one usage query per distinct
    // bucket-date instead of one per feature.
    const byPeriod = new Map<"daily" | "weekly" | "monthly", string[]>();
    for (const r of featuresRes.rows) {
      const period: "daily" | "weekly" | "monthly" =
        r.period === "weekly" || r.period === "monthly" ? r.period : "daily";
      const list = byPeriod.get(period) ?? [];
      list.push(r.feature_name as string);
      byPeriod.set(period, list);
    }

    const usageMap = new Map<string, number>();
    await Promise.all(
      Array.from(byPeriod.entries()).map(async ([period, featureNames]) => {
        const date = periodBucket(period);
        const { rows } = await pool.query(
          `SELECT feature_name, usage_count FROM ai_usage_daily
             WHERE user_id = $1 AND usage_date = $2 AND feature_name = ANY($3::text[])`,
          [userId, date, featureNames]
        );
        for (const row of rows) usageMap.set(row.feature_name as string, row.usage_count as number);
      })
    );

    return featuresRes.rows
      .filter(r => {
        const val = parseInt(r.max_value as string, 10);
        return !isNaN(val) && val > 0;
      })
      .map(r => {
        const limit = parseInt(r.max_value as string, 10);
        const period: "daily" | "weekly" | "monthly" =
          r.period === "weekly" || r.period === "monthly" ? r.period : "daily";
        return {
          featureName: r.feature_name as string,
          description: (r.description as string) ?? r.feature_name as string,
          usedToday: usageMap.get(r.feature_name as string) ?? 0,
          limitToday: limit,
          unlimited: limit === -1,
          period,
        };
      });
  } catch {
    return [];
  }
}
