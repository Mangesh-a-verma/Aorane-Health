import { Router } from "express";
import { db, periodLogsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../../middlewares/user-auth";
import type { AuthRequest } from "../../middlewares/user-auth";

const router = Router();

function predictNextCycle(logs: Array<{ startDate: string; cycleLength: number | null }>) {
  if (!logs.length) return null;
  const latest = logs[0];
  const avgCycle = logs.length > 1
    ? Math.round(logs.slice(0, 5).reduce((s: any, l: any) => s + (l.cycleLength || 28), 0) / Math.min(logs.length, 5))
    : (latest.cycleLength || 28);
  const lastStart = new Date(latest.startDate);
  const nextStart = new Date(lastStart);
  nextStart.setDate(nextStart.getDate() + avgCycle);
  const fertileStart = new Date(nextStart);
  fertileStart.setDate(fertileStart.getDate() - 18);
  const fertileEnd = new Date(nextStart);
  fertileEnd.setDate(fertileEnd.getDate() - 12);
  return {
    nextPeriodDate: nextStart.toISOString().split("T")[0],
    fertileWindowStart: fertileStart.toISOString().split("T")[0],
    fertileWindowEnd: fertileEnd.toISOString().split("T")[0],
    avgCycleLength: avgCycle,
    daysUntilNext: Math.max(0, Math.round((nextStart.getTime() - Date.now()) / 86400000)),
  };
}

router.get("/period/logs", requireAuth, async (req: AuthRequest, res) => {
  try {
    const logs = await db.select().from(periodLogsTable)
      .where(eq(periodLogsTable.userId, req.userId!))
      .orderBy(desc(periodLogsTable.startDate))
      .limit(12);
    const prediction = predictNextCycle(logs);
    res.json({ logs, prediction });
  } catch {
    res.status(500).json({ error: "Failed to get period logs" });
  }
});

router.post("/period/log", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate, symptoms, flow, notes } = req.body as Record<string, unknown>;
    if (!startDate) { res.status(400).json({ error: "startDate required" }); return; }
    let cycleLength: number | null = null;
    const recentLogs = await db.select().from(periodLogsTable).where(eq(periodLogsTable.userId, req.userId!)).orderBy(desc(periodLogsTable.startDate)).limit(1);
    if (recentLogs.length) {
      const prevStart = new Date(recentLogs[0].startDate);
      const thisStart = new Date(startDate as string);
      cycleLength = Math.round((thisStart.getTime() - prevStart.getTime()) / 86400000);
      if (cycleLength < 15 || cycleLength > 60) cycleLength = 28;
    }
    const [log] = await db.insert(periodLogsTable).values({
      userId: req.userId!, startDate: startDate as string,
      endDate: endDate as string || undefined,
      symptoms: (symptoms as string[]) || [],
      flow: flow as string || "medium",
      notes: notes as string || undefined,
      cycleLength,
    }).returning();
    const allLogs = await db.select().from(periodLogsTable).where(eq(periodLogsTable.userId, req.userId!)).orderBy(desc(periodLogsTable.startDate)).limit(12);
    const prediction = predictNextCycle(allLogs);
    res.status(201).json({ success: true, log, prediction });
  } catch {
    res.status(500).json({ error: "Failed to log period" });
  }
});

router.patch("/period/log/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = String(req.params.id);
    const { endDate, symptoms, flow, notes } = req.body as Record<string, unknown>;
    const [updated] = await db.update(periodLogsTable).set({ endDate: endDate as string, symptoms: symptoms as string[], flow: flow as string, notes: notes as string }).where(eq(periodLogsTable.id, id)).returning();
    res.json({ success: true, log: updated });
  } catch {
    res.status(500).json({ error: "Failed to update period log" });
  }
});

export default router;
