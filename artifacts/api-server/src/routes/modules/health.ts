import { Router } from "express";
import { upsertDailyActivityScore, upsertDailyHealthScore } from "../../lib/activityScore";
import { getCumulativeActivePercent } from "../../lib/activityScore";
import { pool } from "@workspace/db";
import { requireAuth } from "../../middlewares/user-auth";
import type { AuthRequest } from "../../middlewares/user-auth";
import { computeScientificScore, type ScoreQueryMemo } from "../../lib/scoring";
import { istDayBounds, todayIST } from "../../lib/dateUtils";
import { safeErrorMessage } from "../../lib/logger";
import { isBooleanFeatureEnabled } from "../../middlewares/plan-limits";

const router = Router();

// ─────────────────────────────────────────────────────────
// MET values for each exercise (per kg per hour)
// ─────────────────────────────────────────────────────────
const MET_VALUES: Record<string, { light: number; moderate: number; intense: number }> = {
  // ── Cardio ────────────────────────────────────────────────────────────────
  "Walking":            { light: 2.5,  moderate: 3.5,  intense: 4.5  },
  "Running":            { light: 7.0,  moderate: 9.8,  intense: 13.5 },
  "Cycling":            { light: 4.0,  moderate: 7.5,  intense: 10.0 },
  "Swimming":           { light: 5.0,  moderate: 8.0,  intense: 11.0 },
  "Skipping":           { light: 8.0,  moderate: 11.0, intense: 13.5 },
  "HIIT":               { light: 7.0,  moderate: 10.0, intense: 14.0 },
  "Treadmill":          { light: 3.5,  moderate: 7.0,  intense: 10.0 },
  "Elliptical":         { light: 4.5,  moderate: 7.0,  intense: 9.5  },
  "Rowing":             { light: 4.5,  moderate: 7.0,  intense: 10.0 },
  "Stair Climbing":     { light: 4.0,  moderate: 7.5,  intense: 10.0 },
  // ── Strength / Gym ────────────────────────────────────────────────────────
  "Weight Training":    { light: 3.0,  moderate: 5.0,  intense: 7.0  },
  "Bench Press":        { light: 3.0,  moderate: 4.5,  intense: 6.0  },
  "Squats":             { light: 3.5,  moderate: 5.0,  intense: 7.0  },
  "Deadlifts":          { light: 4.0,  moderate: 5.5,  intense: 7.5  },
  "Shoulder Press":     { light: 3.0,  moderate: 4.5,  intense: 6.0  },
  "Bicep Curls":        { light: 2.5,  moderate: 3.5,  intense: 5.0  },
  "Pull-ups":           { light: 4.0,  moderate: 6.0,  intense: 8.5  },
  "Push-ups":           { light: 3.5,  moderate: 5.0,  intense: 7.0  },
  "Lunges":             { light: 3.0,  moderate: 4.5,  intense: 6.0  },
  "Plank":              { light: 2.5,  moderate: 3.5,  intense: 4.5  },
  "Leg Press":          { light: 3.0,  moderate: 4.5,  intense: 6.5  },
  "Lat Pulldown":       { light: 3.0,  moderate: 4.5,  intense: 6.0  },
  "Cable Rows":         { light: 3.0,  moderate: 4.5,  intense: 6.0  },
  "Tricep Dips":        { light: 3.0,  moderate: 4.5,  intense: 6.5  },
  // ── Yoga / Flexibility ────────────────────────────────────────────────────
  "Yoga":               { light: 2.0,  moderate: 2.5,  intense: 4.0  },
  "Pilates":            { light: 2.5,  moderate: 3.5,  intense: 5.0  },
  "Surya Namaskar":     { light: 3.5,  moderate: 5.0,  intense: 7.0  },
  // ── Dance / Group ─────────────────────────────────────────────────────────
  "Dancing":            { light: 3.0,  moderate: 4.5,  intense: 7.0  },
  "Zumba":              { light: 4.0,  moderate: 6.0,  intense: 8.0  },
  // ── Sports ────────────────────────────────────────────────────────────────
  "Cricket":            { light: 3.5,  moderate: 5.0,  intense: 7.0  },
  "Badminton":          { light: 4.0,  moderate: 5.5,  intense: 7.5  },
  "Football":           { light: 5.0,  moderate: 7.0,  intense: 10.0 },
  "Basketball":         { light: 4.5,  moderate: 6.5,  intense: 9.0  },
  "Volleyball":         { light: 3.0,  moderate: 4.5,  intense: 6.5  },
  "Climbing":           { light: 5.0,  moderate: 7.5,  intense: 11.0 },
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
    const body = req.body as Record<string, unknown>;
    const exerciseType = (body.exerciseType as string) || "Walking"; // must match a MET_VALUES key exactly (case-sensitive) or it silently falls to the generic MET fallback
    // Accept both durationMinutes and durationMin (mobile alias)
    const durationMinutes = Number(body.durationMinutes ?? body.durationMin ?? 30);
    const intensity = (body.intensity as string) || "moderate";

    if (!exerciseType) {
      res.status(400).json({ error: "exerciseType is required" });
      return;
    }
    if (isNaN(durationMinutes) || durationMinutes <= 0) {
      res.status(400).json({ error: "durationMinutes must be a positive number" });
      return;
    }

    const profRes = await pool.query(`SELECT weight_kg, gender FROM user_profiles WHERE user_id=$1`, [req.userId!]);
    const profileWeight = profRes.rows[0]?.weight_kg ? Number(profRes.rows[0].weight_kg) : null;
    const weightKg = profileWeight && !isNaN(profileWeight) && profileWeight > 0 ? profileWeight : 70;
    const isDefaultWeight = !profileWeight;
    const gender = profRes.rows[0]?.gender || "male";

    const { calories, met } = calculateCalories(
      exerciseType, durationMinutes,
      intensity as "light" | "moderate" | "intense",
      weightKg, gender,
    );
    const safeCalories = isNaN(calories) || calories < 0 ? 0 : calories;
    res.json({
      exerciseType, durationMinutes, intensity, weightKg, gender,
      metValue: met, caloriesBurned: safeCalories,
      isDefaultWeight,
      formula: `MET(${met}) × ${weightKg}kg × ${(durationMinutes/60).toFixed(2)}h × gender(${gender === "female" ? "0.9" : "1.0"}) = ${safeCalories} kcal`,
    });
  } catch (e) {
    res.status(500).json({ error: "Calculation failed", detail: safeErrorMessage(e) });
  }
});

router.post("/health/exercise", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { exerciseType, durationMinutes, intensity, caloriesBurned, inputMethod, notes, sets, reps, steps } = req.body as Record<string, unknown>;

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

    const result = await pool.query(
      `INSERT INTO exercise_logs (user_id, exercise_type, duration_minutes, intensity, sets, reps, steps, calories_burned, met_value, input_method, notes, logged_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW()) RETURNING *`,
      [req.userId!, exerciseType, Number(durationMinutes), intensity || "moderate",
       sets ? Number(sets) : null, reps ? Number(reps) : null, steps ? Number(steps) : null,
       String(finalCalories), String(finalMet), inputMethod || "manual", notes || null]
    );
    upsertDailyActivityScore(req.userId!).catch(() => {});
    upsertDailyHealthScore(req.userId!).catch(() => {});
    res.status(201).json({
      log: result.rows[0],
      calculation: { weightKg, gender, metValue: finalMet, caloriesBurned: finalCalories },
    });
  } catch (e) {
    res.status(500).json({ error: "Failed to log exercise", detail: safeErrorMessage(e) });
  }
});

router.get("/health/exercise", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { date } = req.query as { date?: string };
    let query = `SELECT * FROM exercise_logs WHERE user_id=$1`;
    const params: unknown[] = [req.userId!];
    if (date) {
      query += ` AND logged_at >= $2 AND logged_at <= $3`;
      const { dayStart, dayEnd } = istDayBounds(date);
      params.push(dayStart, dayEnd);
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
      sets:            r.sets,
      reps:            r.reps,
      steps:           r.steps,
      caloriesBurned:  r.calories_burned,
      metValue:        r.met_value,
      inputMethod:     r.input_method,
      notes:           r.notes,
      photoUrl:        r.photo_url,
      loggedAt:        r.logged_at,
    }));
    res.json({ logs });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch exercise logs", detail: safeErrorMessage(e) });
  }
});

router.post("/health/water", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { glassesCount = 1, mlAmount = 250, drinkType = "water" } = req.body as Record<string, unknown>;
    if (Number(mlAmount) <= 0) {
      res.status(400).json({ error: "Water amount must be greater than 0ml" });
      return;
    }
    const result = await pool.query(
      `INSERT INTO water_logs (user_id, glasses_count, ml_amount, drink_type, logged_at) VALUES ($1,$2,$3,$4,NOW()) RETURNING *`,
      [req.userId!, Number(glassesCount), Number(mlAmount), drinkType]
    );
    upsertDailyActivityScore(req.userId!).catch(() => {});
    upsertDailyHealthScore(req.userId!).catch(() => {});
    res.status(201).json({ log: result.rows[0] });
  } catch (e) {
    res.status(500).json({ error: "Failed to log water", detail: safeErrorMessage(e) });
  }
});

router.get("/health/water/:date", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { date } = req.params;
    const { dayStart, dayEnd } = istDayBounds(date as string);
    const logsRes = await pool.query(
      `SELECT * FROM water_logs WHERE user_id=$1 AND logged_at >= $2 AND logged_at <= $3 ORDER BY logged_at`,
      [req.userId!, dayStart, dayEnd]
    );
    const prefsRes = await pool.query(`SELECT water_goal_glasses FROM user_preferences WHERE user_id=$1`, [req.userId!]);
    const logs = logsRes.rows;
    const total = logs.reduce((sum: number, l: any) => sum + (l.glasses_count || 0), 0);
    const goal = prefsRes.rows[0]?.water_goal_glasses || 8;
    res.json({ logs, totalGlasses: total, goal });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch water logs", detail: safeErrorMessage(e) });
  }
});

/**
 * Every day of a date range in ONE request.
 *
 * The health report needs a score for each day of its period. It used to ask
 * for them one date at a time — 7 calls for a weekly report and 30 for a
 * monthly one, issued from a phone in batches of six. That is up to five
 * sequential round trips over a mobile network before the report can render,
 * on top of a Render free-tier instance that may be cold for the first of
 * them.
 *
 * Two things make this cheaper than the loop it replaces:
 *   - one HTTP round trip instead of `days`;
 *   - a ScoreQueryMemo shared across the days, which collapses the six
 *     user-scoped queries (preferences, profile x2, goals, conditions,
 *     medicine schedules) from `days x 6` down to six in total. For 30 days
 *     that is 180 queries saved.
 *
 * Days are scored with bounded concurrency rather than all at once:
 * computeScientificScore issues ~11 date-scoped queries per day, so firing
 * 30 days simultaneously would put ~330 queries on the pool in one burst.
 *
 * A day that fails to score is returned as null rather than failing the
 * whole range — one bad day should not cost the user their report.
 */
router.get("/health/score/range", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { from, to } = req.query as Record<string, string>;
    const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
    if (!isDate(from) || !isDate(to)) {
      return res.status(400).json({ error: "from and to are required as YYYY-MM-DD" });
    }
    if (from > to) return res.status(400).json({ error: "from must not be after to" });
    // The regex accepts shapes like 2026-13-45, which Date.parse answers with
    // NaN. Without this the loop below never runs and the caller gets an
    // empty range with a 200 — a blank report instead of an error.
    const fromMs = Date.parse(`${from}T12:00:00Z`), toMs = Date.parse(`${to}T12:00:00Z`);
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
      return res.status(400).json({ error: "from and to must be real calendar dates" });
    }

    // Build the list of IST calendar days in [from, to]. Stepping by a day
    // through UTC noon avoids a DST-style shift landing twice on one date.
    const dates: string[] = [];
    for (let t = fromMs; t <= toMs; t += 86_400_000) {
      dates.push(new Date(t).toISOString().slice(0, 10));
      // Bound the work a single request can ask for, whatever the client sends.
      if (dates.length >= 92) break;
    }

    const memo: ScoreQueryMemo = new Map();
    const scores: Record<string, unknown> = {};
    const CONCURRENCY = 6;
    for (let i = 0; i < dates.length; i += CONCURRENCY) {
      const chunk = dates.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        chunk.map((d) =>
          computeScientificScore(req.userId!, d, memo)
            .then((s) => ({ d, s }))
            .catch(() => ({ d, s: null })),
        ),
      );
      for (const { d, s } of results) scores[d] = s ? toScoreResponse(req.userId!, d, s) : null;
    }

    return res.json({ scores, days: dates.length });
  } catch (e) {
    return res.status(500).json({ error: "Failed to fetch score range", detail: safeErrorMessage(e) });
  }
});

router.get("/health/score/:date", requireAuth, async (req: AuthRequest, res) => {
  try {
    let date = String(req.params.date);
    // IST auto-correction: old APK sends UTC date via toISOString().slice(0,10)
    // Between 00:00–05:30 IST, UTC date is 1 day behind the actual IST date.
    // If client sent "yesterday" in IST, silently correct to today's IST date.
    const nowIST  = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const prevIST = new Date(Date.now() - 24 * 60 * 60 * 1000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    if (date === prevIST) date = nowIST;
    const score = await computeDailyScore(req.userId!, date);
    res.json({ score });
  } catch (e) {
    // Return safe default instead of 500 so mobile never shows 0 due to a transient error
    res.json({
      score: {
        userId: req.userId,
        scoreDate: req.params.date,
        healthScore: 0,
        grade: "—",
        gradeLabel: "No data yet",
        dataConfidence: 0,
        // No fabricated values — a real computation failure should never
        // masquerade as a plausible partial score (e.g. "75% medicine
        // adherence") that a consumer displays without checking
        // dataConfidence===0 first (health-report.tsx does; family.tsx's
        // ScoreBar reads these directly without that check).
        foodScore: 0, exerciseScore: 0, waterScore: 0,
        medicineScore: 0, sleepScore: 0, bmiScore: 0,
        food: { calories: 0, calorieGoal: 2000, proteinG: 0, proteinGoalG: 50, carbsG: 0, fatG: 0, fiberG: 0, fiberGoalG: 25, meals: 0, mealGoal: 3, micronutrients: { dataAvailable: false, compositeScore: 0, calcium: { mg: 0, goalMg: 800, score: 0 }, iron: { mg: 0, goalMg: 17, score: 0 }, vitaminC: { mg: 0, goalMg: 40, score: 0 }, vitaminB12: { mcg: 0, goalMcg: 1, score: 0 }, vitaminD: { mcg: 0, goalMcg: 10, score: 0 } } },
        exercise: { metMinutesToday: 0, metMinutesGoal: 85.7, durationMinutes: 0, caloriesBurned: 0, sessions: 0 },
        water: { mlConsumed: 0, mlGoal: 2500, glasses: 0 },
        medicine: { taken: 0, scheduled: 0 },
        sleep: { hoursLogged: 0, isOptimal: false, quality: null, isLogged: false },
        bmi: { value: null, category: "Unknown" },
        _error: (e as Error).message,
      }
    });
  }
});

router.post("/health/score/:date/compute", requireAuth, async (req: AuthRequest, res) => {
  try {
    let date = String(req.params.date);
    const nowIST  = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const prevIST = new Date(Date.now() - 24 * 60 * 60 * 1000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    if (date === prevIST) date = nowIST;
    const score = await computeDailyScore(req.userId!, date);
    res.json({ score });
  } catch (e) {
    res.status(500).json({ error: "Failed to compute health score", detail: safeErrorMessage(e) });
  }
});

router.get("/health/scores/history", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { days = "30" } = req.query as { days?: string };
    // Bound + validate like the sibling /health/sleep/history route below —
    // an unbounded value let a caller request an arbitrarily large range,
    // and a non-numeric value (parseInt → NaN) produced invalid SQL
    // ("INTERVAL 'NaN days'") instead of a clean 400.
    const daysNum = Math.min(Math.max(parseInt(days) || 30, 1), 365);
    const result = await pool.query(
      `SELECT * FROM daily_health_scores WHERE user_id=$1 AND created_at >= NOW() - INTERVAL '${daysNum} days' ORDER BY score_date`,
      [req.userId!]
    );
    res.json({ scores: result.rows });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch score history", detail: safeErrorMessage(e) });
  }
});

// ─── Sleep Logging ────────────────────────────────────────────────────────────
router.post("/health/sleep", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { sleepDate, sleepHours, bedtime, wakeTime, quality, notes, isOfflineEntry } = req.body as Record<string, unknown>;
    if (!sleepDate || !sleepHours) {
      res.status(400).json({ error: "sleepDate and sleepHours are required" });
      return;
    }
    
    let calculatedHours = parseFloat(String(sleepHours));
    if (bedtime && wakeTime) {
      try {
        const bed = new Date(`1970-01-01T${bedtime}:00Z`);
        let wake = new Date(`1970-01-01T${wakeTime}:00Z`);
        if (wake < bed) wake = new Date(`1970-01-02T${wakeTime}:00Z`);
        const diffHours = (wake.getTime() - bed.getTime()) / (1000 * 60 * 60);
        if (diffHours > 0 && diffHours <= 24) {
          calculatedHours = diffHours;
        }
      } catch (e) {}
    }
    const hours = Math.round(calculatedHours * 10) / 10;

    if (isNaN(hours) || hours <= 0 || hours > 24) {
      res.status(400).json({ error: "sleepHours must be between 0.1 and 24" });
      return;
    }
    const validQualities = ["poor", "fair", "good", "excellent"];
    if (quality && !validQualities.includes(String(quality))) {
      res.status(400).json({ error: `quality must be one of: ${validQualities.join(", ")}` });
      return;
    }
    // One row per (user_id, sleep_date) — enforced by a unique index.
    // A duplicate POST for a date already logged (client retry after a
    // timeout, offline-sync replay) now merges into the existing row
    // instead of inserting a second one, which previously let
    // SUM(sleep_hours) double-count a night's sleep in the Health Score.
    const result = await pool.query(
      `INSERT INTO sleep_logs (user_id, sleep_date, sleep_hours, bedtime, wake_time, quality, notes, is_offline_entry, logged_at)
       VALUES ($1, $2, $3, $4, $5, $6::sleep_quality, $7, $8, NOW())
       ON CONFLICT (user_id, sleep_date) DO UPDATE SET
         sleep_hours = EXCLUDED.sleep_hours,
         bedtime = EXCLUDED.bedtime,
         wake_time = EXCLUDED.wake_time,
         quality = EXCLUDED.quality,
         notes = EXCLUDED.notes,
         is_offline_entry = EXCLUDED.is_offline_entry,
         logged_at = NOW()
       RETURNING *, (xmax = 0) AS inserted`,
      [
        req.userId!,
        String(sleepDate),
        hours,
        bedtime ? String(bedtime) : null,
        wakeTime ? String(wakeTime) : null,
        quality ? String(quality) : null,
        notes ? String(notes) : null,
        Boolean(isOfflineEntry ?? false),
      ]
    );
    const { inserted, ...log } = result.rows[0];
    upsertDailyActivityScore(req.userId!).catch(() => {});
    upsertDailyHealthScore(req.userId!).catch(() => {});
    res.status(inserted ? 201 : 200).json({ success: true, log, sleepHours: hours, updated: !inserted });
  } catch (e) {
    res.status(500).json({ error: "Failed to log sleep", detail: safeErrorMessage(e) });
  }
});

router.put("/health/sleep/:date", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { date } = req.params;
    const { sleepHours, bedtime, wakeTime, quality, notes } = req.body as Record<string, unknown>;
    if (!sleepHours) {
      res.status(400).json({ error: "sleepHours is required" });
      return;
    }
    const hours = parseFloat(String(sleepHours));
    if (isNaN(hours) || hours <= 0 || hours > 24) {
      res.status(400).json({ error: "sleepHours must be between 0.1 and 24" });
      return;
    }
    const existing = await pool.query(
      `SELECT id FROM sleep_logs WHERE user_id=$1 AND sleep_date=$2 ORDER BY logged_at DESC LIMIT 1`,
      [req.userId!, date]
    );
    if (existing.rows.length === 0) {
      res.status(404).json({ error: "No sleep log found for this date. Use POST /health/sleep to create one." });
      return;
    }
    const result = await pool.query(
      `UPDATE sleep_logs SET sleep_hours=$1, bedtime=$2, wake_time=$3, quality=$4::sleep_quality, notes=$5, logged_at=NOW()
       WHERE id=$6 RETURNING *`,
      [hours, bedtime ?? null, wakeTime ?? null, quality ?? null, notes ?? null, existing.rows[0].id]
    );
    res.json({ success: true, log: result.rows[0], sleepHours: hours });
  } catch (e) {
    res.status(500).json({ error: "Failed to update sleep log", detail: safeErrorMessage(e) });
  }
});

router.get("/health/sleep/history", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { days = "7" } = req.query as { days?: string };
    const limit = Math.min(parseInt(days), 90);
    const result = await pool.query(
      `SELECT * FROM sleep_logs WHERE user_id=$1 ORDER BY sleep_date DESC LIMIT $2`,
      [req.userId!, limit]
    );
    const logs = result.rows;
    const avgHours = logs.length > 0
      ? Math.round((logs.reduce((sum: number, l: Record<string, unknown>) => sum + parseFloat(String(l.sleep_hours || "0")), 0) / logs.length) * 10) / 10
      : null;
    res.json({ logs, count: logs.length, avgHours });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch sleep history", detail: safeErrorMessage(e) });
  }
});

router.get("/health/sleep/:date", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { date } = req.params;
    const result = await pool.query(
      `SELECT * FROM sleep_logs WHERE user_id=$1 AND sleep_date=$2 ORDER BY logged_at DESC LIMIT 1`,
      [req.userId!, date]
    );
    const log = result.rows[0] || null;
    res.json({
      log,
      sleepHours: log ? parseFloat(log.sleep_hours) : null,
      quality: log?.quality || null,
      isLogged: !!log,
    });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch sleep log", detail: safeErrorMessage(e) });
  }
});

// ─── Blood Pressure Logging ─────────────────────────────────────────────────
// Unlike sleep (one row per night), BP is commonly checked more than once a
// day (morning/evening) — no upsert-by-date here, every reading is its own row.
router.post("/health/blood-pressure", requireAuth, async (req: AuthRequest, res) => {
  try {
    const planType = req.userPlan || "free";
    const enabled = await isBooleanFeatureEnabled("blood_sugar_bp_tracking", planType);
    if (!enabled) {
      res.status(403).json({
        error: `Blood pressure tracking is not available on the ${planType.toUpperCase()} plan. Please upgrade to log vitals.`,
        feature: "blood_sugar_bp_tracking",
        reason: "plan_not_supported",
        currentPlan: planType,
        upgradeSuggested: true,
      });
      return;
    }
    const { systolic, diastolic, pulse, measuredAt, notes, isOfflineEntry } = req.body as Record<string, unknown>;
    const sys = parseInt(String(systolic));
    const dia = parseInt(String(diastolic));
    if (!systolic || !diastolic || isNaN(sys) || isNaN(dia)) {
      res.status(400).json({ error: "systolic and diastolic are required" });
      return;
    }
    if (sys < 50 || sys > 300 || dia < 30 || dia > 200) {
      res.status(400).json({ error: "systolic must be 50-300 and diastolic 30-200" });
      return;
    }
    let pulseNum: number | null = null;
    if (pulse !== undefined && pulse !== null && pulse !== "") {
      pulseNum = parseInt(String(pulse));
      if (isNaN(pulseNum) || pulseNum < 20 || pulseNum > 250) {
        res.status(400).json({ error: "pulse must be between 20 and 250" });
        return;
      }
    }
    const result = await pool.query(
      `INSERT INTO blood_pressure_logs (user_id, systolic, diastolic, pulse, measured_at, notes, is_offline_entry)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        req.userId!, sys, dia, pulseNum,
        measuredAt ? new Date(String(measuredAt)) : new Date(),
        notes ? String(notes) : null,
        Boolean(isOfflineEntry ?? false),
      ]
    );
    upsertDailyActivityScore(req.userId!).catch(() => {});
    upsertDailyHealthScore(req.userId!).catch(() => {});
    res.status(201).json({ success: true, log: result.rows[0] });
  } catch (e) {
    res.status(500).json({ error: "Failed to log blood pressure", detail: safeErrorMessage(e) });
  }
});

router.get("/health/blood-pressure/history", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { days = "30" } = req.query as { days?: string };
    const limit = Math.min(parseInt(days) || 30, 365);
    const result = await pool.query(
      `SELECT * FROM blood_pressure_logs WHERE user_id=$1 AND measured_at >= NOW() - ($2 || ' days')::interval ORDER BY measured_at DESC`,
      [req.userId!, String(limit)]
    );
    res.json({ logs: result.rows, count: result.rows.length });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch blood pressure history", detail: safeErrorMessage(e) });
  }
});

router.get("/health/blood-pressure/today", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { dayStart, dayEnd } = istDayBounds(todayIST());
    const result = await pool.query(
      `SELECT * FROM blood_pressure_logs WHERE user_id=$1 AND measured_at >= $2 AND measured_at <= $3 ORDER BY measured_at DESC`,
      [req.userId!, dayStart, dayEnd]
    );
    res.json({ logs: result.rows, latest: result.rows[0] || null });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch today's blood pressure", detail: safeErrorMessage(e) });
  }
});

// ─── Blood Sugar Logging ────────────────────────────────────────────────────
router.post("/health/blood-sugar", requireAuth, async (req: AuthRequest, res) => {
  try {
    const planType = req.userPlan || "free";
    const enabled = await isBooleanFeatureEnabled("blood_sugar_bp_tracking", planType);
    if (!enabled) {
      res.status(403).json({
        error: `Blood sugar tracking is not available on the ${planType.toUpperCase()} plan. Please upgrade to log vitals.`,
        feature: "blood_sugar_bp_tracking",
        reason: "plan_not_supported",
        currentPlan: planType,
        upgradeSuggested: true,
      });
      return;
    }
    const { glucoseMgDl, readingContext, measuredAt, notes, isOfflineEntry } = req.body as Record<string, unknown>;
    const glucose = parseInt(String(glucoseMgDl));
    if (!glucoseMgDl || isNaN(glucose)) {
      res.status(400).json({ error: "glucoseMgDl is required" });
      return;
    }
    if (glucose < 20 || glucose > 600) {
      res.status(400).json({ error: "glucoseMgDl must be between 20 and 600" });
      return;
    }
    const validContexts = ["fasting", "post_meal", "random", "bedtime"];
    if (readingContext && !validContexts.includes(String(readingContext))) {
      res.status(400).json({ error: `readingContext must be one of: ${validContexts.join(", ")}` });
      return;
    }
    const result = await pool.query(
      `INSERT INTO blood_sugar_logs (user_id, glucose_mg_dl, reading_context, measured_at, notes, is_offline_entry)
       VALUES ($1, $2, $3::sugar_reading_context, $4, $5, $6)
       RETURNING *`,
      [
        req.userId!, glucose,
        readingContext ? String(readingContext) : null,
        measuredAt ? new Date(String(measuredAt)) : new Date(),
        notes ? String(notes) : null,
        Boolean(isOfflineEntry ?? false),
      ]
    );
    upsertDailyActivityScore(req.userId!).catch(() => {});
    upsertDailyHealthScore(req.userId!).catch(() => {});
    res.status(201).json({ success: true, log: result.rows[0] });
  } catch (e) {
    res.status(500).json({ error: "Failed to log blood sugar", detail: safeErrorMessage(e) });
  }
});

router.get("/health/blood-sugar/history", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { days = "30" } = req.query as { days?: string };
    const limit = Math.min(parseInt(days) || 30, 365);
    const result = await pool.query(
      `SELECT * FROM blood_sugar_logs WHERE user_id=$1 AND measured_at >= NOW() - ($2 || ' days')::interval ORDER BY measured_at DESC`,
      [req.userId!, String(limit)]
    );
    res.json({ logs: result.rows, count: result.rows.length });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch blood sugar history", detail: safeErrorMessage(e) });
  }
});

router.get("/health/blood-sugar/today", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { dayStart, dayEnd } = istDayBounds(todayIST());
    const result = await pool.query(
      `SELECT * FROM blood_sugar_logs WHERE user_id=$1 AND measured_at >= $2 AND measured_at <= $3 ORDER BY measured_at DESC`,
      [req.userId!, dayStart, dayEnd]
    );
    res.json({ logs: result.rows, latest: result.rows[0] || null });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch today's blood sugar", detail: safeErrorMessage(e) });
  }
});

router.get("/health/score-range", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    if (!startDate || !endDate) {
      res.status(400).json({ error: "startDate and endDate required" });
      return;
    }
    const result = await pool.query(
      `SELECT ROUND(AVG(health_score)) AS avg_pct, COUNT(*) AS days
       FROM daily_health_scores
       WHERE user_id=$1 AND score_date >= $2 AND score_date <= $3`,
      [req.userId!, startDate, endDate]
    );
    const avgPct = Math.round(parseFloat(result.rows[0]?.avg_pct || "0"));
    const days   = parseInt(result.rows[0]?.days || "0");

    // If no historical data, compute today's score as fallback
    if (!avgPct || avgPct === 0) {
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      const fresh = await computeScientificScore(req.userId!, today).catch(() => null);
      const fallback = fresh?.overallScore ?? 0;
      res.json({ score: fallback, daysTracked: days, startDate, endDate, computed: true });
      return;
    }

    res.json({ score: avgPct, daysTracked: days, startDate, endDate });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch score range", detail: safeErrorMessage(e) });
  }
});

router.get("/health/active-percent", requireAuth, async (req: AuthRequest, res) => {
  try {
    let data = await getCumulativeActivePercent(req.userId!);
    if (data.daysTracked === 0) {
      await upsertDailyActivityScore(req.userId!);
      data = await getCumulativeActivePercent(req.userId!);
    }
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch active percent", detail: safeErrorMessage(e) });
  }
});

async function computeDailyScore(userId: string, date: string): Promise<Record<string, unknown>> {
  return toScoreResponse(userId, date, await computeScientificScore(userId, date));
}

/** The wire shape of a day's score.
 *
 *  Extracted so GET /health/score/:date and GET /health/score/range cannot
 *  drift apart: the report reads whichever is available, and a field present
 *  in one but not the other would change the report depending on which path
 *  served it. */
function toScoreResponse(
  userId: string,
  date: string,
  s: Awaited<ReturnType<typeof computeScientificScore>>,
): Record<string, unknown> {
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
    bloodPressureScore: s.bloodPressureScore,
    bloodSugarScore:    s.bloodSugarScore,
    // Detail breakdowns
    food:               s.food,
    exercise:           s.exercise,
    water:              s.water,
    medicine:           s.medicine,
    sleep:              s.sleep,
    bmi:                s.bmi,
    bloodPressure:      s.bloodPressure,
    bloodSugar:         s.bloodSugar,
    // Backward compat fields for existing mobile screens
    totalCaloriesIn:    String(s.food.calories),
    waterGlasses:       s.water.glasses,
    exerciseMinutes:    s.exercise.durationMinutes,
    fieldsLogged:       [s.food.meals > 0, s.exercise.sessions > 0, s.water.glasses > 0].filter(Boolean).length,
    totalPossibleFields: 3,
    // Scientific transparency
    methodology:        s.methodology,
    // Personalisation metadata (v2 engine)
    personalisation:    s.personalisation,
  };
}

export default router;
