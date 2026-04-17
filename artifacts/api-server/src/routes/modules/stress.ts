import { Router } from "express";
import { db, stressLogsTable, userProfilesTable, exerciseLogsTable, waterLogsTable } from "@workspace/db";
import { eq, and, gte, desc } from "drizzle-orm";
import { requireAuth } from "../../middlewares/user-auth";
import type { AuthRequest } from "../../middlewares/user-auth";
import { aiRateLimit } from "../../middlewares/ai-rate-limit";
import { callAI } from "../../lib/ai";

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

// Weekly summary — last 7 days, daily avg stress score
router.get("/stress/weekly", requireAuth, async (req: AuthRequest, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const logs = await db.select().from(stressLogsTable)
      .where(and(eq(stressLogsTable.userId, req.userId!), gte(stressLogsTable.loggedAt, sevenDaysAgo)))
      .orderBy(desc(stressLogsTable.loggedAt));

    const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const DAY_NAMES_HI = ["Ravi", "Som", "Mang", "Budh", "Guru", "Shukr", "Shan"];

    const days: Array<{
      date: string; dayLabel: string; dayLabelHi: string;
      avgScore: number; count: number; dominantMood: string | null;
    }> = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0]!;
      const dayLogs = logs.filter(l => l.loggedAt.toISOString().split("T")[0] === dateStr);
      const avg = dayLogs.length ? Math.round(dayLogs.reduce((s, l) => s + l.stressScore, 0) / dayLogs.length) : 0;
      const moods = dayLogs.filter(l => l.mood).map(l => l.mood!);
      const moodCount: Record<string, number> = {};
      moods.forEach(m => { moodCount[m] = (moodCount[m] || 0) + 1; });
      const dominantMood = moods.length ? Object.entries(moodCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null : null;
      days.push({ date: dateStr, dayLabel: DAY_NAMES[d.getDay()]!, dayLabelHi: DAY_NAMES_HI[d.getDay()]!, avgScore: avg, count: dayLogs.length, dominantMood });
    }

    const weekAvg = days.filter(d => d.count > 0).reduce((s, d) => s + d.avgScore, 0) /
      (days.filter(d => d.count > 0).length || 1);

    res.json({ days, weekAvg: Math.round(weekAvg), totalLogs: logs.length });
  } catch {
    res.status(500).json({ error: "Failed to get weekly data" });
  }
});

// AI-powered insight using Gemini
router.get("/stress/insight", requireAuth, aiRateLimit("stress_insight", 5), async (req: AuthRequest, res) => {
  try {
    const recentLogs = await db.select().from(stressLogsTable)
      .where(eq(stressLogsTable.userId, req.userId!))
      .orderBy(desc(stressLogsTable.loggedAt))
      .limit(14);

    const avg = recentLogs.length
      ? Math.round(recentLogs.reduce((s, l) => s + l.stressScore, 0) / recentLogs.length)
      : 40;

    let insight = "";
    let aiTips: string[] = [];

    if (recentLogs.length > 0) {
      const logSummary = recentLogs.slice(0, 7).map(l =>
        `${l.loggedAt.toISOString().split("T")[0]}: score=${l.stressScore}, type=${l.stressType}${l.mood ? `, mood=${l.mood}` : ""}${l.pillars ? `, pillars=${JSON.stringify(l.pillars)}` : ""}`
      ).join("\n");

      const prompt = `You are an Indian health AI assistant for the Aorane app. Analyze this user's stress data and give personalized advice in English.

Stress logs (last 7 entries):
${logSummary}

Average stress score: ${avg}/100 (0=no stress, 100=extreme stress)

Give:
1. One SHORT insight sentence (1-2 lines) in English about their stress pattern
2. Three specific actionable tips in English (each tip max 1 line, Indian health context)

Format your response as JSON exactly like this:
{"insight": "...", "tips": ["tip1", "tip2", "tip3"]}`;

      try {
        const raw = await callAI("stress_ai", [{ role: "user", content: prompt }], { maxTokens: 600 });
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as { insight?: string; tips?: string[] };
          insight = parsed.insight || "";
          aiTips = parsed.tips || [];
        }
      } catch { }
    }

    if (!insight) {
      if (avg < 30) insight = "Great work! Your stress level is quite low. Keep up this healthy routine.";
      else if (avg < 55) insight = "Your stress is moderate. Try 10 minutes of breathing or meditation daily.";
      else if (avg < 75) insight = "Your stress is elevated. Focus on sleep and exercise, and talk to someone you trust.";
      else insight = "Your stress is very high. Please consult a doctor or counselor. Practice 4-7-8 breathing daily.";
    }
    if (!aiTips.length) {
      if (avg < 30) aiTips = ["Take a 15-minute walk or yoga session daily", "Aim for 7–8 hours of sleep", "Eat meals at regular times"];
      else if (avg < 55) aiTips = ["Practice 4-7-8 breathing for 5 minutes daily", "Drink at least 8 glasses of water", "Reduce screen time before bed"];
      else aiTips = ["Start 4-7-8 breathing right now", "Get at least 15 minutes of exercise today", "Talk to a friend or family member about how you feel"];
    }

    res.json({ avgScore: avg, insight, tips: aiTips, logsCount: recentLogs.length, aiPowered: recentLogs.length > 0 });
  } catch {
    res.status(500).json({ error: "Failed to get insight" });
  }
});

export default router;
