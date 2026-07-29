/**
 * Feature Flag Middleware
 *
 * Admin panel mein feature OFF karo → ye middleware 403 return karta hai.
 * 5-minute in-memory cache — DB per-request nahi jaata.
 *
 * Usage:
 * router.post("/food/scan", requireAuth, requireFeature("food_ai_identify"), handler);
 */

import type { Response, NextFunction } from "express";
import { db, featureFlagsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { AuthRequest } from "./user-auth";
import { logger } from "../lib/logger";

interface FlagCache {
  isEnabled: boolean;
  enabledForPlans: string[];
  expiresAt: number;
}

const FLAG_CACHE = new Map<string, FlagCache>();
const FLAG_TTL_MS = 5 * 60 * 1000;

// FIX BUG 1: Safe Default Registry (Agar DB mein seed data chhoot gaya ho toh ye fallback use hoga)
const KNOWN_FEATURES: Record<string, { isEnabled: boolean; enabledForPlans: string[] }> = {
  // enabledForPlans: [] here means "no extra plan restriction from this
  // registry" — per-plan access + quantity for these two is now solely
  // owned by planLimit()/plan_features (see middlewares/plan-limits.ts).
  // Previously this registry AND a separate hardcoded PAID_PLANS array in
  // intelligence.ts both gated these routes and disagreed with each other
  // (this list excluded nobody, intelligence.ts's array excluded family) —
  // consolidated to a single source of truth, July 2026.
  "health_prediction": { isEnabled: true, enabledForPlans: [] },
  "weekly_diet_chart": { isEnabled: true, enabledForPlans: [] },
  // Aap aage chal kar yahan aur default features add kar sakte hain
};

async function getFlag(name: string): Promise<FlagCache | null> {
  const now = Date.now();
  const cached = FLAG_CACHE.get(name);
  if (cached && now < cached.expiresAt) return cached;

  const [row] = await db
    .select()
    .from(featureFlagsTable)
    .where(eq(featureFlagsTable.key, name))
    .limit(1);

  let flag: FlagCache;

  if (!row) {
    // Agar DB mein feature nahi mila, toh pehle Known Features list mein check karo
    if (KNOWN_FEATURES[name]) {
      flag = {
        isEnabled: KNOWN_FEATURES[name].isEnabled,
        enabledForPlans: KNOWN_FEATURES[name].enabledForPlans,
        expiresAt: now + FLAG_TTL_MS,
      };
    } else {
      return null; // Unknown feature ke liye abhi bhi Fail-Closed rahega (Security Intact)
    }
  } else {
    flag = {
      isEnabled: row.isEnabled ?? true,
      enabledForPlans: (row.enabledForPlans as string[]) ?? [],
      expiresAt: now + FLAG_TTL_MS,
    };
  }

  FLAG_CACHE.set(name, flag);
  return flag;
}

/**
 * Middleware: check feature flag before route handler
 * SECURITY FIX H-9 & H-10 (Updated): 
 * - Now strictly FAIL-CLOSED (denies access on error or missing unknown flag)
 * - Safe Case-Insensitive matching for plans
 */
export function requireFeature(featureName: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const flag = await getFlag(featureName);

      // FIX H-9: Fail-Closed (Deny by default) agar flag DB aur registry dono mein nahi hai
      if (!flag) {
        logger.warn({ feature: featureName }, "[FeatureCheck] Missing flag requested. Blocking access securely.");
        res.status(403).json({
          error: "Feature configuration is missing or restricted",
          feature: featureName,
          reason: "missing_flag",
        });
        return;
      }

      // Agar feature totally disable kar diya gaya hai
      if (!flag.isEnabled) {
        res.status(403).json({
          error: "This feature is currently unavailable",
          feature: featureName,
          reason: "disabled",
        });
        return;
      }

      // FIX BUG 2: Case-Insensitive Matching
      // DB mein case kuch bhi ho ("pro", "Pro", "PRO"), dono ko upper case karke match karenge
      if (flag.enabledForPlans.length > 0) {
        const userPlan = (req.userPlan || "free").toUpperCase(); 
        const allowedPlans = flag.enabledForPlans.map((p: string) => p.toUpperCase());

        if (!allowedPlans.includes(userPlan)) {
          res.status(403).json({
            error: "Upgrade your plan to access this feature",
            feature: featureName,
            reason: "plan_restriction",
            requiredPlans: flag.enabledForPlans,
            currentPlan: req.userPlan || "free",
          });
          return;
        }
      }

      next();
    } catch (err) {
      // FIX H-9: Fail-Closed on Database Errors
      logger.error({ err, feature: featureName }, "[FeatureCheck] Database error during flag check");
      res.status(503).json({
        error: "Unable to verify feature permissions at this moment. Please try again.",
        feature: featureName,
      });
    }
  };
}

/** Call after admin toggles a feature flag */
export function invalidateFeatureCache(name?: string): void {
  if (name) FLAG_CACHE.delete(name);
  else FLAG_CACHE.clear();
}