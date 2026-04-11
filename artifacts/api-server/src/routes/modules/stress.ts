import { Router } from "express";
import { db, stressLogsTable, userProfilesTable, exerciseLogsTable, waterLogsTable } from "@workspace/db";
import { eq, and, gte, desc } from "drizzle-orm";
import { requireAuth } from "../../middlewares/user-auth";
import type { AuthRequest } from "../../middlewares/user-auth";

const router = Router();

async function callGemini(prompt: string, key: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }
  );
  const data = await res.json() as { candidates?: Array<{ content: { parts: Array<{ text: string }> } }> };
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
}

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
router.get("/stress/insight", requireAuth, async (req: AuthRequest, res) => {
  try {
    const recentLogs = await db.select().from(stressLogsTable)
      .where(eq(stressLogsTable.userId, req.userId!))
      .orderBy(desc(stressLogsTable.loggedAt))
      .limit(14);

    const avg = recentLogs.length
      ? Math.round(recentLogs.reduce((s, l) => s + l.stressScore, 0) / recentLogs.length)
      : 40;

    const geminiKey = process.env["GOOGLE_GEMINI_API_KEY"];
    let insight = "";
    let aiTips: string[] = [];

    if (geminiKey && recentLogs.length > 0) {
      const logSummary = recentLogs.slice(0, 7).map(l =>
        `${l.loggedAt.toISOString().split("T")[0]}: score=${l.stressScore}, type=${l.stressType}${l.mood ? `, mood=${l.mood}` : ""}${l.pillars ? `, pillars=${JSON.stringify(l.pillars)}` : ""}`
      ).join("\n");

      const prompt = `You are an Indian health AI assistant for AORANE app. Analyze this user's stress data and give personalized advice in Hinglish (mix of Hindi + English).

Stress logs (last 7 entries):
${logSummary}

Average stress score: ${avg}/100 (0=no stress, 100=extreme stress)

Give:
1. One SHORT insight sentence (1-2 lines) in Hinglish about their stress pattern
2. Three specific actionable tips in Hinglish (each tip max 1 line, Indian context)

Format your response as JSON exactly like this:
{"insight": "...", "tips": ["tip1", "tip2", "tip3"]}`;

      try {
        const raw = await callGemini(prompt, geminiKey);
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as { insight?: string; tips?: string[] };
          insight = parsed.insight || "";
          aiTips = parsed.tips || [];
        }
      } catch { }
    }

    if (!insight) {
      if (avg < 30) insight = "Bahut achha! Aapka stress level kaafi low hai. Isi routine ko maintain karo.";
      else if (avg < 55) insight = "Stress moderate hai. Thoda dhyan do — roz 10 min breathing ya meditation try karo.";
      else if (avg < 75) insight = "Stress high hai. Neend aur exercise pe focus karo. Mann ki baat kisi se share karo.";
      else insight = "Stress bahut high hai! Ek doctor ya counselor se milein. Daily 4-7-8 breathing zaroor karein.";
    }
    if (!aiTips.length) {
      if (avg < 30) aiTips = ["Roz 15 min walk ya yoga karo", "7-8 ghante ki neend lo", "Khana samay pe khao"];
      else if (avg < 55) aiTips = ["4-7-8 breathing roz 5 min karo", "Paani 8 glass pina mat bhoolo", "Mobile screen time kam karo"];
      else aiTips = ["Abhi 4-7-8 breathing shuru karo", "Aaj exercise zaroor karo, chahe 15 min walking ho", "Kisi dost ya family se baat karo"];
    }

    res.json({ avgScore: avg, insight, tips: aiTips, logsCount: recentLogs.length, aiPowered: !!(geminiKey && recentLogs.length > 0) });
  } catch {
    res.status(500).json({ error: "Failed to get insight" });
  }
});

export default router;
