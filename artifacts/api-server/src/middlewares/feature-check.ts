/**
 * Feature Flag Middleware
 *
 * Admin panel mein feature OFF karo → ye middleware 403 return karta hai.
 * 5-minute in-memory cache — DB per-request nahi jaata.
 *
 * Usage:
 *   router.post("/food/scan", requireAuth, requireFeature("food_ai_identify"), handler);
 */

import type { Response, NextFunction } from "express";
import { db, featureFlagsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { AuthRequest } from "./user-auth";

interface FlagCache {
  isEnabled: boolean;
  enabledForPlans: string[];
  expiresAt: number;
}

const FLAG_CACHE = new Map<string, FlagCache>();
const FLAG_TTL_MS = 5 * 60 * 1000;

async function getFlag(name: string): Promise<FlagCache | null> {
  const now = Date.now();
  const cached = FLAG_CACHE.get(name);
  if (cached && now < cached.expiresAt) return cached;

  const [row] = await db
    .select()
    .from(featureFlagsTable)
    .where(eq(featureFlagsTable.key, name))
    .limit(1);

  if (!row) return null;

  const flag: FlagCache = {
    isEnabled: row.isEnabled ?? true,
    enabledForPlans: (row.enabledForPlans as string[]) ?? [],
    expiresAt: now + FLAG_TTL_MS,
  };
  FLAG_CACHE.set(name, flag);
  return flag;
}

/**
 * Middleware: check feature flag before route handler
 * - If flag not found in DB → allow through (unknown features pass)
 * - If flag is_enabled = false → 403
 * - If plan restriction set + user plan not in list → 403 with upgrade message
 */
export function requireFeature(featureName: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const flag = await getFlag(featureName);

      if (!flag) {
        next();
        return;
      }

      if (!flag.isEnabled) {
        res.status(403).json({
          error: "This feature is currently unavailable",
          feature: featureName,
          reason: "disabled",
        });
        return;
      }

      if (flag.enabledForPlans.length > 0 && req.userPlan) {
        if (!flag.enabledForPlans.includes(req.userPlan)) {
          res.status(403).json({
            error: "Upgrade your plan to access this feature",
            feature: featureName,
            reason: "plan_restriction",
            requiredPlans: flag.enabledForPlans,
            currentPlan: req.userPlan,
          });
          return;
        }
      }

      next();
    } catch {
      next();
    }
  };
}

/** Call after admin toggles a feature flag */
export function invalidateFeatureCache(name?: string): void {
  if (name) FLAG_CACHE.delete(name);
  else FLAG_CACHE.clear();
}
