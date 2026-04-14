import { pool } from "@workspace/db";

/**
 * AORANE Scientific Health Score Engine
 * ======================================
 * References:
 *   WHO Physical Activity Guidelines 2020 (exercise)
 *   ICMR Dietary Guidelines for Indians 2024 (nutrition)
 *   WHO/ICMR Hydration Guidelines (water)
 *   CDC/WHO Sleep Guidelines (sleep)
 *   WHO BMI Classification (body wellness)
 *   WHO Adherence to Long-Term Therapies Report (medicine)
 */

// ─── Types ────────────────────────────────────────────────────────────────────
export interface DailyHealthScore {
  // Composite
  overallScore: number;           // 0–100, weighted composite
  grade: string;                  // A+, A, B, C, D, F
  gradeLabel: string;             // "Excellent", "Very Good" etc.
  dataConfidence: number;         // 0–100, how complete today's data is

  // Component scores (all 0–100)
  exerciseScore: number;
  foodScore: number;
  waterScore: number;
  medicineScore: number;
  sleepScore: number;
  bmiScore: number;

  // Sub-components (for display)
  exercise: {
    metMinutesToday: number;
    metMinutesGoal: number;        // WHO: 85.7/day (600/week)
    durationMinutes: number;
    caloriesBurned: number;
    sessions: number;
  };
  food: {
    calories: number;
    calorieGoal: number;
    proteinG: number;
    proteinGoalG: number;          // ICMR: 0.8g per kg body weight
    carbsG: number;
    fatG: number;
    fiberG: number;
    fiberGoalG: number;            // ICMR: 25–30g/day
    meals: number;
    mealGoal: number;              // 3 meals/day
  };
  water: {
    mlConsumed: number;
    mlGoal: number;                // WHO: 2500ml men / 2000ml women
    glasses: number;
  };
  medicine: {
    taken: number;
    scheduled: number;
  };
  sleep: {
    hoursLogged: number;           // self-reported from profile
    isOptimal: boolean;            // 7–9 hours
  };
  bmi: {
    value: number | null;
    category: string;
  };

  // Methodology (for transparency / marketing)
  methodology: {
    exerciseBasis: string;
    foodBasis: string;
    waterBasis: string;
    medicineBasis: string;
    sleepBasis: string;
    compositeBasis: string;
  };
}

// ─── Grade from score ─────────────────────────────────────────────────────────
function gradeFromScore(score: number): { grade: string; gradeLabel: string } {
  if (score >= 90) return { grade: "A+", gradeLabel: "Excellent" };
  if (score >= 75) return { grade: "A",  gradeLabel: "Very Good" };
  if (score >= 60) return { grade: "B",  gradeLabel: "Good" };
  if (score >= 45) return { grade: "C",  gradeLabel: "Average" };
  if (score >= 30) return { grade: "D",  gradeLabel: "Needs Improvement" };
  return              { grade: "F",  gradeLabel: "Critical — Act Now" };
}

// ─── Exercise Score (WHO Physical Activity Guidelines 2020) ───────────────────
// WHO recommends ≥150 min/week moderate OR ≥75 min/week vigorous
// In MET-minutes: minimum 600 MET-min/week = 85.7 MET-min/day
// We use actual MET values from exercise logs (set by MET_VALUES table)
function calcExerciseScore(metMin: number, durationMin: number, calories: number, sessions: number): {
  score: number; metGoal: number; data: DailyHealthScore["exercise"];
} {
  const metGoal = 85.7; // WHO 600 MET-min/week ÷ 7 days
  const raw = metMin > 0 ? (metMin / metGoal) * 100 : 0;
  // Allow bonus up to 120 points but cap display at 100
  const score = Math.min(100, Math.round(raw));
  return {
    score,
    metGoal,
    data: { metMinutesToday: Math.round(metMin * 10) / 10, metMinutesGoal: metGoal, durationMinutes: durationMin, caloriesBurned: Math.round(calories), sessions },
  };
}

// ─── Food Score (ICMR Dietary Guidelines 2024) ───────────────────────────────
// Four sub-components: calorie adequacy, protein adequacy, meal regularity, fiber
// Weights: Calorie 40%, Protein 35%, Meal timing 15%, Fiber 10%
function calcFoodScore(
  totalCalories: number, calorieGoal: number,
  proteinG: number, weightKg: number,
  fiberG: number, mealCount: number,
  carbsG: number, fatG: number,
): { score: number; data: DailyHealthScore["food"]; proteinGoalG: number; fiberGoalG: number } {
  const proteinGoalG = Math.round(weightKg * 0.8);   // ICMR: 0.8g/kg minimum
  const fiberGoalG   = 27;                            // ICMR: 25–30g/day midpoint

  // 1. Calorie adequacy (40%) — penalise both under and over-eating
  const calRatio  = calorieGoal > 0 ? totalCalories / calorieGoal : 0;
  let   calScore  = 0;
  if (calRatio >= 0.85 && calRatio <= 1.10) calScore = 100;        // Ideal range
  else if (calRatio >= 0.70 && calRatio < 0.85) calScore = 75;     // Mild under
  else if (calRatio > 1.10 && calRatio <= 1.25) calScore = 75;     // Mild over
  else if (calRatio >= 0.50 && calRatio < 0.70) calScore = 50;     // Moderate under
  else if (calRatio > 1.25 && calRatio <= 1.50) calScore = 40;     // Moderate over
  else if (calRatio > 0) calScore = 20;                            // Logged something

  // 2. Protein adequacy (35%) — ICMR: 0.8g per kg body weight
  const protRatio = proteinGoalG > 0 ? proteinG / proteinGoalG : 0;
  const protScore = Math.min(100, Math.round(protRatio * 100));

  // 3. Meal regularity (15%) — 3 meals = 100%, 2 = 67%, 1 = 33%
  const mealScore = Math.min(100, Math.round((mealCount / 3) * 100));

  // 4. Fiber (10%) — ICMR target 25–30g; most Indians severely deficient
  const fiberScore = fiberG > 0 ? Math.min(100, Math.round((fiberG / fiberGoalG) * 100)) : 0;

  const score = Math.round(calScore * 0.40 + protScore * 0.35 + mealScore * 0.15 + fiberScore * 0.10);

  return {
    score,
    proteinGoalG,
    fiberGoalG,
    data: {
      calories: Math.round(totalCalories), calorieGoal,
      proteinG: Math.round(proteinG * 10) / 10, proteinGoalG,
      carbsG: Math.round(carbsG * 10) / 10, fatG: Math.round(fatG * 10) / 10,
      fiberG: Math.round(fiberG * 10) / 10, fiberGoalG,
      meals: mealCount, mealGoal: 3,
    },
  };
}

// ─── Water Score (WHO/ICMR Hydration Guidelines) ─────────────────────────────
// Men: 2500ml/day, Women: 2000ml/day (ICMR 2024 for India)
// If ml_amount not logged, use glasses × 250ml as proxy
function calcWaterScore(
  mlConsumed: number, glasses: number, gender: string, activityLevel: string,
): { score: number; mlGoal: number; data: DailyHealthScore["water"] } {
  // Gender-based target (ICMR) + activity adjustment
  let mlGoal = gender === "female" ? 2000 : 2500;
  if (activityLevel === "very_active" || activityLevel === "athlete") mlGoal += 500;
  else if (activityLevel === "moderately_active") mlGoal += 250;

  // Use ml_amount if logged, otherwise estimate from glasses
  const actual = mlConsumed > 0 ? mlConsumed : glasses * 250;
  const score  = Math.min(100, Math.round((actual / mlGoal) * 100));

  return {
    score,
    mlGoal,
    data: { mlConsumed: Math.round(actual), mlGoal, glasses },
  };
}

// ─── Medicine Adherence Score (WHO Adherence to Long-Term Therapies) ──────────
// WHO: "Non-adherence is the primary reason for suboptimal health outcomes"
// Score = taken/scheduled × 100; no medicines = neutral 75 (not penalised)
function calcMedicineScore(taken: number, scheduled: number): {
  score: number; data: DailyHealthScore["medicine"];
} {
  const score = scheduled > 0 ? Math.min(100, Math.round((taken / scheduled) * 100)) : 75;
  return { score, data: { taken, scheduled } };
}

// ─── Sleep Score (CDC/WHO Sleep Guidelines) ───────────────────────────────────
// Optimal: 7–9 hours for adults (CDC, WHO)
// <6 hours: high-risk for metabolic syndrome (Indian ICMR research)
function calcSleepScore(sleepHours: number | null): { score: number; isOptimal: boolean } {
  if (!sleepHours || sleepHours <= 0) return { score: 50, isOptimal: false }; // No data — neutral
  if (sleepHours >= 7 && sleepHours <= 9) return { score: 100, isOptimal: true };
  if (sleepHours >= 6 && sleepHours < 7)  return { score: 75,  isOptimal: false };
  if (sleepHours > 9  && sleepHours <= 10) return { score: 80, isOptimal: true };  // Slight oversleep OK
  if (sleepHours >= 5 && sleepHours < 6)  return { score: 45,  isOptimal: false };
  if (sleepHours > 10) return { score: 60, isOptimal: false };  // Oversleeping
  return { score: 20, isOptimal: false };  // <5 hours — critical
}

// ─── BMI Wellness Score (WHO BMI Classification) ─────────────────────────────
// Normal BMI (18.5–22.9 for Indians per WHO Asia-Pacific guidelines) = 100
// Each unit away from ideal range: deduct ~8 points
function calcBmiScore(bmi: number | null, gender: string): {
  score: number; category: string; value: number | null;
} {
  if (!bmi || bmi <= 0) return { score: 50, category: "Unknown", value: null }; // No data
  // WHO Asia-Pacific guidelines for Indians (lower thresholds)
  let category = "Normal";
  let score = 100;
  if (bmi < 16)        { category = "Severely Underweight"; score = 20; }
  else if (bmi < 17)   { category = "Moderately Underweight"; score = 35; }
  else if (bmi < 18.5) { category = "Mild Underweight"; score = 65; }
  else if (bmi <= 22.9) { category = "Normal"; score = 100; }        // Ideal for Indians
  else if (bmi <= 24.9) { category = "Normal-High"; score = 90; }
  else if (bmi <= 27.4) { category = "Overweight"; score = 65; }
  else if (bmi <= 30)   { category = "Obese Class I"; score = 45; }
  else if (bmi <= 35)   { category = "Obese Class II"; score = 25; }
  else                  { category = "Obese Class III"; score = 10; }
  return { score, category, value: Math.round(bmi * 10) / 10 };
}

// ─── Data Confidence ──────────────────────────────────────────────────────────
// How much of the possible data did the user actually log today?
// Full data → high confidence; sparse data → score is less reliable
function calcDataConfidence(
  hasFoodData: boolean, hasExerciseData: boolean,
  hasWaterData: boolean, hasMedData: boolean, hasProfileData: boolean,
): number {
  const weights = [
    hasFoodData     ? 30 : 0,  // food is 30% of score
    hasExerciseData ? 25 : 0,  // exercise is 25%
    hasWaterData    ? 20 : 0,  // water is 15% (+5 for ease of logging)
    hasMedData      ? 15 : 0,  // medicine is 15%
    hasProfileData  ? 10 : 0,  // profile data (BMI, sleep) needed for personalisation
  ];
  return Math.min(100, weights.reduce((a, b) => a + b, 0));
}

// ─── Main Scoring Function ────────────────────────────────────────────────────
export async function computeScientificScore(userId: string, date: string): Promise<DailyHealthScore> {
  const dayStart = date + "T00:00:00Z";
  const dayEnd   = date + "T23:59:59Z";

  // Fetch all data in parallel
  const [foodR, exR, waterR, medSchedR, medTakenR, prefsR, profileR] = await Promise.all([
    pool.query(
      `SELECT
        COALESCE(SUM(calories::numeric),0)  AS total_cal,
        COALESCE(SUM(protein_g::numeric),0) AS total_protein,
        COALESCE(SUM(carbs_g::numeric),0)   AS total_carbs,
        COALESCE(SUM(fat_g::numeric),0)     AS total_fat,
        COALESCE(SUM(fiber_g::numeric),0)   AS total_fiber,
        COUNT(*)                            AS meal_count
       FROM food_logs WHERE user_id=$1 AND logged_at>=$2 AND logged_at<=$3`,
      [userId, dayStart, dayEnd]
    ),
    pool.query(
      `SELECT
        COALESCE(SUM(met_value::numeric * duration_minutes),0) AS met_minutes,
        COALESCE(SUM(duration_minutes),0)                      AS total_duration,
        COALESCE(SUM(calories_burned::numeric),0)              AS total_calories,
        COUNT(*)                                               AS sessions
       FROM exercise_logs WHERE user_id=$1 AND logged_at>=$2 AND logged_at<=$3`,
      [userId, dayStart, dayEnd]
    ),
    pool.query(
      `SELECT
        COALESCE(SUM(ml_amount),0)     AS total_ml,
        COALESCE(SUM(glasses_count),0) AS total_glasses
       FROM water_logs WHERE user_id=$1 AND logged_at>=$2 AND logged_at<=$3`,
      [userId, dayStart, dayEnd]
    ),
    pool.query(`SELECT COUNT(*) FROM medicine_schedules WHERE user_id=$1 AND is_active=true`, [userId]),
    pool.query(
      `SELECT COUNT(*) FROM medicine_logs WHERE user_id=$1 AND status='taken' AND taken_at>=$2 AND taken_at<=$3`,
      [userId, dayStart, dayEnd]
    ),
    pool.query(
      `SELECT water_goal_glasses, calorie_goal FROM user_preferences WHERE user_id=$1`,
      [userId]
    ),
    pool.query(
      `SELECT weight_kg, gender, bmi, activity_level, sleep_hours_avg FROM user_profiles WHERE user_id=$1`,
      [userId]
    ),
  ]);

  // Parse raw data
  const totalCalories = parseFloat(foodR.rows[0]?.total_cal    || "0");
  const totalProtein  = parseFloat(foodR.rows[0]?.total_protein || "0");
  const totalCarbs    = parseFloat(foodR.rows[0]?.total_carbs   || "0");
  const totalFat      = parseFloat(foodR.rows[0]?.total_fat     || "0");
  const totalFiber    = parseFloat(foodR.rows[0]?.total_fiber   || "0");
  const mealCount     = parseInt(foodR.rows[0]?.meal_count      || "0");

  const metMinutes    = parseFloat(exR.rows[0]?.met_minutes   || "0");
  const exDuration    = parseInt(exR.rows[0]?.total_duration  || "0");
  const exCalories    = parseFloat(exR.rows[0]?.total_calories || "0");
  const exSessions    = parseInt(exR.rows[0]?.sessions        || "0");

  const totalMl       = parseInt(waterR.rows[0]?.total_ml      || "0");
  const totalGlasses  = parseInt(waterR.rows[0]?.total_glasses  || "0");

  const medScheduled  = parseInt(medSchedR.rows[0]?.count  || "0");
  const medTaken      = parseInt(medTakenR.rows[0]?.count  || "0");

  const calorieGoal   = parseInt(prefsR.rows[0]?.calorie_goal       || "2000");

  const profile       = profileR.rows[0];
  const weightKg      = parseFloat(profile?.weight_kg    || "60");
  const gender        = profile?.gender       || "other";
  const bmiValue      = parseFloat(profile?.bmi          || "0");
  const activityLevel = profile?.activity_level || "moderately_active";
  const sleepHours    = parseFloat(profile?.sleep_hours_avg || "0");

  // ── Component Scores ────────────────────────────────────────────────────────
  const ex   = calcExerciseScore(metMinutes, exDuration, exCalories, exSessions);
  const food = calcFoodScore(totalCalories, calorieGoal, totalProtein, weightKg, totalFiber, mealCount, totalCarbs, totalFat);
  const water = calcWaterScore(totalMl, totalGlasses, gender, activityLevel);
  const med  = calcMedicineScore(medTaken, medScheduled);
  const sleep = calcSleepScore(sleepHours > 0 ? sleepHours : null);
  const bmi  = calcBmiScore(bmiValue > 0 ? bmiValue : null, gender);

  // ── Composite Score (WHO/ICMR Weighted) ─────────────────────────────────────
  // Food 30% | Exercise 25% | Water 15% | Medicine 15% | Sleep 10% | BMI 5%
  const overallScore = Math.round(
    food.score  * 0.30 +
    ex.score    * 0.25 +
    water.score * 0.15 +
    med.score   * 0.15 +
    sleep.score * 0.10 +
    bmi.score   * 0.05
  );

  const dataConfidence = calcDataConfidence(
    mealCount > 0, exSessions > 0,
    totalGlasses > 0, medScheduled > 0,
    bmiValue > 0 || sleepHours > 0,
  );

  const { grade, gradeLabel } = gradeFromScore(overallScore);

  // ── Save to DB ───────────────────────────────────────────────────────────────
  await pool.query(
    `INSERT INTO daily_health_scores
      (user_id, score_date, health_score, data_confidence_pct,
       food_score, exercise_score, water_score, medicine_score,
       total_calories_in, water_glasses, exercise_minutes, fields_logged, total_possible_fields)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (user_id, score_date) DO UPDATE SET
       health_score=$3, data_confidence_pct=$4,
       food_score=$5, exercise_score=$6, water_score=$7, medicine_score=$8,
       total_calories_in=$9, water_glasses=$10, exercise_minutes=$11, fields_logged=$12`,
    [userId, date, overallScore, String(dataConfidence),
     food.score, ex.score, water.score, med.score,
     String(Math.round(totalCalories)), totalGlasses, exDuration,
     [mealCount > 0, exSessions > 0, totalGlasses > 0].filter(Boolean).length, 3]
  ).catch(() => {});

  return {
    overallScore, grade, gradeLabel, dataConfidence,
    exerciseScore: ex.score,
    foodScore:     food.score,
    waterScore:    water.score,
    medicineScore: med.score,
    sleepScore:    sleep.score,
    bmiScore:      bmi.score,
    exercise: ex.data,
    food: food.data,
    water: water.data,
    medicine: med.data,
    sleep: { hoursLogged: sleepHours, isOptimal: sleep.isOptimal },
    bmi: { value: bmi.value, category: bmi.category },
    methodology: {
      exerciseBasis: "WHO Physical Activity Guidelines 2020: ≥600 MET-min/week target (85.7/day); scored using actual MET values per exercise type and intensity",
      foodBasis: "ICMR Dietary Guidelines 2024: Calorie balance (40%), Protein 0.8g/kg (35%), Meal regularity (15%), Dietary fiber 25–30g (10%)",
      waterBasis: "WHO/ICMR Hydration: 2500ml men / 2000ml women per day; adjusted for activity level",
      medicineBasis: "WHO Adherence to Long-term Therapies (2003): adherence rate = doses taken / doses prescribed",
      sleepBasis: "CDC/WHO Sleep Guidelines: 7–9 hours optimal for adults; <6 hours associated with metabolic risk (ICMR India data)",
      compositeBasis: "AORANE Weighted Score: Nutrition 30% + Exercise 25% + Hydration 15% + Medicine Adherence 15% + Sleep 10% + BMI 5%",
    },
  };
}

// ─── Quick Active Percentage (for scorecard summary) ─────────────────────────
// Uses the same scientific engine but returns simplified view for scorecard widget
export async function computeActivePercent(userId: string, date?: string): Promise<{
  overall: number; foodPct: number; waterPct: number; exercisePct: number; medicinePct: number;
  sleepPct: number; bmiScore: number; grade: string; gradeLabel: string;
  breakdown: { food: number; water: number; exerciseMetMin: number; medicine: number; sleepHours: number };
}> {
  try {
    const d = date || new Date().toISOString().slice(0, 10);
    const score = await computeScientificScore(userId, d);
    return {
      overall:      score.overallScore,
      foodPct:      score.foodScore,
      waterPct:     score.waterScore,
      exercisePct:  score.exerciseScore,
      medicinePct:  score.medicineScore,
      sleepPct:     score.sleepScore,
      bmiScore:     score.bmiScore,
      grade:        score.grade,
      gradeLabel:   score.gradeLabel,
      breakdown: {
        food:           score.food.meals,
        water:          score.water.glasses,
        exerciseMetMin: score.exercise.metMinutesToday,
        medicine:       score.medicine.taken,
        sleepHours:     score.sleep.hoursLogged,
      },
    };
  } catch {
    return {
      overall: 0, foodPct: 0, waterPct: 0, exercisePct: 0, medicinePct: 0,
      sleepPct: 50, bmiScore: 50, grade: "—", gradeLabel: "No data yet",
      breakdown: { food: 0, water: 0, exerciseMetMin: 0, medicine: 0, sleepHours: 0 },
    };
  }
}
