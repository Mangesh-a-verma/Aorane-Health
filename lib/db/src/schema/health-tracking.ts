import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  uuid,
  decimal,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { inputMethodEnum } from "./health-food";

export const exerciseIntensityEnum = pgEnum("exercise_intensity", ["light", "moderate", "intense"]);
export const medicineFrequencyEnum = pgEnum("medicine_frequency", ["daily", "alternate", "weekly", "custom"]);
export const medicineMealTimingEnum = pgEnum("medicine_meal_timing", ["before_meal", "after_meal", "with_meal", "anytime", "empty_stomach", "bedtime"]);
export const stressTypeEnum = pgEnum("stress_type", ["ppg", "mood", "five_pillar"]);
export const moodEnum = pgEnum("mood", ["happy", "neutral", "stressed", "sad"]);

export const exerciseLogsTable = pgTable("exercise_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  exerciseType: text("exercise_type").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  intensity: exerciseIntensityEnum("intensity").notNull().default("moderate"),
  sets: integer("sets"),
  reps: integer("reps"),
  steps: integer("steps"),
  caloriesBurned: decimal("calories_burned", { precision: 7, scale: 2 }),
  metValue: decimal("met_value", { precision: 4, scale: 2 }),
  inputMethod: inputMethodEnum("input_method").notNull().default("manual"),
  source: text("source").notNull().default("manual"),
  photoUrl: text("photo_url"),
  notes: text("notes"),
  isOfflineEntry: boolean("is_offline_entry").notNull().default(false),
  syncedAt: timestamp("synced_at", { withTimezone: true }),
  loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  // Every log-write in the app (food/water/exercise/medicine/sleep/stress)
  // triggers upsertDailyActivityScore(), which runs
  // `SELECT COUNT(*) FROM exercise_logs WHERE user_id=$1 AND logged_at>=$2 AND logged_at<=$3`
  // (lib/activityScore.ts) on every single call, plus the same shape of
  // query in lib/scoring.ts (dashboard score) and GET /health/exercise
  // (history view, ORDER BY logged_at DESC). No existing index covers
  // (user_id, logged_at) — only the primary key on id.
  userLoggedAtIdx: index("idx_exercise_logs_user_logged_at").on(t.userId, t.loggedAt),
}));

export const waterLogsTable = pgTable("water_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  glassesCount: integer("glasses_count").notNull().default(1),
  mlAmount: integer("ml_amount").notNull().default(250),
  drinkType: text("drink_type").notNull().default("water"),
  isOfflineEntry: boolean("is_offline_entry").notNull().default(false),
  syncedAt: timestamp("synced_at", { withTimezone: true }),
  loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  // Same justification as exercise_logs above: queried with
  // WHERE user_id=$1 AND logged_at BETWEEN ... on every log-write
  // (lib/activityScore.ts), every score computation (lib/scoring.ts),
  // and GET /health/water/:date.
  userLoggedAtIdx: index("idx_water_logs_user_logged_at").on(t.userId, t.loggedAt),
}));

export const medicineSchedulesTable = pgTable("medicine_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  medicineName: text("medicine_name").notNull(),
  dosage: text("dosage"),
  doseCount: integer("dose_count").notNull().default(1),
  mealTiming: medicineMealTimingEnum("meal_timing").notNull().default("anytime"),
  frequency: medicineFrequencyEnum("frequency").notNull().default("daily"),
  customDays: text("custom_days").array(),
  reminderTimes: text("reminder_times").array().notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  isActive: boolean("is_active").notNull().default(true),
  refillAlertDays: integer("refill_alert_days").notNull().default(7),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  // Queried with WHERE user_id=$1 AND is_active=true in medicine.ts (3x),
  // family.ts, stress.ts, and on every single log-write via
  // lib/activityScore.ts's upsertDailyActivityScore().
  userActiveIdx: index("idx_medicine_schedules_user_active").on(t.userId, t.isActive),
}));

export const medicineLogsTable = pgTable("medicine_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  scheduleId: uuid("schedule_id").notNull().references(() => medicineSchedulesTable.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  takenAt: timestamp("taken_at", { withTimezone: true }),
  isOfflineEntry: boolean("is_offline_entry").notNull().default(false),
  syncedAt: timestamp("synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  // Queried with WHERE user_id=$1 AND scheduled_at BETWEEN ...
  // (and ORDER BY scheduled_at DESC) in medicine.ts, family.ts, stress.ts,
  // and on every log-write via lib/activityScore.ts.
  userScheduledAtIdx: index("idx_medicine_logs_user_scheduled_at").on(t.userId, t.scheduledAt),
}));

export const stressLogsTable = pgTable("stress_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  stressType: stressTypeEnum("stress_type").notNull(),
  stressScore: integer("stress_score").notNull(),
  mood: moodEnum("mood"),
  heartRateAvg: integer("heart_rate_avg"),
  hrvScore: decimal("hrv_score", { precision: 5, scale: 2 }),
  sleepHours: decimal("sleep_hours", { precision: 3, scale: 1 }),
  foodQualityScore: integer("food_quality_score"),
  exerciseMinutes: integer("exercise_minutes"),
  waterGlasses: integer("water_glasses"),
  medicineAdherence: decimal("medicine_adherence", { precision: 5, scale: 2 }),
  pillars: jsonb("pillars"),
  aiInsight: text("ai_insight"),
  isOfflineEntry: boolean("is_offline_entry").notNull().default(false),
  syncedAt: timestamp("synced_at", { withTimezone: true }),
  loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  // WHERE user_id=$1 AND logged_at BETWEEN ... on every log-write
  // (lib/activityScore.ts's upsertDailyActivityScore, called after every
  // food/water/exercise/medicine/sleep log).
  userLoggedAtIdx: index("idx_stress_logs_user_logged_at").on(t.userId, t.loggedAt),
}));

export const periodLogsTable = pgTable("period_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  cycleLength: integer("cycle_length"),
  symptoms: text("symptoms").array(),
  flow: text("flow"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  // routes/modules/period.ts: WHERE user_id=$1 ORDER BY start_date DESC
  // (3 call sites — dashboard, latest-cycle lookup, 12-cycle history).
  userStartDateIdx: index("idx_period_logs_user_start_date").on(t.userId, t.startDate),
}));

export const medicalReportsTable = pgTable("medical_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  reportType: text("report_type").notNull(),
  reportDate: text("report_date"),
  labName: text("lab_name"),
  patientName: text("patient_name"),
  findings: jsonb("findings").notNull(),
  criticalValues: jsonb("critical_values"),
  aiAdvice: text("ai_advice"),
  dietRecommendations: text("diet_recommendations").array(),
  urgencyLevel: text("urgency_level"),
  followUpRequired: boolean("follow_up_required").notNull().default(false),
  pageCount: integer("page_count").notNull().default(1),
  analyzedAt: timestamp("analyzed_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const dailyHealthScoresTable = pgTable("daily_health_scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  scoreDate: text("score_date").notNull(),
  healthScore: integer("health_score").notNull().default(0),
  dataConfidencePct: decimal("data_confidence_pct", { precision: 5, scale: 2 }).notNull().default("0"),
  foodScore: integer("food_score").notNull().default(0),
  exerciseScore: integer("exercise_score").notNull().default(0),
  waterScore: integer("water_score").notNull().default(0),
  medicineScore: integer("medicine_score").notNull().default(0),
  sleepScore: integer("sleep_score").notNull().default(0),
  stressScore: integer("stress_score"),
  totalCaloriesIn: decimal("total_calories_in", { precision: 8, scale: 2 }),
  totalCaloriesOut: decimal("total_calories_out", { precision: 8, scale: 2 }),
  waterGlasses: integer("water_glasses").notNull().default(0),
  exerciseMinutes: integer("exercise_minutes").notNull().default(0),
  medicineAdherencePct: decimal("medicine_adherence_pct", { precision: 5, scale: 2 }),
  fieldsLogged: integer("fields_logged").notNull().default(0),
  totalPossibleFields: integer("total_possible_fields").notNull().default(5),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  // lib/scoring.ts's computeScientificScore() persists via
  //   INSERT INTO daily_health_scores (...) VALUES (...)
  //   ON CONFLICT (user_id, score_date) DO UPDATE SET ...
  // `ON CONFLICT (columns)` requires a UNIQUE or exclusion constraint on
  // exactly those columns. artifacts/api-server/src/lib/migrate.ts (the
  // legacy, backward-compat script) already creates this table with an
  // inline `UNIQUE(user_id, score_date)`, so real production — which was
  // bootstrapped via that script — already has this constraint and the
  // upsert already works there today. This entry exists so the *Drizzle
  // schema itself* (the intended long-term source of truth) also declares
  // it: verified by reproducing `ON CONFLICT` against a database that had
  // ONLY gone through the new schema-migration path (no legacy script) —
  // without this, that path silently fails every upsert with "there is no
  // unique or exclusion constraint matching the ON CONFLICT specification".
  // Also serves GET /health/scores/history's WHERE user_id=$1 ... ORDER BY
  // score_date. See the corresponding generated migration for how this is
  // made safe (IF NOT EXISTS) against databases that already have it via
  // the legacy path.
  userScoreDateUniq: uniqueIndex("daily_health_scores_user_id_score_date_key").on(t.userId, t.scoreDate),
}));

export const sleepQualityEnum = pgEnum("sleep_quality", ["poor", "fair", "good", "excellent"]);

export const sleepLogsTable = pgTable("sleep_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  sleepDate: text("sleep_date").notNull(),
  bedtime: text("bedtime"),
  wakeTime: text("wake_time"),
  sleepHours: decimal("sleep_hours", { precision: 3, scale: 1 }).notNull(),
  quality: sleepQualityEnum("quality"),
  notes: text("notes"),
  isOfflineEntry: boolean("is_offline_entry").notNull().default(false),
  syncedAt: timestamp("synced_at", { withTimezone: true }),
  loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  // WHERE user_id=$1 AND sleep_date=$2 (3 call sites: POST /health/sleep
  // dedup check, PUT /health/sleep/:date, GET /health/sleep/:date) and
  // WHERE user_id=$1 ORDER BY sleep_date DESC LIMIT N (GET
  // /health/sleep/history) — exact match for lib/scoring.ts's dashboard
  // query too.
  userSleepDateIdx: index("idx_sleep_logs_user_sleep_date").on(t.userId, t.sleepDate),
}));

export const insertExerciseLogSchema = createInsertSchema(exerciseLogsTable).omit({ id: true, createdAt: true });
export const insertWaterLogSchema = createInsertSchema(waterLogsTable).omit({ id: true, createdAt: true });
export const insertMedicineScheduleSchema = createInsertSchema(medicineSchedulesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMedicineLogSchema = createInsertSchema(medicineLogsTable).omit({ id: true, createdAt: true });
export const insertStressLogSchema = createInsertSchema(stressLogsTable).omit({ id: true, createdAt: true });
export const insertSleepLogSchema = createInsertSchema(sleepLogsTable).omit({ id: true, createdAt: true });

// ── Daily AI Suggestions Cache (per user per day) ────────────────────────────
export const dailySuggestionsTable = pgTable("daily_suggestions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  date: text("date").notNull(),                          // YYYY-MM-DD
  suggestionsJson: jsonb("suggestions_json").notNull(),  // Full AI response
  calorieGoalUsed: integer("calorie_goal_used"),
  isAiGenerated: boolean("is_ai_generated").notNull().default(true),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userDateUniq: { columns: [t.userId, t.date] },
}));

// ── Monthly Health Predictions (Aorane AI — once per month per user) ────────
export const healthPredictionsTable = pgTable("health_predictions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  month: text("month").notNull(),                        // YYYY-MM
  weekStart: text("week_start"),                         // NEW COLUMN
  predictionJson: jsonb("prediction_json").notNull(),    // { risks: [], recommendations: [], overallScore }
  dataSnapshotJson: jsonb("data_snapshot_json"),         // 30-day aggregated data used for prediction
  weatherContext: text("weather_context"),               // Weather at time of prediction
  wasForced: boolean("was_forced").default(false),       // NEW COLUMN (Cost-saver lock)
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userMonthUniq: uniqueIndex("health_predictions_user_month_uniq").on(t.userId, t.month),
}));

// ── Weekly Diet Charts (Aorane AI — once per week per user) ─────────────────
export const weeklyDietChartsTable = pgTable("weekly_diet_charts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  weekStart: text("week_start").notNull(),               // YYYY-MM-DD (Monday)
  dietChartJson: jsonb("diet_chart_json").notNull(),     // { days: [{day, breakfast, lunch, dinner, snacks, totalCalories}] }
  targetCalories: integer("target_calories"),
  wasForced: boolean("was_forced").default(false),       // NAYA COLUMN (Cost-saver lock)
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userWeekUniq: uniqueIndex("weekly_diet_charts_user_week_uniq").on(t.userId, t.weekStart),
}));

export type ExerciseLog = typeof exerciseLogsTable.$inferSelect;
export type WaterLog = typeof waterLogsTable.$inferSelect;
export type MedicineSchedule = typeof medicineSchedulesTable.$inferSelect;
export type MedicineLog = typeof medicineLogsTable.$inferSelect;
export type StressLog = typeof stressLogsTable.$inferSelect;
export type PeriodLog = typeof periodLogsTable.$inferSelect;
export type MedicalReport = typeof medicalReportsTable.$inferSelect;
export type DailyHealthScore = typeof dailyHealthScoresTable.$inferSelect;
export type DailySuggestion = typeof dailySuggestionsTable.$inferSelect;
export type HealthPrediction = typeof healthPredictionsTable.$inferSelect;
export type WeeklyDietChart = typeof weeklyDietChartsTable.$inferSelect;
