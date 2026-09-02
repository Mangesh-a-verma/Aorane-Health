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
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const planEnum = pgEnum("plan", ["free", "max", "pro", "family"]);
export const genderEnum = pgEnum("gender", ["male", "female", "other", "prefer_not_to_say"]);
export const foodPrefEnum = pgEnum("food_preference", ["veg", "nonveg", "eggetarian", "vegan", "jain"]);
export const activityLevelEnum = pgEnum("activity_level", ["sedentary", "light", "moderate", "very", "athlete"]);
export const authProviderEnum = pgEnum("auth_provider", ["mobile", "google", "facebook", "x"]);

export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  phone: text("phone").unique(),
  email: text("email").unique(),
  plan: planEnum("plan").notNull().default("free"),
  isActive: boolean("is_active").notNull().default(true),
  isBanned: boolean("is_banned").notNull().default(false),
  customDiscountPct: integer("custom_discount_pct"),
  customDiscountNote: text("custom_discount_note"),
  customDiscountValidUntil: timestamp("custom_discount_valid_until", { withTimezone: true }),
  countryCode: text("country_code").notNull().default("IN"),
  languageCode: text("language_code").notNull().default("hi"),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  currencyCode: text("currency_code").notNull().default("INR"),
  referralCode: text("referral_code").unique(),
  referredBy: uuid("referred_by"),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const userAuthProvidersTable = pgTable("user_auth_providers", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  provider: authProviderEnum("provider").notNull(),
  providerUserId: text("provider_user_id").notNull(),
  email: text("email"),
  isPrimary: boolean("is_primary").notNull().default(false),
  linkedAt: timestamp("linked_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userProfilesTable = pgTable("user_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  aoraneId: text("aorane_id").unique(),
  fullName: text("full_name"),
  dateOfBirth: text("date_of_birth"),
  gender: genderEnum("gender"),
  profilePhotoUrl: text("profile_photo_url"),
  city: text("city"),
  state: text("state"),
  heightCm: decimal("height_cm", { precision: 5, scale: 2 }),
  weightKg: decimal("weight_kg", { precision: 5, scale: 2 }),
  bmi: decimal("bmi", { precision: 5, scale: 2 }),
  bloodGroup: text("blood_group"),
  foodPreference: foodPrefEnum("food_preference"),
  foodAllergies: text("food_allergies").array(),
  workProfile: text("work_profile"),
  activityLevel: activityLevelEnum("activity_level"),
  exerciseFrequency: text("exercise_frequency"),
  exerciseTypes: text("exercise_types").array(),
  sleepHoursAvg: decimal("sleep_hours_avg", { precision: 3, scale: 1 }),
  // Phase 2: Memory & Trends
  currentHealthStreak: integer("current_health_streak").notNull().default(0),
  longestHealthStreak: integer("longest_health_streak").notNull().default(0),
  rolling7DayScore: integer("rolling_7_day_score"),
  rolling30DayScore: integer("rolling_30_day_score"),
  biologicalAge: integer("biological_age"),
  aiHealthPredictions: jsonb("ai_health_predictions"),

  wakeTime: text("wake_time"),
  sleepTime: text("sleep_time"),
  stressLevelSelf: text("stress_level_self"),
  profileCompletedAt: timestamp("profile_completed_at", { withTimezone: true }),
  onboardingStep: integer("onboarding_step").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const userMedicalConditionsTable = pgTable("user_medical_conditions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  condition: text("condition").notNull(),
  conditionType: text("condition_type"),
  diagnosedAt: text("diagnosed_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  // lib/scoring.ts: WHERE user_id=$1 AND is_active=true, on every single
  // score computation. Also routes/modules/users.ts (profile GET/PUT).
  userActiveIdx: index("idx_user_medical_conditions_user_active").on(t.userId, t.isActive),
}));

export const userHealthGoalsTable = pgTable("user_health_goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  primaryGoal: text("primary_goal").notNull(),
  currentWeightKg: decimal("current_weight_kg", { precision: 5, scale: 2 }),
  targetWeightKg: decimal("target_weight_kg", { precision: 5, scale: 2 }),
  targetDate: text("target_date"),
  secondaryGoals: text("secondary_goals").array(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const userPreferencesTable = pgTable("user_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  languageCode: text("language_code").notNull().default("hi"),
  darkMode: boolean("dark_mode").notNull().default(false),
  waterGoalGlasses: integer("water_goal_glasses").notNull().default(8),
  calorieGoal: integer("calorie_goal"),
  notificationsEnabled: boolean("notifications_enabled").notNull().default(true),
  medicineReminders: boolean("medicine_reminders").notNull().default(true),
  waterReminders: boolean("water_reminders").notNull().default(true),
  foodReminders: boolean("food_reminders").notNull().default(true),
  periodReminders: boolean("period_reminders").notNull().default(true),
  suggestionNotifications: boolean("suggestion_notifications").notNull().default(true),
  waterReminderTimes: text("water_reminder_times").notNull().default("09:00,13:00,18:00,21:00"),
  foodReminderTime: text("food_reminder_time").notNull().default("07:30,12:30,19:30"),
  medicineReminderTime: text("medicine_reminder_time").notNull().default("08:00,14:00,21:00"),
  wakeUpTime: text("wake_up_time").notNull().default("07:00"),
  bedTime: text("bed_time").notNull().default("22:30"),
  // ── Phase B ───────────────────────────────────────────────────────────────
  // A bedtime nudge, fired shortly BEFORE bedTime (going to bed on time is the
  // point; a reminder at the moment you should already be asleep is useless).
  sleepReminders: boolean("sleep_reminders").notNull().default(true),
  // Stress check-ins. Two a day is what the Stress Tracker needs to plot a
  // trend, and midday/evening are when people can actually stop and answer.
  stressReminders: boolean("stress_reminders").notNull().default(true),
  stressReminderTimes: text("stress_reminder_times").notNull().default("12:00,20:00"),
  // Nothing fires between bedTime and wakeUpTime. Derived from those two
  // columns rather than adding a second pair to keep in sync — the user has
  // already told us when they sleep.
  quietHoursEnabled: boolean("quiet_hours_enabled").notNull().default(true),
  weeklyReportEmail: boolean("weekly_report_email").notNull().default(false),
  appLockEnabled: boolean("app_lock_enabled").notNull().default(false),
  appLockMethod: text("app_lock_method"),
  pinHash: text("pin_hash"),
  sessionTimeoutMinutes: integer("session_timeout_minutes").notNull().default(5),
  adsEnabled: boolean("ads_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const userPrivacySettingsTable = pgTable("user_privacy_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  shareBasicProfile: boolean("share_basic_profile").notNull().default(true),
  shareBmi: boolean("share_bmi").notNull().default(true),
  shareExerciseData: boolean("share_exercise_data").notNull().default(true),
  shareWaterIntake: boolean("share_water_intake").notNull().default(true),
  shareSleepData: boolean("share_sleep_data").notNull().default(false),
  shareStressLevel: boolean("share_stress_level").notNull().default(false),
  shareMedicineDetails: boolean("share_medicine_details").notNull().default(false),
  shareMedicalConditions: boolean("share_medical_conditions").notNull().default(false),
  shareFoodData: boolean("share_food_data").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// Server-side record of legal-document acceptance. Previously the mobile
// app's onboarding "accept Terms/Privacy/Medical Disclaimer" checkboxes only
// set a local AsyncStorage boolean — no version, no timestamp, no way to
// prove to a regulator (or to ourselves, if the docs later change) who
// accepted what and when. One row per acceptance event (not one row per
// user) deliberately, so re-consenting to a later policy version adds a new
// row instead of overwriting the history of the original acceptance.
export const userConsentsTable = pgTable("user_consents", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  consentType: text("consent_type").notNull().default("onboarding_bundle"),
  docsAccepted: text("docs_accepted").array().notNull(),
  version: text("version").notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx: index("user_consents_user_id_idx").on(table.userId),
}));

export const otpStoreTable = pgTable("otp_store", {
  id: uuid("id").primaryKey().defaultRandom(),
  phone: text("phone").notNull().unique(),
  hashedOtp: text("hashed_otp").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUserProfileSchema = createInsertSchema(userProfilesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUserPreferencesSchema = createInsertSchema(userPreferencesTable).omit({ id: true, createdAt: true, updatedAt: true });

export type User = typeof usersTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UserProfile = typeof userProfilesTable.$inferSelect;
export type UserPreferences = typeof userPreferencesTable.$inferSelect;
export type UserConsent = typeof userConsentsTable.$inferSelect;
export type UserPrivacySettings = typeof userPrivacySettingsTable.$inferSelect;
