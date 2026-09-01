/**
 * Daily Suggestions & Notification Settings
 * GET  /suggestions/daily          — AI-powered personalized daily suggestions (cached)
 * POST /suggestions/refresh        — Force fresh AI suggestions
 * GET  /notifications/settings     — User notification preferences
 * PUT  /notifications/settings     — Update notification preferences
 */

import { Router } from "express";
import { logger } from "../../lib/logger";
import {
  db, usersTable, userProfilesTable, userPreferencesTable,
  userMedicalConditionsTable, userHealthGoalsTable,
  dailySuggestionsTable, foodLogsTable, waterLogsTable, exerciseLogsTable,
  sleepLogsTable, wearableDataTable, weeklyDietChartsTable,
} from "@workspace/db";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { requireAuth } from "../../middlewares/user-auth";
import type { AuthRequest } from "../../middlewares/user-auth";
import { checkAndUseAILimit, refundAIUsage } from "../../lib/aiLimiter";
import { callAI } from "../../lib/ai";
import { todayIST, istDayBounds, istWeekStart, istHour, istWeekdayName } from "../../lib/dateUtils";
import { WORK_PROFILE_ACTIVITY, calculateEffectiveTDEE } from "../../lib/workProfile";
import { resolveLocale, seasonFor, type UserLocale } from "../../lib/locale";

const router = Router();

// Countries where the generic fallback's dal-and-roti answer is actually a
// reasonable guess. Everyone else gets the plain set — see the fallback below.
const SOUTH_ASIA_FALLBACK = new Set(["IN", "PK", "BD", "NP", "LK", "BT"]);

// ── Weekly diet chart (Intelligence tab) — read-only here ─────────────────────
// The Coach and the Intelligence diet chart used to plan the same day
// independently, so a user could be told to eat Poha by one screen and Idli by
// the other. The chart is the published plan; the Coach now follows it and only
// falls back to planning on its own when no chart exists for this week.
type ChartMeal  = { time?: string; items?: string[]; calories?: number };
type ChartSnack = { time?: string; item?: string; calories?: number };
type ChartDay = {
  day?: string; date?: string;
  breakfast?: ChartMeal; lunch?: ChartMeal; dinner?: ChartMeal;
  snacks?: ChartSnack[]; totalCalories?: number; tip?: string;
};

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Pick today's entry out of a stored weekly chart. */
function pickTodayFromChart(chartJson: unknown, date: string): ChartDay | null {
  const days = (chartJson as { days?: unknown } | null)?.days;
  if (!Array.isArray(days) || days.length === 0) return null;
  const weekday = istWeekdayName(date);

  // Match on the weekday NAME first. `date` is not a reliable key: the diet
  // chart's own static fallback stamps every one of the seven days with the
  // week's Monday, and the AI prompt's example does the same, so matching on
  // date would land on Monday's meals all week.
  const byName = days.find((d) =>
    typeof (d as ChartDay)?.day === "string" &&
    (d as ChartDay).day!.trim().toLowerCase() === weekday.toLowerCase());
  if (byName) return byName as ChartDay;

  const byDate = days.find((d) => (d as ChartDay)?.date === date);
  if (byDate) return byDate as ChartDay;

  // Last resort: position from Monday, so a chart with abbreviated or
  // translated day names still resolves instead of silently returning nothing.
  const idx = WEEKDAYS.indexOf(weekday);
  return idx >= 0 && idx < days.length ? (days[idx] as ChartDay) : null;
}

/** Render today's chart entry as prompt lines. Empty string = nothing usable. */
function formatChartDay(c: ChartDay): string {
  const meal = (label: string, m?: ChartMeal): string | null =>
    m && Array.isArray(m.items) && m.items.length
      ? `- ${label}${m.time ? ` (${m.time})` : ""}: ${m.items.join(", ")}${m.calories ? ` — ${m.calories} kcal` : ""}`
      : null;
  const snacks = Array.isArray(c.snacks) ? c.snacks.filter((sn) => sn?.item) : [];
  return [
    meal("Breakfast", c.breakfast),
    meal("Lunch", c.lunch),
    meal("Dinner", c.dinner),
    snacks.length
      ? `- Snacks: ${snacks.map((sn) => `${sn.item}${sn.time ? ` (${sn.time})` : ""}${sn.calories ? ` — ${sn.calories} kcal` : ""}`).join("; ")}`
      : null,
  ].filter(Boolean).join("\n");
}

/** The meal the user is heading into, by IST clock. */
function nextMealSlot(hour: number): { slot: string; label: string } {
  if (hour < 10) return { slot: "breakfast", label: "breakfast (this morning)" };
  if (hour < 15) return { slot: "lunch",     label: "lunch (today)" };
  if (hour < 19) return { slot: "snack",     label: "an evening snack (today)" };
  if (hour < 22) return { slot: "dinner",    label: "dinner (tonight)" };
  return { slot: "breakfast", label: "breakfast (tomorrow morning)" };
}

// ── BMR / TDEE calculation — uses BOTH workProfile + activityLevel ────────────
// The multiplier table and effective-TDEE formula themselves live in
// lib/workProfile.ts, shared with lib/scoring.ts's Health Score engine, so
// the two never drift apart the way they used to (scoring.ts ignored job
// role entirely until this same fix wired it in there too).
function calculateTDEE(
  weightKg: number, heightCm: number, age: number, gender: string,
  activityLevel: string, workProfile?: string
): number {
  const bmr = gender === "female"
    ? 655 + 9.6 * weightKg + 1.8 * heightCm - 4.7 * age
    : 66 + 13.7 * weightKg + 5 * heightCm - 6.8 * age;
  return calculateEffectiveTDEE(bmr, activityLevel, workProfile);
}

// ── Build full suggestion prompt ──────────────────────────────────────────────
function buildPrompt(data: {
  age: number | null; gender: string; weightKg: number | null; heightCm: number | null;
  bmi: number | null; activityLevel: string; workProfile: string | null;
  primaryGoal: string; targetWeightKg: number | null;
  foodPreference: string; foodAllergies: string[]; medicalConditions: string[];
  caloriesToday: number; waterToday: number; waterGoal: number; exerciseMinToday: number;
  calorieGoal: number; season: string; effectiveTDEE: number;
  sleepHoursToday: number | null; stepsToday: number | null;
  heartRateAvg: number | null; bloodOxygen: number | null;
  recentFoods: string[]; recentSuggestedFoods: string[];
  recentExercises: string[]; burnTarget: number; burnedToday: number;
  todayChart: ChartDay | null; mealsLoggedToday: string[];
  locale: UserLocale;
}): string {
  const { age, gender, weightKg, heightCm, bmi, activityLevel, workProfile, primaryGoal, targetWeightKg,
    foodPreference, foodAllergies, medicalConditions, caloriesToday, waterToday, waterGoal,
    exerciseMinToday, calorieGoal, season, effectiveTDEE,
    sleepHoursToday, stepsToday, heartRateAvg, bloodOxygen,
    recentFoods, recentSuggestedFoods, recentExercises, burnTarget, burnedToday,
    todayChart, mealsLoggedToday, locale } = data;

  const remainingBurn = Math.max(0, burnTarget - burnedToday);
  const avoidList = Array.from(new Set([...recentSuggestedFoods, ...recentFoods])).slice(0, 25);

  const lowSleep = sleepHoursToday !== null && sleepHoursToday < 6;
  const lowOxygen = bloodOxygen !== null && bloodOxygen < 95;
  const highHeartRate = heartRateAvg !== null && heartRateAvg > 100;

  const remainingCalories = Math.max(0, calorieGoal - caloriesToday);
  // IST, not server-local: on a UTC host `new Date().getHours()` greeted a
  // user at 9 PM IST with "morning" advice.
  const hour = istHour();
  const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

  const allergyStr = foodAllergies.length > 0 && !foodAllergies.includes("None") ? foodAllergies.join(", ") : "none";
  const conditionStr = medicalConditions.length > 0 ? medicalConditions.join(", ") : "none";
  const workProfileDesc = workProfile
    ? `${workProfile} (${WORK_PROFILE_ACTIVITY[workProfile] || "moderate"} activity job)`
    : "unknown";

  const chartLines = todayChart ? formatChartDay(todayChart) : "";
  const hasChart = chartLines.length > 0;
  const nextMeal = nextMealSlot(hour);
  const alreadyEaten = mealsLoggedToday.length ? mealsLoggedToday.join(", ") : "nothing yet";

  const planBlock = hasChart
    ? `TODAY'S PUBLISHED DIET CHART (${todayChart!.day || istWeekdayName(todayIST())}) — the user already sees exactly this in the Intelligence tab:
${chartLines}${todayChart!.totalCalories ? `\n- Chart day total: ${todayChart!.totalCalories} kcal` : ""}${todayChart!.tip ? `\n- Chart tip: ${todayChart!.tip}` : ""}
- Meal slots they have already logged food for today: ${alreadyEaten}`
    : `TODAY'S PUBLISHED DIET CHART: none — this user has no weekly diet chart for this week.
- Meal slots they have already logged food for today: ${alreadyEaten}`;

  // Rules are numbered at render time: the diet-chart branch and the
  // no-chart branch contribute different rules, and a hand-numbered list
  // would go out of order the moment either side changes.
  const rules: string[] = [
    `All food suggestions must be AUTHENTIC ${locale.cuisine.toUpperCase()} foods — dishes people actually cook and buy in ${locale.countryName}`,
    `Respect dietary preference: ${foodPreference} (no items that violate this)`,
    `AVOID any allergens: ${allergyStr}`,
    `For medical conditions (${conditionStr}): give specific medical warnings`,
    "Suggest seasonal foods when possible",
    `Calorie numbers should be realistic for ${locale.countryName} serving sizes, and weights in ${locale.unitSystem} units`,
    "If diabetes: avoid high-GI foods, suggest low-GI options",
    "If high BP: suggest low-sodium options and name the salty staples to avoid in their own cuisine",
    "Language: Respond entirely in English",
    "Give work-profile-specific advice (e.g. Army: stamina foods; Office: screen fatigue tips)",
    `The user is in ${locale.countryName}. Every suggestion must fit what is actually available and eaten there — never fall back to another country's ingredients, brands or meal patterns`,
    "If sleep is LOW (under 6h): exercise suggestion should be light/moderate only (never intense), and healthTip should address sleep recovery",
    'If heart rate is ELEVATED or SpO2 is LOW: exerciseSuggestion intensity must be "light" and add a medicalWarnings entry recommending rest and, if it persists, consulting a doctor — do not suggest intense exertion',
  ];

  if (hasChart) {
    rules.push(
      "THE DIET CHART ABOVE IS THE PLAN. foodSuggestions must contain ONLY dishes from today's chart, with the dish names written as they appear there. Do not invent, substitute, rename or add dishes — the user is following that chart, and two screens disagreeing is worse than a repeat",
      "Include only the meal slots they have NOT logged yet today, and skip any slot that is already past for the time of day. Your job is what is still ahead of them, not a recap",
      "For each chart dish, fill in the macros (proteinG/carbsG/fatG), portion and a one-line reason. Use the chart's own calorie figure for a dish whenever it gives one",
      "The variety rule does NOT apply to chart dishes — the weekly chart already provides the week's variety",
    );
  } else {
    rules.push(
      `NO DIET CHART EXISTS for this user this week, so do NOT produce a whole day of meals. Suggest ONLY ${nextMeal.label} — 2 or 3 options, every one with mealType "${nextMeal.slot}". A full-day plan is the weekly diet chart's job, not the Coach's`,
      `VARIETY IS REQUIRED. Do NOT suggest any of these, they were eaten or suggested in the last 7 days: ${avoidList.length ? avoidList.join(", ") : "(nothing yet)"}`,
      "Vary the cuisine and cooking style from what they have been eating — a different grain, dal or vegetable, not a rename of the same dish",
    );
  }

  rules.push(
    `exerciseSuggestion.caloriesToBurn MUST equal ${remainingBurn} (already computed above from their TDEE, goal and what they have burned today). Pick an activity and duration that genuinely burns about that much — do not invent a different number`,
    "Prefer an exercise they already do (see history) over something unfamiliar, unless variety is clearly needed",
    `Hydration has its own tracker elsewhere in the app, so do NOT return a water section. If they are behind on water (${waterToday}/${waterGoal} glasses) and it is past midday, the healthTip is where you mention it — one line, category "hydration"`,
  );

  const rulesBlock = rules.map((r, i) => `${i + 1}. ${r}`).join("\n");

  return `You are Aorane, a certified ${locale.cuisine} health coach and nutritionist. Give personalized daily health suggestions in English.

USER PROFILE:
- Age: ${age || "unknown"}, Gender: ${gender}
- Weight: ${weightKg ? weightKg + " kg" : "unknown"}, Height: ${heightCm ? heightCm + " cm" : "unknown"}, BMI: ${bmi ? Number(bmi).toFixed(1) : "unknown"}
- Work Profile: ${workProfileDesc}
- Exercise Activity Level: ${activityLevel}
- Calculated TDEE: ${effectiveTDEE} kcal/day (based on work + exercise)
- Primary Goal: ${primaryGoal}
- Target Weight: ${targetWeightKg ? targetWeightKg + " kg" : "not set"}
- Food Preference: ${foodPreference}
- Food Allergies: ${allergyStr}
- Medical Conditions: ${conditionStr}

TODAY'S PROGRESS (${timeOfDay}):
- Calories eaten: ${caloriesToday} / ${calorieGoal} kcal (${remainingCalories} remaining)
- Water: ${waterToday} / ${waterGoal} glasses
- Exercise: ${exerciseMinToday} minutes

TODAY'S VITALS (from wearable/manual entry, only where logged):
- Sleep: ${sleepHoursToday !== null ? sleepHoursToday + " hours" : "not logged"}${lowSleep ? " (LOW — under 6h)" : ""}
- Steps: ${stepsToday !== null ? stepsToday : "not logged"}
- Resting heart rate: ${heartRateAvg !== null ? heartRateAvg + " bpm" : "not logged"}${highHeartRate ? " (ELEVATED)" : ""}
- Blood oxygen (SpO2): ${bloodOxygen !== null ? bloodOxygen + "%" : "not logged"}${lowOxygen ? " (LOW — below 95%)" : ""}

RECENT HISTORY (last 7 days):
- Foods they actually logged: ${recentFoods.length ? recentFoods.join(", ") : "nothing logged"}
- Exercises they actually did: ${recentExercises.length ? recentExercises.join(", ") : "nothing logged"}
- Foods already suggested to them recently: ${recentSuggestedFoods.length ? recentSuggestedFoods.join(", ") : "none"}

ENERGY BUDGET (computed, do not recalculate):
- Daily burn target from exercise: ${burnTarget} kcal
- Already burned today: ${burnedToday} kcal
- Still to burn today: ${remainingBurn} kcal

${planBlock}

Current Season: ${season}

WORK PROFILE CONTEXT:
${workProfile === "Army/Defence" ? "- Army/Defence person needs high protein (1.8g/kg), high carbs for energy, adequate hydration" : ""}
${workProfile === "Police/CRPF" ? "- Police person: physically demanding, suggest foods for stamina and joint health" : ""}
${workProfile === "Farmer/Agriculture" ? "- Farmer: very physically active, needs high calorie, traditional desi foods preferred" : ""}
${workProfile === "Call Center/BPO" ? "- Call center worker: sedentary + night shift possible, stress eating risk, suggest anti-fatigue foods" : ""}
${workProfile === "Housewife" || workProfile === "House Husband" ? "- Homemaker: moderate activity, suggest quick healthy home-cooked meals" : ""}
${workProfile === "Driver/Delivery" ? "- Driver: sedentary in vehicle but stressed, suggest foods that maintain alertness, avoid heavy meals" : ""}
${workProfile === "Doctor/Healthcare" ? "- Healthcare worker: on feet all day, stress high, needs quick healthy meals between shifts" : ""}
${workProfile === "Factory Worker" ? "- Factory worker: physical labor, high protein and carbs needed for recovery" : ""}
${workProfile === "Construction Worker" ? "- Construction worker: heavy physical labor, very high calorie needs, protein for muscle" : ""}

RULES:
${rulesBlock}

Return ONLY valid JSON (no markdown):
{
  "greeting": "Personalized morning/afternoon/evening greeting in English",
  "calorieMessage": "short motivational message about their calorie status (the numbers themselves are computed by the app, do not repeat them as fields)",
  "foodSuggestions": [
    {
      "name": "Food name in English",
      "nameLocal": "Food name in ${locale.languageName} (script of that language; if it has no distinct name, repeat the English name)",
      "calories": number,
      "proteinG": number,
      "carbsG": number,
      "fatG": number,
      "portion": "${locale.portionHint}",
      "reason": "Why this is good for you (English, 1 sentence)",
      "mealType": "breakfast|lunch|dinner|snack",
      "isSeasonalSpecial": boolean
    }
  ],
  "exerciseSuggestion": {
    "type": "Exercise name",
    "durationMinutes": number,
    "caloriesToBurn": number,
    "description": "Short description in English",
    "intensity": "light|moderate|intense"
  },
  "healthTip": {
    "tip": "Today's health tip in English (2 sentences max)",
    "category": "nutrition|exercise|sleep|stress|hydration|ayurveda|seasonal",
    "emoji": "single emoji"
  },
  "medicalWarnings": [
    {
      "condition": "condition name",
      "warning": "specific warning in English",
      "foodsToAvoid": ["food1", "food2"],
      "foodsToPrefer": ["food1", "food2"]
    }
  ],
  "motivation": "Personalized motivational message for their goal in English",
  "weeklyMessage": "One line on how their week is going, given the history above"
}`;
}

// ── GET /suggestions/daily — Main endpoint ────────────────────────────────────
router.get("/suggestions/daily", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const planType = (req.userPlan || "free").toLowerCase();
    // IST-anchored, matching scoring.ts/activityScore.ts — a plain UTC date
    // slice puts a user logging between 00:00-05:30 IST on "yesterday",
    // so cached suggestions/today's activity would silently miss what they
    // just logged.
    const today = todayIST();

    // 1. Check cache — if today's suggestions exist, return them
    //    (BUG FIX: the AI-usage gate below runs AFTER this cache check, so
    //    repeatedly viewing already-cached suggestions never consumes quota
    //    — only an actual AI generation does. Previously a hardcoded,
    //    non-admin-controlled aiRateLimit() ran BEFORE this check, so even
    //    pure cache hits burned through the daily allowance.)
    const [cached] = await db.select()
      .from(dailySuggestionsTable)
      .where(and(eq(dailySuggestionsTable.userId, userId), eq(dailySuggestionsTable.date, today)))
      .limit(1);

    if (cached && cached.suggestionsJson) {
      res.json({
        suggestions: cached.suggestionsJson,
        fromCache: true,
        isFallback: false,
        generatedAt: cached.generatedAt,
        date: today,
      }); return;
    }

    // ── Admin-controlled AI quota gate (only reached on a real cache miss) ──
    // Uses "ai_health_coach_daily" — this IS the "AI Health Coach" feature
    // shown in the admin panel and sold in plan copy. It previously gated
    // "ai_health_suggestions_daily" instead, a key nothing in the pricing
    // plan referenced, while the real "Ai Health Coach" row in the admin
    // panel gated an endpoint (/ai/health-tip) no client ever calls -- so
    // the limit an admin thought they were controlling did nothing, and
    // this screen's real limit (Max: 999/day, i.e. unlimited) was invisible
    // and uncontrolled.
    const limitCheck = await checkAndUseAILimit(userId, "ai_health_coach_daily", planType);
    if (!limitCheck.allowed) {
      res.status(429).json({
        error: `You've reached today's suggestions limit. Limit: ${limitCheck.limit}/day on ${planType.toUpperCase()} plan.`,
        feature: "ai_health_coach_daily",
        limitPerDay: limitCheck.limit,
        usedToday: limitCheck.usedToday,
        currentPlan: planType,
        resetsAt: "midnight IST",
        upgradeSuggested: planType === "free",
      });
      return;
    }

    // 2. Load user data
    const [userRow] = await db.select({
      countryCode: usersTable.countryCode, languageCode: usersTable.languageCode,
    }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    // Both columns are NOT NULL with India defaults, so an existing user
    // resolves exactly as before; only a user who set something else moves.
    const locale = resolveLocale(userRow?.countryCode, userRow?.languageCode);

    const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId)).limit(1);
    const [prefs] = await db.select().from(userPreferencesTable).where(eq(userPreferencesTable.userId, userId)).limit(1);
    const conditions = await db.select().from(userMedicalConditionsTable).where(eq(userMedicalConditionsTable.userId, userId));
    const [goals] = await db.select().from(userHealthGoalsTable).where(eq(userHealthGoalsTable.userId, userId)).orderBy(userHealthGoalsTable.createdAt).limit(1);

    // 3. Prepare user context
    const age = profile?.dateOfBirth
      ? Math.floor((Date.now() - new Date(profile.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365))
      : null;
    const weightKg = profile?.weightKg ? Number(profile.weightKg) : null;
    const heightCm = profile?.heightCm ? Number(profile.heightCm) : null;
    const bmi = profile?.bmi ? Number(profile.bmi) : null;
    const activityLevel = (profile?.activityLevel as string) || "moderate";
    const workProfile = (profile?.workProfile as string) || null;
    const gender = (profile?.gender as string) || "other";
    const foodPreference = (profile?.foodPreference as string) || "veg";
    const foodAllergies = (profile?.foodAllergies as string[]) || [];
    const medicalConditions = conditions.map((c: any) => c.condition);

    // 4. Calculate calorie goal — now uses BOTH workProfile + activityLevel
    let calorieGoal = prefs?.calorieGoal || 2000;
    let effectiveTDEE = 2000;
    if (weightKg && heightCm && age) {
      effectiveTDEE = calculateTDEE(weightKg, heightCm, age, gender, activityLevel, workProfile || undefined);
      const primaryGoal = goals?.primaryGoal || "maintain";
      if (primaryGoal === "lose_weight" || primaryGoal === "weight_loss" || primaryGoal === "fat_loss") calorieGoal = Math.round(effectiveTDEE * 0.82);
      else if (primaryGoal === "gain_weight" || primaryGoal === "gain_muscle" || primaryGoal === "muscle_gain" || primaryGoal === "bulking" || primaryGoal === "athletic") calorieGoal = Math.round(effectiveTDEE * 1.12);
      else calorieGoal = effectiveTDEE;
    }

    // 5. Get today's activity (best-effort)
    let caloriesToday = 0, waterToday = 0, exerciseMinToday = 0;
    // Wearable/manual vitals — same tables lib/scoring.ts's Health Score
    // reads, so the Coach's picture of "today" matches the dashboard's
    // instead of being blind to sleep/steps/heart rate/oxygen entirely.
    let sleepHoursToday: number | null = null;
    let stepsToday: number | null = null;
    let heartRateAvg: number | null = null;
    let bloodOxygen: number | null = null;
    let wearableCaloriesToday: number | null = null;
    let mealsLoggedToday: string[] = [];
    try {
      const istBounds = istDayBounds(today);
      const dayStart = new Date(istBounds.dayStart);
      const dayEnd = new Date(istBounds.dayEnd);

      const [foodLogs, waterLogs, exerciseLogs, sleepLog, wearable] = await Promise.allSettled([
        db.select().from(foodLogsTable).where(and(eq(foodLogsTable.userId, userId), gte(foodLogsTable.loggedAt, dayStart), lte(foodLogsTable.loggedAt, dayEnd))),
        db.select().from(waterLogsTable).where(and(eq(waterLogsTable.userId, userId), gte(waterLogsTable.loggedAt, dayStart), lte(waterLogsTable.loggedAt, dayEnd))),
        db.select().from(exerciseLogsTable).where(and(eq(exerciseLogsTable.userId, userId), gte(exerciseLogsTable.loggedAt, dayStart), lte(exerciseLogsTable.loggedAt, dayEnd))),
        db.select().from(sleepLogsTable).where(and(eq(sleepLogsTable.userId, userId), eq(sleepLogsTable.sleepDate, today))).limit(1),
        db.select().from(wearableDataTable).where(and(eq(wearableDataTable.userId, userId), gte(wearableDataTable.syncedAt, dayStart), lte(wearableDataTable.syncedAt, dayEnd))).orderBy(desc(wearableDataTable.syncedAt)).limit(1),
      ]);

      if (foodLogs.status === "fulfilled") {
        caloriesToday = Math.round(foodLogs.value.reduce((s: any, l: any) => s + Number(l.calories || 0), 0));
        // Which slots they have already eaten, so the Coach suggests what is
        // still ahead of them instead of re-listing this morning's breakfast.
        mealsLoggedToday = Array.from(new Set(
          foodLogs.value.map((l: any) => String(l.mealType || "")).filter(Boolean)
        ));
      }
      if (waterLogs.status === "fulfilled") waterToday = waterLogs.value.reduce((s: any, l: any) => s + (l.glassesCount || 0), 0);
      if (exerciseLogs.status === "fulfilled") exerciseMinToday = exerciseLogs.value.reduce((s: any, l: any) => s + (l.durationMinutes || 0), 0);
      if (sleepLog.status === "fulfilled" && sleepLog.value[0]) sleepHoursToday = Number(sleepLog.value[0].sleepHours) || null;
      if (wearable.status === "fulfilled" && wearable.value[0]) {
        const w = wearable.value[0];
        stepsToday   = w.steps ?? null;
        heartRateAvg = w.heartRateAvg ?? null;
        bloodOxygen  = w.bloodOxygen ? Number(w.bloodOxygen) : null;
        // Feeds the burn budget below. A wearable's calorie figure covers the
        // whole day and normally already includes any logged workout, so it is
        // taken as a floor rather than added to the exercise-log total.
        wearableCaloriesToday = w.caloriesBurned ? Number(w.caloriesBurned) : null;
        // Wearable sleepHours is a secondary source — only use it if no
        // manual sleep_logs entry exists for today, never overwrite one.
        if (sleepHoursToday === null && w.sleepHours) sleepHoursToday = Number(w.sleepHours);
      }
    } catch (err) {
      // Safe to continue without today's context — suggestions just fall
      // back to defaults — but log it so a persistent failure is visible
      // instead of silently degrading suggestion quality forever.
      logger.warn({ err, userId }, "[Suggestions] Failed to fetch today's food/water/exercise/vitals context — continuing with defaults");
    }

    // 5b. Last 7 days of what the user ACTUALLY did, plus what we already
    // suggested. Without this the prompt only ever saw today's totals, so the
    // same profile and a similar day produced near-identical output — the
    // main reason the meal plan looked frozen even when the AI was healthy.
    let recentFoods: string[] = [];
    let recentExercises: string[] = [];
    let recentSuggestedFoods: string[] = [];
    let burnedToday = 0;
    try {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const istBounds = istDayBounds(today);
      const [foodHist, exHist, pastSuggestions, todayEx] = await Promise.allSettled([
        db.select({ name: foodLogsTable.foodNameEn })
          .from(foodLogsTable)
          .where(and(eq(foodLogsTable.userId, userId), gte(foodLogsTable.loggedAt, weekAgo)))
          .orderBy(desc(foodLogsTable.loggedAt)).limit(40),
        db.select({ type: exerciseLogsTable.exerciseType, mins: exerciseLogsTable.durationMinutes })
          .from(exerciseLogsTable)
          .where(and(eq(exerciseLogsTable.userId, userId), gte(exerciseLogsTable.loggedAt, weekAgo)))
          .orderBy(desc(exerciseLogsTable.loggedAt)).limit(30),
        db.select({ json: dailySuggestionsTable.suggestionsJson })
          .from(dailySuggestionsTable)
          .where(eq(dailySuggestionsTable.userId, userId))
          .orderBy(desc(dailySuggestionsTable.date)).limit(3),
        db.select({ cals: exerciseLogsTable.caloriesBurned })
          .from(exerciseLogsTable)
          .where(and(
            eq(exerciseLogsTable.userId, userId),
            gte(exerciseLogsTable.loggedAt, new Date(istBounds.dayStart)),
            lte(exerciseLogsTable.loggedAt, new Date(istBounds.dayEnd)),
          )),
      ]);

      if (foodHist.status === "fulfilled") {
        recentFoods = Array.from(new Set(foodHist.value.map((r) => r.name).filter(Boolean))).slice(0, 20);
      }
      if (exHist.status === "fulfilled") {
        // Collapse to "Walking (3x, 95 min)" so a week of logs stays a few
        // tokens instead of thirty repeated lines.
        const byType = new Map<string, { n: number; mins: number }>();
        for (const r of exHist.value) {
          const cur = byType.get(r.type) ?? { n: 0, mins: 0 };
          byType.set(r.type, { n: cur.n + 1, mins: cur.mins + (r.mins || 0) });
        }
        recentExercises = Array.from(byType.entries())
          .sort((a, b) => b[1].mins - a[1].mins)
          .slice(0, 8)
          .map(([type, v]) => `${type} (${v.n}x, ${v.mins} min)`);
      }
      if (pastSuggestions.status === "fulfilled") {
        for (const row of pastSuggestions.value) {
          const foods = (row.json as { foodSuggestions?: Array<{ name?: string }> })?.foodSuggestions;
          if (Array.isArray(foods)) {
            for (const f of foods) if (f?.name) recentSuggestedFoods.push(f.name);
          }
        }
        recentSuggestedFoods = Array.from(new Set(recentSuggestedFoods)).slice(0, 15);
      }
      if (todayEx.status === "fulfilled") {
        burnedToday = Math.round(todayEx.value.reduce((sum, r) => sum + Number(r.cals || 0), 0));
      }
    } catch (err) {
      logger.warn({ err, userId }, "[Suggestions] Failed to load 7-day history — falling back to a profile-only prompt");
    }

    // Wearable calories count toward the day's burn too, but only when they
    // exceed what the exercise logs already account for — a wearable total is
    // a whole-day figure that usually INCLUDES the logged workout, so adding
    // the two would double-count it.
    if (wearableCaloriesToday !== null) {
      burnedToday = Math.max(burnedToday, Math.round(wearableCaloriesToday));
    }

    // 5c. This week's published diet chart (Intelligence tab). The Coach reads
    // it read-only — it never generates or refreshes one, so this adds no AI
    // call and no plan gate: it is the user's own already-generated plan.
    let todayChart: ChartDay | null = null;
    try {
      const [chartRow] = await db.select({ json: weeklyDietChartsTable.dietChartJson })
        .from(weeklyDietChartsTable)
        .where(and(
          eq(weeklyDietChartsTable.userId, userId),
          eq(weeklyDietChartsTable.weekStart, istWeekStart()),
        ))
        .limit(1);
      if (chartRow?.json) {
        const day = pickTodayFromChart(chartRow.json, today);
        // A chart entry with no usable meals is the same as having no chart —
        // better to fall through to next-meal mode than to prompt with an
        // empty plan the model would then "helpfully" fill in itself.
        todayChart = day && formatChartDay(day).length > 0 ? day : null;
      }
    } catch (err) {
      logger.warn({ err, userId }, "[Suggestions] Failed to read this week's diet chart — coaching without it");
    }

    // The burn target is the exercise half of the goal the calorie side
    // already encodes: a weight-loss goal sets calorieGoal below TDEE, and
    // that gap is what activity is meant to cover. Previously the model was
    // asked to invent `caloriesToBurn` with nothing tying it to either number.
    const burnTarget = Math.max(0, Math.round(effectiveTDEE - calorieGoal));

    // 6. Generate AI suggestions
    const prompt = buildPrompt({
      age, gender, weightKg, heightCm, bmi, activityLevel, workProfile,
      primaryGoal: goals?.primaryGoal || "maintain",
      targetWeightKg: goals?.targetWeightKg ? Number(goals.targetWeightKg) : null,
      foodPreference, foodAllergies, medicalConditions,
      caloriesToday, waterToday, waterGoal: prefs?.waterGoalGlasses || 8,
      exerciseMinToday, calorieGoal, season: seasonFor(locale),
      effectiveTDEE, sleepHoursToday, stepsToday, heartRateAvg, bloodOxygen,
      recentFoods, recentSuggestedFoods, recentExercises, burnTarget, burnedToday,
      todayChart, mealsLoggedToday, locale,
    });

    let suggestions: unknown;
    let usedFallback = false;
    const generatedAt = new Date();
    try {
      // 2000 could not fit ten fields plus a food array, so a complete answer
      // was truncated mid-JSON, threw on parse, and landed in the generic
      // fallback below — one of the reasons every day looked identical.
      // (The weekly diet chart, a bigger response, already asks for 6000.)
      const jsonStr = await callAI("health_suggestions", [{ role: "user", content: prompt }], { maxTokens: 3000, temperature: 0.7 });
      let cleanJson = jsonStr.trim();
      if (cleanJson.startsWith("```json")) {
        cleanJson = cleanJson.substring(7);
      }
      if (cleanJson.endsWith("```")) {
        cleanJson = cleanJson.substring(0, cleanJson.length - 3);
      }
      cleanJson = cleanJson.trim();
      suggestions = JSON.parse(cleanJson);
    } catch {
      // Fallback if Gemini fails — the user still gets a usable response, but
      // it's generic rather than personalized, so refund the quota unit they
      // paid for a real AI call.
      await refundAIUsage(userId, "ai_health_coach_daily");
      usedFallback = true;
      suggestions = {
        greeting: "Hello! Wishing you a wonderful and healthy day ahead! 🙏",
        calorieMessage: "Keep tracking your calorie goal!",
        // Two sets, because a generic fallback that names dal and sabzi is
        // not generic — it is India's answer handed to someone in São Paulo.
        // Outside South Asia the dishes are deliberately plain and widely
        // available rather than an attempt at 200 national cuisines.
        foodSuggestions: SOUTH_ASIA_FALLBACK.has(locale.countryCode)
          ? [
            { name: "Dal Chawal", nameLocal: "दाल चावल", calories: 350, proteinG: 12, carbsG: 58, fatG: 4, portion: "1 bowl dal + 1 bowl rice", reason: "Great balance of protein and carbohydrates", mealType: "lunch", isSeasonalSpecial: false },
            { name: "Moong Dal Cheela", nameLocal: "मूंग दाल चीला", calories: 180, proteinG: 9, carbsG: 22, fatG: 5, portion: "2 cheelas", reason: "High protein, low calorie breakfast option", mealType: "breakfast", isSeasonalSpecial: false },
            { name: "Mixed Vegetable Sabzi", nameLocal: "मिक्स सब्जी", calories: 120, proteinG: 4, carbsG: 15, fatG: 5, portion: "1 bowl", reason: "Packed with vitamins and fiber", mealType: "dinner", isSeasonalSpecial: false },
          ]
          : [
            { name: "Oats with fruit", nameLocal: "Oats with fruit", calories: 300, proteinG: 10, carbsG: 48, fatG: 7, portion: "1 bowl", reason: "Slow-release carbohydrates and fibre to start the day", mealType: "breakfast", isSeasonalSpecial: false },
            { name: "Grilled protein with vegetables", nameLocal: "Grilled protein with vegetables", calories: 420, proteinG: 35, carbsG: 20, fatG: 18, portion: "1 plate", reason: "High protein with a low glycemic load", mealType: "lunch", isSeasonalSpecial: false },
            { name: "Lentil or bean soup", nameLocal: "Lentil or bean soup", calories: 260, proteinG: 15, carbsG: 34, fatG: 5, portion: "1 bowl", reason: "Filling, high in fibre and light on the stomach at night", mealType: "dinner", isSeasonalSpecial: false },
          ],
        exerciseSuggestion: { type: "Brisk Walk", durationMinutes: 30, caloriesToBurn: 150, description: "A 30-minute brisk walk in the morning or evening is highly beneficial", intensity: "moderate" },
        healthTip: { tip: "Drink 2 glasses of water right after waking up — it boosts metabolism and flushes toxins", category: "hydration", emoji: "💧" },
        medicalWarnings: [],
        motivation: "Every step brings you closer to your goal. Keep going! 💪",
        weeklyMessage: "Keep logging — your weekly picture builds up as you go.",
      };
    }

    // 6b. Rebuild the arithmetic here rather than trusting the model with it.
    // The server already computed the goal, the intake and the weight gap —
    // it was previously handing those numbers to the AI purely to have them
    // read back, which cost tokens and let a hallucinated figure through.
    const weightGap = weightKg && goals?.targetWeightKg
      ? Math.round(Math.abs(weightKg - Number(goals.targetWeightKg)) * 10) / 10
      : 0;
    // ~0.5 kg a week is the usual safe rate; with no deficit configured there
    // is no honest estimate to give, so it stays null rather than guessing.
    const weeklyDeficit = Math.max(0, effectiveTDEE - calorieGoal) * 7;
    const estimatedWeeks = weightGap > 0 && weeklyDeficit > 0
      ? Math.max(1, Math.round(weightGap / Math.min(0.5, weeklyDeficit / 7700)))
      : null;

    const s2 = suggestions as Record<string, unknown>;
    // Hydration is no longer an AI-written section here — it duplicated the
    // dashboard's water tracker, and asking the model for a message plus tips
    // cost tokens for something the app already knows exactly. The header
    // still shows the real count; the advice, when it is needed, rides along
    // in the health tip (see the last prompt rule).
    delete s2.waterReminder;
    s2.waterStatus = { current: waterToday, goal: prefs?.waterGoalGlasses || 8 };
    // The prompt asks for `nameLocal`, but the model has years of practice
    // emitting `nameHindi`, and a client from before this change reads only
    // `nameHindi`. Fill both from whichever arrived, so neither the screen nor
    // an app still on the old build shows a blank subtitle.
    const foods = s2.foodSuggestions;
    if (Array.isArray(foods)) {
      for (const f of foods as Record<string, unknown>[]) {
        if (!f || typeof f !== "object") continue;
        if (!f.nameLocal && typeof f.nameHindi === "string") f.nameLocal = f.nameHindi;
        if (!f.nameHindi && typeof f.nameLocal === "string") f.nameHindi = f.nameLocal;
      }
    }

    // Lets the screen say WHY these dishes: "following your weekly diet chart"
    // vs "your next meal". Without it a one-meal answer looks like a bug.
    s2.mealPlanSource = todayChart ? "diet_chart" : "next_meal";
    s2.nextMealSlot = todayChart ? null : nextMealSlot(istHour()).slot;
    s2.calorieStatus = {
      goal: calorieGoal,
      eaten: caloriesToday,
      remaining: Math.max(0, calorieGoal - caloriesToday),
      message: typeof s2.calorieMessage === "string" ? s2.calorieMessage : "Keep tracking your calorie goal!",
    };
    delete s2.calorieMessage;
    s2.targetProgress = {
      currentWeight: weightKg || 0,
      targetWeight: goals?.targetWeightKg ? Number(goals.targetWeightKg) : 0,
      weightGap,
      estimatedWeeks,
      weeklyMessage: typeof s2.weeklyMessage === "string" ? s2.weeklyMessage : "",
    };
    delete s2.weeklyMessage;
    // Same treatment for the burn figure: the model is told to echo the
    // computed remainder, but a wrong number here would be visible advice, so
    // it is overwritten with the value the app actually stands behind.
    const ex = s2.exerciseSuggestion as Record<string, unknown> | undefined;
    if (ex && typeof ex === "object") {
      ex.caloriesToBurn = Math.max(0, burnTarget - burnedToday);
    }

    // 7. Cache in DB (delete old + insert new to avoid upsert constraint complexity)
    //
    // The generic fallback is deliberately NOT cached. It used to be written
    // here with isAiGenerated: true — a flat untruth — which meant one failed
    // AI call froze the same three dishes in front of the user for the rest of
    // the day, with nothing in the response or the row to show it had
    // happened. Leaving it uncached lets the next open try the AI again and
    // recover on its own the moment the provider is healthy.
    if (!usedFallback) {
      await db.delete(dailySuggestionsTable)
        .where(and(eq(dailySuggestionsTable.userId, userId), eq(dailySuggestionsTable.date, today)));
      await db.insert(dailySuggestionsTable).values({
        userId,
        date: today,
        suggestionsJson: suggestions as Record<string, unknown>,
        generatedAt,
        calorieGoalUsed: calorieGoal,
        isAiGenerated: true,
      });
    }

    // `isFallback` tells the client these are generic defaults rather than
    // anything personalised, so the screen can say so instead of presenting
    // them as coaching.
    res.json({ suggestions, fromCache: false, isFallback: usedFallback, generatedAt, date: today });
  } catch (err) {
    req.log.error({ err }, "Suggestions error");
    res.status(500).json({ error: "Failed to generate suggestions" });
  }
});

// ── POST /suggestions/refresh — Force new AI generation ──────────────────────
router.post("/suggestions/refresh", requireAuth, async (req: AuthRequest, res) => {
  try {
    // Must match the same IST day key /suggestions/daily reads/writes,
    // otherwise this clears (or misses) the wrong day's cached row.
    const today = todayIST();
    await db.delete(dailySuggestionsTable).where(
      and(eq(dailySuggestionsTable.userId, req.userId!), eq(dailySuggestionsTable.date, today))
    );
    res.json({ success: true, message: "Cache cleared — call /suggestions/daily again" });
  } catch {
    res.status(500).json({ error: "Refresh failed" });
  }
});

// ── GET /notifications/settings ───────────────────────────────────────────────
router.get("/notifications/settings", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [prefs] = await db.select().from(userPreferencesTable)
      .where(eq(userPreferencesTable.userId, req.userId!)).limit(1);
    const DEFAULT_SETTINGS = {
      notificationsEnabled: true,
      medicineReminders: true,
      waterReminders: true,
      foodReminders: true,
      periodReminders: true,
      suggestionNotifications: true,
      waterReminderTimes: "09:00,13:00,18:00,21:00",
      foodReminderTime: "07:30,12:30,19:30",
      medicineReminderTime: "08:00,14:00,21:00",
      wakeUpTime: "07:00",
      bedTime: "22:30",
      weeklyReportEmail: false,
      calorieGoal: 2000,
      waterGoalGlasses: 8,
    };
    if (!prefs) {
      res.json({ settings: DEFAULT_SETTINGS, isDefault: true });
      return;
    }
    res.json({
      settings: {
        notificationsEnabled: prefs.notificationsEnabled ?? DEFAULT_SETTINGS.notificationsEnabled,
        medicineReminders: prefs.medicineReminders ?? DEFAULT_SETTINGS.medicineReminders,
        waterReminders: prefs.waterReminders ?? DEFAULT_SETTINGS.waterReminders,
        foodReminders: (prefs as Record<string, unknown>).foodReminders ?? DEFAULT_SETTINGS.foodReminders,
        periodReminders: (prefs as Record<string, unknown>).periodReminders ?? DEFAULT_SETTINGS.periodReminders,
        suggestionNotifications: (prefs as Record<string, unknown>).suggestionNotifications ?? DEFAULT_SETTINGS.suggestionNotifications,
        waterReminderTimes: (prefs as Record<string, unknown>).waterReminderTimes ?? DEFAULT_SETTINGS.waterReminderTimes,
        foodReminderTime: (prefs as Record<string, unknown>).foodReminderTime ?? DEFAULT_SETTINGS.foodReminderTime,
        medicineReminderTime: (prefs as Record<string, unknown>).medicineReminderTime ?? DEFAULT_SETTINGS.medicineReminderTime,
        wakeUpTime: (prefs as Record<string, unknown>).wakeUpTime ?? DEFAULT_SETTINGS.wakeUpTime,
        bedTime: (prefs as Record<string, unknown>).bedTime ?? DEFAULT_SETTINGS.bedTime,
        weeklyReportEmail: prefs.weeklyReportEmail ?? DEFAULT_SETTINGS.weeklyReportEmail,
        calorieGoal: prefs.calorieGoal ?? DEFAULT_SETTINGS.calorieGoal,
        waterGoalGlasses: prefs.waterGoalGlasses ?? DEFAULT_SETTINGS.waterGoalGlasses,
      },
      isDefault: false,
    });
  } catch {
    res.status(500).json({ error: "Failed to load settings" });
  }
});

// AUDIT FIX (Phase 0): "HH:MM" 24-hour format check, reused for every time-ish
// field below. Root-cause note: this route previously accepted any string for
// wakeUpTime/bedTime/*ReminderTime with zero validation — a malformed value
// saved here would flow straight into the mobile app's notification scheduler
// (lib/notifications.ts parseTime()), which silently drops any time it can't
// parse. That meant a bad save here = a reminder that silently never fires,
// with no error surfaced anywhere in the chain.
function isValidHHMM(t: unknown): t is string {
  return typeof t === "string" && /^([01]\d|2[0-3]):([0-5]\d)$/.test(t);
}

// Some fields (waterReminderTimes/foodReminderTime/medicineReminderTime) are
// stored as comma-separated "HH:MM,HH:MM,..." lists — validate every entry.
function isValidHHMMList(t: unknown): t is string {
  if (typeof t !== "string" || t.trim().length === 0) return false;
  return t.split(",").every((part) => isValidHHMM(part.trim()));
}

// ── PUT /notifications/settings ───────────────────────────────────────────────
router.put("/notifications/settings", requireAuth, async (req: AuthRequest, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const booleanFields = [
      "notificationsEnabled", "medicineReminders", "waterReminders",
      "foodReminders", "periodReminders", "suggestionNotifications",
      "weeklyReportEmail",
    ];
    const singleTimeFields = ["wakeUpTime", "bedTime"];
    const timeListFields = ["waterReminderTimes", "foodReminderTime", "medicineReminderTime"];

    const updates: Record<string, unknown> = {};
    const invalidFields: string[] = [];

    for (const key of booleanFields) {
      if (!Object.prototype.hasOwnProperty.call(body, key) || body[key] === undefined) continue;
      if (typeof body[key] !== "boolean") { invalidFields.push(key); continue; }
      updates[key] = body[key];
    }

    for (const key of singleTimeFields) {
      if (!Object.prototype.hasOwnProperty.call(body, key) || body[key] === undefined) continue;
      if (!isValidHHMM(body[key])) { invalidFields.push(key); continue; }
      updates[key] = body[key];
    }

    for (const key of timeListFields) {
      if (!Object.prototype.hasOwnProperty.call(body, key) || body[key] === undefined) continue;
      if (!isValidHHMMList(body[key])) { invalidFields.push(key); continue; }
      updates[key] = body[key];
    }

    if (Object.prototype.hasOwnProperty.call(body, "calorieGoal") && body.calorieGoal !== undefined) {
      const v = Number(body.calorieGoal);
      if (!Number.isFinite(v) || v < 500 || v > 10000) invalidFields.push("calorieGoal");
      else updates.calorieGoal = Math.round(v);
    }

    if (Object.prototype.hasOwnProperty.call(body, "waterGoalGlasses") && body.waterGoalGlasses !== undefined) {
      const v = Number(body.waterGoalGlasses);
      if (!Number.isFinite(v) || v < 1 || v > 30) invalidFields.push("waterGoalGlasses");
      else updates.waterGoalGlasses = Math.round(v);
    }

    if (invalidFields.length > 0) {
      res.status(400).json({ error: "Invalid value for field(s)", fields: invalidFields });
      return;
    }

    if (Object.keys(updates).length === 0) {
      res.json({ success: true });
      return;
    }

    // AUDIT FIX (Phase 0): was a bare UPDATE with no existence check — if a
    // user's user_preferences row didn't exist (e.g. a future signup path
    // that misses the "ensure supporting rows exist" insert), this silently
    // matched zero rows and returned {success:true} anyway, permanently
    // discarding the user's settings change with no error to the client.
    // Upsert guarantees the row always ends up correct regardless of whether
    // it previously existed.
    await db.insert(userPreferencesTable)
      .values({ userId: req.userId!, ...updates })
      .onConflictDoUpdate({ target: userPreferencesTable.userId, set: updates });

    res.json({ success: true });
  } catch (e) {
    logger.error({ err: e }, "notifications/settings PUT error");
    res.status(500).json({ error: "Failed to save settings" });
  }
});

export default router;
