import type { Request, Response, NextFunction } from "express";
import { verifyBusinessToken } from "../lib/jwt";
import { cache } from "../lib/redis";

export interface BusinessRequest extends Request {
  orgAdminId?: string;
  orgId?: string;
  orgRole?: string;
}

export async function requireBusinessAuth(req: BusinessRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Business authorization required" });
    return;
  }
  const token = authHeader.split(" ")[1];
  try {
    const payload = verifyBusinessToken(token);

    // A5: Token revocation — reject tokens issued before last logout
    const logoutTs = await cache.get(`logout:business:${payload.orgAdminId}`);
    if (logoutTs) {
      const decoded = payload as unknown as { iat?: number };
      const iat = decoded.iat ?? 0;
      if (iat < parseInt(logoutTs, 10)) {
        res.status(401).json({ error: "Token has been revoked. Please log in again." });
        return;
      }
    }

    req.orgAdminId = payload.orgAdminId;
    req.orgId = payload.orgId;
    req.orgRole = payload.role;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired business token" });
  }
}
