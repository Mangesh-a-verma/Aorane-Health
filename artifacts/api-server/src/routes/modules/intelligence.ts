/**
 * Health Intelligence Module
 * GET  /health/intelligence/predict            — Weekly disease risk prediction (cached per week)
 * POST /health/intelligence/predict/refresh    — Force new prediction (max 1/week per paid plan)
 * GET  /health/intelligence/diet-chart         — Weekly diet chart (cached per week)
 * POST /health/intelligence/diet-chart/refresh — Force new diet chart (max 1/week per paid plan)
 * GET  /health/intelligence/exercise/met       — MET values list
 * POST /health/intelligence/exercise/calories  — Calculate calories via MET formula
 *
 * Caching strategy:
 *   - Both features cache by weekStart (Monday of current week)
 *   - Cached data is ALWAYS returned without any AI call
 *   - Manual refresh is allowed MAX 1 time per week per user
 *   - FREE plan users are blocked at route level (requireFeature)
 *   - PRO and MAX plans both get weekly caching (cost control)
 */

import { Router } from "express";
import {
  db, usersTable, userProfilesTable, userPreferencesTable,
  userMedicalConditionsTable, userHealthGoalsTable,
  foodLogsTable, waterLogsTable, exerciseLogsTable, stressLogsTable, sleepLogsTable,
  healthPredictionsTable, weeklyDietChartsTable,
} from "@workspace/db";
import { eq, and, gte, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { requireAuth } from "../../middlewares/user-auth";
import type { AuthRequest } from "../../middlewares/user-auth";
import { callAI } from "../../lib/ai";
import { requireFeature } from "../../middlewares/feature-check";
import { incrementUsage } from "../../middlewares/plan-limits";
import { getWeatherContext } from "../../lib/weather";
import { calculateCaloriesBurned, getMet, MET_VALUES } from "../../lib/met";
import { todayIST } from "../../lib/dateUtils";

const router = Router();

// ─── Constants ────────────────────────────────────────────────────────────────

// Plans allowed to use these AI features (Free is blocked — see plan_features table)
const PAID_PLANS = ["pro", "max", "family"];

// Work profile → TDEE multiplier
const INTEL_WORK_MULTIPLIERS: Record<string, number> = {
  "Office/Desk Job": 1.2,      "IT/Software": 1.2,        "Call Center/BPO": 1.2,
  "Freelancer/WFH": 1.2,       "Teacher/Professor": 1.375, "Doctor/Healthcare": 1.375,
  "Business Owner": 1.375,     "Housewife": 1.375,         "House Husband": 1.375,
  "Retired": 1.375,            "Artist/Creative": 1.375,   "Student (School)": 1.375,
  "Field/Sales": 1.55,         "Driver/Delivery": 1.55,    "Factory Worker": 1.55,
  "ASHA/ANM Worker": 1.55,     "Student (College)": 1.55,  "Police/CRPF": 1.725,
  "Army/Defence": 1.725,       "Farmer/Agriculture": 1.725,"Construction Worker": 1.725,
  "Athlete/Sports": 1.9,
};

const INTEL_EXERCISE_EXTRA: Record<string, number> = {
  sedentary: 0, light: 0.05, lightly_active: 0.05,
  moderate: 0.1, moderately_active: 0.1,
  very: 0.175, very_active: 0.175, athlete: 0.25,
};

const GOAL_CALORIE_MULT: Record<string, number> = {
  weight_loss: 0.85, lose_weight: 0.85, fat_loss: 0.85,
  muscle_gain: 1.10, gain_weight: 1.10, gain_muscle: 1.10, bulking: 1.15, athletic: 1.10,
  diabetes_management: 1.0, diabetes_control: 1.0, heart_health: 1.0,
  hormonal_balance: 1.0, reduce_stress: 1.0, general_wellness: 1.0,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns "YYYY-Www" style week key — used as the cache key for BOTH
 * prediction and diet chart. Both features reset together on Monday.
 */
function getCurrentWeekStart(): string {
  // IST-anchored (matches scoring.ts/suggestions.ts) — using server-local/UTC
  // `new Date()` here meant a request between ~18:30-24:00 UTC (00:00-05:30
  // IST) could resolve to the previous IST calendar day, and therefore the
  // previous week's Monday, near a week boundary.
  const [y, m, d] = todayIST().split("-").map(Number);
  // Treat the IST calendar date as a plain Y/M/D and compute its Monday
  // using UTC getters, so no further timezone shift is introduced.
  const asUTC = new Date(Date.UTC(y, m - 1, d));
  const day = asUTC.getUTCDay(); // 0=Sun … 6=Sat
  const diff = asUTC.getUTCDate() - day + (day === 0 ? -6 : 1); // Monday
  const monday = new Date(Date.UTC(asUTC.getUTCFullYear(), asUTC.getUTCMonth(), diff));
  return monday.toISOString().split("T")[0]; // "2025-01-06"
}

/** Keep backward-compat for prediction table which stored by month */
function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getDateRange(daysBack: number): { from: string } {
  const from = new Date();
  from.setDate(from.getDate() - daysBack);
  return { from: from.toISOString().split("T")[0] };
}

function calcAge(dob: string | null): number | null {
  if (!dob) return null;
  return Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365));
}

function goalLabel(primaryGoal: string): string {
  const labels: Record<string, string> = {
    weight_loss: "Weight Loss", lose_weight: "Weight Loss", fat_loss: "Fat Loss",
    muscle_gain: "Muscle Gain", gain_weight: "Weight Gain", gain_muscle: "Muscle Gain",
    bulking: "Bulking / Muscle Gain", athletic: "Athletic Performance",
    diabetes_management: "Diabetes Management", diabetes_control: "Diabetes Control",
    heart_health: "Heart Health", hormonal_balance: "Hormonal Balance",
    reduce_stress: "Stress Reduction", general_wellness: "General Wellness",
  };
  return labels[primaryGoal] ?? primaryGoal.replace(/_/g, " ").replace(/\b\w/g, (c: any) => c.toUpperCase());
}

/**
 * Check if this user has already used their one manual refresh
 * this week. Returns true if refresh is allowed (not yet used).
 *
 * We reuse the healthPredictions / weeklyDietCharts "forced" column.
 * If a row for this weekStart already has forcedAt set → blocked.
 */
async function canRefreshThisWeek(
  table: typeof healthPredictionsTable | typeof weeklyDietChartsTable,
  userId: string,
  weekStart: string,
): Promise<boolean> {
  // Check if a forced refresh row exists for this week
  const rows = await db
    .select()
    .from(table as any)
    .where(
      and(
        eq((table as any).userId, userId),
        eq((table as any).weekStart ?? (table as any).month, weekStart),
      ),
    )
    .limit(1);

  if (rows.length === 0) return true; // No data yet → first generate, always allow

  // If the row was created by a forced refresh this week → block
  const row = rows[0] as any;
  return !row.wasForced; // wasForced flag set by generatePrediction / generateDietChart
}

// ─── Data Gatherers ───────────────────────────────────────────────────────────

async function gatherUserContext(userId: string) {
  const [user]    = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId)).limit(1);
  const conditions = await db.select().from(userMedicalConditionsTable).where(eq(userMedicalConditionsTable.userId, userId));
  const [goals]   = await db.select().from(userHealthGoalsTable).where(eq(userHealthGoalsTable.userId, userId)).limit(1);

  const p = profile as unknown as Record<string, any>;
  const age         = calcAge(p?.dateOfBirth ?? null);
  const weight      = p?.weightKg  ? Number(p.weightKg)  : null;
  const height      = p?.heightCm  ? Number(p.heightCm)  : null;
  const gender      = p?.gender    ?? "other";
  const city        = p?.city      ?? null;
  const state       = p?.state     ?? null;
  const workProfile = p?.workProfile  ?? null;
  const activityLevel = p?.activityLevel ?? "moderate";
  const conditionsList = conditions.map((c: any) => c.condition).join(", ") || "None";
  const dietaryPref  = p?.foodPreference ?? "vegetarian";
  const primaryGoal  = goals?.primaryGoal || "general_wellness";
  const targetWeightKg = goals?.targetWeightKg ? Number(goals.targetWeightKg) : null;
  const healthGoals  = goalLabel(primaryGoal);
  const bmi = (weight && height)
    ? Math.round((weight / ((height / 100) ** 2)) * 10) / 10
    : null;

  return { user, profile, age, weight, height, gender, city, state, workProfile, activityLevel, conditionsList, dietaryPref, primaryGoal, targetWeightKg, healthGoals, bmi };
}

async function gather30DayData(userId: string) {
  const { from } = getDateRange(30);

  const [foodLogs, waterLogs, exerciseLogs, stressLogs, sleepLogs] = await Promise.all([
    db.select().from(foodLogsTable).where(and(eq(foodLogsTable.userId, userId), gte(sql`DATE(${foodLogsTable.loggedAt})`, from))),
    db.select().from(waterLogsTable).where(and(eq(waterLogsTable.userId, userId), gte(sql`DATE(${waterLogsTable.loggedAt})`, from))),
    db.select().from(exerciseLogsTable).where(and(eq(exerciseLogsTable.userId, userId), gte(sql`DATE(${exerciseLogsTable.loggedAt})`, from))),
    db.select().from(stressLogsTable).where(and(eq(stressLogsTable.userId, userId), gte(sql`DATE(${stressLogsTable.loggedAt})`, from))),
    db.select().from(sleepLogsTable).where(and(eq(sleepLogsTable.userId, userId), gte(sleepLogsTable.sleepDate, from))),
  ]);

  const days = 30;

  const avgCalories  = foodLogs.length > 0 ? Math.round(foodLogs.reduce((s: any, l: any) => s + Number(l.calories ?? 0), 0) / days) : 0;
  const avgProtein   = foodLogs.length > 0 ? Math.round(foodLogs.reduce((s: any, l: any) => s + Number(l.proteinG ?? 0), 0) / days) : 0;
  const avgCarbs     = foodLogs.length > 0 ? Math.round(foodLogs.reduce((s: any, l: any) => s + Number(l.carbsG ?? 0), 0) / days) : 0;
  const avgFat       = foodLogs.length > 0 ? Math.round(foodLogs.reduce((s: any, l: any) => s + Number(l.fatG ?? 0), 0) / days) : 0;
  const avgWaterGlasses = waterLogs.length > 0
    ? Math.round((waterLogs.reduce((s: any, l: any) => s + (l.glassesCount ?? 0), 0) / days) * 10) / 10 : 0;
  const totalExerciseSessions = exerciseLogs.length;
  const avgExerciseMinutes = totalExerciseSessions > 0
    ? Math.round(exerciseLogs.reduce((s: any, l: any) => s + (l.durationMinutes ?? 0), 0) / totalExerciseSessions) : 0;
  // Real sleep_logs — the same table the Health Score dashboard reads —
  // not stress_logs.sleepHours, which is only ever a snapshot of the
  // profile's one-time sleepHoursAvg taken at stress-checkin time (see
  // routes/modules/stress.ts), not that day's actual logged sleep. A user
  // who tracks sleep daily but rarely does a stress check-in got wildly
  // wrong (or entirely missing) sleep data fed into this prediction.
  const avgSleepHours = sleepLogs.length > 0
    ? Math.round((sleepLogs.reduce((s: any, l: any) => s + Number(l.sleepHours ?? 0), 0) / sleepLogs.length) * 10) / 10 : null;
  const avgStressLevel = stressLogs.length > 0
    ? Math.round((stressLogs.reduce((s: any, l: any) => s + (l.stressScore ?? 5), 0) / stressLogs.length) * 10) / 10 : null;

  return { avgCalories, avgProtein, avgCarbs, avgFat, avgWaterGlasses, totalExerciseSessions, avgExerciseMinutes, avgSleepHours, avgStressLevel, days };
}

// ─── Static Fallbacks ─────────────────────────────────────────────────────────

function getStaticPrediction(weekStart: string, data: Awaited<ReturnType<typeof gather30DayData>>, ctx: Awaited<ReturnType<typeof gatherUserContext>>) {
  const score = (data.avgSleepHours && data.avgSleepHours >= 7 && data.totalExerciseSessions >= 8) ? 72 : 60;
  return {
    overallScore: score,
    overallLabel: score >= 70 ? "Good" : "Fair",
    risks: [
      { name: "Dehydration Risk",       percentage: data.avgWaterGlasses < 6 ? 55 : 25, level: data.avgWaterGlasses < 6 ? "moderate" : "low",    reason: `Average water intake is ${data.avgWaterGlasses} glasses/day. Recommended is 8+.`, icon: "💧" },
      { name: "Sedentary Lifestyle",    percentage: data.totalExerciseSessions < 8 ? 60 : 20, level: data.totalExerciseSessions < 8 ? "moderate" : "low", reason: `Only ${data.totalExerciseSessions} exercise sessions in 30 days.`, icon: "🏃" },
      { name: "Nutritional Imbalance",  percentage: data.avgProtein < 50 ? 50 : 20, level: data.avgProtein < 50 ? "moderate" : "low", reason: `Average protein: ${data.avgProtein}g/day — may be low.`, icon: "🥗" },
    ],
    recommendations: [
      { title: "Stay Hydrated",        detail: "Drink at least 8 glasses of water daily.",                                              priority: "high" },
      { title: "Walk 30 Minutes",      detail: "A daily brisk walk improves heart health and burns calories.",                           priority: "high" },
      { title: "Eat More Protein",     detail: "Include dal, paneer, eggs or sprouts in every meal.",                                   priority: "medium" },
      { title: "Sleep 7–8 Hours",      detail: "Quality sleep boosts immunity and mental health.",                                      priority: "high" },
      { title: "Reduce Salt & Sugar",  detail: "Avoid processed foods, packed snacks and excess chai/coffee.",                          priority: "medium" },
    ],
    disclaimer: "This is a general lifestyle insight based on your logged data. It is NOT a medical diagnosis. Please consult a qualified doctor for any health concerns.",
    generatedFor: weekStart,
    isStaticFallback: true,
  };
}

function getStaticDietChart(weekStart: string, targetCal: number, isVeg: boolean) {
  return {
    weekStart,
    targetCalories: targetCal,
    isStaticFallback: true,
    days: [
      { day: "Monday",    date: weekStart, breakfast: { time: "7:30 AM", items: ["Poha with peanuts (1 cup)", "Chai (1 cup)"], calories: 310 }, lunch: { time: "1:00 PM", items: ["Dal tadka (1 bowl)", "Roti (2)", "Dahi (1 bowl)"], calories: 520 }, dinner: { time: "7:30 PM", items: ["Khichdi (1.5 cup)", "Ghee (1 tsp)", "Papad"], calories: 400 }, snacks: [{ time: "11 AM", item: "Banana (1)", calories: 90 }, { time: "4 PM", item: "Roasted chana (30g)", calories: 110 }], totalCalories: 1430, water: "8-10 glasses", tip: "Start with warm lemon water today." },
      { day: "Tuesday",   date: weekStart, breakfast: { time: "7:30 AM", items: ["Idli (3) + Sambar", "Coconut chutney"], calories: 330 }, lunch: { time: "1:00 PM", items: ["Rajma chawal (1 plate)", "Salad"], calories: 560 }, dinner: { time: "7:30 PM", items: ["Roti (2)", "Palak sabzi (1 bowl)"], calories: 380 }, snacks: [{ time: "11 AM", item: "Apple (1)", calories: 80 }, { time: "4 PM", item: "Makhana (1 handful)", calories: 100 }], totalCalories: 1450, water: "8-10 glasses", tip: "Add sprouts to your lunch for extra protein." },
      { day: "Wednesday", date: weekStart, breakfast: { time: "7:30 AM", items: ["Besan chilla (2)", "Green chutney"], calories: 280 }, lunch: { time: "1:00 PM", items: ["Chole (1 bowl)", "Roti (2)", "Onion salad"], calories: 540 }, dinner: { time: "7:30 PM", items: ["Dalia (1.5 cup)", "Mixed veg sabzi"], calories: 360 }, snacks: [{ time: "11 AM", item: "Guava (1)", calories: 70 }, { time: "4 PM", item: "Chai + Marie biscuits (3)", calories: 120 }], totalCalories: 1370, water: "8-10 glasses", tip: "Go for a 20-minute walk after dinner." },
      { day: "Thursday",  date: weekStart, breakfast: { time: "7:30 AM", items: ["Oats upma (1 cup)", "Chai"], calories: 290 }, lunch: { time: "1:00 PM", items: [isVeg ? "Paneer sabzi (1 bowl)" : "Egg curry (2 eggs)", "Roti (2)", "Dahi"], calories: 580 }, dinner: { time: "7:30 PM", items: ["Moong dal (1 bowl)", "Roti (2)"], calories: 380 }, snacks: [{ time: "11 AM", item: "Pomegranate (1 bowl)", calories: 85 }, { time: "4 PM", item: "Peanut chikki (1)", calories: 110 }], totalCalories: 1445, water: "8-10 glasses", tip: "Drink a glass of water before every meal." },
      { day: "Friday",    date: weekStart, breakfast: { time: "7:30 AM", items: ["Paratha (1) with dahi", "Pickle"], calories: 350 }, lunch: { time: "1:00 PM", items: ["Dal makhani (1 bowl)", "Rice (1 cup)", "Salad"], calories: 570 }, dinner: { time: "7:30 PM", items: ["Vegetable soup (1 bowl)", "Bread (2 slices)"], calories: 310 }, snacks: [{ time: "11 AM", item: "Orange (1)", calories: 65 }, { time: "4 PM", item: "Roasted peanuts (30g)", calories: 170 }], totalCalories: 1465, water: "8-10 glasses", tip: "Include a colorful salad with every meal." },
      { day: "Saturday",  date: weekStart, breakfast: { time: "8:00 AM", items: ["Dosa (2) + Sambar", "Filter chai"], calories: 360 }, lunch: { time: "1:30 PM", items: ["Biryani/Pulao (1 cup)", isVeg ? "Raita (1 bowl)" : "Chicken curry (small)", "Salad"], calories: 600 }, dinner: { time: "8:00 PM", items: ["Roti (2)", "Mix dal (1 bowl)"], calories: 390 }, snacks: [{ time: "11 AM", item: "Watermelon (2 slices)", calories: 60 }, { time: "5 PM", item: "Bhel puri (1 cup)", calories: 150 }], totalCalories: 1560, water: "8-10 glasses", tip: "Enjoy a fun outdoor activity today." },
      { day: "Sunday",    date: weekStart, breakfast: { time: "9:00 AM", items: ["Aloo paratha (1)", "Dahi (1 bowl)", "Butter (1 tsp)"], calories: 400 }, lunch: { time: "2:00 PM", items: ["Kadhi chawal (1 plate)", "Papad", "Pickle"], calories: 520 }, dinner: { time: "8:00 PM", items: ["Khichdi (1 cup)", "Ghee (1 tsp)", "Pickle"], calories: 350 }, snacks: [{ time: "11 AM", item: "Lassi (1 glass)", calories: 130 }, { time: "5 PM", item: "Chai + cookies (2)", calories: 120 }], totalCalories: 1520, water: "8-10 glasses", tip: "Plan next week's meals and groceries today." },
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

// ─── Health Prediction Routes ─────────────────────────────────────────────────

/**
 * GET /health/intelligence/predict
 * - FREE plan → blocked by requireFeature → 403 with upgrade hint
 * - PRO/MAX  → returns cached data if available, else generates once
 * - No AI call if cached data exists for current week
 */
router.get(
  "/health/intelligence/predict",
  requireAuth,
  requireFeature("health_prediction"), // blocks FREE users here
  async (req: AuthRequest, res) => {
    try {
      const userId   = req.userId!;
      const planType = (req.userPlan || "free").toLowerCase();
      const weekStart = getCurrentWeekStart();

      // Extra guard: double-check plan (defence in depth)
      if (!PAID_PLANS.includes(planType)) {
        res.status(403).json({
          error: "Health Prediction is not available on the FREE plan. Upgrade to PRO or MAX.",
          feature: "health_prediction",
          reason: "plan_not_supported",
          currentPlan: planType,
          upgradeSuggested: true,
        });
        return;
      }

      // ── Return cached data immediately (NO AI call) ──
      const cached = await db
        .select()
        .from(healthPredictionsTable)
        .where(
          and(
            eq(healthPredictionsTable.userId, userId),
            eq(healthPredictionsTable.weekStart ?? healthPredictionsTable.month, weekStart),
          ),
        )
        .limit(1);

      if (cached.length > 0) {
        res.json({ prediction: cached[0].predictionJson, cached: true, generatedAt: cached[0].generatedAt, weekStart });
        return;
      }

      // ── No cached data → generate (first time this week) ──
      await generatePrediction(userId, weekStart, planType, res, false);
    } catch (err) {
      req.log.error({ err }, "prediction GET error");
      res.status(500).json({ error: "Health prediction failed. Please try again." });
    }
  },
);

/**
 * POST /health/intelligence/predict/refresh
 * - FREE plan → blocked by requireFeature
 * - PRO/MAX  → allowed ONCE per week (after that, returns cached + time info)
 */
router.post(
  "/health/intelligence/predict/refresh",
  requireAuth,
  requireFeature("health_prediction"),
  async (req: AuthRequest, res) => {
    try {
      const userId    = req.userId!;
      const planType  = (req.userPlan || "free").toLowerCase();
      const weekStart = getCurrentWeekStart();

      if (!PAID_PLANS.includes(planType)) {
        res.status(403).json({
          error: "Health Prediction is not available on the FREE plan.",
          feature: "health_prediction",
          reason: "plan_not_supported",
          currentPlan: planType,
          upgradeSuggested: true,
        });
        return;
      }

      // ── Check: has this user already done a manual refresh this week? ──
      const existing = await db
        .select()
        .from(healthPredictionsTable)
        .where(
          and(
            eq(healthPredictionsTable.userId, userId),
            eq(healthPredictionsTable.weekStart ?? healthPredictionsTable.month, weekStart),
          ),
        )
        .limit(1);

      if (existing.length > 0 && (existing[0] as any).wasForced) {
        // Already refreshed manually this week → return cached data + countdown info
        res.status(429).json({
          error: "You have already refreshed your health prediction this week. New data will be auto-generated next Monday.",
          cached: true,
          prediction: existing[0].predictionJson,
          generatedAt: existing[0].generatedAt,
          weekStart,
          nextRefreshDate: getNextMondayISO(),
          reason: "weekly_refresh_limit_reached",
        });
        return;
      }

      // ── Delete existing row and regenerate ──
      await db
        .delete(healthPredictionsTable)
        .where(
          and(
            eq(healthPredictionsTable.userId, userId),
            eq(healthPredictionsTable.weekStart ?? healthPredictionsTable.month, weekStart),
          ),
        );

      await generatePrediction(userId, weekStart, planType, res, true);
    } catch (err) {
      req.log.error({ err }, "prediction refresh error");
      res.status(500).json({ error: "Health prediction refresh failed." });
    }
  },
);

async function generatePrediction(
  userId: string,
  weekStart: string,
  planType: string,
  res: import("express").Response,
  forced: boolean,
) {
  const ctx     = await gatherUserContext(userId);
  const data    = await gather30DayData(userId);
  const weather = await getWeatherContext(ctx.city ?? "India", ctx.state ?? undefined);

  const prompt = `You are a certified preventive health analyst. Based on the user's 30-day health data, predict disease risks and give lifestyle recommendations.

USER PROFILE:
- Age: ${ctx.age ?? "Unknown"} years | Gender: ${ctx.gender}
- Weight: ${ctx.weight ? ctx.weight + " kg" : "Unknown"} | Height: ${ctx.height ? ctx.height + " cm" : "Unknown"} | BMI: ${ctx.bmi ?? "Unknown"}
- Work: ${ctx.workProfile ?? "Unknown"} | Activity: ${ctx.activityLevel}
- Known conditions: ${ctx.conditionsList}
- Diet preference: ${ctx.dietaryPref}
- Health goals: ${ctx.healthGoals}

30-DAY AVERAGE DATA:
- Calories/day: ${data.avgCalories} kcal
- Protein: ${data.avgProtein}g | Carbs: ${data.avgCarbs}g | Fat: ${data.avgFat}g
- Water intake: ${data.avgWaterGlasses} glasses/day
- Exercise sessions: ${data.totalExerciseSessions} in 30 days (avg ${data.avgExerciseMinutes} min/session)
- Sleep: ${data.avgSleepHours ?? "Not tracked"} hrs/night
- Stress level: ${data.avgStressLevel ?? "Not tracked"}/10
- Weather/Season: ${weather}

INSTRUCTIONS:
1. Identify up to 5 health risks with percentage likelihood (0–100%)
2. Each risk must include a clear reason based on actual data above
3. Give 3–5 actionable lifestyle recommendations
4. Give an overall health score (0–100) and label
5. Add a mandatory disclaimer
6. Simple English, no medical jargon

Return ONLY valid JSON (no markdown, no extra text):
{
  "overallScore": 72,
  "overallLabel": "Fair",
  "risks": [
    { "name": "Risk name", "percentage": 45, "level": "moderate", "reason": "Reason from data", "icon": "💧" }
  ],
  "recommendations": [
    { "title": "Short title", "detail": "What to do and why", "priority": "high" }
  ],
  "disclaimer": "This is a lifestyle prediction based on your self-reported data. It is NOT a medical diagnosis. Please consult a qualified doctor for any health concerns.",
  "generatedFor": "${weekStart}"
}`;

  let prediction: unknown;
  try {
    const jsonStr = await callAI("health_prediction", [
      { role: "system", content: "You are a preventive health analyst. Return only valid JSON." },
      { role: "user", content: prompt },
    ], { maxTokens: 3000, temperature: 0.5 });
    prediction = JSON.parse(jsonStr);
  } catch (aiErr) {
    logger.warn({ err: aiErr }, "Prediction AI failed — using static fallback");
    prediction = getStaticPrediction(weekStart, data, ctx);
  }

  // Save to DB — wasForced flag prevents second manual refresh this week
  await db
    .insert(healthPredictionsTable)
    .values({
      userId,
      weekStart,          // new column — add to schema if using month previously
      month: getCurrentMonth(), // keep for backward compat
      predictionJson: prediction as Record<string, unknown>,
      dataSnapshotJson: data as unknown as Record<string, unknown>,
      weatherContext: weather,
      wasForced: forced,
    })
    .onConflictDoUpdate({
      target: [healthPredictionsTable.userId, healthPredictionsTable.weekStart ?? healthPredictionsTable.month],
      set: {
        predictionJson: prediction as Record<string, unknown>,
        dataSnapshotJson: data as unknown as Record<string, unknown>,
        weatherContext: weather,
        wasForced: forced,
        generatedAt: new Date(),
      },
    });

  // Track for /my/ai-usage display purposes only — actual "once per week"
  // gating is already enforced above via the weekStart cache-row check.
  incrementUsage(userId, "ai_health_prediction_weekly", "weekly").catch(() => {});

  res.json({ prediction, cached: false, forced, weekStart, generatedAt: new Date() });
}

// ─── Weekly Diet Chart Routes ─────────────────────────────────────────────────

/**
 * GET /health/intelligence/diet-chart
 * - FREE plan → blocked by requireFeature → 403
 * - PRO/MAX  → cached data returned instantly, else generate once this week
 */
router.get(
  "/health/intelligence/diet-chart",
  requireAuth,
  requireFeature("weekly_diet_chart"), // blocks FREE users
  async (req: AuthRequest, res) => {
    try {
      const userId    = req.userId!;
      const planType  = (req.userPlan || "free").toLowerCase();
      const weekStart = getCurrentWeekStart();

      // Double-check plan
      if (!PAID_PLANS.includes(planType)) {
        res.status(403).json({
          error: "Weekly Diet Chart is not available on the FREE plan. Upgrade to PRO or MAX.",
          feature: "weekly_diet_chart",
          reason: "plan_not_supported",
          currentPlan: planType,
          upgradeSuggested: true,
        });
        return;
      }

      // ── Return cached instantly ──
      const cached = await db
        .select()
        .from(weeklyDietChartsTable)
        .where(
          and(
            eq(weeklyDietChartsTable.userId, userId),
            eq(weeklyDietChartsTable.weekStart, weekStart),
          ),
        )
        .limit(1);

      if (cached.length > 0) {
        res.json({ dietChart: cached[0].dietChartJson, cached: true, weekStart, generatedAt: cached[0].generatedAt });
        return;
      }

      // ── Generate for first time this week ──
      await generateDietChart(userId, weekStart, planType, res, false);
    } catch (err) {
      req.log.error({ err }, "diet chart GET error");
      res.status(500).json({ error: "Diet chart generation failed." });
    }
  },
);

/**
 * POST /health/intelligence/diet-chart/refresh
 * - FREE plan → blocked
 * - PRO/MAX  → allowed ONCE per week, then returns cached + countdown
 */
router.post(
  "/health/intelligence/diet-chart/refresh",
  requireAuth,
  requireFeature("weekly_diet_chart"),
  async (req: AuthRequest, res) => {
    try {
      const userId    = req.userId!;
      const planType  = (req.userPlan || "free").toLowerCase();
      const weekStart = getCurrentWeekStart();

      if (!PAID_PLANS.includes(planType)) {
        res.status(403).json({
          error: "Weekly Diet Chart is not available on the FREE plan.",
          feature: "weekly_diet_chart",
          reason: "plan_not_supported",
          currentPlan: planType,
          upgradeSuggested: true,
        });
        return;
      }

      // ── Check weekly refresh limit ──
      const existing = await db
        .select()
        .from(weeklyDietChartsTable)
        .where(
          and(
            eq(weeklyDietChartsTable.userId, userId),
            eq(weeklyDietChartsTable.weekStart, weekStart),
          ),
        )
        .limit(1);

      if (existing.length > 0 && (existing[0] as any).wasForced) {
        res.status(429).json({
          error: "You have already refreshed your diet chart this week. A fresh plan will auto-generate next Monday.",
          cached: true,
          dietChart: existing[0].dietChartJson,
          generatedAt: existing[0].generatedAt,
          weekStart,
          nextRefreshDate: getNextMondayISO(),
          reason: "weekly_refresh_limit_reached",
        });
        return;
      }

      // ── Delete old row and regenerate ──
      await db
        .delete(weeklyDietChartsTable)
        .where(
          and(
            eq(weeklyDietChartsTable.userId, userId),
            eq(weeklyDietChartsTable.weekStart, weekStart),
          ),
        );

      await generateDietChart(userId, weekStart, planType, res, true);
    } catch (err) {
      req.log.error({ err }, "diet chart refresh error");
      res.status(500).json({ error: "Diet chart refresh failed." });
    }
  },
);

async function generateDietChart(
  userId: string,
  weekStart: string,
  planType: string,
  res: import("express").Response,
  forced: boolean,
) {
  const ctx     = await gatherUserContext(userId);
  const data    = await gather30DayData(userId);
  const weather = await getWeatherContext(ctx.city ?? "India", ctx.state ?? undefined);

  // TDEE calculation (Harris-Benedict + work profile + activity)
  let bmr = 0;
  if (ctx.weight && ctx.height && ctx.age) {
    bmr = ctx.gender === "female"
      ? 655 + 9.6 * ctx.weight + 1.8 * ctx.height - 4.7 * ctx.age
      : 66  + 13.7 * ctx.weight + 5   * ctx.height - 6.8 * ctx.age;
  }
  const workMult     = ctx.workProfile ? (INTEL_WORK_MULTIPLIERS[ctx.workProfile] ?? 1.4) : 1.4;
  const exerciseMult = INTEL_EXERCISE_EXTRA[ctx.activityLevel] ?? 0.1;
  const tdee         = bmr ? Math.round(bmr * Math.min(2.0, workMult + exerciseMult)) : (data.avgCalories || 1800);
  const calMult      = GOAL_CALORIE_MULT[ctx.primaryGoal] ?? 1.0;
  const targetCal    = Math.round(tdee * calMult);

  const prompt = `You are a certified Indian dietitian. Create a 7-day personalized Indian diet chart.

USER PROFILE:
- Age: ${ctx.age ?? "Unknown"} | Gender: ${ctx.gender}
- Weight: ${ctx.weight ? ctx.weight + " kg" : "Unknown"} | BMI: ${ctx.bmi ?? "Unknown"}
- Target weight: ${ctx.targetWeightKg ? ctx.targetWeightKg + " kg" : "Not set"}
- Health conditions: ${ctx.conditionsList}
- Diet preference: ${ctx.dietaryPref}
- Work profile: ${ctx.workProfile ?? "Unknown"}
- Health goal: ${ctx.healthGoals}
- Calculated TDEE: ${tdee} kcal/day
- Target daily calories: ${targetCal} kcal (${calMult < 1 ? "deficit — weight loss" : calMult > 1 ? "surplus — muscle/weight gain" : "maintenance"})
- Avg current intake: ${data.avgCalories} kcal/day | Protein: ${data.avgProtein}g/day
- Water intake: ${data.avgWaterGlasses} glasses/day
- Weather: ${weather}

RULES:
1. Use ONLY authentic Indian foods
2. All 7 days must be different — no repetition
3. Regional variety across the week
4. Respect dietary preference (${ctx.dietaryPref})
5. ALL meal calories must hit target of ${targetCal} kcal/day
6. Respect health condition restrictions (diabetes: low-GI; heart: low-sodium; etc.)
7. Meal timings in Indian format (7 AM, 1 PM, 7 PM)
8. Include hydration advice per day

Return ONLY valid JSON (no markdown):
{
  "weekStart": "${weekStart}",
  "targetCalories": ${targetCal},
  "days": [
    {
      "day": "Monday",
      "date": "${weekStart}",
      "breakfast": { "time": "7:30 AM", "items": ["Poha with vegetables (1 cup)", "Chai"], "calories": 320 },
      "lunch":     { "time": "1:00 PM", "items": ["Dal tadka (1 bowl)", "Roti (2)", "Dahi"], "calories": 550 },
      "dinner":    { "time": "7:30 PM", "items": ["Khichdi (1.5 cup)", "Ghee (1 tsp)"], "calories": 420 },
      "snacks":    [{ "time": "11 AM", "item": "Banana (1)", "calories": 90 }],
      "totalCalories": ${targetCal},
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
    logger.warn({ err: aiErr }, "Diet Chart AI failed — using static fallback");
    dietChart = getStaticDietChart(weekStart, targetCal, ctx.dietaryPref !== "non-veg");
  }

  await db
    .insert(weeklyDietChartsTable)
    .values({
      userId,
      weekStart,
      dietChartJson: dietChart as Record<string, unknown>,
      targetCalories: targetCal,
      wasForced: forced,
    })
    .onConflictDoUpdate({
      target: [weeklyDietChartsTable.userId, weeklyDietChartsTable.weekStart],
      set: {
        dietChartJson: dietChart as Record<string, unknown>,
        targetCalories: targetCal,
        wasForced: forced,
        generatedAt: new Date(),
      },
    });

  // Track for /my/ai-usage display purposes only — actual "once per week"
  // gating is already enforced above via the weekStart cache-row check.
  incrementUsage(userId, "ai_diet_plan_daily", "weekly").catch(() => {});

  res.json({ dietChart, cached: false, forced, weekStart, generatedAt: new Date() });
}

// ─── Exercise MET Routes (No AI — always free) ────────────────────────────────

router.get("/health/intelligence/exercise/met", (_req, res) => {
  res.json({ metValues: MET_VALUES });
});

router.post("/health/intelligence/exercise/calories", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { exerciseType, durationMinutes } = req.body as { exerciseType: string; durationMinutes: number };

    if (!exerciseType || !durationMinutes) {
      res.status(400).json({ error: "exerciseType and durationMinutes are required" });
      return;
    }

    const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId)).limit(1);
    const weight = (profile as any)?.weightKg ? Number((profile as any).weightKg) : 70;
    const calories = calculateCaloriesBurned(exerciseType, Number(durationMinutes), weight);
    const met = getMet(exerciseType);

    res.json({ exerciseType, durationMinutes, weightKg: weight, met, caloriesBurned: calories });
  } catch (err) {
    req.log.error({ err }, "MET calc error");
    res.status(500).json({ error: "Calorie calculation failed" });
  }
});

// ─── Utility ──────────────────────────────────────────────────────────────────

/** Returns next Monday's date as ISO string (for frontend countdown) */
function getNextMondayISO(): string {
  const now = new Date();
  const day = now.getDay();
  const daysUntil = day === 1 ? 7 : (8 - day) % 7 || 7;
  const next = new Date(now);
  next.setDate(now.getDate() + daysUntil);
  next.setHours(0, 0, 0, 0);
  return next.toISOString().split("T")[0];
}

export default router;