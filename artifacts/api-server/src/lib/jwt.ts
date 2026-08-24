import jwt from "jsonwebtoken";
import { logger } from "./logger";

// FIX SEC-1: Treat any non-local environment as production-strict for secrets.
// Previously only NODE_ENV === "production" was checked, so a mis-set staging/
// preview deploy (Render/Vercel preview URLs) could silently fall back to a
// predictable dev secret. Now anything other than "development"/"test" must
// supply real secrets.
function requireSecret(name: string): string {
  const val = process.env[name];
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const isDevLike = nodeEnv === "development" || nodeEnv === "test";
  if (!val) {
    if (!isDevLike) {
      throw new Error(`FATAL: Environment variable ${name} is not set. Refusing to start.`);
    }
    logger.warn(
      { name },
      "[JWT] WARNING: secret not set — using insecure dev fallback. NEVER deploy to production without this secret."
    );
    return `${name}_dev_fallback_not_for_prod`;
  }
  return val;
}

const JWT_SECRET          = requireSecret("JWT_SECRET");
const JWT_REFRESH_SECRET  = requireSecret("JWT_REFRESH_SECRET");
const ADMIN_JWT_SECRET    = requireSecret("ADMIN_JWT_SECRET");
const BUSINESS_JWT_SECRET = requireSecret("BUSINESS_JWT_SECRET");

export type UserTokenPayload = {
  userId: string;
  phone?: string;
  email?: string;
  plan: string;
};

export type AdminTokenPayload = {
  adminId: string;
  role: string;
};

export type BusinessTokenPayload = {
  orgAdminId: string;
  orgId: string;
  role: string;
};

// FIX H-3: Access tokens valid for 1 hour only.
export function signUserToken(payload: UserTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });
}

// FIX H-3: Refresh tokens valid for 30 days. App uses this to get a new access token.
export function signRefreshToken(payload: UserTokenPayload): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: "30d" });
}

// SECURITY: explicit `algorithms` allowlist as defense-in-depth. All four
// verify calls below previously relied on jsonwebtoken inferring HS256 from
// the secret being a plain string — not currently exploitable since these
// secrets are never PEM keys, but pinning it explicitly means a future
// change (e.g. switching to PEM-based keys) can't silently reopen an
// algorithm-confusion class of bug.
export function verifyUserToken(token: string): UserTokenPayload {
  return jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] }) as UserTokenPayload;
}

export function verifyRefreshToken(token: string): UserTokenPayload {
  return jwt.verify(token, JWT_REFRESH_SECRET, { algorithms: ["HS256"] }) as UserTokenPayload;
}

// FIX H-3: Admin tokens restricted to 1 day for high-privilege sessions.
export function signAdminToken(payload: AdminTokenPayload): string {
  return jwt.sign(payload, ADMIN_JWT_SECRET, { expiresIn: "1d" });
}

export function verifyAdminToken(token: string): AdminTokenPayload {
  return jwt.verify(token, ADMIN_JWT_SECRET, { algorithms: ["HS256"] }) as AdminTokenPayload;
}

// FIX H-3: Business tokens restricted to 1 day.
export function signBusinessToken(payload: BusinessTokenPayload): string {
  return jwt.sign(payload, BUSINESS_JWT_SECRET, { expiresIn: "1d" });
}

export function verifyBusinessToken(token: string): BusinessTokenPayload {
  return jwt.verify(token, BUSINESS_JWT_SECRET, { algorithms: ["HS256"] }) as BusinessTokenPayload;
}