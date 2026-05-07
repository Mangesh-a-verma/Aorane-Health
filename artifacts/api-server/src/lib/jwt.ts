import jwt from "jsonwebtoken";

function requireSecret(name: string): string {
  const val = process.env[name];
  if (!val) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`FATAL: Environment variable ${name} is not set. Refusing to start.`);
    }
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

export function signUserToken(payload: UserTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function signRefreshToken(payload: UserTokenPayload): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: "90d" });
}

export function verifyUserToken(token: string): UserTokenPayload {
  return jwt.verify(token, JWT_SECRET) as UserTokenPayload;
}

export function verifyRefreshToken(token: string): UserTokenPayload {
  return jwt.verify(token, JWT_REFRESH_SECRET) as UserTokenPayload;
}

export function signAdminToken(payload: AdminTokenPayload): string {
  return jwt.sign(payload, ADMIN_JWT_SECRET, { expiresIn: "7d" });
}

export function verifyAdminToken(token: string): AdminTokenPayload {
  return jwt.verify(token, ADMIN_JWT_SECRET) as AdminTokenPayload;
}

export function signBusinessToken(payload: BusinessTokenPayload): string {
  return jwt.sign(payload, BUSINESS_JWT_SECRET, { expiresIn: "30d" });
}

export function verifyBusinessToken(token: string): BusinessTokenPayload {
  return jwt.verify(token, BUSINESS_JWT_SECRET) as BusinessTokenPayload;
}
