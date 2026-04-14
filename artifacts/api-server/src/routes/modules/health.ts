import { Router } from "express";
import {
  db, pool, exerciseLogsTable, waterLogsTable, dailyHealthScoresTable,
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
// Calculate calorie burn estimate
// ─────────────────────────────────────────────────────────
router.post("/health/exercise/calculate", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { exerciseType, durationMinutes, intensity } = req.body as {
      exerciseType: string; durationMinutes: number; intensity: string;
    };
    const profRes = await pool.query(`SELECT weight_kg, gender FROM user_profiles WHERE user_id=$1`, [req.userId!]);
    const weightKg = Number(profRes.rows[0]?.weight_kg || 70);
    const gender = profRes.rows[0]?.gender || "male";

    const { calories, met } = calculateCalories(
      exerciseType, durationMinutes,
      (intensity || "moderate") as "light" | "moderate" | "intense",
      weightKg, gender,
    );
    res.json({
      exerciseType, durationMinutes, intensity, weightKg, gender,
      metValue: met, caloriesBurned: calories,
      formula: `MET(${met}) × ${weightKg}kg × ${(durationMinutes/60).toFixed(2)}h × gender(${gender === "female" ? "0.9" : "1.0"}) = ${calories} kcal`,
    });
  } catch (e) {
    res.status(500).json({ error: "Calculation failed", detail: (e as Error).message });
  }
});

router.post("/health/exercise", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { exerciseType, durationMinutes, intensity, caloriesBurned, inputMethod, notes, loggedAt } = req.body as Record<string, unknown>;

    const profRes = await pool.query(`SELECT weight_kg, gender FROM user_profiles WHERE user_id=$1`, [req.userId!]);
    const weightKg = Number(profRes.rows[0]?.weight_kg || 70);
    const gender = profRes.rows[0]?.gender || "male";

    let finalCalories: number;
    let finalMet: number;

    if (caloriesBurned) {
      finalCalories = Number(caloriesBurned);
      finalMet = MET_VALUES[exerciseType as string]?.moderate || 5.0;
    } else {
      const calc = calculateCalories(
        exerciseType as string, Number(durationMinutes),
        (intensity as "light" | "moderate" | "intense") || "moderate",
        weightKg, gender,
      );
      finalCalories = calc.calories;
      finalMet = calc.met;
    }

    const logTime = loggedAt ? new Date(loggedAt as string) : new Date();
    const result = await pool.query(
      `INSERT INTO exercise_logs (user_id, exercise_type, duration_minutes, intensity, calories_burned, met_value, input_method, notes, logged_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.userId!, exerciseType, Number(durationMinutes), intensity || "moderate",
       String(finalCalories), String(finalMet), inputMethod || "manual", notes || null, logTime]
    );
    res.status(201).json({
      log: result.rows[0],
      calculation: { weightKg, gender, metValue: finalMet, caloriesBurned: finalCalories },
    });
  } catch (e) {
    res.status(500).json({ error: "Failed to log exercise", detail: (e as Error).message });
  }
});

router.get("/health/exercise", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { date } = req.query as { date?: string };
    let query = `SELECT * FROM exercise_logs WHERE user_id=$1`;
    const params: unknown[] = [req.userId!];
    if (date) {
      query += ` AND logged_at >= $2 AND logged_at <= $3`;
      params.push(date + "T00:00:00Z", date + "T23:59:59Z");
    }
    query += ` ORDER BY logged_at DESC`;
    const result = await pool.query(query, params);
    res.json({ logs: result.rows });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch exercise logs", detail: (e as Error).message });
  }
});

router.post("/health/water", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { glassesCount = 1, mlAmount = 250, drinkType = "water", loggedAt } = req.body as Record<string, unknown>;
    if (Number(mlAmount) <= 0) {
      res.status(400).json({ error: "Water amount must be greater than 0ml" });
      return;
    }
    const logTime = loggedAt ? new Date(loggedAt as string) : new Date();
    const result = await pool.query(
      `INSERT INTO water_logs (user_id, glasses_count, ml_amount, drink_type, logged_at) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.userId!, Number(glassesCount), Number(mlAmount), drinkType, logTime]
    );
    res.status(201).json({ log: result.rows[0] });
  } catch (e) {
    res.status(500).json({ error: "Failed to log water", detail: (e as Error).message });
  }
});

router.get("/health/water/:date", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { date } = req.params;
    const logsRes = await pool.query(
      `SELECT * FROM water_logs WHERE user_id=$1 AND logged_at >= $2 AND logged_at <= $3 ORDER BY logged_at`,
      [req.userId!, date + "T00:00:00Z", date + "T23:59:59Z"]
    );
    const prefsRes = await pool.query(`SELECT water_goal_glasses FROM user_preferences WHERE user_id=$1`, [req.userId!]);
    const logs = logsRes.rows;
    const total = logs.reduce((sum: number, l: any) => sum + (l.glasses_count || 0), 0);
    const goal = prefsRes.rows[0]?.water_goal_glasses || 8;
    res.json({ logs, totalGlasses: total, goal });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch water logs", detail: (e as Error).message });
  }
});

router.get("/health/score/:date", requireAuth, async (req: AuthRequest, res) => {
  try {
    const date = String(req.params.date);
    const score = await computeDailyScore(req.userId!, date);
    res.json({ score });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch health score", detail: (e as Error).message });
  }
});

router.post("/health/score/:date/compute", requireAuth, async (req: AuthRequest, res) => {
  try {
    const date = String(req.params.date);
    const score = await computeDailyScore(req.userId!, date);
    res.json({ score });
  } catch (e) {
    res.status(500).json({ error: "Failed to compute health score", detail: (e as Error).message });
  }
});

router.get("/health/scores/history", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { days = "30" } = req.query as { days?: string };
    const result = await pool.query(
      `SELECT * FROM daily_health_scores WHERE user_id=$1 AND created_at >= NOW() - INTERVAL '${parseInt(days)} days' ORDER BY score_date`,
      [req.userId!]
    );
    res.json({ scores: result.rows });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch score history", detail: (e as Error).message });
  }
});

async function computeDailyScore(userId: string, date: string): Promise<Record<string, unknown>> {
  const dayStart = date + "T00:00:00Z";
  const dayEnd   = date + "T23:59:59Z";

  const [foodR, exR, waterR, medR, medTakenR, prefsR] = await Promise.all([
    pool.query(`SELECT COALESCE(SUM(calories::numeric),0) AS total_cal, COUNT(*) AS meal_count FROM food_logs WHERE user_id=$1 AND logged_at>=$2 AND logged_at<=$3`, [userId, dayStart, dayEnd]),
    pool.query(`SELECT COALESCE(SUM(duration_minutes),0) AS total_min FROM exercise_logs WHERE user_id=$1 AND logged_at>=$2 AND logged_at<=$3`, [userId, dayStart, dayEnd]),
    pool.query(`SELECT COALESCE(SUM(glasses_count),0) AS total FROM water_logs WHERE user_id=$1 AND logged_at>=$2 AND logged_at<=$3`, [userId, dayStart, dayEnd]),
    pool.query(`SELECT COUNT(*) FROM medicine_logs WHERE user_id=$1 AND scheduled_at>=$2 AND scheduled_at<=$3`, [userId, dayStart, dayEnd]),
    pool.query(`SELECT COUNT(*) FROM medicine_logs WHERE user_id=$1 AND status='taken' AND scheduled_at>=$2 AND scheduled_at<=$3`, [userId, dayStart, dayEnd]),
    pool.query(`SELECT water_goal_glasses, calorie_goal FROM user_preferences WHERE user_id=$1`, [userId]),
  ]);

  const totalCalories  = parseFloat(foodR.rows[0]?.total_cal || "0");
  const mealCount      = parseInt(foodR.rows[0]?.meal_count || "0");
  const totalExercise  = parseInt(exR.rows[0]?.total_min || "0");
  const totalWater     = parseInt(waterR.rows[0]?.total || "0");
  const totalMed       = parseInt(medR.rows[0]?.count || "0");
  const takenMed       = parseInt(medTakenR.rows[0]?.count || "0");
  const waterGoal      = parseInt(prefsR.rows[0]?.water_goal_glasses || "8");
  const calorieGoal    = parseInt(prefsR.rows[0]?.calorie_goal || "2000");

  const foodScore      = mealCount > 0 ? Math.min(100, Math.round((Math.min(totalCalories, calorieGoal) / calorieGoal) * 100)) : 0;
  const waterScore     = Math.min(100, Math.round((totalWater / waterGoal) * 100));
  const exerciseScore  = Math.min(100, Math.round((totalExercise / 30) * 100));
  const medicineScore  = totalMed > 0 ? Math.round((takenMed / totalMed) * 100) : 50;
  const healthScore    = Math.round((foodScore + waterScore + exerciseScore + medicineScore) / 4);
  const fieldsLogged   = [mealCount > 0, totalWater > 0, totalExercise > 0].filter(Boolean).length;
  const dataConfidencePct = (fieldsLogged / 3) * 100;

  await pool.query(
    `INSERT INTO daily_health_scores (user_id, score_date, health_score, data_confidence_pct, food_score, exercise_score, water_score, medicine_score, total_calories_in, water_glasses, exercise_minutes, fields_logged, total_possible_fields)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (user_id, score_date) DO UPDATE SET
       health_score=$3, data_confidence_pct=$4, food_score=$5, exercise_score=$6, water_score=$7, medicine_score=$8,
       total_calories_in=$9, water_glasses=$10, exercise_minutes=$11, fields_logged=$12`,
    [userId, date, healthScore, String(dataConfidencePct), foodScore, exerciseScore, waterScore, medicineScore,
     String(totalCalories), totalWater, totalExercise, fieldsLogged, 3]
  ).catch(() => {});  // fail silently if table doesn't exist yet

  return {
    userId, scoreDate: date, healthScore, dataConfidencePct: String(dataConfidencePct),
    foodScore, exerciseScore, waterScore, medicineScore,
    totalCaloriesIn: String(totalCalories), waterGlasses: totalWater,
    exerciseMinutes: totalExercise, fieldsLogged, totalPossibleFields: 3,
  };
}

export default router;
