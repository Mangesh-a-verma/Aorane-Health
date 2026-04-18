/**
 * Health Intelligence Module
 * GET  /health/intelligence/predict       — Monthly disease risk prediction (DeepSeek)
 * POST /health/intelligence/predict/refresh — Force new prediction
 * GET  /health/intelligence/diet-chart    — Weekly diet chart (DeepSeek)
 * POST /health/intelligence/diet-chart/refresh — Force new diet chart
 * GET  /health/intelligence/exercise/met — MET values list
 * POST /health/intelligence/exercise/calories — Calculate calories via MET formula
 */

import { Router } from "express";
import { db, usersTable, userProfilesTable, userPreferencesTable, userMedicalConditionsTable, foodLogsTable, waterLogsTable, exerciseLogsTable, stressLogsTable, healthPredictionsTable, weeklyDietChartsTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { requireAuth } from "../../middlewares/user-auth";
import type { AuthRequest } from "../../middlewares/user-auth";
import { aiRateLimit } from "../../middlewares/ai-rate-limit";
import { callAI } from "../../lib/ai";
import { requireFeature } from "../../middlewares/feature-check";
import { getWeatherContext } from "../../lib/weather";
import { calculateCaloriesBurned, getMet, MET_VALUES } from "../../lib/met";

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getCurrentWeekStart(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon...
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const monday = new Date(now.getFullYear(), now.getMonth(), diff);
  return monday.toISOString().split("T")[0];
}

function getDateRange(daysBack: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - daysBack);
  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
  };
}

function calcAge(dob: string | null): number | null {
  if (!dob) return null;
  return Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365));
}

async function gatherUserContext(userId: string) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId)).limit(1);
  const [prefs] = await db.select().from(userPreferencesTable).where(eq(userPreferencesTable.userId, userId)).limit(1);
  const conditions = await db.select().from(userMedicalConditionsTable).where(eq(userMedicalConditionsTable.userId, userId));

  const age = calcAge(profile?.dateOfBirth as string | null);
  const weight = profile?.weightKg ? Number(profile.weightKg) : null;
  const height = profile?.heightCm ? Number(profile.heightCm) : null;
  const gender = profile?.gender ?? "other";
  const city = (profile as unknown as Record<string, string>)?.city ?? null;
  const state = (profile as unknown as Record<string, string>)?.state ?? null;
  const workProfile = (profile as unknown as Record<string, string>)?.workProfile ?? null;
  const conditionsList = conditions.map((c) => c.condition).join(", ") || "None";
  const dietaryPref = profile?.foodPreference ?? "vegetarian";
  const healthGoals = "General wellness";
  void prefs;

  let bmi: number | null = null;
  if (weight && height) bmi = Math.round((weight / ((height / 100) ** 2)) * 10) / 10;

  return { user, profile, age, weight, height, gender, city, state, workProfile, conditionsList, dietaryPref, healthGoals, bmi };
}

async function gather30DayData(userId: string) {
  const { from } = getDateRange(30);
  const toDate = new Date().toISOString().split("T")[0];

  const foodLogs = await db.select().from(foodLogsTable)
    .where(and(eq(foodLogsTable.userId, userId), gte(sql`DATE(${foodLogsTable.loggedAt})`, from)));

  const waterLogs = await db.select().from(waterLogsTable)
    .where(and(eq(waterLogsTable.userId, userId), gte(sql`DATE(${waterLogsTable.loggedAt})`, from)));

  const exerciseLogs = await db.select().from(exerciseLogsTable)
    .where(and(eq(exerciseLogsTable.userId, userId), gte(sql`DATE(${exerciseLogsTable.loggedAt})`, from)));

  const stressLogs = await db.select().from(stressLogsTable)
    .where(and(eq(stressLogsTable.userId, userId), gte(sql`DATE(${stressLogsTable.loggedAt})`, from)));

  const days = Math.max(1, Math.ceil((Date.now() - new Date(from).getTime()) / (1000 * 60 * 60 * 24)));

  const avgCalories = foodLogs.length > 0
    ? Math.round(foodLogs.reduce((s, l) => s + Number(l.calories ?? 0), 0) / days) : 0;
  const avgProtein = foodLogs.length > 0
    ? Math.round(foodLogs.reduce((s, l) => s + Number(l.proteinG ?? 0), 0) / days) : 0;
  const avgCarbs = foodLogs.length > 0
    ? Math.round(foodLogs.reduce((s, l) => s + Number(l.carbsG ?? 0), 0) / days) : 0;
  const avgFat = foodLogs.length > 0
    ? Math.round(foodLogs.reduce((s, l) => s + Number(l.fatG ?? 0), 0) / days) : 0;

  const avgWaterGlasses = waterLogs.length > 0
    ? Math.round((waterLogs.reduce((s, l) => s + (l.glassesCount ?? 0), 0) / days) * 10) / 10 : 0;

  const totalExerciseSessions = exerciseLogs.length;
  const avgExerciseMinutes = totalExerciseSessions > 0
    ? Math.round(exerciseLogs.reduce((s, l) => s + (l.durationMinutes ?? 0), 0) / totalExerciseSessions) : 0;

  const avgSleepHours = stressLogs.length > 0
    ? Math.round((stressLogs.reduce((s, l) => s + Number(l.sleepHours ?? 0), 0) / stressLogs.length) * 10) / 10 : null;
  const avgStressLevel = stressLogs.length > 0
    ? Math.round((stressLogs.reduce((s, l) => s + (l.stressScore ?? 5), 0) / stressLogs.length) * 10) / 10 : null;

  return {
    avgCalories, avgProtein, avgCarbs, avgFat,
    avgWaterGlasses, totalExerciseSessions, avgExerciseMinutes,
    avgSleepHours, avgStressLevel, days,
  };
}

// ── Monthly Disease Risk Prediction ──────────────────────────────────────────

router.get("/health/intelligence/predict", requireAuth, aiRateLimit("health_prediction", 5), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const month = getCurrentMonth();

    const cached = await db.select().from(healthPredictionsTable)
      .where(and(eq(healthPredictionsTable.userId, userId), eq(healthPredictionsTable.month, month)))
      .limit(1);

    if (cached.length > 0) {
      res.json({ prediction: cached[0].predictionJson, cached: true, generatedAt: cached[0].generatedAt, month }); return;
    }

    await generatePrediction(userId, month, res, false);
  } catch (err) {
    console.error("prediction error:", err);
    res.status(500).json({ error: "Health prediction failed. Please try again." });
  }
});

router.post("/health/intelligence/predict/refresh", requireAuth, aiRateLimit("health_prediction", 5), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const month = getCurrentMonth();
    await db.delete(healthPredictionsTable)
      .where(and(eq(healthPredictionsTable.userId, userId), eq(healthPredictionsTable.month, month)));
    await generatePrediction(userId, month, res, true);
  } catch (err) {
    console.error("prediction refresh error:", err);
    res.status(500).json({ error: "Health prediction refresh failed." });
  }
});

function getStaticPrediction(month: string, data: Awaited<ReturnType<typeof gather30DayData>>, ctx: Awaited<ReturnType<typeof gatherUserContext>>) {
  const score = data.avgSleepHours && data.avgSleepHours >= 7 && data.totalExerciseSessions >= 8 ? 72 : 60;
  return {
    overallScore: score,
    overallLabel: score >= 70 ? "Good" : "Fair",
    risks: [
      {
        name: "Dehydration Risk",
        percentage: data.avgWaterGlasses < 6 ? 55 : 25,
        level: data.avgWaterGlasses < 6 ? "moderate" : "low",
        reason: `Average water intake is ${data.avgWaterGlasses} glasses/day. Recommended is 8+ glasses.`,
        icon: "💧",
      },
      {
        name: "Sedentary Lifestyle",
        percentage: data.totalExerciseSessions < 8 ? 60 : 20,
        level: data.totalExerciseSessions < 8 ? "moderate" : "low",
        reason: `Only ${data.totalExerciseSessions} exercise sessions logged in the past 30 days.`,
        icon: "🏃",
      },
      {
        name: "Nutritional Imbalance",
        percentage: data.avgProtein < 50 ? 50 : 20,
        level: data.avgProtein < 50 ? "moderate" : "low",
        reason: `Average protein intake (${data.avgProtein}g/day) may be lower than optimal.`,
        icon: "🥗",
      },
    ],
    recommendations: [
      { title: "Stay Hydrated", detail: "Drink at least 8 glasses of water daily. Keep a bottle on your desk.", priority: "high" },
      { title: "Walk 30 Minutes Daily", detail: "A daily brisk walk reduces stress, improves heart health, and burns calories.", priority: "high" },
      { title: "Eat More Protein", detail: "Include dal, paneer, eggs, or sprouts in every meal for better muscle health.", priority: "medium" },
      { title: "Sleep 7-8 Hours", detail: "Quality sleep boosts immunity and mental health. Maintain a consistent bedtime.", priority: "high" },
      { title: "Reduce Salt & Sugar", detail: "Avoid processed foods, packed snacks, and excess chai/coffee.", priority: "medium" },
    ],
    disclaimer: "This is a general lifestyle insight based on your logged data. It is NOT a medical diagnosis. Please consult a qualified doctor for any health concerns.",
    generatedFor: month,
    isStaticFallback: true,
    ctx: ctx.gender,
  };
}

async function generatePrediction(userId: string, month: string, res: import("express").Response, forced: boolean) {
  const ctx = await gatherUserContext(userId);
  const data = await gather30DayData(userId);
  const weather = await getWeatherContext(ctx.city ?? "India", ctx.state ?? undefined);

  const prompt = `You are a certified preventive health analyst. Based on the user's 30-day health data, predict disease risks and give lifestyle recommendations.

USER PROFILE:
- Age: ${ctx.age ?? "Unknown"} years
- Gender: ${ctx.gender}
- Weight: ${ctx.weight ? ctx.weight + " kg" : "Unknown"}
- Height: ${ctx.height ? ctx.height + " cm" : "Unknown"}
- BMI: ${ctx.bmi ?? "Unknown"}
- Work: ${ctx.workProfile ?? "Unknown"}
- Known health conditions: ${ctx.conditionsList}
- Diet preference: ${ctx.dietaryPref}
- Health goals: ${ctx.healthGoals}

30-DAY AVERAGE DATA:
- Calories/day: ${data.avgCalories} kcal
- Protein/day: ${data.avgProtein}g
- Carbs/day: ${data.avgCarbs}g
- Fat/day: ${data.avgFat}g
- Water intake: ${data.avgWaterGlasses} glasses/day
- Exercise sessions: ${data.totalExerciseSessions} in 30 days (avg ${data.avgExerciseMinutes} min/session)
- Sleep: ${data.avgSleepHours ?? "Not tracked"} hours/night
- Stress level: ${data.avgStressLevel ?? "Not tracked"}/10
- Weather/Season context: ${weather}

INSTRUCTIONS:
1. Identify up to 5 health risks with percentage likelihood (0-100%)
2. Each risk must include a clear reason based on the actual data
3. Give 3-5 actionable lifestyle recommendations
4. Give an overall health score (0-100)
5. Add a mandatory disclaimer
6. Use simple English, no medical jargon

Return ONLY valid JSON (no markdown, no extra text):
{
  "overallScore": 72,
  "overallLabel": "Fair",
  "risks": [
    {
      "name": "Risk name",
      "percentage": 45,
      "level": "moderate",
      "reason": "Reason based on data",
      "icon": "heart"
    }
  ],
  "recommendations": [
    {
      "title": "Short title",
      "detail": "What to do and why",
      "priority": "high"
    }
  ],
  "disclaimer": "This is a lifestyle prediction based on your self-reported data. It is NOT a medical diagnosis. Please consult a qualified doctor for any health concerns.",
  "generatedFor": "${month}"
}`;

  let prediction: unknown;
  try {
    const jsonStr = await callAI("health_prediction", [
      { role: "system", content: "You are a preventive health analyst. Return only valid JSON." },
      { role: "user", content: prompt },
    ], { maxTokens: 3000, temperature: 0.5 });
    prediction = JSON.parse(jsonStr);
  } catch (aiErr) {
    console.warn("[Health Prediction] AI call failed, using static fallback:", (aiErr as Error).message);
    prediction = getStaticPrediction(month, data, ctx);
  }

  await db.insert(healthPredictionsTable).values({
    userId,
    month,
    predictionJson: prediction as Record<string, unknown>,
    dataSnapshotJson: data as unknown as Record<string, unknown>,
    weatherContext: weather,
  }).onConflictDoUpdate({
    target: [healthPredictionsTable.userId, healthPredictionsTable.month],
    set: { predictionJson: prediction as Record<string, unknown>, dataSnapshotJson: data as unknown as Record<string, unknown>, weatherContext: weather, generatedAt: new Date() },
  });

  res.json({ prediction, cached: false, forced, month, generatedAt: new Date() });
}

// ── Weekly Diet Chart ─────────────────────────────────────────────────────────

router.get("/health/intelligence/diet-chart", requireAuth, aiRateLimit("diet_chart", 4), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const weekStart = getCurrentWeekStart();

    const cached = await db.select().from(weeklyDietChartsTable)
      .where(and(eq(weeklyDietChartsTable.userId, userId), eq(weeklyDietChartsTable.weekStart, weekStart)))
      .limit(1);

    if (cached.length > 0) {
      res.json({ dietChart: cached[0].dietChartJson, cached: true, weekStart, generatedAt: cached[0].generatedAt }); return;
    }

    await generateDietChart(userId, weekStart, res, false);
  } catch (err) {
    console.error("diet chart error:", err);
    res.status(500).json({ error: "Diet chart generation failed." });
  }
});

router.post("/health/intelligence/diet-chart/refresh", requireAuth, aiRateLimit("diet_chart", 2), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const weekStart = getCurrentWeekStart();
    await db.delete(weeklyDietChartsTable)
      .where(and(eq(weeklyDietChartsTable.userId, userId), eq(weeklyDietChartsTable.weekStart, weekStart)));
    await generateDietChart(userId, weekStart, res, true);
  } catch (err) {
    console.error("diet chart refresh error:", err);
    res.status(500).json({ error: "Diet chart refresh failed." });
  }
});

async function generateDietChart(userId: string, weekStart: string, res: import("express").Response, forced: boolean) {
  const ctx = await gatherUserContext(userId);
  const data = await gather30DayData(userId);
  const weather = await getWeatherContext(ctx.city ?? "India", ctx.state ?? undefined);

  let bmr = 0;
  if (ctx.weight && ctx.height && ctx.age) {
    bmr = ctx.gender === "female"
      ? 655 + 9.6 * ctx.weight + 1.8 * ctx.height - 4.7 * ctx.age
      : 66 + 13.7 * ctx.weight + 5 * ctx.height - 6.8 * ctx.age;
  }
  const tdee = bmr ? Math.round(bmr * 1.55) : (data.avgCalories || 1800);
  const targetCal = ctx.healthGoals.includes("weight_loss") ? Math.round(tdee * 0.8)
    : ctx.healthGoals.includes("muscle_gain") ? Math.round(tdee * 1.1) : tdee;

  const prompt = `You are a certified Indian dietitian. Create a 7-day personalized Indian diet chart.

USER PROFILE:
- Age: ${ctx.age ?? "Unknown"}, Gender: ${ctx.gender}
- Weight: ${ctx.weight ? ctx.weight + " kg" : "Unknown"}, BMI: ${ctx.bmi ?? "Unknown"}
- Health conditions: ${ctx.conditionsList}
- Diet preference: ${ctx.dietaryPref}
- Health goal: ${ctx.healthGoals}
- Target daily calories: ${targetCal} kcal
- Avg current intake: ${data.avgCalories} kcal/day
- Current water intake: ${data.avgWaterGlasses} glasses/day
- Weather: ${weather}

RULES:
1. Use ONLY authentic Indian foods (roti, dal, sabzi, rice, dahi, etc.)
2. All 7 days must be different — no repetition
3. Include regional variety across the week
4. Respect dietary preference (${ctx.dietaryPref})
5. Consider health conditions for restrictions
6. Give meal timings in Indian format (7 AM, 1 PM, 7 PM style)
7. Include hydration advice
8. Each day must show total estimated calories

Return ONLY valid JSON (no markdown):
{
  "weekStart": "${weekStart}",
  "targetCalories": ${targetCal},
  "days": [
    {
      "day": "Monday",
      "date": "${weekStart}",
      "breakfast": { "time": "7:30 AM", "items": ["Poha with vegetables (1 cup)", "Chai (1 cup)"], "calories": 320 },
      "lunch": { "time": "1:00 PM", "items": ["Dal tadka (1 bowl)", "Roti (2)", "Palak sabzi", "Dahi (1 bowl)"], "calories": 550 },
      "dinner": { "time": "7:30 PM", "items": ["Khichdi (1.5 cup)", "Pickle", "Ghee (1 tsp)"], "calories": 420 },
      "snacks": [{ "time": "11 AM", "item": "Banana (1)", "calories": 90 }, { "time": "4 PM", "item": "Roasted chana (30g)", "calories": 120 }],
      "totalCalories": 1500,
      "water": "8-10 glasses",
      "tip": "Short health tip for the day"
    }
  ],
  "weeklyTips": ["Tip 1", "Tip 2", "Tip 3"]
}`;

  let dietChart: unknown;
  try {
    const jsonStr = await callAI("weekly_diet_chart", [
      { role: "system", content: "You are a certified Indian dietitian. Return only valid JSON." },
      { role: "user", content: prompt },
    ], { maxTokens: 6000, temperature: 0.7 });
    dietChart = JSON.parse(jsonStr);
  } catch (aiErr) {
    console.warn("[Diet Chart] AI call failed, using static fallback:", (aiErr as Error).message);
    const isVeg = ctx.dietaryPref !== "non-veg";
    dietChart = {
      weekStart,
      targetCalories: targetCal,
      isStaticFallback: true,
      days: [
        { day: "Monday",    date: weekStart, breakfast: { time: "7:30 AM", items: ["Poha with peanuts (1 cup)", "Chai (1 cup)"], calories: 310 }, lunch: { time: "1:00 PM", items: ["Dal tadka (1 bowl)", "Roti (2)", "Dahi (1 bowl)"], calories: 520 }, dinner: { time: "7:30 PM", items: ["Khichdi (1.5 cup)", "Ghee (1 tsp)", "Papad"], calories: 400 }, snacks: [{ time: "11 AM", item: "Banana (1)", calories: 90 }, { time: "4 PM", item: "Roasted chana (30g)", calories: 110 }], totalCalories: 1430, water: "8-10 glasses", tip: "Start with warm lemon water today." },
        { day: "Tuesday",   date: weekStart, breakfast: { time: "7:30 AM", items: ["Idli (3) + Sambar (1 bowl)", "Coconut chutney"], calories: 330 }, lunch: { time: "1:00 PM", items: ["Rajma chawal (1 plate)", "Salad"], calories: 560 }, dinner: { time: "7:30 PM", items: ["Roti (2)", "Palak sabzi (1 bowl)"], calories: 380 }, snacks: [{ time: "11 AM", item: "Apple (1)", calories: 80 }, { time: "4 PM", item: "Makhana (1 handful)", calories: 100 }], totalCalories: 1450, water: "8-10 glasses", tip: "Add a handful of sprouts to your lunch for extra protein." },
        { day: "Wednesday", date: weekStart, breakfast: { time: "7:30 AM", items: ["Besan chilla (2)", "Green chutney"], calories: 280 }, lunch: { time: "1:00 PM", items: ["Chole (1 bowl)", "Roti (2)", "Onion salad"], calories: 540 }, dinner: { time: "7:30 PM", items: ["Dalia (1.5 cup)", "Mixed veg sabzi"], calories: 360 }, snacks: [{ time: "11 AM", item: "Guava (1)", calories: 70 }, { time: "4 PM", item: "Chai + Marie biscuits (3)", calories: 120 }], totalCalories: 1370, water: "8-10 glasses", tip: "Go for a 20-minute walk after dinner." },
        { day: "Thursday",  date: weekStart, breakfast: { time: "7:30 AM", items: ["Oats upma (1 cup)", "Chai"], calories: 290 }, lunch: { time: "1:00 PM", items: [isVeg ? "Paneer sabzi (1 bowl)" : "Egg curry (2 eggs)", "Roti (2)", "Dahi"], calories: 580 }, dinner: { time: "7:30 PM", items: ["Moong dal (1 bowl)", "Roti (2)"], calories: 380 }, snacks: [{ time: "11 AM", item: "Pomegranate (1 bowl)", calories: 85 }, { time: "4 PM", item: "Peanut chikki (1 piece)", calories: 110 }], totalCalories: 1445, water: "8-10 glasses", tip: "Drink a glass of water before every meal." },
        { day: "Friday",    date: weekStart, breakfast: { time: "7:30 AM", items: ["Paratha (1) with dahi", "Pickle"], calories: 350 }, lunch: { time: "1:00 PM", items: ["Dal makhani (1 bowl)", "Steamed rice (1 cup)", "Salad"], calories: 570 }, dinner: { time: "7:30 PM", items: ["Vegetable soup (1 bowl)", "Bread (2 slices)"], calories: 310 }, snacks: [{ time: "11 AM", item: "Orange (1)", calories: 65 }, { time: "4 PM", item: "Roasted peanuts (30g)", calories: 170 }], totalCalories: 1465, water: "8-10 glasses", tip: "Include a colorful salad with every meal this weekend." },
        { day: "Saturday",  date: weekStart, breakfast: { time: "8:00 AM", items: ["Dosa (2) + Sambar", "Filter chai"], calories: 360 }, lunch: { time: "1:30 PM", items: ["Biryani/Pulao (1 cup)", isVeg ? "Raita (1 bowl)" : "Chicken curry (small portion)", "Salad"], calories: 600 }, dinner: { time: "8:00 PM", items: ["Roti (2)", "Mix dal (1 bowl)"], calories: 390 }, snacks: [{ time: "11 AM", item: "Watermelon (2 slices)", calories: 60 }, { time: "5 PM", item: "Bhel puri (1 cup)", calories: 150 }], totalCalories: 1560, water: "8-10 glasses", tip: "Enjoy a fun outdoor activity today — play cricket, walk in the park." },
        { day: "Sunday",    date: weekStart, breakfast: { time: "9:00 AM", items: ["Aloo paratha (1)", "Dahi (1 bowl)", "Butter (1 tsp)"], calories: 400 }, lunch: { time: "2:00 PM", items: ["Kadhi chawal (1 plate)", "Papad", "Pickle"], calories: 520 }, dinner: { time: "8:00 PM", items: ["Khichdi (1 cup)", "Ghee (1 tsp)", "Pickle"], calories: 350 }, snacks: [{ time: "11 AM", item: "Lassi (1 glass)", calories: 130 }, { time: "5 PM", item: "Chai + cookies (2)", calories: 120 }], totalCalories: 1520, water: "8-10 glasses", tip: "Plan your next week's meals and groceries today." },
      ],
      weeklyTips: [
        "Use mustard oil or desi ghee in moderation for healthy fats",
        "Eat seasonal fruits as snacks instead of packaged foods",
        "Have dinner at least 2 hours before sleeping",
        "Drink 1 glass of warm water with lemon every morning",
        "Add turmeric and ginger to your cooking for immunity",
      ],
    };
  }

  await db.insert(weeklyDietChartsTable).values({
    userId,
    weekStart,
    dietChartJson: dietChart as Record<string, unknown>,
    targetCalories: targetCal,
  }).onConflictDoUpdate({
    target: [weeklyDietChartsTable.userId, weeklyDietChartsTable.weekStart],
    set: { dietChartJson: dietChart as Record<string, unknown>, targetCalories: targetCal, generatedAt: new Date() },
  });

  res.json({ dietChart, cached: false, forced, weekStart, generatedAt: new Date() });
}

// ── MET Formula — Exercise Calories (No AI) ───────────────────────────────────

router.get("/health/intelligence/exercise/met", (_req, res) => {
  res.json({ metValues: MET_VALUES });
});

router.post("/health/intelligence/exercise/calories", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { exerciseType, durationMinutes } = req.body as { exerciseType: string; durationMinutes: number };

    if (!exerciseType || !durationMinutes) {
      res.status(400).json({ error: "exerciseType and durationMinutes are required" }); return;
    }

    const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId)).limit(1);
    const weight = profile?.weightKg ? Number(profile.weightKg) : 70;

    const calories = calculateCaloriesBurned(exerciseType, Number(durationMinutes), weight);
    const met = getMet(exerciseType);

    res.json({ exerciseType, durationMinutes, weightKg: weight, met, caloriesBurned: calories });
  } catch (err) {
    console.error("MET calc error:", err);
    res.status(500).json({ error: "Calorie calculation failed" });
  }
});

export default router;
