export type ReportType = "weekly" | "monthly";

export type UserProfile = {
  name: string;
  aoraneId: string;
  age: number | null;
  gender: string;
  height_cm: number | null;
  weight_kg: number | null;
  bmi: string | null;
  bmiCategory: string | null;
  bloodGroup: string;
  plan: string;
  memberSince: string;
  city: string | null;
  state: string | null;
  conditions: string | null; // Any known disease / medical condition
};

/** A pillar's period score.
 *
 *  `pct` is the average of the SERVER's per-day sub-score for that pillar
 *  (foodScore/waterScore/exerciseScore/sleepScore from GET /health/score/:date),
 *  which grades QUALITY — 7-9h of sleep scores well, 4h does not.
 *
 *  It used to be `days the user logged anything / days in period`, which is
 *  a tracking-consistency number wearing a health label: log a meal every
 *  day and Nutrition read 100/100 no matter what was eaten, and log four
 *  hours of sleep every night and Sleep read 100/100 "healthy".
 *
 *  `pct` is null when the pillar was never logged in the period. Null is NOT
 *  zero: "no data" and "did badly" are different facts and a health report
 *  must not present one as the other. `days` says how many days the average
 *  actually covers, so the report can show its own coverage honestly. */
export type PillarScore = {
  pct: number | null;
  days: number;
};

export type ScoreData = {
  // FIX: "todayScore" removed — report now shows only period average
  periodAvgScore: number;   // 7-day avg for weekly, 30-day avg for monthly
  activePercent: number;    // Period-computed active % (not today's scorecard)
  food: PillarScore;        // Quality score from the server, period-averaged
  water: PillarScore;
  exercise: PillarScore;
  sleep: PillarScore;
  stressPct: number;        // Period-computed (inverted: low stress = high %)
  medicinePct: number;
  streakDays: number;
  /** Days in the period with any logged pillar at all - the denominator the
   *  report cites when it says "averaged over N of M days". */
  daysWithAnyData: number;
};

/** "Unknown" is a real verdict, not a gap to be filled. The old shape had
 *  no way to say it, so every consumer defaulted to `|| "Low"` and a user
 *  who had never logged water was told their hydration risk was Low. */
export type RiskLevel = "Low" | "Moderate" | "High" | "Unknown";

export type RiskData = {
  hydrationRisk: RiskLevel;
  nutritionRisk: RiskLevel;
  stressRisk: RiskLevel;
  hydrationScore: number | null;   // 0-100, null = never logged
  nutritionScore: number | null;
  stressScore: number | null;
};

export type DayLog = {
  date: string;             // "2026-05-22"
  dayName: string;          // "Mon"
  healthScore: number;
  stressLevel: number;
  waterGlasses: number;
  caloriesIn: number;
  caloriesBurned: number;
  exerciseMinutes: number;
  sleepHours: number;       // NEW
  medicinesTaken: number;
  medicinesTotal: number;
};

export type NutritionData = {
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  calcium_mg: number;
  iron_mg: number;
  vitaminC_mg: number;
  vitaminB12_mcg: number;
  vitaminD_mcg: number;
  // Targets are now PERIOD-AWARE (multiplied by 7 or 30)
  targets: {
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    calcium_mg: number;
    iron_mg: number;
    vitaminC_mg: number;
    vitaminB12_mcg: number;
  };
};

export type GoalData = {
  goalType: string;
  targetWeight: number | null;
  currentWeight: number | null;
  targetCalories: number;
  currentAvgCalories: number;   // Period average
  progressPercent: number;
  daysToGoal: number | null;
  weeklyTrend: "improving" | "stable" | "declining";
};

export type WeatherData = {
  season: "summer" | "monsoon" | "winter" | "spring";
  city: string | null;
};

export type WearableVitals = {
  avgHeartRate: number | null;   // bpm, period average
  avgSpo2: number | null;        // %, period average
  totalActiveMinutes: number | null; // sum across the period
  windowDays: number;            // actual days the averages cover (may be less than periodDays if data is sparse)
};

export type ReportData = {
  generatedAt: Date;
  reportId: string;
  reportType: ReportType;
  dateFrom: Date;
  dateTo: Date;
  periodDays: number;           // 7 for weekly, 28-31 for monthly
  profile: UserProfile;
  scores: ScoreData;
  risks: RiskData;
  dailyLogs: DayLog[];
  nutrition: NutritionData;
  goals: GoalData;
  weather: WeatherData;
  companyName: string;
  primaryColor: string;
  accentColor: string;
  logoBase64?: string;          // Optional base64 logo for PDF header
  wearableVitals?: WearableVitals; // Optional — Health Connect period averages (undefined if never synced)
};