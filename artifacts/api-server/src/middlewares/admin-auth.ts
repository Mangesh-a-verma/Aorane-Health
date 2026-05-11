import type { Request, Response, NextFunction } from "express";
import { verifyAdminToken } from "../lib/jwt";
import { cache } from "../lib/redis";

export interface AdminRequest extends Request {
  adminId?: string;
  adminRole?: string;
}

export function requireAdmin(req: AdminRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Admin authorization required" });
    return;
  }
  const token = authHeader.split(" ")[1];
  try {
    const payload = verifyAdminToken(token);

    // A5: Token revocation — reject tokens issued before last logout
    const logoutTs = cache.get(`logout:admin:${payload.adminId}`);
    if (logoutTs) {
      const decoded = payload as unknown as { iat?: number };
      const iat = decoded.iat ?? 0;
      if (iat < parseInt(logoutTs, 10)) {
        res.status(401).json({ error: "Token has been revoked. Please log in again." });
        return;
      }
    }

    req.adminId = payload.adminId;
    req.adminRole = payload.role;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired admin token" });
  }
}
