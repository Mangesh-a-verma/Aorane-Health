import type { Request, Response, NextFunction } from "express";
import { verifyUserToken } from "../lib/jwt";
import { cache } from "../lib/redis";

export interface AuthRequest extends Request {
  userId?: string;
  userPlan?: string;
  userPhone?: string;
  userEmail?: string;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
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
    req.userPlan = payload.plan;
    req.userPhone = payload.phone;
    req.userEmail = payload.email;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const payload = verifyUserToken(token);
      const logoutTs = cache.get(`logout:user:${payload.userId}`);
      if (!logoutTs) {
        req.userId = payload.userId;
        req.userPlan = payload.plan;
      } else {
        const decoded = payload as unknown as { iat?: number };
        const iat = decoded.iat ?? 0;
        if (iat >= parseInt(logoutTs, 10)) {
          req.userId = payload.userId;
          req.userPlan = payload.plan;
        }
      }
    } catch {
      // ignore
    }
  }
  next();
}
