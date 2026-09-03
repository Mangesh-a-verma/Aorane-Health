import { pool } from "@workspace/db";
import { istDayBounds } from "./dateUtils";
import { calculateEffectiveTDEE } from "./workProfile";

/**
 * AORANE Scientific Health Score Engine v3
 * ==========================================
 * Core principle: ONLY score data that actually exists today.
 * No fallbacks, no fake defaults, no profile averages substituted as today's data.
 * If a metric has no data → it is excluded from composite entirely.
 * Morning score with zero entries = 0.
 *
 * NOT a duplicate of activityScore.ts's upsertDailyActivityScore() — that's
 * a separate, simpler engagement/consistency percentage. See the header
 * comment in activityScore.ts for how the two relate; do not merge them.
 *
 * References:
 * WHO Physical Activity Guidelines 2020
 * ICMR Dietary Guidelines for Indians 2024
 * ICMR Recommended Dietary Allowances (RDA) 2020
 * WHO/ICMR Hydration Guidelines
 * CDC/WHO Sleep Guidelines
 * WHO BMI Classification + Asia-Pacific Guidelines
 * WHO Adherence to Long-Term Therapies Report
 * Harris-Benedict Equation (BMR/TDEE)
 */

// ─── Types ────────────────────────────────────────────────────────────────────
export interface DailyHealthScore {
  overallScore:   number;   // 0–100 — genuinely 0 if no data logged today
  grade:          string;
  gradeLabel:     string;
  dataConfidence: number;   // 0–100, how many pillars have real data

  // Component scores — null means "no data logged today, not counted"
  exerciseScore:  number | null;
  foodScore:      number | null;
  waterScore:     number | null;
  medicineScore:  number | null;
  sleepScore:     number | null;
  stressScore:    number | null;
  bmiScore:       number | null;
  stepsScore:     number | null;
  heartRateScore: number | null;
  spo2Score:      number | null;
  bloodPressureScore: number | null;
  bloodSugarScore:    number | null;

  // Breakdown detail
  exercise: {
    metMinutesToday: number; metMinutesGoal: number;
    durationMinutes: number; caloriesBurned: number; sessions: number;
    hasData: boolean;
  };
  food: {
    calories: number; calorieGoal: number;
    proteinG: number; proteinGoalG: number;
    carbsG: number; fatG: number; fiberG: number; fiberGoalG: number;
    sugarG: number; sodiumMg: number;
    meals: number; mealGoal: number;
    hasData: boolean;
    micronutrients: {
      dataAvailable: boolean; compositeScore: number;
      calcium: { mg: number; goalMg: number; score: number };
      iron: { mg: number; goalMg: number; score: number };
      vitaminC: { mg: number; goalMg: number; score: number };
      vitaminB12: { mcg: number; goalMcg: number; score: number };
      vitaminD: { mcg: number; goalMcg: number; score: number };
    };
  };
  water: {
    mlConsumed: number; mlGoal: number; glasses: number; hasData: boolean;
  };
  medicine: {
    taken: number; scheduled: number; hasData: boolean;
  };
  sleep: {
    hoursLogged: number | null; isOptimal: boolean;
    quality: string | null; isLogged: boolean;
  };
  stress: {
    stressScore: number | null; mood: string | null; isLogged: boolean;
  };
  bmi: {
    value: number | null; category: string; hasData: boolean;
  };
  wearable: {
    steps: number | null; stepsGoal: number;
    heartRateAvg: number | null; heartRateMin: number | null; heartRateMax: number | null;
    bloodOxygen: number | null;
    hasSteps: boolean; hasHeartRate: boolean; hasSpo2: boolean;
  };
  bloodPressure: {
    systolic: number | null; diastolic: number | null; pulse: number | null;
    category: string; hasData: boolean;
  };
  bloodSugar: {
    glucoseMgDl: number | null; readingContext: string | null;
    category: string; hasData: boolean;
  };

  // Which metrics actually contributed to today's score
  activeMetrics: string[];
  excludedMetrics: string[]; // metrics with no data — excluded from composite

  personalisation: {
    ageYears: number | null; primaryGoal: string; conditions: string[];
    calorieGoalSource: "calculated" | "preference" | "default";
    proteinGoalBasis: string; bmr: number | null; tdee: number | null;
  };
  methodology: {
    exerciseBasis: string; foodBasis: string; waterBasis: string;
    medicineBasis: string; sleepBasis: string; stressBasis: string;
    compositeBasis: string;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function gradeFromScore(score: number): { grade: string; gradeLabel: string } {
  if (score >= 90) return { grade: "A+", gradeLabel: "Excellent" };
  if (score >= 75) return { grade: "A",  gradeLabel: "Very Good" };
  if (score >= 60) return { grade: "B",  gradeLabel: "Good" };
  if (score >= 45) return { grade: "C",  gradeLabel: "Average" };
  if (score >= 30) return { grade: "D",  gradeLabel: "Needs Improvement" };
  return              { grade: "F",  gradeLabel: "No Data Yet" };
}

function calcAge(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (86400000 * 365.25));
}

function calcBMRandTDEE(
  weightKg: number, heightCm: number, age: number, gender: string, activityLevel: string,
  workProfile?: string | null,
): { bmr: number; tdee: number } | null {
  if (!weightKg || !heightCm || !age) return null;
  const bmr = gender === "female"
    ? 655 + (9.6 * weightKg) + (1.8 * heightCm) - (4.7 * age)
    : 66  + (13.7 * weightKg) + (5 * heightCm) - (6.8 * age);
  // Same job-role-aware formula routes/modules/suggestions.ts's AI Coach
  // uses — previously this only looked at activityLevel, so a farmer and
  // an office worker with the same self-reported activity level got
  // identical calorie/protein goals here despite very different real
  // TDEE, while the Coach already told them apart correctly.
  return { bmr: Math.round(bmr), tdee: calculateEffectiveTDEE(bmr, activityLevel, workProfile) };
}

function calcPersonalisedCalorieGoal(
  tdee: number | null, primaryGoal: string, prefGoal: number,
): { goal: number; source: "calculated" | "preference" | "default" } {
  if (!tdee) return { goal: prefGoal, source: prefGoal !== 2000 ? "preference" : "default" };
  const m: Record<string, number> = {
    weight_loss: 0.85, lose_weight: 0.85, fat_loss: 0.85,
    muscle_gain: 1.10, gain_weight: 1.10, gain_muscle: 1.10, bulking: 1.15,
  };
  return { goal: Math.round(tdee * (m[primaryGoal] ?? 1.0)), source: "calculated" };
}

function calcProteinGoal(
  weightKg: number, age: number | null, primaryGoal: string,
): { goalG: number; basis: string } {
  let rda = 0.8, basis = "ICMR 2024: 0.8g/kg";
  if (age !== null && age >= 60) { rda = 1.0; basis = "ICMR RDA 2020 elderly: 1.0g/kg"; }
  if (primaryGoal === "muscle_gain" || primaryGoal === "bulking") { rda = 1.6; basis = "Sports nutrition: 1.6g/kg"; }
  else if (primaryGoal === "weight_loss" || primaryGoal === "fat_loss") { rda = Math.max(rda, 1.0); basis = "Deficit protocol: 1.0g/kg"; }
  return { goalG: Math.round(weightKg * rda), basis };
}

function calcFiberGoal(conditions: string[]): number {
  const lc = conditions.map(c => c.toLowerCase());
  if (lc.some(c => c.includes("diabetes") || c.includes("prediabetes"))) return 35;
  if (lc.some(c => c.includes("ibs") || c.includes("colitis"))) return 20;
  return 27;
}

function calcMicroTargets(
  gender: string, age: number | null, conditions: string[],
): { calciumMg: number; ironMg: number; vitaminCMg: number; vitaminB12Mcg: number; vitaminDMcg: number } {
  const lc = conditions.map(c => c.toLowerCase());
  const elderly = age !== null && age >= 60;
  const anemia = lc.some(c => c.includes("anemia") || c.includes("iron_deficiency"));
  const osteo  = lc.some(c => c.includes("osteoporosis") || c.includes("osteopenia"));
  return {
    calciumMg:    osteo ? 1000 : elderly ? 800 : 600,
    ironMg:       anemia ? 30 : elderly ? 10 : gender === "female" ? 21 : 17,
    vitaminCMg:   40,
    vitaminB12Mcg: 2.4,
    vitaminDMcg:  elderly ? 15 : 10,
  };
}

// ─── Individual Scorers ───────────────────────────────────────────────────────
// RULE: Every scorer returns null score if no real data exists.
// null = "not counted in composite today"

function scoreExercise(metMin: number, duration: number, calories: number, sessions: number): {
  score: number | null; hasData: boolean;
  data: DailyHealthScore["exercise"];
} {
  const hasData = sessions > 0 || metMin > 0 || duration > 0;
  const metGoal = 85.7; // WHO: 600 MET-min/week ÷ 7
  const score   = hasData ? Math.min(100, Math.round((metMin / metGoal) * 100)) : null;
  return {
    score, hasData,
    data: { metMinutesToday: Math.round(metMin * 10) / 10, metMinutesGoal: metGoal, durationMinutes: duration, caloriesBurned: Math.round(calories), sessions, hasData },
  };
}

function scoreFood(
  totalCal: number, calGoal: number,
  protein: number, proteinGoal: number,
  fiber: number, fiberGoal: number,
  meals: number, carbs: number, fat: number, sugar: number, sodium: number,
  micro: DailyHealthScore["food"]["micronutrients"],
): { score: number | null; hasData: boolean; data: DailyHealthScore["food"] } {
  const hasData = meals > 0 || totalCal > 0;
  if (!hasData) {
    return {
      score: null, hasData: false,
      data: { calories: 0, calorieGoal: calGoal, proteinG: 0, proteinGoalG: proteinGoal, carbsG: 0, fatG: 0, fiberG: 0, fiberGoalG: fiberGoal, sugarG: 0, sodiumMg: 0, meals: 0, mealGoal: 3, hasData: false, micronutrients: micro },
    };
  }

  const calRatio = calGoal > 0 ? totalCal / calGoal : 0;
  let calScore = 0;
  if      (calRatio >= 0.85 && calRatio <= 1.10) calScore = 100;
  else if (calRatio >= 0.70 && calRatio <  0.85) calScore = 75;
  else if (calRatio >  1.10 && calRatio <= 1.20) calScore = 70;
  else if (calRatio >= 0.50 && calRatio <  0.70) calScore = 50;
  else if (calRatio >  1.20 && calRatio <= 1.35) calScore = 45;
  else if (calRatio >  1.35 && calRatio <= 1.50) calScore = 25;
  else if (calRatio >  1.50)                     calScore = 10;
  else if (calRatio > 0)                         calScore = 20;

  const protScore  = proteinGoal > 0 ? Math.min(100, Math.round((protein / proteinGoal) * 100)) : 0;
  const mealScore  = Math.min(100, Math.round((meals / 3) * 100));
  const fiberScore = fiber > 0 ? Math.min(100, Math.round((fiber / fiberGoal) * 100)) : 0;

  let score: number;
  if (micro.dataAvailable) {
    score = Math.round(calScore * 0.30 + protScore * 0.25 + mealScore * 0.10 + fiberScore * 0.15 + micro.compositeScore * 0.20);
  } else {
    score = Math.round(calScore * 0.40 + protScore * 0.35 + mealScore * 0.15 + fiberScore * 0.10);
  }

  const sugarPenalty  = sugar  > 75 ? 12 : sugar  > 50 ? 7 : sugar  > 25 ? 3 : 0;
  const sodiumPenalty = sodium > 3500 ? 12 : sodium > 2500 ? 7 : sodium > 2000 ? 3 : 0;
  score = Math.max(0, score - Math.min(20, sugarPenalty + sodiumPenalty));

  return {
    score, hasData: true,
    data: {
      calories: Math.round(totalCal), calorieGoal: calGoal,
      proteinG: Math.round(protein * 10) / 10, proteinGoalG: proteinGoal,
      carbsG: Math.round(carbs * 10) / 10, fatG: Math.round(fat * 10) / 10,
      fiberG: Math.round(fiber * 10) / 10, fiberGoalG: fiberGoal,
      sugarG: Math.round(sugar * 10) / 10, sodiumMg: Math.round(sodium),
      meals, mealGoal: 3, hasData: true, micronutrients: micro,
    },
  };
}

function scoreWater(
  mlConsumed: number, glasses: number, gender: string,
  activityLevel: string, prefGoalGlasses: number | null,
): { score: number | null; mlGoal: number; hasData: boolean; data: DailyHealthScore["water"] } {
  const hasData = glasses > 0 || mlConsumed > 0;
  let mlGoal = gender === "female" ? 2000 : 2500;
  if (prefGoalGlasses && prefGoalGlasses > 0) mlGoal = prefGoalGlasses * 250;
  else if (["very", "very_active", "athlete"].includes(activityLevel)) mlGoal += 500;
  else if (["moderate", "moderately_active"].includes(activityLevel))   mlGoal += 250;

  const actual = mlConsumed > 0 ? mlConsumed : glasses * 250;
  const score  = hasData ? Math.min(100, Math.round((actual / mlGoal) * 100)) : null;
  return { score, mlGoal, hasData, data: { mlConsumed: Math.round(actual), mlGoal, glasses, hasData } };
}

function scoreMedicine(taken: number, scheduled: number): {
  score: number | null; hasData: boolean; data: DailyHealthScore["medicine"];
} {
  // No scheduled medicines → not counted (undefined, not "healthy")
  const hasData = scheduled > 0;
  const score   = hasData ? Math.min(100, Math.round((taken / scheduled) * 100)) : null;
  return { score, hasData, data: { taken, scheduled, hasData } };
}

// FIXED: No fallback score when no sleep data
function scoreSleep(hoursLogged: number | null, quality: string | null, isLogged: boolean): {
  score: number | null; isOptimal: boolean;
} {
  if (!isLogged || !hoursLogged || hoursLogged <= 0) {
    return { score: null, isOptimal: false }; // Not logged → not counted
  }
  let base: number, optimal = false;
  if      (hoursLogged >= 7 && hoursLogged <= 9)  { base = 100; optimal = true; }
  else if (hoursLogged >  9 && hoursLogged <= 10) { base = 80; }
  else if (hoursLogged >= 6 && hoursLogged <  7)  { base = 75; }
  else if (hoursLogged >= 5 && hoursLogged <  6)  { base = 45; }
  else if (hoursLogged >  10)                     { base = 60; }
  else                                            { base = 20; }
  const adj: Record<string, number> = { excellent: +5, good: 0, fair: -8, poor: -15 };
  const qa = quality ? (adj[quality.toLowerCase()] ?? 0) : 0;
  return { score: Math.min(100, Math.max(0, base + qa)), isOptimal: optimal };
}

// FIXED: No fallback score when no stress data
function scoreStress(rawStress: number | null): { score: number | null } {
  if (rawStress === null) return { score: null }; // Not logged → not counted
  let base: number;
  if      (rawStress <= 20) base = 100;
  else if (rawStress <= 40) base = 82;
  else if (rawStress <= 60) base = 62;
  else if (rawStress <= 80) base = 38;
  else                       base = 18;
  return { score: base };
}

// FIXED: No fallback score when BMI unknown
function scoreBMI(bmi: number | null): {
  score: number | null; category: string; value: number | null; hasData: boolean;
} {
  if (!bmi || bmi <= 0) return { score: null, category: "Unknown", value: null, hasData: false };
  let category = "Normal", score = 100;
  if      (bmi < 16)    { category = "Severely Underweight"; score = 20; }
  else if (bmi < 17)    { category = "Moderately Underweight"; score = 35; }
  else if (bmi < 18.5)  { category = "Mild Underweight"; score = 65; }
  else if (bmi <= 22.9) { category = "Normal"; score = 100; }
  else if (bmi <= 24.9) { category = "Normal-High"; score = 90; }
  else if (bmi <= 27.4) { category = "Overweight"; score = 65; }
  else if (bmi <= 30)   { category = "Obese Class I"; score = 45; }
  else if (bmi <= 35)   { category = "Obese Class II"; score = 25; }
  else                  { category = "Obese Class III"; score = 10; }
  return { score, category, value: Math.round(bmi * 10) / 10, hasData: true };
}

// Steps score — WHO: 10,000 steps/day
function scoreSteps(steps: number | null): number | null {
  if (steps === null || steps <= 0) return null;
  return Math.min(100, Math.round((steps / 10000) * 100));
}

// Heart rate score — resting HR 60–100 bpm normal
function scoreHeartRate(hrAvg: number | null): number | null {
  if (hrAvg === null || hrAvg <= 0) return null;
  if (hrAvg >= 60 && hrAvg <= 100) return 100;
  if (hrAvg >= 50 && hrAvg < 60)   return 75;  // Athletic bradycardia
  if (hrAvg > 100 && hrAvg <= 110) return 65;  // Mild tachycardia
  if (hrAvg > 110 && hrAvg <= 120) return 40;
  if (hrAvg > 120)                 return 20;
  return 50; // Very low (<50)
}

// SpO2 score — normal ≥95%
function scoreSpo2(spo2: number | null): number | null {
  if (spo2 === null || spo2 <= 0) return null;
  if (spo2 >= 95) return 100;
  if (spo2 >= 92) return 65;
  if (spo2 >= 88) return 30;
  return 10; // <88 = severe hypoxia
}

// Blood pressure — AHA/ACC 2017 categories. Uses the day's latest reading
// (a user checking BP morning+evening isn't "worse" for having 2 readings —
// same "latest snapshot" approach already used for wearable steps/HR/SpO2).
function scoreBloodPressure(systolic: number | null, diastolic: number | null): { score: number | null; category: string } {
  if (systolic === null || diastolic === null || systolic <= 0 || diastolic <= 0) {
    return { score: null, category: "Unknown" };
  }
  if (systolic < 90 || diastolic < 60) return { score: 55, category: "Low (Hypotension)" };
  if (systolic < 120 && diastolic < 80) return { score: 100, category: "Normal" };
  if (systolic < 130 && diastolic < 80) return { score: 85, category: "Elevated" };
  if (systolic < 140 || diastolic < 90) return { score: 60, category: "Hypertension Stage 1" };
  if (systolic < 180 && diastolic < 120) return { score: 35, category: "Hypertension Stage 2" };
  return { score: 5, category: "Hypertensive Crisis" };
}

// Blood sugar — ADA guideline ranges, split by whether the reading was
// fasting/bedtime (stricter normal range) or post-meal/random (higher
// normal ceiling, since blood sugar naturally rises after eating).
function scoreBloodSugar(glucoseMgDl: number | null, context: string | null): { score: number | null; category: string } {
  if (glucoseMgDl === null || glucoseMgDl <= 0) return { score: null, category: "Unknown" };
  if (glucoseMgDl < 70) return { score: 40, category: "Low (Hypoglycemia)" };
  const isFasting = context === "fasting" || context === "bedtime";
  if (isFasting) {
    if (glucoseMgDl <= 99)  return { score: 100, category: "Normal (fasting)" };
    if (glucoseMgDl <= 125) return { score: 60,  category: "Prediabetic range (fasting)" };
    return { score: 25, category: "Diabetic range (fasting)" };
  }
  if (glucoseMgDl < 140) return { score: 100, category: "Normal" };
  if (glucoseMgDl < 200) return { score: 60,  category: "Prediabetic range" };
  return { score: 25, category: "Diabetic range" };
}

function calcMicronutrientScore(
  calcium: number, iron: number, vitC: number, b12: number, vitD: number,
  hasData: boolean, targets: ReturnType<typeof calcMicroTargets>,
): DailyHealthScore["food"]["micronutrients"] {
  const s = (a: number, g: number) => g > 0 ? Math.min(100, Math.round((a / g) * 100)) : 0;
  const cs = s(calcium, targets.calciumMg);
  const is = s(iron, targets.ironMg);
  const vcs = s(vitC, targets.vitaminCMg);
  const b12s = s(b12, targets.vitaminB12Mcg);
  const vds = s(vitD, targets.vitaminDMcg);
  const composite = hasData ? Math.round(is * 0.30 + cs * 0.25 + b12s * 0.20 + vcs * 0.15 + vds * 0.10) : 0;
  return {
    dataAvailable: hasData, compositeScore: composite,
    calcium:    { mg: Math.round(calcium * 10) / 10,  goalMg: targets.calciumMg,    score: cs },
    iron:       { mg: Math.round(iron * 10) / 10,      goalMg: targets.ironMg,       score: is },
    vitaminC:   { mg: Math.round(vitC * 10) / 10,      goalMg: targets.vitaminCMg,   score: vcs },
    vitaminB12: { mcg: Math.round(b12 * 100) / 100,    goalMcg: targets.vitaminB12Mcg, score: b12s },
    vitaminD:   { mcg: Math.round(vitD * 10) / 10,     goalMcg: targets.vitaminDMcg,  score: vds },
  };
}

// ─── Composite Score — TRUE Dynamic Weighting ────────────────────────────────
// ONLY metrics with real data today are included.
// Weights are normalized among active metrics so total always = 100%.
// No hardcoded defaults, no fake scores.
const METRIC_WEIGHTS: Record<string, number> = {
  food:          0.19,  // ICMR nutrition — highest weight
  exercise:      0.15,  // WHO physical activity
  water:         0.10,  // WHO hydration
  medicine:      0.12,  // WHO adherence
  sleep:         0.12,  // CDC/WHO sleep
  stress:        0.08,  // Mental health
  bmi:           0.08,  // Body composition
  steps:         0.04,  // Physical activity proxy
  heartRate:     0.03,  // Cardiovascular
  spo2:          0.03,  // Respiratory
  bloodPressure: 0.03,  // AHA/ACC — occasional/manual metric like heartRate/spo2
  bloodSugar:    0.03,  // ADA — occasional/manual metric like heartRate/spo2
};

function buildCompositeScore(
  scores: Record<string, number | null>,
): { overallScore: number; activeMetrics: string[]; excludedMetrics: string[] } {
  const active: string[] = [];
  const excluded: string[] = [];
  let weightSum = 0;
  let scoreAcc  = 0;

  for (const [metric, score] of Object.entries(scores)) {
    if (score !== null && score !== undefined) {
      const w = METRIC_WEIGHTS[metric] ?? 0;
      weightSum += w;
      scoreAcc  += score * w;
      active.push(metric);
    } else {
      excluded.push(metric);
    }
  }

  // Normalize: divide by actual weight sum so excluded metrics don't deflate score
  const overallScore = weightSum > 0 ? Math.round(scoreAcc / weightSum) : 0;
  return { overallScore, activeMetrics: active, excludedMetrics: excluded };
}

// ─── Main Engine ──────────────────────────────────────────────────────────────
/** Optional per-request memo for the queries whose answer does not depend on
 *  `date`. Scoring one day runs 17 queries, six of which — medicine schedules,
 *  preferences, profile (twice), goals and conditions — return the same rows
 *  for every date. A 30-day report therefore re-ran those six 30 times over.
 *
 *  Passing a Map shared across the days of one request collapses them to six
 *  in total. Omit it and every query runs exactly as before, so the
 *  single-day path is untouched. Scoped to one request and then discarded —
 *  this is NOT a cache across requests, so it can never serve stale data. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- matches the
// untyped pool.query() rows the rest of this file already works with.
export type ScoreQueryMemo = Map<string, Promise<{ rows: any[] }>>;

export async function computeScientificScore(
  userId: string,
  date: string,
  memo?: ScoreQueryMemo,
): Promise<DailyHealthScore> {
  const { dayStart, dayEnd } = istDayBounds(date);

  // Runs a user-scoped (date-independent) query, through the memo when one
  // was supplied. The key is the caller-chosen tag; every such query is
  // parameterised by userId alone, which is fixed for the whole memo.
  // The memo is keyed by a fixed tag per call site, so a hit always has the
  // shape that call site stored. TypeScript cannot see that through the Map,
  // hence the cast; the keys are literals below, not caller input.
  const userScoped = <T extends { rows: any[] }>(key: string, run: () => Promise<T>): Promise<T> => {
    if (!memo) return run();
    const hit = memo.get(key) as Promise<T> | undefined;
    if (hit) return hit;
    const p = run();
    memo.set(key, p);
    return p;
  };

  // ── Fetch all data in parallel ──────────────────────────────────────────────
  const [
    foodBasicR, exBasicR, waterR, medSchedR, medTakenR,
    prefsR, profileBasicR, goalsR, conditionsR, sleepR, stressR,
  ] = await Promise.all([
    pool.query(
      `SELECT COALESCE(SUM(calories::numeric),0) AS total_cal,
              COALESCE(SUM(protein_g::numeric),0) AS total_protein,
              COALESCE(SUM(carbs_g::numeric),0) AS total_carbs,
              COALESCE(SUM(fat_g::numeric),0) AS total_fat,
              COALESCE(SUM(fiber_g::numeric),0) AS total_fiber,
              COALESCE(SUM(sugar_g::numeric),0) AS total_sugar,
              COALESCE(SUM(sodium_mg::numeric),0) AS total_sodium,
              COUNT(*) AS meal_count
       FROM food_logs WHERE user_id=$1 AND logged_at>=$2 AND logged_at<=$3`,
      [userId, dayStart, dayEnd],
    ).catch(() => ({ rows: [{ total_cal: "0", total_protein: "0", total_carbs: "0", total_fat: "0", total_fiber: "0", total_sugar: "0", total_sodium: "0", meal_count: "0" }] })),

    pool.query(
      `SELECT COALESCE(SUM(duration_minutes),0) AS total_duration,
              COALESCE(SUM(calories_burned::numeric),0) AS total_calories,
              COUNT(*) AS sessions
       FROM exercise_logs WHERE user_id=$1 AND logged_at>=$2 AND logged_at<=$3`,
      [userId, dayStart, dayEnd],
    ).catch(() => ({ rows: [{ total_duration: "0", total_calories: "0", sessions: "0" }] })),

    pool.query(
      `SELECT COALESCE(SUM(ml_amount),0) AS total_ml,
              COALESCE(SUM(glasses_count),0) AS total_glasses
       FROM water_logs WHERE user_id=$1 AND logged_at>=$2 AND logged_at<=$3`,
      [userId, dayStart, dayEnd],
    ).catch(() => ({ rows: [{ total_ml: "0", total_glasses: "0" }] })),

    userScoped("medSched", () => pool.query(
      `SELECT COUNT(*) FROM medicine_schedules WHERE user_id=$1 AND is_active=true`,
      [userId],
    ).catch(() => ({ rows: [{ count: "0" }] }))),

    pool.query(
      `SELECT COUNT(*) FROM medicine_logs
       WHERE user_id=$1 AND status='taken' AND scheduled_at>=$2 AND scheduled_at<=$3`,
      [userId, dayStart, dayEnd],
    ).catch(() => ({ rows: [{ count: "0" }] })),

    userScoped("prefs", () => pool.query(
      `SELECT water_goal_glasses, calorie_goal FROM user_preferences WHERE user_id=$1`,
      [userId],
    ).catch(() => ({ rows: [{}] }))),

    userScoped("profileBasic", () => pool.query(
      `SELECT weight_kg, gender, bmi,
              current_health_streak, longest_health_streak,
              rolling_7_day_score, rolling_30_day_score, biological_age
       FROM user_profiles WHERE user_id=$1`,
      [userId],
    ).catch(() => ({ rows: [{}] }))),

    userScoped("goals", () => pool.query(
      `SELECT primary_goal FROM user_health_goals WHERE user_id=$1 LIMIT 1`,
      [userId],
    ).catch(() => ({ rows: [{ primary_goal: "general_wellness" }] }))),

    userScoped("conditions", () => pool.query(
      `SELECT condition FROM user_medical_conditions WHERE user_id=$1 AND is_active=true`,
      [userId],
    ).catch(() => ({ rows: [] }))),

    // Sleep: ONLY from sleep_logs for today — NO profile average fallback
    pool.query(
      `SELECT SUM(sleep_hours) AS sleep_hours, MAX(quality) AS quality
       FROM sleep_logs WHERE user_id=$1 AND sleep_date=$2`,
      [userId, date],
    ).catch(() => ({ rows: [] })),

    pool.query(
      `SELECT stress_score, mood FROM stress_logs
       WHERE user_id=$1 AND logged_at>=$2 AND logged_at<=$3
       ORDER BY logged_at DESC LIMIT 1`,
      [userId, dayStart, dayEnd],
    ).catch(() => ({ rows: [] })),
  ]);

  // ── Optional columns — silently degrade if not yet migrated ─────────────────
  const [profileExtR, exMetR, foodMicroR, wearableR, bpR, sugarR] = await Promise.all([
    userScoped("profileExt", () => pool.query(
      `SELECT height_cm, date_of_birth, activity_level, work_profile FROM user_profiles WHERE user_id=$1`,
      [userId],
    ).catch(() => ({ rows: [{}] }))),

    pool.query(
      `SELECT COALESCE(SUM(met_value::numeric * duration_minutes), 0) AS met_minutes
       FROM exercise_logs WHERE user_id=$1 AND logged_at>=$2 AND logged_at<=$3`,
      [userId, dayStart, dayEnd],
    ).catch(() => ({ rows: [{ met_minutes: "0" }] })),

    pool.query(
      `SELECT COALESCE(SUM(calcium_mg::numeric),0) AS total_calcium,
              COALESCE(SUM(iron_mg::numeric),0) AS total_iron,
              COALESCE(SUM(vitamin_c_mg::numeric),0) AS total_vitamin_c,
              COALESCE(SUM(vitamin_b12_mcg::numeric),0) AS total_b12,
              COALESCE(SUM(vitamin_d_mcg::numeric),0) AS total_vitamin_d,
              COUNT(CASE WHEN calcium_mg::numeric > 0 OR iron_mg::numeric > 0
                              OR vitamin_c_mg::numeric > 0 OR vitamin_b12_mcg::numeric > 0
                              OR vitamin_d_mcg::numeric > 0 THEN 1 END) AS micro_logged_count
       FROM food_logs WHERE user_id=$1 AND logged_at>=$2 AND logged_at<=$3`,
      [userId, dayStart, dayEnd],
    ).catch(() => ({ rows: [{ total_calcium: "0", total_iron: "0", total_vitamin_c: "0", total_b12: "0", total_vitamin_d: "0", micro_logged_count: "0" }] })),

    // Wearable data: steps, heart rate, blood oxygen synced today
    pool.query(
      `SELECT steps, heart_rate_avg, heart_rate_min, heart_rate_max, blood_oxygen
       FROM wearable_data
       WHERE user_id=$1 AND synced_at>=$2 AND synced_at<=$3
       ORDER BY synced_at DESC LIMIT 1`,
      [userId, dayStart, dayEnd],
    ).catch(() => ({ rows: [] })),

    // Blood pressure — latest reading today (manual or synced)
    pool.query(
      `SELECT systolic, diastolic, pulse FROM blood_pressure_logs
       WHERE user_id=$1 AND measured_at>=$2 AND measured_at<=$3
       ORDER BY measured_at DESC LIMIT 1`,
      [userId, dayStart, dayEnd],
    ).catch(() => ({ rows: [] })),

    // Blood sugar — latest reading today
    pool.query(
      `SELECT glucose_mg_dl, reading_context FROM blood_sugar_logs
       WHERE user_id=$1 AND measured_at>=$2 AND measured_at<=$3
       ORDER BY measured_at DESC LIMIT 1`,
      [userId, dayStart, dayEnd],
    ).catch(() => ({ rows: [] })),
  ]);

  // ── Parse ────────────────────────────────────────────────────────────────────
  const f = foodBasicR.rows[0] ?? {};
  const totalCalories = parseFloat(f.total_cal     || "0");
  const totalProtein  = parseFloat(f.total_protein  || "0");
  const totalCarbs    = parseFloat(f.total_carbs    || "0");
  const totalFat      = parseFloat(f.total_fat      || "0");
  const totalFiber    = parseFloat(f.total_fiber    || "0");
  const totalSugar    = parseFloat(f.total_sugar    || "0");
  const totalSodium   = parseFloat(f.total_sodium   || "0");
  const mealCount     = parseInt(f.meal_count       || "0");

  const fm = foodMicroR.rows[0] ?? {};
  const totalCalcium = parseFloat(fm.total_calcium   || "0");
  const totalIron    = parseFloat(fm.total_iron      || "0");
  const totalVitC    = parseFloat(fm.total_vitamin_c || "0");
  const totalB12     = parseFloat(fm.total_b12       || "0");
  const totalVitD    = parseFloat(fm.total_vitamin_d || "0");
  const hasMicroData = parseInt(fm.micro_logged_count || "0") > 0;

  const ex = exBasicR.rows[0] ?? {};
  const metMinutes = parseFloat(exMetR.rows[0]?.met_minutes  || "0");
  const exDuration = parseInt(ex.total_duration              || "0");
  const exCalories = parseFloat(ex.total_calories            || "0");
  const exSessions = parseInt(ex.sessions                    || "0");

  const w = waterR.rows[0] ?? {};
  const totalMl     = parseInt(w.total_ml      || "0");
  const totalGlasses = parseInt(w.total_glasses || "0");

  const medScheduled = parseInt(medSchedR.rows[0]?.count || "0");
  const medTaken     = parseInt(medTakenR.rows[0]?.count  || "0");

  const pref = prefsR.rows[0] ?? {};
  const prefCalGoal      = parseInt(pref.calorie_goal       || "2000");
  const prefWaterGlasses = parseInt(pref.water_goal_glasses || "0") || null;

  const profile = { ...(profileBasicR.rows[0] ?? {}), ...(profileExtR.rows[0] ?? {}) };
  // No fake weight default — a fabricated weight would silently produce a
  // fabricated BMI (marked hasData:true) and skew BMR/TDEE/calorie/protein
  // goals, contradicting this module's own "no fake defaults" principle
  // above. calcBMRandTDEE() already treats a falsy weightKg as "no data"
  // (returns null), and the freshBmi computation below already requires
  // weightKg > 0, so leaving this at 0 when unset correctly excludes BMI
  // from the composite instead of scoring a fictitious value.
  const weightKg     = parseFloat(profile.weight_kg    || "0");
  const heightCm     = parseFloat(profile.height_cm    || "0");
  const gender       = profile.gender       || "other";
  const activityLevel = profile.activity_level || "moderate";
  const workProfile  = profile.work_profile   || null;
  const dateOfBirth  = profile.date_of_birth  || null;

  // BMI: always compute fresh from current weight + height
  const heightM  = heightCm / 100;
  const freshBmi = (weightKg > 0 && heightM > 0)
    ? parseFloat((weightKg / (heightM * heightM)).toFixed(1))
    : parseFloat(profile.bmi || "0");

  // Sleep: ONLY from today's sleep_log — no profile average
  const sleepRow    = sleepR.rows[0] ?? null;
  const sleepHours  = sleepRow ? parseFloat(sleepRow.sleep_hours || "0") : null;
  const sleepQuality = sleepRow?.quality || null;
  const sleepLogged  = !!(sleepRow && sleepHours && sleepHours > 0);

  // Stress: only from today
  const stressRow    = stressR.rows[0] ?? null;
  const rawStress    = stressRow?.stress_score != null ? Number(stressRow.stress_score) : null;
  const stressMood   = stressRow?.mood || null;
  const stressLogged = !!stressRow;

  // Wearable
  const wr          = wearableR.rows[0] ?? null;
  const wSteps      = wr?.steps        ? parseInt(wr.steps)             : null;
  const wHrAvg      = wr?.heart_rate_avg ? parseFloat(wr.heart_rate_avg) : null;
  const wHrMin      = wr?.heart_rate_min ? parseFloat(wr.heart_rate_min) : null;
  const wHrMax      = wr?.heart_rate_max ? parseFloat(wr.heart_rate_max) : null;
  const wSpo2       = wr?.blood_oxygen   ? parseFloat(wr.blood_oxygen)   : null;

  // Blood pressure / blood sugar — today's latest manual/synced reading
  const bpRow       = bpR.rows[0] ?? null;
  const bpSystolic  = bpRow?.systolic  ? parseInt(bpRow.systolic)  : null;
  const bpDiastolic = bpRow?.diastolic ? parseInt(bpRow.diastolic) : null;
  const bpPulse     = bpRow?.pulse     ? parseInt(bpRow.pulse)     : null;
  const sugarRow    = sugarR.rows[0] ?? null;
  const glucoseMgDl = sugarRow?.glucose_mg_dl ? parseInt(sugarRow.glucose_mg_dl) : null;
  const sugarContext = sugarRow?.reading_context || null;

  const primaryGoal  = goalsR.rows[0]?.primary_goal || "general_wellness";
  const conditions: string[] = (conditionsR.rows || []).map((r: any) => String(r.condition || ""));
  const age          = calcAge(dateOfBirth);
  const bmrTdee      = calcBMRandTDEE(weightKg, heightCm, age ?? 30, gender, activityLevel, workProfile);
  const { goal: calGoal, source: goalSource } = calcPersonalisedCalorieGoal(bmrTdee?.tdee ?? null, primaryGoal, prefCalGoal);
  const { goalG: proteinGoal, basis: proteinBasis } = calcProteinGoal(weightKg, age, primaryGoal);
  const fiberGoalG   = calcFiberGoal(conditions);
  const microTargets = calcMicroTargets(gender, age, conditions);

  // ── Score each metric ────────────────────────────────────────────────────────
  const microScore   = calcMicronutrientScore(totalCalcium, totalIron, totalVitC, totalB12, totalVitD, hasMicroData, microTargets);
  const foodResult   = scoreFood(totalCalories, calGoal, totalProtein, proteinGoal, totalFiber, fiberGoalG, mealCount, totalCarbs, totalFat, totalSugar, totalSodium, microScore);
  const exResult     = scoreExercise(metMinutes, exDuration, exCalories, exSessions);
  const waterResult  = scoreWater(totalMl, totalGlasses, gender, activityLevel, prefWaterGlasses);
  const medResult    = scoreMedicine(medTaken, medScheduled);
  const sleepResult  = scoreSleep(sleepHours, sleepQuality, sleepLogged);
  const stressResult = scoreStress(rawStress);
  const bmiResult    = scoreBMI(freshBmi > 0 ? freshBmi : null);
  const stepsResult  = scoreSteps(wSteps);
  const hrResult     = scoreHeartRate(wHrAvg);
  const spo2Result   = scoreSpo2(wSpo2);
  const bpResult     = scoreBloodPressure(bpSystolic, bpDiastolic);
  const sugarResult  = scoreBloodSugar(glucoseMgDl, sugarContext);

  // BMI reflects the profile, not today's activity — it must never be the
  // metric that carries a day's score on its own. Only let it into the
  // composite when at least one real activity metric was also logged today,
  // otherwise a day with zero logging can score 100 purely off a healthy
  // BMI on file (BMI becomes the sole active metric, so its weight gets
  // renormalized to 100% of the composite) — the exact kind of fake score
  // this module's "no fake defaults" design is meant to prevent.
  const hasAnyDailyActivity = [
    foodResult.score, exResult.score, waterResult.score, medResult.score,
    sleepResult.score, stressResult.score, stepsResult, hrResult, spo2Result,
    bpResult.score, sugarResult.score,
  ].some((s) => s !== null);

  // ── Composite: only metrics with real data ───────────────────────────────────
  const { overallScore, activeMetrics, excludedMetrics } = buildCompositeScore({
    food:          foodResult.score,
    exercise:      exResult.score,
    water:         waterResult.score,
    medicine:      medResult.score,
    sleep:         sleepResult.score,
    stress:        stressResult.score,
    bmi:           hasAnyDailyActivity ? bmiResult.score : null,
    steps:         stepsResult,
    heartRate:     hrResult,
    spo2:          spo2Result,
    bloodPressure: bpResult.score,
    bloodSugar:    sugarResult.score,
  });

  const dataConfidence = Math.round(
    (activeMetrics.length / Object.keys(METRIC_WEIGHTS).length) * 100
  );

  const { grade, gradeLabel } = gradeFromScore(overallScore);

  // ── Persist ──────────────────────────────────────────────────────────────────
  await pool.query(
    `INSERT INTO daily_health_scores
      (user_id, score_date, health_score, data_confidence_pct,
       food_score, exercise_score, water_score, medicine_score,
       sleep_score, stress_score,
       total_calories_in, water_glasses, exercise_minutes,
       fields_logged, total_possible_fields)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     ON CONFLICT (user_id, score_date) DO UPDATE SET
       health_score=$3, data_confidence_pct=$4,
       food_score=$5, exercise_score=$6, water_score=$7, medicine_score=$8,
       sleep_score=$9, stress_score=$10,
       total_calories_in=$11, water_glasses=$12, exercise_minutes=$13, fields_logged=$14,
       total_possible_fields=$15`,
    [
      userId, date, overallScore, String(dataConfidence),
      foodResult.score ?? 0, exResult.score ?? 0,
      waterResult.score ?? 0, medResult.score ?? 0,
      sleepResult.score ?? 0, stressResult.score ?? 0,
      String(Math.round(totalCalories)), totalGlasses, exDuration,
      activeMetrics.length, Object.keys(METRIC_WEIGHTS).length,
    ],
  ).catch(() => {});

  // updateHealthTrends recomputes the user's streaks and rolling averages
  // from scratch and ignores `date`, so scoring a 30-day range fired 30
  // identical recomputes. It is user-scoped like the queries above, so the
  // same memo gates it to once per request; with no memo it fires as before.
  if (!memo || !memo.has("__trendsFired")) {
    memo?.set("__trendsFired", Promise.resolve({ rows: [] }));
    import("./health-trends.js").then(m => m.updateHealthTrends(userId)).catch(() => {});
  }

  return {
    overallScore, grade, gradeLabel, dataConfidence,
    exerciseScore:  exResult.score,
    foodScore:      foodResult.score,
    waterScore:     waterResult.score,
    medicineScore:  medResult.score,
    sleepScore:     sleepResult.score,
    stressScore:    stressResult.score,
    bmiScore:       bmiResult.score,
    stepsScore:     stepsResult,
    heartRateScore: hrResult,
    spo2Score:      spo2Result,
    bloodPressureScore: bpResult.score,
    bloodSugarScore:    sugarResult.score,
    exercise: exResult.data,
    food:     foodResult.data,
    water:    waterResult.data,
    medicine: medResult.data,
    sleep: {
      hoursLogged: sleepHours,
      isOptimal:   sleepResult.isOptimal,
      quality:     sleepQuality,
      isLogged:    sleepLogged,
    },
    stress: {
      stressScore: rawStress,
      mood:        stressMood,
      isLogged:    stressLogged,
    },
    bmi: { value: bmiResult.value, category: bmiResult.category, hasData: bmiResult.hasData },
    wearable: {
      steps:        wSteps,     stepsGoal: 10000,
      heartRateAvg: wHrAvg,    heartRateMin: wHrMin, heartRateMax: wHrMax,
      bloodOxygen:  wSpo2,
      hasSteps:     wSteps !== null,
      hasHeartRate: wHrAvg !== null,
      hasSpo2:      wSpo2  !== null,
    },
    bloodPressure: {
      systolic: bpSystolic, diastolic: bpDiastolic, pulse: bpPulse,
      category: bpResult.category, hasData: bpResult.score !== null,
    },
    bloodSugar: {
      glucoseMgDl, readingContext: sugarContext,
      category: sugarResult.category, hasData: sugarResult.score !== null,
    },
    activeMetrics,
    excludedMetrics,
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
      exerciseBasis:  "WHO 2020: ≥600 MET-min/week (85.7/day); MET × duration per session",
      foodBasis:      hasMicroData
        ? `ICMR 2024: Calories 30% + Protein 25% + Fiber 15% + Micronutrients 20% + Meals 10%; sugar/sodium penalty (WHO)`
        : `ICMR 2024: Calories 40% + Protein 35% + Meals 15% + Fiber 10%; sugar/sodium penalty (WHO)`,
      waterBasis:     prefWaterGlasses
        ? `User goal: ${prefWaterGlasses} glasses/day`
        : `WHO/ICMR: ${gender === "female" ? "2000ml" : "2500ml"}/day + activity adjustment`,
      medicineBasis:  "WHO Adherence 2003: doses taken ÷ doses scheduled",
      sleepBasis:     "CDC/WHO: 7–9h optimal; quality-adjusted (±5 to -15); only scored when logged today",
      stressBasis:    "Stress score inverted (lower = healthier); only scored when logged today",
      compositeBasis: `Dynamic weighting — only logged metrics included. Active today: ${activeMetrics.join(", ") || "none"}`,
    },
  };
}

// ─── Quick summary for scorecard ─────────────────────────────────────────────
export async function computeActivePercent(userId: string, date?: string): Promise<{
  overall: number; foodPct: number; waterPct: number; exercisePct: number; medicinePct: number;
  sleepPct: number | null; stressPct: number | null; bmiScore: number | null;
  stepsScore: number | null; heartRateScore: number | null; spo2Score: number | null;
  grade: string; gradeLabel: string; dataConfidence: number;
  activeMetrics: string[]; excludedMetrics: string[];
  breakdown: { food: number; water: number; exerciseMetMin: number; medicine: number; sleepHours: number | null; stressScore: number | null; steps: number | null; heartRateAvg: number | null; bloodOxygen: number | null };
  personalisation?: DailyHealthScore["personalisation"];
}> {
  try {
    const d     = date || new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const score = await computeScientificScore(userId, d);
    return {
      overall:        score.overallScore,
      foodPct:        score.foodScore     ?? 0,
      waterPct:       score.waterScore    ?? 0,
      exercisePct:    score.exerciseScore ?? 0,
      medicinePct:    score.medicineScore ?? 0,
      sleepPct:       score.sleepScore,
      stressPct:      score.stressScore,
      bmiScore:       score.bmiScore,
      stepsScore:     score.stepsScore,
      heartRateScore: score.heartRateScore,
      spo2Score:      score.spo2Score,
      grade:          score.grade,
      gradeLabel:     score.gradeLabel,
      dataConfidence: score.dataConfidence,
      activeMetrics:  score.activeMetrics,
      excludedMetrics: score.excludedMetrics,
      breakdown: {
        food:           score.food.meals,
        water:          score.water.glasses,
        exerciseMetMin: score.exercise.metMinutesToday,
        medicine:       score.medicine.taken,
        sleepHours:     score.sleep.hoursLogged,
        stressScore:    score.stress.stressScore,
        steps:          score.wearable.steps,
        heartRateAvg:   score.wearable.heartRateAvg,
        bloodOxygen:    score.wearable.bloodOxygen,
      },
      personalisation: score.personalisation,
    };
  } catch {
    return {
      overall: 0, foodPct: 0, waterPct: 0, exercisePct: 0, medicinePct: 0,
      sleepPct: null, stressPct: null, bmiScore: null,
      stepsScore: null, heartRateScore: null, spo2Score: null,
      grade: "F", gradeLabel: "No Data Yet", dataConfidence: 0,
      activeMetrics: [], excludedMetrics: Object.keys(METRIC_WEIGHTS),
      breakdown: { food: 0, water: 0, exerciseMetMin: 0, medicine: 0, sleepHours: null, stressScore: null, steps: null, heartRateAvg: null, bloodOxygen: null },
    };
  }
}