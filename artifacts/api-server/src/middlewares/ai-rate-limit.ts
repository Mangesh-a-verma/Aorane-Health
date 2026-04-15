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
  food_scan:           "Food Scan",
  food_scan_image:     "Food Image Scan",
  weather_suggestions: "Weather Food Suggestions",
  health_prediction:   "Health Prediction",
  diet_chart:          "Diet Chart",
  meal_planner:        "Meal Planner",
  meal_swap:           "Meal Swap",
  health_tip:          "Health Tip",
  stress_insight:      "Stress Insight",
  daily_suggestions:   "Daily Suggestions",
};

/**
 * Returns Express middleware that limits a user to `limitPerDay` calls
 * for the given `feature` key per day (resets at midnight IST).
 */
export function aiRateLimit(feature: string, limitPerDay: number) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const userId = req.userId;
    if (!userId) { next(); return; }

    const date  = todayIST();
    const key   = `${feature}:${userId}:${date}`;
    const ttl   = secondsUntilMidnight();
    const count = cache.incrementRateLimitFixed(key, ttl);

    if (count > limitPerDay) {
      const label = FEATURE_LABELS[feature] ?? feature;
      res.status(429).json({
        error: `Daily AI limit reached for ${label}. Limit: ${limitPerDay} per day. Resets at midnight IST.`,
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
