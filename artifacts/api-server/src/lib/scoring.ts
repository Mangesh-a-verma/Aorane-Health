import { pool } from "@workspace/db";

/**
 * AORANE Scientific Health Score Engine v2
 * ==========================================
 * References:
 *   WHO Physical Activity Guidelines 2020 (exercise)
 *   ICMR Dietary Guidelines for Indians 2024 (nutrition + micronutrients)
 *   ICMR Recommended Dietary Allowances (RDA) 2020 (micronutrient targets)
 *   WHO/ICMR Hydration Guidelines (water)
 *   CDC/WHO Sleep Guidelines (sleep)
 *   WHO BMI Classification + Asia-Pacific Guidelines (body wellness)
 *   WHO Adherence to Long-Term Therapies Report (medicine)
 *   Harris-Benedict Equation (BMR/TDEE for personalised calorie targets)
 */

// ─── Types ────────────────────────────────────────────────────────────────────
export interface DailyHealthScore {
  // Composite
  overallScore:    number;   // 0–100, weighted composite
  grade:           string;   // A+, A, B, C, D, F
  gradeLabel:      string;   // "Excellent", "Very Good" etc.
  dataConfidence:  number;   // 0–100, how complete today's data is

  // Component scores (all 0–100)
  exerciseScore:  number;
  foodScore:      number;
  waterScore:     number;
  medicineScore:  number;
  sleepScore:     number;
  bmiScore:       number;

  // Sub-components (for display)
  exercise: {
    metMinutesToday: number;
    metMinutesGoal:  number;     // WHO: 85.7/day (600/week)
    durationMinutes: number;
    caloriesBurned:  number;
    sessions:        number;
  };
  food: {
    calories:       number;
    calorieGoal:    number;
    proteinG:       number;
    proteinGoalG:   number;      // age + goal adjusted
    carbsG:         number;
    fatG:           number;
    fiberG:         number;
    fiberGoalG:     number;      // condition-adjusted
    meals:          number;
    mealGoal:       number;
    micronutrients: {
      dataAvailable:  boolean;
      compositeScore: number;    // 0–100, only meaningful if dataAvailable
      calcium:   { mg: number; goalMg: number; score: number };
      iron:      { mg: number; goalMg: number; score: number };
      vitaminC:  { mg: number; goalMg: number; score: number };
      vitaminB12:{ mcg: number; goalMcg: number; score: number };
      vitaminD:  { mcg: number; goalMcg: number; score: number };
    };
  };
  water: {
    mlConsumed: number;
    mlGoal:     number;          // WHO: 2500ml men / 2000ml women
    glasses:    number;
  };
  medicine: {
    taken:     number;
    scheduled: number;
  };
  sleep: {
    hoursLogged: number;         // self-reported from profile
    isOptimal:   boolean;        // 7–9 hours
    quality:     string | null;  // self-reported quality label
    isLogged:    boolean;        // whether a sleep log exists today
  };
  bmi: {
    value:    number | null;
    category: string;
  };

  // Personalisation metadata (transparency)
  personalisation: {
    ageYears:           number | null;
    primaryGoal:        string;
    conditions:         string[];
    calorieGoalSource:  "calculated" | "preference" | "default";
    proteinGoalBasis:   string;
    bmr:                number | null;
    tdee:               number | null;
  };

  // Methodology (for transparency / marketing)
  methodology: {
    exerciseBasis:   string;
    foodBasis:       string;
    waterBasis:      string;
    medicineBasis:   string;
    sleepBasis:      string;
    compositeBasis:  string;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function gradeFromScore(score: number): { grade: string; gradeLabel: string } {
  if (score >= 90) return { grade: "A+", gradeLabel: "Excellent" };
  if (score >= 75) return { grade: "A",  gradeLabel: "Very Good" };
  if (score >= 60) return { grade: "B",  gradeLabel: "Good" };
  if (score >= 45) return { grade: "C",  gradeLabel: "Average" };
  if (score >= 30) return { grade: "D",  gradeLabel: "Needs Improvement" };
  return              { grade: "F",  gradeLabel: "Critical — Act Now" };
}

function calcAge(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return null;
  return Math.floor((Date.now() - dob.getTime()) / (86400000 * 365.25));
}

// ─── Harris-Benedict BMR + TDEE ───────────────────────────────────────────────
// Male:   BMR = 66 + (13.7 × W) + (5 × H) - (6.8 × age)
// Female: BMR = 655 + (9.6 × W) + (1.8 × H) - (4.7 × age)
function calcBMRandTDEE(
  weightKg: number, heightCm: number, age: number, gender: string, activityLevel: string,
): { bmr: number; tdee: number } | null {
  if (!weightKg || !heightCm || !age) return null;
  const bmr = gender === "female"
    ? 655 + (9.6 * weightKg) + (1.8 * heightCm) - (4.7 * age)
    : 66  + (13.7 * weightKg) + (5 * heightCm) - (6.8 * age);
  const multipliers: Record<string, number> = {
    sedentary:          1.2,
    light:              1.375,
    lightly_active:     1.375,
    moderate:           1.55,
    moderately_active:  1.55,
    very:               1.725,
    very_active:        1.725,
    athlete:            1.9,
  };
  const mult = multipliers[activityLevel] ?? 1.55;
  return { bmr: Math.round(bmr), tdee: Math.round(bmr * mult) };
}

// ─── Personalised Calorie Goal ─────────────────────────────────────────────────
// Adjusts TDEE based on health goal:
//   weight_loss / fat_loss → 15% deficit
//   muscle_gain / bulking  → 10% surplus
//   others                 → maintenance
function calcPersonalisedCalorieGoal(
  tdee: number | null, primaryGoal: string, fallback: number,
): { goal: number; source: "calculated" | "preference" | "default" } {
  if (!tdee) return { goal: fallback, source: fallback !== 2000 ? "preference" : "default" };
  const multipliers: Record<string, number> = {
    weight_loss:       0.85,
    fat_loss:          0.85,
    muscle_gain:       1.10,
    bulking:           1.15,
    diabetes_control:  1.0,
    heart_health:      1.0,
    general_wellness:  1.0,
  };
  const mult = multipliers[primaryGoal] ?? 1.0;
  return { goal: Math.round(tdee * mult), source: "calculated" };
}

// ─── Personalised Protein Goal ────────────────────────────────────────────────
// ICMR RDA: standard adult 0.8g/kg
// Elderly (60+): 1.0g/kg
// Muscle gain: 1.6g/kg (sports nutrition standard)
// Weight loss: 1.0g/kg (preserve lean mass during deficit)
function calcProteinGoal(
  weightKg: number, age: number | null, primaryGoal: string,
): { goalG: number; basis: string } {
  let rda = 0.8;
  let basis = "ICMR 2024: 0.8g/kg body weight";
  if (age !== null && age >= 60) {
    rda = 1.0;
    basis = "ICMR RDA 2020 elderly (60+): 1.0g/kg";
  }
  if (primaryGoal === "muscle_gain" || primaryGoal === "bulking") {
    rda = 1.6;
    basis = "Sports nutrition standard (muscle gain): 1.6g/kg";
  } else if (primaryGoal === "weight_loss" || primaryGoal === "fat_loss") {
    rda = Math.max(rda, 1.0);
    basis = "ICMR + deficit protocol: 1.0g/kg (preserve lean mass)";
  }
  return { goalG: Math.round(weightKg * rda), basis };
}

// ─── Condition-adjusted Fiber Goal ───────────────────────────────────────────
// ICMR: 25–30g standard; diabetes management → 35g; digestive conditions → 20g
function calcFiberGoal(conditions: string[]): { goalG: number; note: string } {
  const lower = conditions.map((c) => c.toLowerCase());
  if (lower.some((c) => c.includes("diabetes") || c.includes("prediabetes") || c.includes("blood_sugar"))) {
    return { goalG: 35, note: "Elevated (diabetes management — ICMR)" };
  }
  if (lower.some((c) => c.includes("ibs") || c.includes("colitis") || c.includes("crohn"))) {
    return { goalG: 20, note: "Reduced (digestive condition)" };
  }
  return { goalG: 27, note: "ICMR 2024: 25–30g/day midpoint" };
}

// ─── ICMR RDA 2020 — Micronutrient Targets (per day) ─────────────────────────
// Personalised by gender, age, and condition
function calcMicronutrientTargets(
  gender: string, age: number | null, conditions: string[],
): { calciumMg: number; ironMg: number; vitaminCMg: number; vitaminB12Mcg: number; vitaminDMcg: number } {
  const lower = conditions.map((c) => c.toLowerCase());
  const isElderly = age !== null && age >= 60;
  const hasAnemia = lower.some((c) =>
    c.includes("anemia") || c.includes("anaemia") || c.includes("iron_deficiency") || c.includes("iron deficiency"),
  );
  const hasOsteoporosis = lower.some((c) =>
    c.includes("osteoporosis") || c.includes("osteopenia") || c.includes("bone"),
  );

  // Calcium: ICMR RDA — adults 600mg, elderly 800mg, osteoporosis 1000mg
  let calciumMg = isElderly ? 800 : 600;
  if (hasOsteoporosis) calciumMg = 1000;

  // Iron: ICMR RDA — male 17mg, female 21mg (higher due to Indian dietary patterns)
  //       Elderly: 10mg (no menstruation); anemia: 30mg (therapeutic)
  let ironMg = gender === "female" ? 21 : 17;
  if (isElderly) ironMg = 10;
  if (hasAnemia) ironMg = 30;

  // Vitamin C: ICMR RDA — 40mg/day adults
  const vitaminCMg = 40;

  // Vitamin B12: WHO RDA 2.4mcg/day (ICMR is 1.0mcg but WHO is more clinically meaningful;
  // B12 deficiency is widespread in India esp. vegetarians — higher target gives actionable score)
  const vitaminB12Mcg = 2.4;

  // Vitamin D: ICMR RDA — 10mcg (400 IU)/day; elderly 15mcg
  const vitaminDMcg = isElderly ? 15 : 10;

  return { calciumMg, ironMg, vitaminCMg, vitaminB12Mcg, vitaminDMcg };
}

// ─── Micronutrient Score ──────────────────────────────────────────────────────
// Scores each nutrient vs ICMR RDA (capped at 100%), then weighted composite
// Weights: Iron 30%, Calcium 25%, Vitamin B12 20%, Vitamin C 15%, Vitamin D 10%
// Only scored when food_logs actually contain micronutrient data
function calcMicronutrientScore(
  totalCalcium: number, totalIron: number, totalVitC: number,
  totalB12: number, totalVitD: number, hasMicroData: boolean,
  targets: ReturnType<typeof calcMicronutrientTargets>,
): DailyHealthScore["food"]["micronutrients"] {
  const s = (actual: number, goal: number) =>
    goal > 0 ? Math.min(100, Math.round((actual / goal) * 100)) : 0;

  const calciumScore   = s(totalCalcium, targets.calciumMg);
  const ironScore      = s(totalIron,    targets.ironMg);
  const vitCScore      = s(totalVitC,    targets.vitaminCMg);
  const b12Score       = s(totalB12,     targets.vitaminB12Mcg);
  const vitDScore      = s(totalVitD,    targets.vitaminDMcg);

  // Weighted composite
  const compositeScore = hasMicroData
    ? Math.round(ironScore * 0.30 + calciumScore * 0.25 + b12Score * 0.20 + vitCScore * 0.15 + vitDScore * 0.10)
    : 0;

  return {
    dataAvailable: hasMicroData,
    compositeScore,
    calcium:    { mg: Math.round(totalCalcium * 10) / 10,  goalMg: targets.calciumMg,    score: calciumScore },
    iron:       { mg: Math.round(totalIron * 10) / 10,      goalMg: targets.ironMg,       score: ironScore },
    vitaminC:   { mg: Math.round(totalVitC * 10) / 10,      goalMg: targets.vitaminCMg,   score: vitCScore },
    vitaminB12: { mcg: Math.round(totalB12 * 100) / 100,    goalMcg: targets.vitaminB12Mcg, score: b12Score },
    vitaminD:   { mcg: Math.round(totalVitD * 10) / 10,     goalMcg: targets.vitaminDMcg,  score: vitDScore },
  };
}

// ─── Exercise Score (WHO Physical Activity Guidelines 2020) ───────────────────
// WHO: ≥150 min/week moderate OR ≥75 min/week vigorous
// In MET-minutes: minimum 600 MET-min/week = 85.7 MET-min/day
function calcExerciseScore(
  metMin: number, durationMin: number, calories: number, sessions: number,
): { score: number; metGoal: number; data: DailyHealthScore["exercise"] } {
  const metGoal = 85.7;
  const score   = metMin > 0 ? Math.min(100, Math.round((metMin / metGoal) * 100)) : 0;
  return {
    score,
    metGoal,
    data: {
      metMinutesToday: Math.round(metMin * 10) / 10,
      metMinutesGoal:  metGoal,
      durationMinutes: durationMin,
      caloriesBurned:  Math.round(calories),
      sessions,
    },
  };
}

// ─── Food Score (ICMR + personalised targets) ────────────────────────────────
// Without micronutrient data: Calorie 40% | Protein 35% | Meals 15% | Fiber 10%
// With micronutrient data:    Calorie 30% | Protein 25% | Meals 10% | Fiber 15% | Micronutrients 20%
function calcFoodScore(
  totalCalories: number, calorieGoal: number,
  proteinG: number, proteinGoalG: number,
  fiberG: number, fiberGoalG: number,
  mealCount: number, carbsG: number, fatG: number,
  micronutrients: DailyHealthScore["food"]["micronutrients"],
): { score: number; data: DailyHealthScore["food"] } {
  // 1. Calorie adequacy — penalise both under and over-eating
  // Over-eating penalised more strictly than under-eating (metabolic risk)
  const calRatio = calorieGoal > 0 ? totalCalories / calorieGoal : 0;
  let calScore = 0;
  if      (calRatio >= 0.85 && calRatio <= 1.10) calScore = 100;   // Ideal (±10%)
  else if (calRatio >= 0.70 && calRatio <  0.85) calScore = 75;    // Mild under (-15 to -30%)
  else if (calRatio >  1.10 && calRatio <= 1.20) calScore = 70;    // Mild over (+10-20%)
  else if (calRatio >= 0.50 && calRatio <  0.70) calScore = 50;    // Moderate under (-30-50%)
  else if (calRatio >  1.20 && calRatio <= 1.35) calScore = 45;    // Moderate over (+20-35%)
  else if (calRatio >  1.35 && calRatio <= 1.50) calScore = 25;    // Heavy over (+35-50%)
  else if (calRatio >  1.50)                      calScore = 10;    // Severe over (>50% — critical)
  else if (calRatio > 0)                          calScore = 20;    // Severe under (<50%)

  // 2. Protein adequacy
  const protScore = proteinGoalG > 0
    ? Math.min(100, Math.round((proteinG / proteinGoalG) * 100))
    : 0;

  // 3. Meal regularity (3 meals = 100%)
  const mealScore = Math.min(100, Math.round((mealCount / 3) * 100));

  // 4. Fiber
  const fiberScore = fiberG > 0
    ? Math.min(100, Math.round((fiberG / fiberGoalG) * 100))
    : 0;

  // 5. Weighted composite — include micronutrients if data is available
  let score: number;
  if (micronutrients.dataAvailable) {
    score = Math.round(
      calScore               * 0.30 +
      protScore              * 0.25 +
      mealScore              * 0.10 +
      fiberScore             * 0.15 +
      micronutrients.compositeScore * 0.20,
    );
  } else {
    score = Math.round(
      calScore   * 0.40 +
      protScore  * 0.35 +
      mealScore  * 0.15 +
      fiberScore * 0.10,
    );
  }

  return {
    score,
    data: {
      calories: Math.round(totalCalories), calorieGoal,
      proteinG: Math.round(proteinG * 10) / 10, proteinGoalG,
      carbsG:   Math.round(carbsG * 10) / 10,
      fatG:     Math.round(fatG * 10) / 10,
      fiberG:   Math.round(fiberG * 10) / 10, fiberGoalG,
      meals: mealCount, mealGoal: 3,
      micronutrients,
    },
  };
}

// ─── Water Score (WHO/ICMR Hydration Guidelines) ─────────────────────────────
function calcWaterScore(
  mlConsumed: number, glasses: number, gender: string, activityLevel: string,
): { score: number; mlGoal: number; data: DailyHealthScore["water"] } {
  let mlGoal = gender === "female" ? 2000 : 2500;
  if (activityLevel === "very" || activityLevel === "very_active" || activityLevel === "athlete") mlGoal += 500;
  else if (activityLevel === "moderate" || activityLevel === "moderately_active") mlGoal += 250;
  else if (activityLevel === "light" || activityLevel === "lightly_active") mlGoal += 150;
  const actual = mlConsumed > 0 ? mlConsumed : glasses * 250;
  const score  = Math.min(100, Math.round((actual / mlGoal) * 100));
  return { score, mlGoal, data: { mlConsumed: Math.round(actual), mlGoal, glasses } };
}

// ─── Medicine Adherence Score ─────────────────────────────────────────────────
function calcMedicineScore(
  taken: number, scheduled: number,
): { score: number; data: DailyHealthScore["medicine"] } {
  const score = scheduled > 0
    ? Math.min(100, Math.round((taken / scheduled) * 100))
    : 75; // No medicines → neutral
  return { score, data: { taken, scheduled } };
}

// ─── Sleep Score (CDC/WHO Sleep Guidelines) ───────────────────────────────────
function calcSleepScore(sleepHours: number | null): { score: number; isOptimal: boolean } {
  if (!sleepHours || sleepHours <= 0) return { score: 50, isOptimal: false };
  if (sleepHours >= 7 && sleepHours <= 9)   return { score: 100, isOptimal: true };
  if (sleepHours >= 6 && sleepHours <  7)   return { score: 75,  isOptimal: false };
  if (sleepHours >  9 && sleepHours <= 10)  return { score: 80,  isOptimal: true };
  if (sleepHours >= 5 && sleepHours <  6)   return { score: 45,  isOptimal: false };
  if (sleepHours >  10)                     return { score: 60,  isOptimal: false };
  return { score: 20, isOptimal: false }; // <5h — critical
}

// ─── BMI Score (WHO Asia-Pacific Guidelines) ─────────────────────────────────
// Normal BMI for Indians: 18.5–22.9 (lower thresholds than Western standards)
function calcBmiScore(
  bmi: number | null,
): { score: number; category: string; value: number | null } {
  if (!bmi || bmi <= 0) return { score: 50, category: "Unknown", value: null };
  let category = "Normal";
  let score = 100;
  if      (bmi < 16)         { category = "Severely Underweight"; score = 20; }
  else if (bmi < 17)         { category = "Moderately Underweight"; score = 35; }
  else if (bmi < 18.5)       { category = "Mild Underweight"; score = 65; }
  else if (bmi <= 22.9)      { category = "Normal"; score = 100; }
  else if (bmi <= 24.9)      { category = "Normal-High"; score = 90; }
  else if (bmi <= 27.4)      { category = "Overweight"; score = 65; }
  else if (bmi <= 30)        { category = "Obese Class I"; score = 45; }
  else if (bmi <= 35)        { category = "Obese Class II"; score = 25; }
  else                       { category = "Obese Class III"; score = 10; }
  return { score, category, value: Math.round(bmi * 10) / 10 };
}

// ─── Data Confidence ──────────────────────────────────────────────────────────
function calcDataConfidence(
  hasFoodData: boolean, hasExerciseData: boolean,
  hasWaterData: boolean, hasMedData: boolean, hasProfileData: boolean,
): number {
  const weights = [
    hasFoodData     ? 30 : 0,
    hasExerciseData ? 25 : 0,
    hasWaterData    ? 20 : 0,
    hasMedData      ? 15 : 0,
    hasProfileData  ? 10 : 0,
  ];
  return Math.min(100, weights.reduce((a, b) => a + b, 0));
}

// ─── Main Scoring Function ────────────────────────────────────────────────────
export async function computeScientificScore(userId: string, date: string): Promise<DailyHealthScore> {
  // IST = UTC+05:30 — use IST boundaries so Indian users' midnight-5:30 AM activity
  // is correctly assigned to the date they intended, not the previous UTC day
  const dayStart = date + "T00:00:00+05:30";
  const dayEnd   = date + "T23:59:59+05:30";

  // Fetch all data in parallel — now includes height, DOB, goals, conditions, micronutrients, sleep
  const [foodR, exR, waterR, medSchedR, medTakenR, prefsR, profileR, goalsR, conditionsR, sleepR] = await Promise.all([
    // Food — now includes micronutrients + tracking if micronutrient data was actually logged
    pool.query(
      `SELECT
        COALESCE(SUM(calories::numeric),0)      AS total_cal,
        COALESCE(SUM(protein_g::numeric),0)     AS total_protein,
        COALESCE(SUM(carbs_g::numeric),0)       AS total_carbs,
        COALESCE(SUM(fat_g::numeric),0)         AS total_fat,
        COALESCE(SUM(fiber_g::numeric),0)       AS total_fiber,
        COALESCE(SUM(calcium_mg::numeric),0)    AS total_calcium,
        COALESCE(SUM(iron_mg::numeric),0)       AS total_iron,
        COALESCE(SUM(vitamin_c_mg::numeric),0)  AS total_vitamin_c,
        COALESCE(SUM(vitamin_b12_mcg::numeric),0) AS total_b12,
        COALESCE(SUM(vitamin_d_mcg::numeric),0) AS total_vitamin_d,
        COUNT(*)                                AS meal_count,
        COUNT(CASE WHEN calcium_mg::numeric > 0 OR iron_mg::numeric > 0
                        OR vitamin_c_mg::numeric > 0
                        OR vitamin_b12_mcg::numeric > 0
                        OR vitamin_d_mcg::numeric > 0 THEN 1 END) AS micro_logged_count
       FROM food_logs WHERE user_id=$1 AND logged_at>=$2 AND logged_at<=$3`,
      [userId, dayStart, dayEnd],
    ),
    // Exercise
    pool.query(
      `SELECT
        COALESCE(SUM(met_value::numeric * duration_minutes),0) AS met_minutes,
        COALESCE(SUM(duration_minutes),0)                      AS total_duration,
        COALESCE(SUM(calories_burned::numeric),0)              AS total_calories,
        COUNT(*)                                               AS sessions
       FROM exercise_logs WHERE user_id=$1 AND logged_at>=$2 AND logged_at<=$3`,
      [userId, dayStart, dayEnd],
    ),
    // Water
    pool.query(
      `SELECT
        COALESCE(SUM(ml_amount),0)     AS total_ml,
        COALESCE(SUM(glasses_count),0) AS total_glasses
       FROM water_logs WHERE user_id=$1 AND logged_at>=$2 AND logged_at<=$3`,
      [userId, dayStart, dayEnd],
    ),
    // Medicine scheduled
    pool.query(`SELECT COUNT(*) FROM medicine_schedules WHERE user_id=$1 AND is_active=true`, [userId]),
    // Medicine taken today
    pool.query(
      `SELECT COUNT(*) FROM medicine_logs WHERE user_id=$1 AND status='taken' AND taken_at>=$2 AND taken_at<=$3`,
      [userId, dayStart, dayEnd],
    ),
    // User preferences (calorie goal fallback, water goal)
    pool.query(
      `SELECT water_goal_glasses, calorie_goal FROM user_preferences WHERE user_id=$1`,
      [userId],
    ),
    // User profile — now includes height_cm and date_of_birth for BMR
    pool.query(
      `SELECT weight_kg, gender, bmi, activity_level, sleep_hours_avg, height_cm, date_of_birth
       FROM user_profiles WHERE user_id=$1`,
      [userId],
    ),
    // Health goals — for personalised calorie + protein targets
    pool.query(
      `SELECT primary_goal FROM user_health_goals WHERE user_id=$1 LIMIT 1`,
      [userId],
    ),
    // Medical conditions — for fiber, iron, calcium target adjustments
    pool.query(
      `SELECT condition FROM user_medical_conditions WHERE user_id=$1 AND is_active=true`,
      [userId],
    ),
    // Sleep log for this specific date (actual daily tracking)
    pool.query(
      `SELECT sleep_hours, quality, bedtime, wake_time FROM sleep_logs WHERE user_id=$1 AND sleep_date=$2 ORDER BY logged_at DESC LIMIT 1`,
      [userId, date],
    ),
  ]);

  // ── Parse raw data ───────────────────────────────────────────────────────────
  const totalCalories  = parseFloat(foodR.rows[0]?.total_cal     || "0");
  const totalProtein   = parseFloat(foodR.rows[0]?.total_protein  || "0");
  const totalCarbs     = parseFloat(foodR.rows[0]?.total_carbs    || "0");
  const totalFat       = parseFloat(foodR.rows[0]?.total_fat      || "0");
  const totalFiber     = parseFloat(foodR.rows[0]?.total_fiber    || "0");
  const totalCalcium   = parseFloat(foodR.rows[0]?.total_calcium  || "0");
  const totalIron      = parseFloat(foodR.rows[0]?.total_iron     || "0");
  const totalVitC      = parseFloat(foodR.rows[0]?.total_vitamin_c || "0");
  const totalB12       = parseFloat(foodR.rows[0]?.total_b12      || "0");
  const totalVitD      = parseFloat(foodR.rows[0]?.total_vitamin_d || "0");
  const mealCount      = parseInt(foodR.rows[0]?.meal_count       || "0");
  const microLoggedCount = parseInt(foodR.rows[0]?.micro_logged_count || "0");
  const hasMicroData   = microLoggedCount > 0;

  const metMinutes  = parseFloat(exR.rows[0]?.met_minutes    || "0");
  const exDuration  = parseInt(exR.rows[0]?.total_duration   || "0");
  const exCalories  = parseFloat(exR.rows[0]?.total_calories  || "0");
  const exSessions  = parseInt(exR.rows[0]?.sessions          || "0");

  const totalMl     = parseInt(waterR.rows[0]?.total_ml      || "0");
  const totalGlasses = parseInt(waterR.rows[0]?.total_glasses || "0");

  const medScheduled = parseInt(medSchedR.rows[0]?.count || "0");
  const medTaken     = parseInt(medTakenR.rows[0]?.count  || "0");

  const prefCalorieGoal = parseInt(prefsR.rows[0]?.calorie_goal || "2000");

  const profile      = profileR.rows[0];
  const weightKg     = parseFloat(profile?.weight_kg     || "60");
  const heightCm     = parseFloat(profile?.height_cm     || "0");
  const gender       = profile?.gender        || "other";
  // Issue 2 fix: always compute BMI fresh from latest weight + height
  // Stored profile.bmi can be stale if user updates weight without recalculating
  const heightM      = heightCm / 100;
  const freshBmi     = (weightKg > 0 && heightM > 0)
    ? parseFloat((weightKg / (heightM * heightM)).toFixed(1))
    : 0;
  const bmiValue     = freshBmi > 0 ? freshBmi : parseFloat(profile?.bmi || "0");
  const activityLevel = profile?.activity_level || "moderate";
  // Use actual daily sleep log if available, fall back to profile average
  const dailySleepLog = sleepR.rows[0];
  const sleepHours = dailySleepLog
    ? parseFloat(dailySleepLog.sleep_hours || "0")
    : parseFloat(profile?.sleep_hours_avg || "0");
  const sleepQuality  = dailySleepLog?.quality || null;
  const sleepIsLogged = !!dailySleepLog;
  const dateOfBirth  = profile?.date_of_birth  || null;

  const primaryGoal  = goalsR.rows[0]?.primary_goal || "general_wellness";
  const conditions: string[] = (conditionsR.rows || []).map((r: Record<string, unknown>) => String(r.condition || ""));

  // ── Derived personalisation ──────────────────────────────────────────────────
  const age        = calcAge(dateOfBirth);
  const bmrTdee    = calcBMRandTDEE(weightKg, heightCm, age ?? 30, gender, activityLevel);
  const { goal: calorieGoal, source: goalSource } = calcPersonalisedCalorieGoal(
    bmrTdee?.tdee ?? null, primaryGoal, prefCalorieGoal,
  );
  const { goalG: proteinGoalG, basis: proteinBasis } = calcProteinGoal(weightKg, age, primaryGoal);
  const { goalG: fiberGoalG } = calcFiberGoal(conditions);
  const microTargets = calcMicronutrientTargets(gender, age, conditions);

  // ── Component Scores ────────────────────────────────────────────────────────
  const microScore  = calcMicronutrientScore(totalCalcium, totalIron, totalVitC, totalB12, totalVitD, hasMicroData, microTargets);
  const food        = calcFoodScore(totalCalories, calorieGoal, totalProtein, proteinGoalG, totalFiber, fiberGoalG, mealCount, totalCarbs, totalFat, microScore);
  const ex          = calcExerciseScore(metMinutes, exDuration, exCalories, exSessions);
  const water       = calcWaterScore(totalMl, totalGlasses, gender, activityLevel);
  const med         = calcMedicineScore(medTaken, medScheduled);
  const sleep       = calcSleepScore(sleepHours > 0 ? sleepHours : null);
  const bmi         = calcBmiScore(bmiValue > 0 ? bmiValue : null);

  // ── Composite Score (WHO/ICMR Weighted) ─────────────────────────────────────
  // Food 30% | Exercise 25% | Water 15% | Medicine 15% | Sleep 10% | BMI 5%
  const overallScore = Math.round(
    food.score  * 0.30 +
    ex.score    * 0.25 +
    water.score * 0.15 +
    med.score   * 0.15 +
    sleep.score * 0.10 +
    bmi.score   * 0.05,
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
     [mealCount > 0, exSessions > 0, totalGlasses > 0].filter(Boolean).length, 3],
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
    food:     food.data,
    water:    water.data,
    medicine: med.data,
    sleep:    { hoursLogged: sleepHours, isOptimal: sleep.isOptimal, quality: sleepQuality, isLogged: sleepIsLogged },
    bmi:      { value: bmi.value, category: bmi.category },
    personalisation: {
      ageYears:          age,
      primaryGoal,
      conditions,
      calorieGoalSource: goalSource,
      proteinGoalBasis:  proteinBasis,
      bmr:               bmrTdee?.bmr ?? null,
      tdee:              bmrTdee?.tdee ?? null,
    },
    methodology: {
      exerciseBasis:   "WHO Physical Activity Guidelines 2020: ≥600 MET-min/week (85.7/day); scored via actual MET values per exercise type and intensity",
      foodBasis:       hasMicroData
        ? `ICMR 2024 personalised: Calories 30% (goal-adjusted via ${goalSource === "calculated" ? "Harris-Benedict BMR" : "user preference"}), Protein 25% (${proteinBasis}), Fiber 15% (${fiberGoalG}g target), Micronutrients 20% (ICMR RDA 2020), Meal regularity 10%`
        : `ICMR 2024 personalised: Calories 40% (goal-adjusted via ${goalSource === "calculated" ? "Harris-Benedict BMR" : "user preference"}), Protein 35% (${proteinBasis}), Meal regularity 15%, Fiber 10%; micronutrient data not yet logged`,
      waterBasis:      `WHO/ICMR Hydration: ${gender === "female" ? "2000ml" : "2500ml"}/day base; adjusted for activity level`,
      medicineBasis:   "WHO Adherence to Long-term Therapies (2003): adherence = doses taken ÷ doses prescribed",
      sleepBasis:      "CDC/WHO Sleep Guidelines: 7–9 hours optimal for adults; <6h associated with metabolic risk (ICMR India data)",
      compositeBasis:  "AORANE v2 Weighted Score: Nutrition 30% + Exercise 25% + Hydration 15% + Medicine Adherence 15% + Sleep 10% + BMI 5%",
    },
  };
}

// ─── Quick Active Percentage (for scorecard summary) ─────────────────────────
export async function computeActivePercent(userId: string, date?: string): Promise<{
  overall: number; foodPct: number; waterPct: number; exercisePct: number; medicinePct: number;
  sleepPct: number; bmiScore: number; grade: string; gradeLabel: string;
  breakdown: { food: number; water: number; exerciseMetMin: number; medicine: number; sleepHours: number };
  personalisation?: DailyHealthScore["personalisation"];
}> {
  try {
    const d     = date || new Date().toISOString().slice(0, 10);
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
      personalisation: score.personalisation,
    };
  } catch {
    return {
      overall: 0, foodPct: 0, waterPct: 0, exercisePct: 0, medicinePct: 0,
      sleepPct: 50, bmiScore: 50, grade: "—", gradeLabel: "No data yet",
      breakdown: { food: 0, water: 0, exerciseMetMin: 0, medicine: 0, sleepHours: 0 },
    };
  }
}
