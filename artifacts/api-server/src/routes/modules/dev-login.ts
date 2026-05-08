import { Router } from "express";
import { db, usersTable, userProfilesTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { signUserToken, signRefreshToken } from "../../lib/jwt";
import { logger } from "../../lib/logger";

const router = Router();

if (process.env.NODE_ENV !== "production") {
  /**
   * DEV-ONLY: POST /auth/dev-login
   * Body: { phone: "9420228752" }
   * Returns a valid JWT for the user with that phone number.
   * Used by the web preview dev-login page to bypass OTP flow.
   */
  router.post("/auth/dev-login", async (req, res) => {
    const { phone } = req.body as { phone?: string };
    if (!phone) {
      res.status(400).json({ error: "phone required" });
      return;
    }
    const normalized = phone.replace(/^\+91/, "").replace(/^91(?=\d{10}$)/, "").replace(/\s+/g, "");

    try {
      const [user] = await db
        .select({
          id: usersTable.id,
          phone: usersTable.phone,
          email: usersTable.email,
          fullName: userProfilesTable.fullName,
          aoraneId: userProfilesTable.aoraneId,
        })
        .from(usersTable)
        .leftJoin(userProfilesTable, eq(userProfilesTable.userId, usersTable.id))
        .where(or(eq(usersTable.phone, normalized), eq(usersTable.phone, `+91${normalized}`)))
        .limit(1);

      if (!user) {
        res.status(404).json({ error: `No user found with phone ${normalized}` });
        return;
      }

      const tokenPayload = { userId: user.id, phone: user.phone ?? undefined, email: user.email ?? undefined, plan: "free" };
      const token = signUserToken(tokenPayload);
      const refreshToken = signRefreshToken(tokenPayload);

      logger.info({ userId: user.id, phone: user.phone }, "[DevLogin] issued dev JWT");

      res.json({
        token,
        refreshToken,
        user: {
          id: user.id,
          phone: user.phone,
          email: user.email,
          fullName: user.fullName,
          aoraneId: user.aoraneId,
        },
      });
    } catch (err) {
      logger.error({ err }, "[DevLogin] error");
      res.status(500).json({ error: "Internal error" });
    }
  });
}

export default router;
