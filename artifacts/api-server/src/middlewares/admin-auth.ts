import type { Request, Response, NextFunction } from "express";
import { verifyAdminToken } from "../lib/jwt";
import { cache } from "../lib/redis";

export interface AdminRequest extends Request {
  adminId?: string;
  adminRole?: string;
}

// Two-tier role model: "admin" (default for every existing row) can manage
// day-to-day content/support data; "super_admin" is required for actions
// that affect money, platform-wide config, or another org's/user's data
// irreversibly. There is no self-service way to become super_admin — an
// existing super_admin must promote via PATCH /admin/admin-users/:id/role,
// or the first one is set directly in the database.
export function requireSuperAdmin(req: AdminRequest, res: Response, next: NextFunction): void {
  if (req.adminRole !== "super_admin") {
    res.status(403).json({ error: "This action requires super admin access" });
    return;
  }
  next();
}

export async function requireAdmin(req: AdminRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Admin authorization required" });
    return;
  }
  const token = authHeader.split(" ")[1];
  try {
    const payload = verifyAdminToken(token);

    // A5: Token revocation — reject tokens issued before last logout
    const logoutTs = await cache.get(`logout:admin:${payload.adminId}`);
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
