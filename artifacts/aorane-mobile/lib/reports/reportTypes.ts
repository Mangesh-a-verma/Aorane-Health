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

export type ScoreData = {
  // FIX: "todayScore" removed — report now shows only period average
  periodAvgScore: number;   // 7-day avg for weekly, 30-day avg for monthly
  activePercent: number;    // Period-computed active % (not today's scorecard)
  foodPct: number;          // Period-computed
  waterPct: number;         // Period-computed
  exercisePct: number;      // Period-computed
  sleepPct: number;         // Period-computed (new)
  stressPct: number;        // Period-computed (new — inverted: low stress = high %)
  medicinePct: number;
  streakDays: number;
};

export type RiskData = {
  hydrationRisk: "Low" | "Moderate" | "High";
  nutritionRisk: "Low" | "Moderate" | "High";
  stressRisk: "Low" | "Moderate" | "High";
  hydrationScore: number;   // 0-100
  nutritionScore: number;
  stressScore: number;
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
};