import type { Response, NextFunction } from "express";
import type { AuthRequest } from "./user-auth";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const PLAN_HIERARCHY: Record<string, number> = {
  free: 0,
  max: 1,
  family: 1,
  pro: 2,
};

// ── In-memory plan cache (2-min TTL) ──────────────────────────────────────────
// Ensures plan changes made by admin take effect within 2 minutes
// without hammering the DB on every request
const PLAN_CACHE_TTL_MS = 2 * 60 * 1000;
const planCache = new Map<string, { plan: string; expiresAt: number }>();

export function invalidatePlanCache(userId: string): void {
  planCache.delete(userId);
}

async function getCurrentPlan(userId: string, fallback: string): Promise<string> {
  const cached = planCache.get(userId);
  if (cached && Date.now() < cached.expiresAt) return cached.plan;

  try {
    const [user] = await db
      .select({ plan: usersTable.plan })
      .from(usersTable)
      .where(eq(usersTable.id, userId));
    const plan = user?.plan || "free";
    planCache.set(userId, { plan, expiresAt: Date.now() + PLAN_CACHE_TTL_MS });
    return plan;
  } catch {
    return fallback || "free";
  }
}

export function requirePlan(...plans: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.userId;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const userPlan = await getCurrentPlan(userId, req.userPlan || "free");
    req.userPlan = userPlan;

    const userLevel = PLAN_HIERARCHY[userPlan] ?? 0;
    const requiredLevels = plans.map((p) => PLAN_HIERARCHY[p] ?? 0);
    const minRequired = Math.min(...requiredLevels);

    if (userLevel >= minRequired || plans.includes(userPlan)) {
      next();
    } else {
      res.status(403).json({
        error: "Plan upgrade required",
        requiredPlans: plans,
        currentPlan: userPlan,
        upgradeUrl: "/plans",
      });
    }
  };
}

export function requirePro(req: AuthRequest, res: Response, next: NextFunction): void {
  requirePlan("pro")(req, res, next);
}

export function requireMax(req: AuthRequest, res: Response, next: NextFunction): void {
  requirePlan("max", "pro")(req, res, next);
}
