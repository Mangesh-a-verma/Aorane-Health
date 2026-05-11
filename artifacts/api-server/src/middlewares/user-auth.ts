import type { Request, Response, NextFunction } from "express";
import { verifyUserToken } from "../lib/jwt";
import { cache } from "../lib/redis";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface AuthRequest extends Request {
  userId?: string;
  userPlan?: string;
  userPhone?: string;
  userEmail?: string;
}

// FIX C3 — Plan source-of-truth is the DB, not the JWT.
// Stale `plan` claim in JWT was the root cause of "PRO users can't food scan"
// since JWTs live 30 days but plan can change anytime (payment, org enrollment,
// admin update). We cache plan lookups for 120 seconds to avoid hitting the DB
// on every request.
const PLAN_CACHE_TTL_SECONDS = 120;

async function getCurrentPlan(userId: string, fallbackPlan: string): Promise<string> {
  const cacheKey = `user_plan:${userId}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  try {
    const [row] = await db
      .select({ plan: usersTable.plan })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    const plan = row?.plan ?? fallbackPlan;
    cache.set(cacheKey, plan, PLAN_CACHE_TTL_SECONDS);
    return plan;
  } catch {
    // DB error → fall back to JWT claim, fail-open so legitimate requests don't break
    return fallbackPlan;
  }
}

/** Call this after any code path that updates users.plan to invalidate the cache */
export function invalidateUserPlanCache(userId: string): void {
  // cache module has no explicit delete API; setting to empty + tiny TTL effectively expires
  cache.set(`user_plan:${userId}`, "", 1);
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }
  const token = authHeader.split(" ")[1];
  try {
    const payload = verifyUserToken(token);

    // A5: Token revocation — reject tokens issued before last logout
    const logoutTs = cache.get(`logout:user:${payload.userId}`);
    if (logoutTs) {
      const decoded = payload as unknown as { iat?: number };
      const iat = decoded.iat ?? 0;
      if (iat < parseInt(logoutTs, 10)) {
        res.status(401).json({ error: "Token has been revoked. Please log in again." });
        return;
      }
    }

    req.userId = payload.userId;
    req.userPhone = payload.phone;
    req.userEmail = payload.email;
    // FIX C3 — read latest plan from DB (cached 120s) instead of trusting JWT claim
    req.userPlan = await getCurrentPlan(payload.userId, payload.plan);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export async function optionalAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const payload = verifyUserToken(token);
      const logoutTs = cache.get(`logout:user:${payload.userId}`);
      const decoded = payload as unknown as { iat?: number };
      const iat = decoded.iat ?? 0;
      const tokenValid = !logoutTs || iat >= parseInt(logoutTs, 10);
      if (tokenValid) {
        req.userId = payload.userId;
        req.userPlan = await getCurrentPlan(payload.userId, payload.plan);
      }
    } catch {
      // ignore
    }
  }
  next();
}
