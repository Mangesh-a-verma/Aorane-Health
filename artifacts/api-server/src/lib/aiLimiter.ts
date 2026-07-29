/**
 * AI Limiter — per-user, per-feature daily usage limits
 *
 * Uses plan_features table for limits + ai_usage_daily for tracking.
 * Increment happens ONLY when AI is actually called (not on cache hits).
 * IST midnight reset.
 */

import { pool } from "@workspace/db";

export type AIFeature =
  | "ai_food_scan_photo_daily"
  | "ai_food_scan_text_daily"
  | "ai_medical_scan_daily"
  | "ai_diet_plan_daily"
  | "ai_health_coach_daily"
  | "ai_meal_swap_daily"
  | "ai_predictions_enabled"
  | "ai_health_prediction_weekly";

type Period = "daily" | "weekly" | "monthly";

// ── 5-minute plan_features cache ─────────────────────────────────────────────
interface CachedFeature {
  freeValue: string;
  maxValue: string;
  proValue: string;
  familyValue: string;
  period: Period;
  expiresAt: number;
}
const FEATURE_CACHE = new Map<string, CachedFeature>();
const CACHE_TTL = 5 * 60 * 1000;

/** Returns the period-bucket date string (daily/weekly/monthly), anchored to IST */
function periodBucket(period: Period): string {
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(Date.now() + istOffset);
  if (period === "monthly") {
    return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1)).toISOString().slice(0, 10);
  }
  if (period === "weekly") {
    const day = ist.getUTCDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() - diffToMonday))
      .toISOString().slice(0, 10);
  }
  return ist.toISOString().slice(0, 10);
}

/** Parse plan_features value → numeric limit. -1 or 'true' = 999 (unlimited), 'false' = 0 */
function parseLimit(val: string | null | undefined): number {
  if (!val || val === "false") return 0;
  if (val === "true") return 999;
  const n = parseInt(val, 10);
  if (isNaN(n)) return 0;
  return n === -1 ? 999 : n;
}

async function fetchFeatureRow(feature: AIFeature): Promise<CachedFeature | null> {
  const now = Date.now();
  const cached = FEATURE_CACHE.get(feature);
  if (cached && now < cached.expiresAt) return cached;

  try {
    const { rows } = await pool.query(
      `SELECT free_value, max_value, pro_value, family_value, period
         FROM plan_features WHERE feature_name = $1 LIMIT 1`,
      [feature],
    );
    if (!rows.length) return null;
    const r = rows[0] as Record<string, string>;
    const period: Period = r.period === "weekly" || r.period === "monthly" ? r.period : "daily";
    const row: CachedFeature = {
      freeValue:   r.free_value,
      maxValue:    r.max_value,
      proValue:    r.pro_value,
      familyValue: r.family_value,
      period,
      expiresAt:   now + CACHE_TTL,
    };
    FEATURE_CACHE.set(feature, row);
    return row;
  } catch {
    return null; // fail-open
  }
}

function limitForPlan(row: CachedFeature, plan: string): number {
  switch ((plan || "free").toLowerCase()) {
    case "max":    return parseLimit(row.maxValue);
    case "pro":    return parseLimit(row.proValue);
    case "family": return parseLimit(row.familyValue);
    default:       return parseLimit(row.freeValue);
  }
}

/** Get usage count for a user+feature in the given period bucket */
async function getPeriodUsage(userId: string, feature: AIFeature, bucketDate: string): Promise<number> {
  try {
    const { rows } = await pool.query(
      `SELECT usage_count FROM ai_usage_daily
         WHERE user_id = $1 AND feature_name = $2 AND usage_date = $3`,
      [userId, feature, bucketDate],
    );
    return rows.length ? (rows[0].usage_count as number) : 0;
  } catch {
    return 0;
  }
}

/** Increment AI usage via stored procedure */
export async function incrementAIUsage(userId: string, feature: AIFeature, bucketDate: string): Promise<void> {
  try {
    await pool.query(
      `SELECT increment_ai_usage($1::uuid, $2::text, $3::date)`,
      [userId, feature, bucketDate],
    );
  } catch {
    // Non-fatal — don't block the response
  }
}

/** Invalidate cache (call after admin updates plan_features) */
export function invalidateAILimiterCache(feature?: AIFeature): void {
  if (feature) FEATURE_CACHE.delete(feature);
  else FEATURE_CACHE.clear();
}

export interface AILimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  usedToday: number;
  planRequired?: string;
  period?: Period;
}

/**
 * checkAndUseAILimit — Call BEFORE every AI feature invocation.
 *
 * - Checks plan limit from plan_features
 * - Checks today's usage from ai_usage_daily
 * - If allowed: increments usage count + returns { allowed: true, remaining }
 * - If blocked: returns { allowed: false, planRequired? }
 *
 * @param userId    Authenticated user's UUID
 * @param feature   Feature name matching plan_features table
 * @param planType  User's plan (free | max | pro | family)
 */
export async function checkAndUseAILimit(
  userId: string,
  feature: AIFeature,
  planType: string = "free",
): Promise<AILimitResult> {
  const row = await fetchFeatureRow(feature);

  // Feature not configured in plan_features → allow through
  if (!row) {
    await incrementAIUsage(userId, feature, periodBucket("daily"));
    return { allowed: true, remaining: 999, limit: 999, usedToday: 0 };
  }

  const limit = limitForPlan(row, planType);
  const bucketDate = periodBucket(row.period);

  // Feature disabled on this plan
  if (limit === 0) {
    const planRequired =
      feature.includes("predictions") || feature.includes("stress") ? "pro" : "max";
    return { allowed: false, remaining: 0, limit: 0, usedToday: 0, planRequired, period: row.period };
  }

  // Unlimited
  if (limit >= 999) {
    await incrementAIUsage(userId, feature, bucketDate);
    return { allowed: true, remaining: 999, limit: 999, usedToday: 0, period: row.period };
  }

  const usedToday = await getPeriodUsage(userId, feature, bucketDate);

  // Over limit for this period
  if (usedToday >= limit) {
    return { allowed: false, remaining: 0, limit, usedToday, period: row.period };
  }

  // Under limit — increment and allow
  await incrementAIUsage(userId, feature, bucketDate);
  return { allowed: true, remaining: limit - usedToday - 1, limit, usedToday, period: row.period };
}
