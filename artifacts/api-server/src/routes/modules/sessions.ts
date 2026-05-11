/**
 * App Sessions — DAU/MAU Tracking
 * POST /sessions/start       — Start a new session (on app open)
 * POST /sessions/heartbeat   — Update last_seen_at (every 5 min)
 * POST /sessions/end         — Mark session ended (on app background/close)
 * GET  /sessions/me          — Current user's recent sessions
 */

import { Router } from "express";
import { db, appSessionsTable } from "@workspace/db";
import { eq, desc, and, gte } from "drizzle-orm";
import { requireAuth } from "../../middlewares/user-auth";
import type { AuthRequest } from "../../middlewares/user-auth";
import { requireAdmin } from "../../middlewares/admin-auth";
import crypto from "crypto";

const router = Router();

// ── Start Session ─────────────────────────────────────────────────────────────
router.post("/sessions/start", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { deviceType = "mobile", deviceModel, appVersion, platform } = req.body as {
      deviceType?: string;
      deviceModel?: string;
      appVersion?: string;
      platform?: string;
    };

    const sessionId = `${userId}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

    const [session] = await db.insert(appSessionsTable).values({
      userId,
      sessionId,
      deviceType,
      deviceModel,
      appVersion,
      platform,
      startedAt: new Date(),
      lastSeenAt: new Date(),
      isActive: true,
    }).returning();

    res.status(201).json({ sessionId: session.sessionId, session });
  } catch (err) {
    req.log.error({ err }, "Session start error");
    res.status(500).json({ error: "Failed to start session" });
  }
});

// ── Heartbeat ─────────────────────────────────────────────────────────────────
router.post("/sessions/heartbeat", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { sessionId, screenCount } = req.body as { sessionId: string; screenCount?: number };
    if (!sessionId) { res.status(400).json({ error: "sessionId required" }); return; }

    const updates: Record<string, unknown> = { lastSeenAt: new Date() };
    if (screenCount !== undefined) updates.screenCount = screenCount;

    await db.update(appSessionsTable)
      .set(updates)
      .where(and(eq(appSessionsTable.sessionId, sessionId), eq(appSessionsTable.userId, req.userId!)));

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Heartbeat failed" });
  }
});

// ── End Session ───────────────────────────────────────────────────────────────
router.post("/sessions/end", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { sessionId, durationSeconds, screenCount } = req.body as {
      sessionId: string;
      durationSeconds?: number;
      screenCount?: number;
    };
    if (!sessionId) { res.status(400).json({ error: "sessionId required" }); return; }

    await db.update(appSessionsTable)
      .set({
        isActive: false,
        endedAt: new Date(),
        lastSeenAt: new Date(),
        durationSeconds: durationSeconds ?? undefined,
        screenCount: screenCount ?? undefined,
      })
      .where(and(eq(appSessionsTable.sessionId, sessionId), eq(appSessionsTable.userId, req.userId!)));

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to end session" });
  }
});

// ── User's recent sessions ────────────────────────────────────────────────────
router.get("/sessions/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const limit = Math.min(Number(req.query["limit"]) || 10, 50);
    const sessions = await db.select().from(appSessionsTable)
      .where(eq(appSessionsTable.userId, req.userId!))
      .orderBy(desc(appSessionsTable.startedAt))
      .limit(limit);

    const totalSessions = sessions.length;
    const avgDuration = sessions.filter(s => s.durationSeconds).reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0) /
      (sessions.filter(s => s.durationSeconds).length || 1);

    res.json({ sessions, totalSessions, avgDurationSeconds: Math.round(avgDuration) });
  } catch {
    res.status(500).json({ error: "Failed to get sessions" });
  }
});

// ── Admin: DAU/MAU stats (last 30 days, grouped by date) ─────────────────────
router.get("/sessions/dau", requireAdmin, async (_req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sessions = await db.select().from(appSessionsTable)
      .where(gte(appSessionsTable.startedAt, thirtyDaysAgo))
      .orderBy(desc(appSessionsTable.startedAt));

    const dayMap: Record<string, Set<string>> = {};
    const monthUsers = new Set<string>();

    for (const s of sessions) {
      const day = s.startedAt.toISOString().split("T")[0]!;
      if (!dayMap[day]) dayMap[day] = new Set();
      dayMap[day].add(s.userId);
      monthUsers.add(s.userId);
    }

    const dau = Object.entries(dayMap)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, users]) => ({ date, activeUsers: users.size }));

    res.json({
      dau,
      mau: monthUsers.size,
      totalSessions: sessions.length,
      periodDays: 30,
    });
  } catch {
    res.status(500).json({ error: "Failed to get DAU stats" });
  }
});

export default router;
