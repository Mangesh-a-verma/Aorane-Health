import { Router } from "express";
import { db, stressLogsTable, userProfilesTable, exerciseLogsTable, waterLogsTable, medicineLogsTable, foodLogsTable } from "@workspace/db";
import { eq, and, gte, desc } from "drizzle-orm";
import { requireAuth } from "../../middlewares/user-auth";
import type { AuthRequest } from "../../middlewares/user-auth";

const router = Router();

router.post("/stress/log", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { stressType, mood, heartRateAvg, pillars, aiInsight, stressScore: manualScore } = req.body as Record<string, unknown>;

    let stressScore = Number(manualScore) || 0;
    let pillarData = pillars;

    if (stressType === "five_pillar") {
      const today = new Date().toISOString().split("T")[0];
      const todayStart = new Date(`${today}T00:00:00Z`);
      const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, req.userId!));
      const waterLogs = await db.select().from(waterLogsTable).where(and(eq(waterLogsTable.userId, req.userId!), gte(waterLogsTable.loggedAt, todayStart)));
      const exerciseLogs = await db.select().from(exerciseLogsTable).where(and(eq(exerciseLogsTable.userId, req.userId!), gte(exerciseLogsTable.loggedAt, todayStart)));
      const waterGlasses = waterLogs.reduce((s, l) => s + (l.glassesCount || 0), 0);
      const exerciseMin = exerciseLogs.reduce((s, l) => s + (l.durationMinutes || 0), 0);
      const sleepHours = Number(profile?.sleepHoursAvg) || 7;
      const sleepScore = Math.min(100, (sleepHours / 8) * 100);
      const waterScore = Math.min(100, (waterGlasses / 8) * 100);
      const exerciseScore = Math.min(100, (exerciseMin / 30) * 100);
      const medicineScore = 70;
      const foodScore = 65;
      stressScore = Math.round(100 - ((sleepScore + waterScore + exerciseScore + medicineScore + foodScore) / 5));
      stressScore = Math.max(10, Math.min(95, stressScore));
      pillarData = { sleep: sleepScore, water: waterScore, exercise: exerciseScore, medicine: medicineScore, food: foodScore };
    }

    if (stressType === "mood") {
      const moodScores: Record<string, number> = { happy: 15, neutral: 40, stressed: 72, sad: 65 };
      stressScore = moodScores[mood as string] || 40;
    }

    const [log] = await db.insert(stressLogsTable).values({
      userId: req.userId!,
      stressType: (stressType as "ppg" | "mood" | "five_pillar") || "mood",
      stressScore,
      mood: (mood as "happy" | "neutral" | "stressed" | "sad") || undefined,
      heartRateAvg: heartRateAvg ? Number(heartRateAvg) : undefined,
      pillars: pillarData || undefined,
      aiInsight: aiInsight as string || undefined,
      loggedAt: new Date(),
    }).returning();

    res.status(201).json({ success: true, log, stressScore });
  } catch (err) {
    res.status(500).json({ error: "Failed to log stress" });
  }
});

router.get("/stress/logs", requireAuth, async (req: AuthRequest, res) => {
  try {
    const limit = Number(req.query["limit"]) || 30;
    const logs = await db.select().from(stressLogsTable)
      .where(eq(stressLogsTable.userId, req.userId!))
      .orderBy(desc(stressLogsTable.loggedAt))
      .limit(limit);
    const avgScore = logs.length ? Math.round(logs.reduce((s, l) => s + l.stressScore, 0) / logs.length) : 0;
    res.json({ logs, avgScore, count: logs.length });
  } catch {
    res.status(500).json({ error: "Failed to get stress logs" });
  }
});

router.get("/stress/insight", requireAuth, async (req: AuthRequest, res) => {
  try {
    const recentLogs = await db.select().from(stressLogsTable)
      .where(eq(stressLogsTable.userId, req.userId!))
      .orderBy(desc(stressLogsTable.loggedAt))
      .limit(7);
    const avg = recentLogs.length ? Math.round(recentLogs.reduce((s, l) => s + l.stressScore, 0) / recentLogs.length) : 40;
    let insight = "";
    if (avg < 30) insight = "Bahut achha! Aapka stress level kaafi low hai. Isi routine ko maintain karo — neend, pani, aur exercise ka balance perfect hai.";
    else if (avg < 55) insight = "Stress moderate hai — thoda dhyan do. Roz 10 minute ka meditation ya deep breathing try karo. Pani 8 glass pina mat bhoolo.";
    else if (avg < 75) insight = "Stress high hai. Zindagi mein kuch cheezein adjust karo — neend kam mat karo, aur exercise zaroor karo. Apne mann ki baat kisi se karo.";
    else insight = "Stress bahut high hai! Please ek doctor ya counselor se milein. Daily 4-7-8 breathing try karein aur social media screen time kam karein.";
    res.json({ avgScore: avg, insight, logsCount: recentLogs.length });
  } catch {
    res.status(500).json({ error: "Failed to get insight" });
  }
});

export default router;
