/**
 * AI Limiter — per-user, per-feature daily/weekly/monthly usage limits
 *
 * SINGLE SOURCE OF TRUTH for AI quota enforcement across the entire app.
 * Uses plan_features table for admin-editable limits + ai_usage_daily for
 * tracking. Every AI-calling route MUST go through checkAndUseAILimit()
 * before invoking callAI() — no exceptions, no parallel/hardcoded limiters.
 *
 * (production-hardening pass): previously this did a SELECT to check
 * current usage, then a SEPARATE increment call — two concurrent requests
 * from the same user could both pass the check before either incremented,
 * letting the limit be exceeded. Now uses the atomic
 * try_increment_ai_usage() Postgres function (see migrate.ts) — the
 * check-and-increment happens as one atomic UPSERT guarded by the row's
 * UNIQUE constraint, so concurrent requests can never both succeed past
 * the configured limit.
 *
 * IST midnight (or week/month) reset, based on the feature's configured
 * `period` in plan_features.
 */

import { pool } from "@workspace/db";

export type AIFeature =
  | "ai_food_scan_photo_daily"
  | "ai_food_scan_text_daily"
  | "ai_medical_scan_daily"
  | "ai_diet_plan_daily"
  | "ai_health_coach_daily"
  | "ai_meal_swap_daily"
  | "ai_meal_planner_daily"
  | "ai_health_prediction_weekly"
  | "ai_health_suggestions_daily"
  | "ai_stress_insight_daily"
  | "ai_weather_suggestions_daily";

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

/** Get usage count for a user+feature in the given period bucket (read-only — used for display/summary only, NOT for gating) */
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

/**
 * Atomic check-and-increment — the ONLY correct way to gate an AI call.
 * Calls the try_increment_ai_usage() Postgres function, which does the
 * read-check-write as a single UPSERT so concurrent requests can't race
 * past the limit (see migrate.ts for the function definition).
 */
async function tryIncrementUsage(
  userId: string,
  feature: AIFeature,
  bucketDate: string,
  limit: number,
): Promise<{ allowed: boolean; usageCount: number }> {
  try {
    const { rows } = await pool.query(
      `SELECT allowed, usage_count FROM try_increment_ai_usage($1::uuid, $2::text, $3::date, $4::int)`,
      [userId, feature, bucketDate, limit],
    );
    if (!rows.length) return { allowed: false, usageCount: limit };
    return { allowed: rows[0].allowed as boolean, usageCount: rows[0].usage_count as number };
  } catch {
    // DB error on the gating call itself — fail CLOSED here (unlike the
    // "feature not configured" case below, which fails open on purpose).
    // A DB hiccup mid-request should not silently grant free unlimited AI
    // usage; better to ask the user to retry.
    return { allowed: false, usageCount: 0 };
  }
}

/** Legacy non-atomic increment — kept only for the "feature not configured, allow through" fallback path below (no limit to race against there). */
async function incrementAIUsage(userId: string, feature: AIFeature, bucketDate: string): Promise<void> {
  try {
    await pool.query(
      `SELECT increment_ai_usage($1::uuid, $2::text, $3::date)`,
      [userId, feature, bucketDate],
    );
  } catch {
    // Non-fatal — don't block the response
  }
}

/**
 * refundAIUsage — call this when checkAndUseAILimit() already consumed a
 * unit of quota but the AI call afterwards failed for a reason that is
 * NOT the user's fault (provider rate-limited, misconfigured API key,
 * provider 5xx, unparseable response, etc.). Without this, a failed scan
 * silently burns the user's daily quota — which is especially painful
 * now that Gemini's free-tier rate limit means failures can be frequent.
 *
 * Best-effort / non-atomic by design: worst case (two failed scans by the
 * same user in the same instant) under-refunds by one unit, which is a
 * far smaller problem than over-charging every failed attempt. Bounded
 * at 0 so it can never push a user's usage negative.
 */
export async function refundAIUsage(userId: string, feature: AIFeature): Promise<void> {
  try {
    const row = await fetchFeatureRow(feature);
    const bucketDate = periodBucket(row?.period ?? "daily");
    await pool.query(
      `UPDATE ai_usage_daily SET usage_count = GREATEST(usage_count - 1, 0)
         WHERE user_id = $1 AND feature_name = $2 AND usage_date = $3`,
      [userId, feature, bucketDate],
    );
  } catch {
    // Non-fatal — a missed refund just means the user's quota display is
    // off by one for today; never let this break the error response already
    // being sent back to the client.
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

  // Feature not configured in plan_features → allow through, but log loudly.
  // This should never happen in practice (AIFeature is a closed union and
  // every value is seeded in migrate.ts), but if a new feature is ever added
  // to the type without a matching plan_features row, failing open silently
  // would mean unlimited free AI usage for everyone until someone notices.
  if (!row) {
    // eslint-disable-next-line no-console
    console.error(`[aiLimiter] WARNING: no plan_features row for "${feature}" — allowing UNMETERED access. Seed this feature in the Admin Panel > Plan Features immediately.`);
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

  // Unlimited (even "unlimited" usage is still recorded for admin visibility/
  // reporting — but never gates, so a plain non-atomic increment is fine here)
  if (limit >= 999) {
    await incrementAIUsage(userId, feature, bucketDate);
    return { allowed: true, remaining: 999, limit: 999, usedToday: 0, period: row.period };
  }

  // Bounded limit — atomic check-and-increment (race-condition-safe).
  const { allowed, usageCount } = await tryIncrementUsage(userId, feature, bucketDate, limit);

  if (!allowed) {
    return { allowed: false, remaining: 0, limit, usedToday: usageCount, period: row.period };
  }

  return {
    allowed: true,
    remaining: Math.max(0, limit - usageCount),
    limit,
    usedToday: usageCount - 1, // usageCount already includes this call
    period: row.period,
  };
}

/**
 * Read-only usage peek — does NOT increment. Use this for display purposes
 * (e.g. "You've used 3/5 scans today" banners) where you must not consume
 * a unit of quota just by showing the number.
 */
export async function peekAIUsage(
  userId: string,
  feature: AIFeature,
  planType: string = "free",
): Promise<AILimitResult> {
  const row = await fetchFeatureRow(feature);
  if (!row) return { allowed: true, remaining: 999, limit: 999, usedToday: 0 };

  const limit = limitForPlan(row, planType);
  const bucketDate = periodBucket(row.period);

  if (limit === 0) {
    return { allowed: false, remaining: 0, limit: 0, usedToday: 0, period: row.period };
  }
  if (limit >= 999) {
    return { allowed: true, remaining: 999, limit: 999, usedToday: 0, period: row.period };
  }

  const usedToday = await getPeriodUsage(userId, feature, bucketDate);
  return {
    allowed: usedToday < limit,
    remaining: Math.max(0, limit - usedToday),
    limit,
    usedToday,
    period: row.period,
  };
}
