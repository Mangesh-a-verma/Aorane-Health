import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth } from "../../middlewares/user-auth";
import type { AuthRequest } from "../../middlewares/user-auth";
import { computeScientificScore } from "../../lib/scoring";

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
    // Map snake_case DB columns → camelCase for mobile client
    const logs = result.rows.map((r: Record<string, unknown>) => ({
      id:              r.id,
      userId:          r.user_id,
      exerciseType:    r.exercise_type,
      durationMinutes: r.duration_minutes,
      intensity:       r.intensity,
      caloriesBurned:  r.calories_burned,
      metValue:        r.met_value,
      inputMethod:     r.input_method,
      notes:           r.notes,
      photoUrl:        r.photo_url,
      loggedAt:        r.logged_at,
    }));
    res.json({ logs });
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

router.get("/health/weekly-activity", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const result = await pool.query(
      `SELECT COUNT(DISTINCT day) AS active_days FROM (
        SELECT DATE(logged_at) AS day FROM food_logs WHERE user_id=$1 AND logged_at >= NOW() - INTERVAL '7 days'
        UNION
        SELECT DATE(logged_at) AS day FROM exercise_logs WHERE user_id=$1 AND logged_at >= NOW() - INTERVAL '7 days'
        UNION
        SELECT DATE(logged_at) AS day FROM water_logs WHERE user_id=$1 AND logged_at >= NOW() - INTERVAL '7 days'
      ) sub`,
      [userId]
    );
    const activeDays = parseInt(result.rows[0]?.active_days || "0");
    res.json({ activeDays, totalDays: 7, percentage: Math.round((activeDays / 7) * 100) });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch weekly activity", detail: (e as Error).message });
  }
});

async function computeDailyScore(userId: string, date: string): Promise<Record<string, unknown>> {
  const s = await computeScientificScore(userId, date);
  return {
    userId,
    scoreDate:          date,
    healthScore:        s.overallScore,
    grade:              s.grade,
    gradeLabel:         s.gradeLabel,
    dataConfidence:     s.dataConfidence,
    dataConfidencePct:  String(s.dataConfidence),
    // Component scores
    foodScore:          s.foodScore,
    exerciseScore:      s.exerciseScore,
    waterScore:         s.waterScore,
    medicineScore:      s.medicineScore,
    sleepScore:         s.sleepScore,
    bmiScore:           s.bmiScore,
    // Detail breakdowns
    food:               s.food,
    exercise:           s.exercise,
    water:              s.water,
    medicine:           s.medicine,
    sleep:              s.sleep,
    bmi:                s.bmi,
    // Backward compat fields for existing mobile screens
    totalCaloriesIn:    String(s.food.calories),
    waterGlasses:       s.water.glasses,
    exerciseMinutes:    s.exercise.durationMinutes,
    fieldsLogged:       [s.food.meals > 0, s.exercise.sessions > 0, s.water.glasses > 0].filter(Boolean).length,
    totalPossibleFields: 3,
    // Scientific transparency
    methodology:        s.methodology,
  };
}

export default router;
