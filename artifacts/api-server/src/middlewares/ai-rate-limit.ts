/**
 * AI Rate Limiting Middleware — per user, per feature, per day
 * Resets at midnight IST. Uses in-memory cache (survives server restart via TTL logic).
 *
 * Usage:
 *   router.post("/food/scan", requireAuth, aiRateLimit("food_scan", 50), handler)
 */

import type { Response, NextFunction } from "express";
import { cache } from "../lib/redis";
import type { AuthRequest } from "./user-auth";

/** Seconds remaining until midnight IST */
function secondsUntilMidnight(): number {
  const now = new Date();
  // IST = UTC+5:30
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);
  const midnight = new Date(istNow);
  midnight.setUTCHours(24, 0, 0, 0);
  return Math.max(60, Math.floor((midnight.getTime() - istNow.getTime()) / 1000));
}

/** Today's date string in IST (for cache key bucketing) */
function todayIST(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);
  return istNow.toISOString().slice(0, 10);
}

const FEATURE_LABELS: Record<string, string> = {
  food_scan:           "AI Food Scan",
  food_scan_image:     "Food Image Scan",
  smart_scan:          "Smart Image Scan",
  medical_scan:        "Medical Report Scan",
  weather_suggestions: "Weather Food Suggestions",
  health_prediction:   "Health Prediction",
  diet_chart:          "Diet Chart",
  meal_planner:        "Meal Planner",
  meal_swap:           "Meal Swap",
  health_tip:          "Health Tip",
  stress_insight:      "Stress Insight",
  daily_suggestions:   "Daily Suggestions",
};

/** Paid plans (anything except free) */
const PAID_PLANS = new Set(["max", "pro", "family", "starter", "growth", "enterprise"]);

/**
 * Fixed-limit rate limiting — same limit for all plans.
 */
export function aiRateLimit(feature: string, limitPerDay: number) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.userId;
    if (!userId) { next(); return; }

    const date  = todayIST();
    const key   = `${feature}:${userId}:${date}`;
    const ttl   = secondsUntilMidnight();
    const count = await cache.incrementRateLimitFixed(key, ttl);

    if (count > limitPerDay) {
      const label = FEATURE_LABELS[feature] ?? feature;
      res.status(429).json({
        error: `Daily limit reached for ${label}. Limit: ${limitPerDay}/day. Resets at midnight IST.`,
        feature,
        limitPerDay,
        usedToday: count - 1,
        resetsAt:  "midnight IST",
      });
      return;
    }

    res.setHeader("X-AI-RateLimit-Feature",   feature);
    res.setHeader("X-AI-RateLimit-Limit",     String(limitPerDay));
    res.setHeader("X-AI-RateLimit-Remaining", String(Math.max(0, limitPerDay - count)));

    next();
  };
}

/**
 * Plan-aware rate limiting — free plan gets fewer calls than paid.
 * limits.free  = calls/day for Free plan
 * limits.paid  = calls/day for Max / Pro / Family / Org plans
 */
export function planAiRateLimit(
  feature: string,
  limits: { free: number; paid: number }
) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.userId;
    if (!userId) { next(); return; }

    const plan       = (req.userPlan || "free").toLowerCase();
    const isPaid     = PAID_PLANS.has(plan);
    const limitPerDay = isPaid ? limits.paid : limits.free;

    const date  = todayIST();
    const key   = `${feature}:${userId}:${date}`;
    const ttl   = secondsUntilMidnight();
    const count = await cache.incrementRateLimitFixed(key, ttl);

    if (count > limitPerDay) {
      const label = FEATURE_LABELS[feature] ?? feature;
      const upgradeNote = !isPaid
        ? ` Free plan: ${limits.free}/day. Upgrade to Max (₹199/mo) for ${limits.paid}/day.`
        : ` Limit: ${limitPerDay}/day.`;
      res.status(429).json({
        error: `Daily limit reached for ${label}.${upgradeNote} Resets at midnight IST.`,
        feature,
        limitPerDay,
        freeLimitPerDay: limits.free,
        paidLimitPerDay: limits.paid,
        usedToday: count - 1,
        currentPlan: plan,
        resetsAt: "midnight IST",
        upgradeSuggested: !isPaid,
      });
      return;
    }

    res.setHeader("X-AI-RateLimit-Feature",   feature);
    res.setHeader("X-AI-RateLimit-Limit",     String(limitPerDay));
    res.setHeader("X-AI-RateLimit-Remaining", String(Math.max(0, limitPerDay - count)));
    res.setHeader("X-AI-RateLimit-Plan",      plan);

    next();
  };
}
