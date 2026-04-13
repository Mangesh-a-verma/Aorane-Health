import { Router } from "express";
import {
  db, exerciseLogsTable, waterLogsTable, dailyHealthScoresTable,
  userProfilesTable, userPreferencesTable, foodLogsTable, medicineLogsTable, stressLogsTable
} from "@workspace/db";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { requireAuth } from "../../middlewares/user-auth";
import type { AuthRequest } from "../../middlewares/user-auth";

const router = Router();

// ─────────────────────────────────────────────────────────
// MET values for each exercise (per kg per hour)
// ─────────────────────────────────────────────────────────
const MET_VALUES: Record<string, { light: number; moderate: number; intense: number }> = {
  "Walking":          { light: 2.5,  moderate: 3.5,  intense: 4.5  },
  "Running":          { light: 7.0,  moderate: 9.8,  intense: 13.5 },
  "Yoga":             { light: 2.0,  moderate: 2.5,  intense: 4.0  },
  "Cycling":          { light: 4.0,  moderate: 7.5,  intense: 10.0 },
  "Swimming":         { light: 5.0,  moderate: 8.0,  intense: 11.0 },
  "Weight Training":  { light: 3.0,  moderate: 5.0,  intense: 7.0  },
  "Dancing":          { light: 3.0,  moderate: 4.5,  intense: 7.0  },
  "Cricket":          { light: 3.5,  moderate: 5.0,  intense: 7.0  },
  "Badminton":        { light: 4.0,  moderate: 5.5,  intense: 7.5  },
  "Skipping":         { light: 8.0,  moderate: 11.0, intense: 13.5 },
  "HIIT":             { light: 7.0,  moderate: 10.0, intense: 14.0 },
  "Pilates":          { light: 2.5,  moderate: 3.5,  intense: 5.0  },
  "Zumba":            { light: 4.0,  moderate: 6.0,  intense: 8.0  },
  "Climbing":         { light: 5.0,  moderate: 7.5,  intense: 11.0 },
  "Football":         { light: 5.0,  moderate: 7.0,  intense: 10.0 },
  "Basketball":       { light: 4.5,  moderate: 6.5,  intense: 9.0  },
};

function calculateCalories(
  exerciseType: string,
  durationMinutes: number,
  intensity: "light" | "moderate" | "intense",
  weightKg: number,
  gender: string,
): { calories: number; met: number } {
  const metMap = MET_VALUES[exerciseType] || { light: 3.0, moderate: 5.0, intense: 7.0 };
  let met = metMap[intensity] || metMap.moderate;

  // Gender correction factor: women burn ~10-15% fewer calories at same intensity
  const genderFactor = gender === "female" ? 0.9 : 1.0;

  // Formula: Calories = MET × weight(kg) × duration(hours) × gender_factor
  const durationHours = durationMinutes / 60;
  const calories = Math.round(met * weightKg * durationHours * genderFactor);

  return { calories, met };
}

// ─────────────────────────────────────────────────────────
// Calculate calorie burn estimate (no auth required for quick estimate)
// ─────────────────────────────────────────────────────────
router.post("/health/exercise/calculate", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { exerciseType, durationMinutes, intensity } = req.body as {
      exerciseType: string; durationMinutes: number; intensity: string;
    };

    const [profile] = await db.select().from(userProfilesTable)
      .where(eq(userProfilesTable.userId, req.userId!));

    const weightKg = Number(profile?.weightKg || 70);
    const gender = profile?.gender || "male";

    const { calories, met } = calculateCalories(
      exerciseType,
      durationMinutes,
      (intensity || "moderate") as "light" | "moderate" | "intense",
      weightKg,
      gender,
    );

    res.json({
      exerciseType,
      durationMinutes,
      intensity,
      weightKg,
      gender,
      metValue: met,
      caloriesBurned: calories,
      formula: `MET(${met}) × ${weightKg}kg × ${(durationMinutes/60).toFixed(2)}h × gender(${gender === "female" ? "0.9" : "1.0"}) = ${calories} kcal`,
    });
  } catch {
    res.status(500).json({ error: "Calculation failed" });
  }
});

router.post("/health/exercise", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { exerciseType, durationMinutes, intensity, caloriesBurned, inputMethod, notes, loggedAt } = req.body as Record<string, unknown>;

    // Fetch user profile for accurate calorie calculation
    const [profile] = await db.select().from(userProfilesTable)
      .where(eq(userProfilesTable.userId, req.userId!));

    const weightKg = Number(profile?.weightKg || 70);
    const gender = profile?.gender || "male";

    let finalCalories: string;
    let finalMet: number;

    if (caloriesBurned) {
      finalCalories = String(caloriesBurned);
      finalMet = MET_VALUES[exerciseType as string]?.moderate || 5.0;
    } else {
      const calc = calculateCalories(
        exerciseType as string,
        Number(durationMinutes),
        (intensity as "light" | "moderate" | "intense") || "moderate",
        weightKg,
        gender,
      );
      finalCalories = String(calc.calories);
      finalMet = calc.met;
    }

    const [log] = await db.insert(exerciseLogsTable).values({
      userId: req.userId!,
      exerciseType: exerciseType as string,
      durationMinutes: Number(durationMinutes),
      intensity: (intensity as "light" | "moderate" | "intense") || "moderate",
      caloriesBurned: finalCalories,
      metValue: String(finalMet),
      inputMethod: (inputMethod as "photo" | "text" | "voice" | "manual") || "manual",
      notes: notes as string | undefined,
      loggedAt: loggedAt ? new Date(loggedAt as string) : new Date(),
    }).returning();

    res.status(201).json({
      log,
      calculation: {
        weightKg,
        gender,
        metValue: finalMet,
        caloriesBurned: Number(finalCalories),
      }
    });
  } catch {
    res.status(500).json({ error: "Failed to log exercise" });
  }
});

router.get("/health/exercise", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { date } = req.query as { date?: string };
    const conditions = [eq(exerciseLogsTable.userId, req.userId!)];
    if (date) {
      conditions.push(gte(exerciseLogsTable.loggedAt, new Date(date + "T00:00:00Z")));
      conditions.push(lte(exerciseLogsTable.loggedAt, new Date(date + "T23:59:59Z")));
    }
    const logs = await db.select().from(exerciseLogsTable).where(and(...conditions)).orderBy(desc(exerciseLogsTable.loggedAt));
    res.json({ logs });
  } catch {
    res.status(500).json({ error: "Failed to fetch exercise logs" });
  }
});

router.post("/health/water", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { glassesCount = 1, mlAmount = 250, drinkType = "water", loggedAt } = req.body as Record<string, unknown>;
    if (Number(mlAmount) <= 0) {
      res.status(400).json({ error: "Water amount must be greater than 0ml" });
      return;
    }
    const [log] = await db.insert(waterLogsTable).values({
      userId: req.userId!,
      glassesCount: Number(glassesCount),
      mlAmount: Number(mlAmount),
      drinkType: drinkType as string,
      loggedAt: loggedAt ? new Date(loggedAt as string) : new Date(),
    }).returning();
    res.status(201).json({ log });
  } catch {
    res.status(500).json({ error: "Failed to log water" });
  }
});

router.get("/health/water/:date", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { date } = req.params;
    const logs = await db.select().from(waterLogsTable).where(
      and(
        eq(waterLogsTable.userId, req.userId!),
        gte(waterLogsTable.loggedAt, new Date(date + "T00:00:00Z")),
        lte(waterLogsTable.loggedAt, new Date(date + "T23:59:59Z"))
      )
    ).orderBy(waterLogsTable.loggedAt);
    const total = logs.reduce((sum, l) => sum + l.glassesCount, 0);
    const [prefs] = await db.select().from(userPreferencesTable).where(eq(userPreferencesTable.userId, req.userId!));
    res.json({ logs, totalGlasses: total, goal: prefs?.waterGoalGlasses || 8 });
  } catch {
    res.status(500).json({ error: "Failed to fetch water logs" });
  }
});

router.get("/health/score/:date", requireAuth, async (req: AuthRequest, res) => {
  try {
    const date = String(req.params.date);
    const [existing] = await db.select().from(dailyHealthScoresTable).where(
      and(eq(dailyHealthScoresTable.userId, req.userId!), eq(dailyHealthScoresTable.scoreDate, date))
    );
    if (existing) { res.json({ score: existing }); return; }
    const score = await computeDailyScore(req.userId!, date);
    res.json({ score });
  } catch {
    res.status(500).json({ error: "Failed to fetch health score" });
  }
});

router.post("/health/score/:date/compute", requireAuth, async (req: AuthRequest, res) => {
  try {
    const date = String(req.params.date);
    const score = await computeDailyScore(req.userId!, date);
    res.json({ score });
  } catch {
    res.status(500).json({ error: "Failed to compute health score" });
  }
});

router.get("/health/scores/history", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { days = "30" } = req.query as { days?: string };
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    const scores = await db.select().from(dailyHealthScoresTable).where(
      and(
        eq(dailyHealthScoresTable.userId, req.userId!),
        gte(dailyHealthScoresTable.createdAt, startDate)
      )
    ).orderBy(dailyHealthScoresTable.scoreDate);
    res.json({ scores });
  } catch {
    res.status(500).json({ error: "Failed to fetch score history" });
  }
});

async function computeDailyScore(userId: string, date: string): Promise<typeof dailyHealthScoresTable.$inferSelect> {
  const startOfDay = new Date(date + "T00:00:00Z");
  const endOfDay = new Date(date + "T23:59:59Z");

  const [foodLogs, exerciseLogs, waterLogs, medicineLogs, stressLogs, prefs] = await Promise.all([
    db.select().from(foodLogsTable).where(and(eq(foodLogsTable.userId, userId), gte(foodLogsTable.loggedAt, startOfDay), lte(foodLogsTable.loggedAt, endOfDay))),
    db.select().from(exerciseLogsTable).where(and(eq(exerciseLogsTable.userId, userId), gte(exerciseLogsTable.loggedAt, startOfDay), lte(exerciseLogsTable.loggedAt, endOfDay))),
    db.select().from(waterLogsTable).where(and(eq(waterLogsTable.userId, userId), gte(waterLogsTable.loggedAt, startOfDay), lte(waterLogsTable.loggedAt, endOfDay))),
    db.select().from(medicineLogsTable).where(and(eq(medicineLogsTable.userId, userId), gte(medicineLogsTable.scheduledAt, startOfDay), lte(medicineLogsTable.scheduledAt, endOfDay))),
    db.select().from(stressLogsTable).where(and(eq(stressLogsTable.userId, userId), gte(stressLogsTable.loggedAt, startOfDay), lte(stressLogsTable.loggedAt, endOfDay))),
    db.select().from(userPreferencesTable).where(eq(userPreferencesTable.userId, userId)),
  ]);

  const waterGoal = prefs[0]?.waterGoalGlasses || 8;
  const calorieGoal = prefs[0]?.calorieGoal || 2000;
  const totalCalories = foodLogs.reduce((s, l) => s + Number(l.calories), 0);
  const totalWater = waterLogs.reduce((s, l) => s + l.glassesCount, 0);
  const totalExercise = exerciseLogs.reduce((s, l) => s + l.durationMinutes, 0);

  const foodScore = foodLogs.length > 0 ? Math.min(100, Math.round((Math.min(totalCalories, calorieGoal) / calorieGoal) * 100)) : 0;
  const waterScore = Math.min(100, Math.round((totalWater / waterGoal) * 100));
  const exerciseScore = Math.min(100, Math.round((totalExercise / 30) * 100));
  const takeMedicines = medicineLogs.filter((m) => m.status === "taken").length;
  const totalMedicines = medicineLogs.length;
  const medicineScore = totalMedicines > 0 ? Math.round((takeMedicines / totalMedicines) * 100) : 50;
  const fieldsLogged = [foodLogs.length > 0, waterLogs.length > 0, exerciseLogs.length > 0].filter(Boolean).length;
  const healthScore = Math.round((foodScore + waterScore + exerciseScore + medicineScore) / 4);
  const dataConfidencePct = (fieldsLogged / 3) * 100;

  const [existing] = await db.select().from(dailyHealthScoresTable).where(
    and(eq(dailyHealthScoresTable.userId, userId), eq(dailyHealthScoresTable.scoreDate, date))
  );

  if (existing) {
    const [updated] = await db.update(dailyHealthScoresTable).set({
      healthScore, dataConfidencePct: String(dataConfidencePct), foodScore, exerciseScore, waterScore, medicineScore,
      totalCaloriesIn: String(totalCalories), waterGlasses: totalWater, exerciseMinutes: totalExercise, fieldsLogged,
    }).where(and(eq(dailyHealthScoresTable.userId, userId), eq(dailyHealthScoresTable.scoreDate, date))).returning();
    return updated;
  }

  const [created] = await db.insert(dailyHealthScoresTable).values({
    userId, scoreDate: date, healthScore, dataConfidencePct: String(dataConfidencePct), foodScore, exerciseScore,
    waterScore, medicineScore, totalCaloriesIn: String(totalCalories), waterGlasses: totalWater,
    exerciseMinutes: totalExercise, fieldsLogged, totalPossibleFields: 3,
  }).returning();
  return created;
}

export default router;
