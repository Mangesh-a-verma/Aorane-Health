/**
 * Daily Suggestions & Notification Settings
 * GET  /suggestions/daily          — AI-powered personalized daily suggestions (cached)
 * POST /suggestions/refresh        — Force fresh AI suggestions
 * GET  /notifications/settings     — User notification preferences
 * PUT  /notifications/settings     — Update notification preferences
 */

import { Router } from "express";
import {
  db, usersTable, userProfilesTable, userPreferencesTable,
  userMedicalConditionsTable, userHealthGoalsTable,
  dailySuggestionsTable, foodLogsTable, waterLogsTable, exerciseLogsTable,
} from "@workspace/db";
import { eq, and, gte, lte } from "drizzle-orm";
import { requireAuth } from "../../middlewares/user-auth";
import type { AuthRequest } from "../../middlewares/user-auth";
import { aiRateLimit } from "../../middlewares/ai-rate-limit";
import { callAI } from "../../lib/ai";

const router = Router();

// ── Indian season detection ────────────────────────────────────────────────────
function getIndianSeason(): string {
  const month = new Date().getMonth() + 1;
  if ([12, 1, 2].includes(month)) return "Winter (Sardi) — Seasonal foods: Sarson saag, Gajar, Peas, Bajra, Tilgud";
  if ([3, 4, 5].includes(month)) return "Summer (Garmi) — Seasonal foods: Aam, Tarbuz, Aam Panna, Nimbu Paani, Coconut Water";
  if ([6, 7, 8, 9].includes(month)) return "Monsoon (Barsaat) — Avoid raw salads. Prefer: Khichdi, Dahi, Ginger tea, Turmeric milk";
  return "Autumn (Sharad) — Seasonal foods: Pomegranate, Guava, Apple, Light dal";
}

// ── Work profile → activity multiplier mapping ───────────────────────────────
const WORK_PROFILE_MULTIPLIERS: Record<string, number> = {
  "Office/Desk Job":     1.2,
  "IT/Software":         1.2,
  "Call Center/BPO":     1.2,
  "Freelancer/WFH":      1.2,
  "Teacher/Professor":   1.375,
  "Doctor/Healthcare":   1.375,
  "Business Owner":      1.375,
  "Housewife":           1.375,
  "House Husband":       1.375,
  "Retired":             1.375,
  "Artist/Creative":     1.375,
  "Student (School)":    1.375,
  "Field/Sales":         1.55,
  "Driver/Delivery":     1.55,
  "Factory Worker":      1.55,
  "ASHA/ANM Worker":     1.55,
  "Student (College)":   1.55,
  "Police/CRPF":         1.725,
  "Army/Defence":        1.725,
  "Farmer/Agriculture":  1.725,
  "Construction Worker": 1.725,
  "Athlete/Sports":      1.9,
};

// Maps work profile → activity level label (for display + prompt)
const WORK_PROFILE_ACTIVITY: Record<string, string> = {
  "Office/Desk Job":     "sedentary",
  "IT/Software":         "sedentary",
  "Call Center/BPO":     "sedentary",
  "Freelancer/WFH":      "sedentary",
  "Teacher/Professor":   "light",
  "Doctor/Healthcare":   "light",
  "Business Owner":      "light",
  "Housewife":           "light",
  "House Husband":       "light",
  "Retired":             "light",
  "Artist/Creative":     "light",
  "Student (School)":    "light",
  "Field/Sales":         "moderate",
  "Driver/Delivery":     "moderate",
  "Factory Worker":      "moderate",
  "ASHA/ANM Worker":     "moderate",
  "Student (College)":   "moderate",
  "Police/CRPF":         "very",
  "Army/Defence":        "very",
  "Farmer/Agriculture":  "very",
  "Construction Worker": "very",
  "Athlete/Sports":      "athlete",
};

// ── BMR / TDEE calculation — uses BOTH workProfile + activityLevel ────────────
function calculateTDEE(
  weightKg: number, heightCm: number, age: number, gender: string,
  activityLevel: string, workProfile?: string
): number {
  const bmr = gender === "female"
    ? 655 + 9.6 * weightKg + 1.8 * heightCm - 4.7 * age
    : 66 + 13.7 * weightKg + 5 * heightCm - 6.8 * age;

  // Work profile multiplier (based on job physical demand)
  const workMultiplier = workProfile ? (WORK_PROFILE_MULTIPLIERS[workProfile] || 1.4) : 1.4;

  // Exercise/lifestyle multiplier (additional to work)
  const exerciseMultipliers: Record<string, number> = {
    sedentary: 0, light: 0.05, moderate: 0.1, very: 0.175, athlete: 0.25,
  };
  const exerciseAdd = exerciseMultipliers[activityLevel] || 0;

  // Effective multiplier: work base + exercise addition, capped at 2.0
  const effectiveMultiplier = Math.min(2.0, workMultiplier + exerciseAdd);

  return Math.round(bmr * effectiveMultiplier);
}

// ── Build full suggestion prompt ──────────────────────────────────────────────
function buildPrompt(data: {
  age: number | null; gender: string; weightKg: number | null; heightCm: number | null;
  bmi: number | null; activityLevel: string; workProfile: string | null;
  primaryGoal: string; targetWeightKg: number | null;
  foodPreference: string; foodAllergies: string[]; medicalConditions: string[];
  caloriesToday: number; waterToday: number; waterGoal: number; exerciseMinToday: number;
  calorieGoal: number; season: string; effectiveTDEE: number;
}): string {
  const { age, gender, weightKg, heightCm, bmi, activityLevel, workProfile, primaryGoal, targetWeightKg,
    foodPreference, foodAllergies, medicalConditions, caloriesToday, waterToday, waterGoal,
    exerciseMinToday, calorieGoal, season, effectiveTDEE } = data;

  const remainingCalories = Math.max(0, calorieGoal - caloriesToday);
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const allergyStr = foodAllergies.length > 0 && !foodAllergies.includes("None") ? foodAllergies.join(", ") : "none";
  const conditionStr = medicalConditions.length > 0 ? medicalConditions.join(", ") : "none";
  const workProfileDesc = workProfile
    ? `${workProfile} (${WORK_PROFILE_ACTIVITY[workProfile] || "moderate"} activity job)`
    : "unknown";

  return `You are Aorane, a certified Indian health coach and nutritionist. Give personalized daily health suggestions in English.

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
1. All food suggestions must be AUTHENTIC INDIAN foods
2. Respect dietary preference: ${foodPreference} (no items that violate this)
3. AVOID any allergens: ${allergyStr}
4. For medical conditions (${conditionStr}): give specific medical warnings
5. Suggest seasonal foods when possible
6. Calorie numbers should be realistic for Indian serving sizes
7. If diabetes: avoid high-GI foods, suggest low-GI options
8. If high BP: suggest low-sodium options, avoid pickles/papad
9. Language: Respond entirely in English
10. Give work-profile-specific advice (e.g. Army: stamina foods; Office: screen fatigue tips)

Return ONLY valid JSON (no markdown):
{
  "greeting": "Personalized morning/afternoon/evening greeting in English",
  "calorieStatus": {
    "goal": ${calorieGoal},
    "eaten": ${caloriesToday},
    "remaining": ${remainingCalories},
    "message": "short motivational message about calorie status"
  },
  "foodSuggestions": [
    {
      "name": "Food name in English",
      "nameHindi": "Food name in Hindi",
      "calories": number,
      "proteinG": number,
      "carbsG": number,
      "fatG": number,
      "portion": "1 katori / 2 roti etc.",
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
  "waterReminder": {
    "current": ${waterToday},
    "goal": ${waterGoal},
    "message": "Water reminder message in English",
    "tipsForDrinkingMore": ["tip1", "tip2"]
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
  "targetProgress": {
    "currentWeight": ${weightKg || 0},
    "targetWeight": ${targetWeightKg || 0},
    "weightGap": ${weightKg && targetWeightKg ? Math.abs(weightKg - targetWeightKg).toFixed(1) : 0},
    "estimatedWeeks": number,
    "weeklyMessage": "Progress update in English"
  }
}`;
}

// ── GET /suggestions/daily — Main endpoint ────────────────────────────────────
router.get("/suggestions/daily", requireAuth, aiRateLimit("daily_suggestions", 3), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const today = new Date().toISOString().slice(0, 10);

    // 1. Check cache — if today's suggestions exist, return them
    const [cached] = await db.select()
      .from(dailySuggestionsTable)
      .where(and(eq(dailySuggestionsTable.userId, userId), eq(dailySuggestionsTable.date, today)))
      .limit(1);

    if (cached && cached.suggestionsJson) {
      res.json({
        suggestions: cached.suggestionsJson,
        fromCache: true,
        generatedAt: cached.generatedAt,
        date: today,
      }); return;
    }

    // 2. Load user data
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
    try {
      const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(); dayEnd.setHours(23, 59, 59, 999);

      const [foodLogs, waterLogs, exerciseLogs] = await Promise.allSettled([
        db.select().from(foodLogsTable).where(and(eq(foodLogsTable.userId, userId), gte(foodLogsTable.loggedAt, dayStart), lte(foodLogsTable.loggedAt, dayEnd))),
        db.select().from(waterLogsTable).where(and(eq(waterLogsTable.userId, userId), gte(waterLogsTable.loggedAt, dayStart), lte(waterLogsTable.loggedAt, dayEnd))),
        db.select().from(exerciseLogsTable).where(and(eq(exerciseLogsTable.userId, userId), gte(exerciseLogsTable.loggedAt, dayStart), lte(exerciseLogsTable.loggedAt, dayEnd))),
      ]);

      if (foodLogs.status === "fulfilled") caloriesToday = Math.round(foodLogs.value.reduce((s: any, l: any) => s + Number(l.calories || 0), 0));
      if (waterLogs.status === "fulfilled") waterToday = waterLogs.value.reduce((s: any, l: any) => s + (l.glassesCount || 0), 0);
      if (exerciseLogs.status === "fulfilled") exerciseMinToday = exerciseLogs.value.reduce((s: any, l: any) => s + (l.durationMinutes || 0), 0);
    } catch { }

    // 6. Generate AI suggestions
    const prompt = buildPrompt({
      age, gender, weightKg, heightCm, bmi, activityLevel, workProfile,
      primaryGoal: goals?.primaryGoal || "maintain",
      targetWeightKg: goals?.targetWeightKg ? Number(goals.targetWeightKg) : null,
      foodPreference, foodAllergies, medicalConditions,
      caloriesToday, waterToday, waterGoal: prefs?.waterGoalGlasses || 8,
      exerciseMinToday, calorieGoal, season: getIndianSeason(),
      effectiveTDEE,
    });

    let suggestions: unknown;
    const generatedAt = new Date();
    try {
      const jsonStr = await callAI("health_suggestions", [{ role: "user", content: prompt }], { maxTokens: 2000 });
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
      // Fallback if Gemini fails
      suggestions = {
        greeting: "Hello! Wishing you a wonderful and healthy day ahead! 🙏",
        calorieStatus: { goal: calorieGoal, eaten: caloriesToday, remaining: Math.max(0, calorieGoal - caloriesToday), message: "Keep tracking your calorie goal!" },
        foodSuggestions: [
          { name: "Dal Chawal", nameHindi: "दाल चावल", calories: 350, proteinG: 12, carbsG: 58, fatG: 4, portion: "1 bowl dal + 1 bowl rice", reason: "Great balance of protein and carbohydrates", mealType: "lunch", isSeasonalSpecial: false },
          { name: "Moong Dal Cheela", nameHindi: "मूंग दाल चीला", calories: 180, proteinG: 9, carbsG: 22, fatG: 5, portion: "2 cheelas", reason: "High protein, low calorie breakfast option", mealType: "breakfast", isSeasonalSpecial: false },
          { name: "Mixed Vegetable Sabzi", nameHindi: "मिक्स सब्जी", calories: 120, proteinG: 4, carbsG: 15, fatG: 5, portion: "1 bowl", reason: "Packed with vitamins and fiber", mealType: "dinner", isSeasonalSpecial: false },
        ],
        exerciseSuggestion: { type: "Brisk Walk", durationMinutes: 30, caloriesToBurn: 150, description: "A 30-minute brisk walk in the morning or evening is highly beneficial", intensity: "moderate" },
        waterReminder: { current: waterToday, goal: prefs?.waterGoalGlasses || 8, message: "Don't forget to stay hydrated! 💧", tipsForDrinkingMore: ["Drink one glass every hour", "Have 1 glass of water before meals"] },
        healthTip: { tip: "Drink 2 glasses of water right after waking up — it boosts metabolism and flushes toxins", category: "hydration", emoji: "💧" },
        medicalWarnings: [],
        motivation: "Every step brings you closer to your goal. Keep going! 💪",
        targetProgress: { currentWeight: weightKg || 0, targetWeight: goals?.targetWeightKg ? Number(goals.targetWeightKg) : 0, weightGap: 0, estimatedWeeks: 0, weeklyMessage: "Loading your progress data..." },
      };
    }

    // 7. Cache in DB (delete old + insert new to avoid upsert constraint complexity)
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

    res.json({ suggestions, fromCache: false, generatedAt, date: today });
  } catch (err) {
    req.log.error({ err }, "Suggestions error");
    res.status(500).json({ error: "Failed to generate suggestions" });
  }
});

// ── POST /suggestions/refresh — Force new AI generation ──────────────────────
router.post("/suggestions/refresh", requireAuth, aiRateLimit("daily_suggestions", 3), async (req: AuthRequest, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
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

// ── PUT /notifications/settings ───────────────────────────────────────────────
router.put("/notifications/settings", requireAuth, async (req: AuthRequest, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const allowed = [
      "notificationsEnabled", "medicineReminders", "waterReminders",
      "foodReminders", "periodReminders", "suggestionNotifications",
      "waterReminderTimes", "foodReminderTime", "medicineReminderTime",
      "wakeUpTime", "bedTime", "weeklyReportEmail", "calorieGoal", "waterGoalGlasses",
    ];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(body, key) && body[key] !== undefined) updates[key] = body[key];
    }

    await db.update(userPreferencesTable)
      .set(updates)
      .where(eq(userPreferencesTable.userId, req.userId!));

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to save settings" });
  }
});

export default router;
