import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { verifyUserToken } from "../lib/jwt";
import { cache } from "../lib/redis";
import { db, usersTable, subscriptionsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { logger } from "../lib/logger";

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

// Redis is a cache here, not a source of truth — every value it holds is
// re-derivable from Postgres. So a Redis failure should never be treated
// differently from a Redis miss: swallow the error and fall through to
// the DB lookup, same fail-open policy the DB calls below already use.
// (Previously an unguarded cache.get() would throw on a Redis outage and
// propagate out of requireAuth's try/catch as a 401 for every request —
// the opposite of the intended "don't lock everyone out" design.)
async function safeCacheGet(key: string): Promise<string | null> {
  try {
    return await cache.get(key);
  } catch (error) {
    logger.error({ err: error, key }, "[Auth] Redis get failed");
    return null;
  }
}

async function getCurrentPlan(userId: string, fallbackPlan: string): Promise<string> {
  const cacheKey = `user_plan:${userId}`;
  
  const cached = await safeCacheGet(cacheKey);
  if (cached) return cached;
  
  try {
    // FIX Expiry Leak: Join with subscriptions table to get the latest expiry date
    const [row] = await db
      .select({ 
        plan: usersTable.plan,
        expiresAt: subscriptionsTable.expiresAt 
      })
      .from(usersTable)
      .leftJoin(
        subscriptionsTable,
        and(
          eq(subscriptionsTable.userId, usersTable.id),
          eq(subscriptionsTable.status, 'active')
        )
      )
      .where(eq(usersTable.id, userId))
      .orderBy(desc(subscriptionsTable.expiresAt)) // In case of multiple active records, get the latest
      .limit(1);

    let plan = row?.plan ?? fallbackPlan;

    // --- EXPIRY ENFORCEMENT LOGIC ---
    if (plan !== "free" && row?.expiresAt) {
      const now = new Date();
      const expiryDate = new Date(row.expiresAt);
      
      // If today's date is past the expiry date, return 'free' on the fly
      if (expiryDate < now) {
        plan = "free"; 
      }
    } else if (plan !== "free" && !row?.expiresAt) {
      // Defense in depth: if the user's plan is 'pro' but no active subscription exists,
      // downgrade them. (Needed in case the users table wasn't updated after a cancellation.)
      plan = "free";
    }

    // Added: await for the Redis network call
    await cache.set(cacheKey, plan, PLAN_CACHE_TTL_SECONDS);
    return plan;
  } catch (error) {
    // DB error → fall back to JWT claim, fail-open so legitimate requests don't break
    logger.error({ err: error, userId }, "[Auth] DB lookup failed for plan");
    return fallbackPlan;
  }
}

/** Call this after any code path that updates users.plan to invalidate the cache */
export async function invalidateUserPlanCache(userId: string): Promise<void> {
  // Added: since we're using real Redis, we issue a direct delete call
  await cache.delete(`user_plan:${userId}`);
}

async function isAccountActive(userId: string): Promise<boolean> {
  const cacheKey = `user_active:${userId}`;
  const cached = await safeCacheGet(cacheKey);
  if (cached !== null && cached !== undefined) return cached === "1";

  try {
    const [row] = await db.select({ isActive: usersTable.isActive })
      .from(usersTable).where(eq(usersTable.id, userId));
    const active = row ? row.isActive !== false : true;
    await cache.set(cacheKey, active ? "1" : "0", PLAN_CACHE_TTL_SECONDS);
    return active;
  } catch (error) {
    // DB error → fail-open (same policy as plan lookup) so a transient
    // outage doesn't lock every user out.
    logger.error({ err: error, userId }, "[Auth] DB lookup failed for is_active");
    return true;
  }
}

/** Call this after deactivating/reactivating a user to invalidate the cache immediately */
export async function invalidateUserActiveCache(userId: string): Promise<void> {
  await cache.delete(`user_active:${userId}`);
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

    // A5: Token revocation — reject tokens issued before last logout.
    // A Redis failure here falls through as "no logout recorded" (same
    // fail-open policy as everywhere else in this file) rather than
    // rejecting the request.
    const logoutTs = await safeCacheGet(`logout:user:${payload.userId}`);
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

    // Reject deactivated accounts (e.g. under-18 age-gate block) even if
    // they somehow obtain a fresh, otherwise-valid token — is_active is
    // account status, which a JWT signature alone can't reflect.
    if (!(await isAccountActive(payload.userId))) {
      res.status(403).json({ error: "ACCOUNT_DEACTIVATED", message: "This account has been deactivated." });
      return;
    }

    // FIX C3 & Expiry — read latest plan & expiry from DB (cached 120s) instead of trusting JWT claim
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
      
      // Added: await for the Redis network call
      const logoutTs = await safeCacheGet(`logout:user:${payload.userId}`);
      
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