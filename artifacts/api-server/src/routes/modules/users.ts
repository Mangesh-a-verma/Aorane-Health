import { Router } from "express";
import {
  db, usersTable, userProfilesTable, userPreferencesTable, userPrivacySettingsTable,
  userMedicalConditionsTable, userHealthGoalsTable,
  foodLogsTable, waterLogsTable, exerciseLogsTable, medicineSchedulesTable, medicineLogsTable,
} from "@workspace/db";
import { eq, and, gte, lte, ilike, or } from "drizzle-orm";
import { requireAuth } from "../../middlewares/user-auth";
import type { AuthRequest } from "../../middlewares/user-auth";

// ── AORANE ID Generation (12 digits, immutable) ───────────────────────────────
// Format: [G][AA][CCC][RRRRRR]
//   G   = Gender code (1=Male, 2=Female, 3=Other/Prefer-not)
//   AA  = Age at registration (00-99)
//   CCC = City hash (100-999, derived from city name)
//   RRRRRR = 6 random digits (100000-999999)
function generateAoraneId(gender: string | null, dateOfBirth: string | null, city: string | null): string {
  const gCode = gender === "male" ? "1" : gender === "female" ? "2" : "3";
  const age = dateOfBirth
    ? Math.min(99, Math.floor((Date.now() - new Date(dateOfBirth).getTime()) / (86400000 * 365.25)))
    : 0;
  const ageCode = String(age).padStart(2, "0");
  const cityName = (city || "other").toLowerCase().replace(/[^a-z]/g, "");
  const s = (cityName + "xxx").slice(0, 4);
  const cityHash = ((s.charCodeAt(0) * 97 + s.charCodeAt(1) * 53 + s.charCodeAt(2) * 31 + s.charCodeAt(3) * 7) % 900) + 100;
  const cityCode = String(cityHash).padStart(3, "0");
  const random = String(Math.floor(Math.random() * 900000) + 100000);
  return `${gCode}${ageCode}${cityCode}${random}`; // Total: 1+2+3+6 = 12 digits
}

// ── Daily Active Percentage Calculation ───────────────────────────────────────
async function calculateActivePercent(userId: string, date?: string): Promise<{
  overall: number; foodPct: number; waterPct: number; exercisePct: number; medicinePct: number;
  breakdown: { food: number; water: number; exercise: number; medicine: number };
}> {
  const today = date || new Date().toISOString().slice(0, 10);
  const dayStart = new Date(today); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(today); dayEnd.setHours(23, 59, 59, 999);

  const [foodLogs, waterLogs, exerciseLogs, medSchedules, medLogs] = await Promise.allSettled([
    db.select().from(foodLogsTable).where(and(eq(foodLogsTable.userId, userId), gte(foodLogsTable.loggedAt, dayStart), lte(foodLogsTable.loggedAt, dayEnd))),
    db.select().from(waterLogsTable).where(and(eq(waterLogsTable.userId, userId), gte(waterLogsTable.loggedAt, dayStart), lte(waterLogsTable.loggedAt, dayEnd))),
    db.select().from(exerciseLogsTable).where(and(eq(exerciseLogsTable.userId, userId), gte(exerciseLogsTable.loggedAt, dayStart), lte(exerciseLogsTable.loggedAt, dayEnd))),
    db.select().from(medicineSchedulesTable).where(and(eq(medicineSchedulesTable.userId, userId), eq(medicineSchedulesTable.isActive, true))),
    db.select().from(medicineLogsTable).where(and(eq(medicineLogsTable.userId, userId), gte(medicineLogsTable.takenAt, dayStart), lte(medicineLogsTable.takenAt, dayEnd))),
  ]);

  // Food: 3 meals expected = max 3 entries, each = 33.3%
  const foodCount = foodLogs.status === "fulfilled" ? foodLogs.value.length : 0;
  const foodPct = Math.min(100, Math.round((foodCount / 3) * 100));

  // Water: 8 glasses expected, each glass logged = 12.5%
  const totalWaterGlasses = waterLogs.status === "fulfilled"
    ? waterLogs.value.reduce((s, l) => s + (l.glassesCount || 0), 0) : 0;
  const [prefs] = await db.select().from(userPreferencesTable).where(eq(userPreferencesTable.userId, userId)).limit(1).catch(() => [null]);
  const waterGoal = (prefs as Record<string, unknown>)?.waterGoalGlasses as number || 8;
  const waterPct = Math.min(100, Math.round((totalWaterGlasses / waterGoal) * 100));

  // Exercise: any exercise logged = 100%, nothing = 0%
  const exerciseCount = exerciseLogs.status === "fulfilled" ? exerciseLogs.value.length : 0;
  const exercisePct = exerciseCount > 0 ? 100 : 0;

  // Medicine: (taken today / scheduled today) × 100
  const scheduleCount = medSchedules.status === "fulfilled" ? medSchedules.value.length : 0;
  const takenCount = medLogs.status === "fulfilled" ? medLogs.value.length : 0;
  const medicinePct = scheduleCount > 0 ? Math.min(100, Math.round((takenCount / scheduleCount) * 100)) : 100;

  // Overall weighted average: food 35%, water 30%, exercise 25%, medicine 10%
  const overall = Math.round(foodPct * 0.35 + waterPct * 0.30 + exercisePct * 0.25 + medicinePct * 0.10);

  return {
    overall, foodPct, waterPct, exercisePct, medicinePct,
    breakdown: { food: foodCount, water: totalWaterGlasses, exercise: exerciseCount, medicine: takenCount },
  };
}

const router = Router();

router.get("/users/profile", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, req.userId!));
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    const [prefs] = await db.select().from(userPreferencesTable).where(eq(userPreferencesTable.userId, req.userId!));
    const conditions = await db.select().from(userMedicalConditionsTable).where(eq(userMedicalConditionsTable.userId, req.userId!));
    const [goals] = await db.select().from(userHealthGoalsTable).where(eq(userHealthGoalsTable.userId, req.userId!));

    res.json({ profile, user: { plan: user?.plan, phone: user?.phone, email: user?.email }, preferences: prefs, conditions, goals });
  } catch {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

router.patch("/users/profile", requireAuth, async (req: AuthRequest, res) => {
  try {
    const {
      fullName, dateOfBirth, gender, heightCm, weightKg, bloodGroup,
      foodPreference, foodAllergies, workProfile, activityLevel,
      exerciseFrequency, exerciseTypes, sleepHoursAvg, wakeTime,
      sleepTime, stressLevelSelf, profilePhotoUrl, city, state,
    } = req.body as Record<string, unknown>;

    const bmi = heightCm && weightKg
      ? Number((Number(weightKg) / Math.pow(Number(heightCm) / 100, 2)).toFixed(1))
      : undefined;

    const updateData: Record<string, unknown> = {};
    if (fullName !== undefined) updateData.fullName = fullName;
    if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth;
    if (gender !== undefined) updateData.gender = gender;
    if (heightCm !== undefined) updateData.heightCm = String(heightCm);
    if (weightKg !== undefined) updateData.weightKg = String(weightKg);
    if (bmi !== undefined) updateData.bmi = String(bmi);
    if (bloodGroup !== undefined) updateData.bloodGroup = bloodGroup;
    if (foodPreference !== undefined) updateData.foodPreference = foodPreference;
    if (foodAllergies !== undefined) updateData.foodAllergies = foodAllergies;
    if (workProfile !== undefined) updateData.workProfile = workProfile;
    if (activityLevel !== undefined) updateData.activityLevel = activityLevel;
    if (exerciseFrequency !== undefined) updateData.exerciseFrequency = exerciseFrequency;
    if (exerciseTypes !== undefined) updateData.exerciseTypes = exerciseTypes;
    if (sleepHoursAvg !== undefined) updateData.sleepHoursAvg = String(sleepHoursAvg);
    if (wakeTime !== undefined) updateData.wakeTime = wakeTime;
    if (sleepTime !== undefined) updateData.sleepTime = sleepTime;
    if (stressLevelSelf !== undefined) updateData.stressLevelSelf = stressLevelSelf;
    if (profilePhotoUrl !== undefined) updateData.profilePhotoUrl = profilePhotoUrl;
    if (city !== undefined) updateData.city = city;
    if (state !== undefined) updateData.state = state;

    const [updated] = await db
      .update(userProfilesTable)
      .set(updateData as Parameters<typeof db.update>[0] extends infer T ? T : never)
      .where(eq(userProfilesTable.userId, req.userId!))
      .returning();

    res.json({ profile: updated });
  } catch (err) {
    res.status(500).json({ error: "Failed to update profile" });
  }
});

router.patch("/users/onboarding/step", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { step } = req.body as { step: number };
    await db.update(userProfilesTable).set({ onboardingStep: step }).where(eq(userProfilesTable.userId, req.userId!));
    res.json({ success: true, step });
  } catch {
    res.status(500).json({ error: "Failed to update onboarding step" });
  }
});

router.post("/users/medical-conditions", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { conditions } = req.body as { conditions: Array<{ condition: string; conditionType?: string }> };
    await db.delete(userMedicalConditionsTable).where(eq(userMedicalConditionsTable.userId, req.userId!));
    if (conditions?.length) {
      await db.insert(userMedicalConditionsTable).values(
        conditions.map((c) => ({ userId: req.userId!, ...c }))
      );
    }
    const saved = await db.select().from(userMedicalConditionsTable).where(eq(userMedicalConditionsTable.userId, req.userId!));
    res.json({ conditions: saved });
  } catch {
    res.status(500).json({ error: "Failed to save conditions" });
  }
});

router.post("/users/health-goals", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { primaryGoal, currentWeightKg, targetWeightKg, targetDate, secondaryGoals } = req.body as {
      primaryGoal: string; currentWeightKg?: number; targetWeightKg?: number; targetDate?: string; secondaryGoals?: string[];
    };
    const existing = await db.select().from(userHealthGoalsTable).where(eq(userHealthGoalsTable.userId, req.userId!));
    if (existing.length) {
      const [updated] = await db.update(userHealthGoalsTable).set({
        primaryGoal,
        currentWeightKg: currentWeightKg ? String(currentWeightKg) : undefined,
        targetWeightKg: targetWeightKg ? String(targetWeightKg) : undefined,
        targetDate,
        secondaryGoals,
      }).where(eq(userHealthGoalsTable.userId, req.userId!)).returning();
      res.json({ goals: updated });
    } else {
      const [created] = await db.insert(userHealthGoalsTable).values({
        userId: req.userId!,
        primaryGoal,
        currentWeightKg: currentWeightKg ? String(currentWeightKg) : undefined,
        targetWeightKg: targetWeightKg ? String(targetWeightKg) : undefined,
        targetDate,
        secondaryGoals,
      }).returning();
      res.json({ goals: created });
    }
  } catch {
    res.status(500).json({ error: "Failed to save goals" });
  }
});

router.get("/users/preferences", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [prefs] = await db.select().from(userPreferencesTable).where(eq(userPreferencesTable.userId, req.userId!));
    res.json({ preferences: prefs });
  } catch {
    res.status(500).json({ error: "Failed to fetch preferences" });
  }
});

router.patch("/users/preferences", requireAuth, async (req: AuthRequest, res) => {
  try {
    const allowedFields = [
      "languageCode", "darkMode", "waterGoalGlasses", "calorieGoal",
      "notificationsEnabled", "medicineReminders", "waterReminders",
      "weeklyReportEmail", "appLockEnabled", "appLockMethod", "adsEnabled",
    ];
    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    const [updated] = await db.update(userPreferencesTable).set(updates as Parameters<typeof db.update>[0] extends infer T ? T : never).where(eq(userPreferencesTable.userId, req.userId!)).returning();
    res.json({ preferences: updated });
  } catch {
    res.status(500).json({ error: "Failed to update preferences" });
  }
});

router.get("/users/privacy", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [privacy] = await db.select().from(userPrivacySettingsTable).where(eq(userPrivacySettingsTable.userId, req.userId!));
    res.json({ privacy });
  } catch {
    res.status(500).json({ error: "Failed to fetch privacy settings" });
  }
});

router.patch("/users/privacy", requireAuth, async (req: AuthRequest, res) => {
  try {
    const allowedFields = [
      "shareBasicProfile", "shareBmi", "shareExerciseData", "shareWaterIntake",
      "shareSleepData", "shareStressLevel", "shareMedicineDetails",
      "shareMedicalConditions", "shareFoodData",
    ];
    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    const [updated] = await db.update(userPrivacySettingsTable).set(updates as Parameters<typeof db.update>[0] extends infer T ? T : never).where(eq(userPrivacySettingsTable.userId, req.userId!)).returning();
    res.json({ privacy: updated });
  } catch {
    res.status(500).json({ error: "Failed to update privacy settings" });
  }
});

// ─── Health Scorecard — stores AORANE ID on first generation (immutable) ─────
router.get("/users/scorecard", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, req.userId!));

    // Generate and SAVE AORANE ID only if not already stored
    let aoraneId = profile?.aoraneId;
    if (!aoraneId) {
      // Try up to 5 times for uniqueness
      let generated = "";
      for (let attempt = 0; attempt < 5; attempt++) {
        generated = generateAoraneId(
          profile?.gender || null,
          profile?.dateOfBirth || null,
          (profile as Record<string, unknown>)?.city as string || null
        );
        // Save immediately — unique constraint will reject duplicates
        try {
          await db.update(userProfilesTable)
            .set({ aoraneId: generated })
            .where(eq(userProfilesTable.userId, req.userId!));
          aoraneId = generated;
          break;
        } catch { /* try again with different random */ }
      }
      if (!aoraneId) aoraneId = generated; // fallback, show but not saved
    }

    const bmi = profile?.bmi || null;
    let bmiCategory = "Normal";
    if (bmi) {
      const b = Number(bmi);
      if (b < 18.5) bmiCategory = "Underweight";
      else if (b < 25) bmiCategory = "Normal";
      else if (b < 30) bmiCategory = "Overweight";
      else bmiCategory = "Obese";
    }

    const age = profile?.dateOfBirth
      ? Math.floor((Date.now() - new Date(profile.dateOfBirth).getTime()) / (86400000 * 365.25))
      : null;

    // Active percentage for today
    const activeData = await calculateActivePercent(req.userId!).catch(() => ({ overall: 0, foodPct: 0, waterPct: 0, exercisePct: 0, medicinePct: 0, breakdown: { food: 0, water: 0, exercise: 0, medicine: 0 } }));

    res.json({
      aoraneId,
      name: profile?.fullName || "AORANE User",
      bloodGroup: profile?.bloodGroup || "Unknown",
      bmi: bmi || "N/A",
      bmiCategory,
      plan: user?.plan || "free",
      gender: profile?.gender || "other",
      age,
      city: (profile as Record<string, unknown>)?.city || null,
      state: (profile as Record<string, unknown>)?.state || null,
      workProfile: profile?.workProfile || null,
      memberSince: user?.createdAt,
      qrData: JSON.stringify({ aoraneId, name: profile?.fullName, bloodGroup: profile?.bloodGroup }),
      activePercent: activeData,
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch scorecard" });
  }
});

// ─── Daily Active Percentage ──────────────────────────────────────────────────
router.get("/users/activity-score", requireAuth, async (req: AuthRequest, res) => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const result = await calculateActivePercent(req.userId!, date);
    res.json({ date, ...result, label: getActiveLabel(result.overall) });
  } catch {
    res.status(500).json({ error: "Failed to calculate activity score" });
  }
});

function getActiveLabel(pct: number): string {
  if (pct >= 90) return "Excellent 🌟";
  if (pct >= 70) return "Good 👍";
  if (pct >= 50) return "Average 📊";
  if (pct >= 30) return "Low ⚡";
  return "Inactive 😴";
}

// ─── Search user by AORANE ID (for Admin + Business Portal) ──────────────────
// Also supports search by name/phone for admin
router.get("/users/search", requireAuth, async (req: AuthRequest, res) => {
  try {
    const q = (req.query.q as string || "").trim();
    if (!q || q.length < 4) return res.status(400).json({ error: "Minimum 4 characters required" });

    const isAoraneId = /^\d{12}$/.test(q);

    let profiles: typeof import("@workspace/db").userProfilesTable.$inferSelect[] = [];

    if (isAoraneId) {
      profiles = await db.select().from(userProfilesTable).where(eq(userProfilesTable.aoraneId, q)).limit(5);
    } else {
      profiles = await db.select().from(userProfilesTable).where(ilike(userProfilesTable.fullName, `%${q}%`)).limit(10);
    }

    const results = await Promise.all(profiles.map(async (p) => {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, p.userId)).limit(1);
      const activeData = await calculateActivePercent(p.userId).catch(() => ({ overall: 0 }));
      return {
        userId: p.userId,
        aoraneId: p.aoraneId,
        name: p.fullName,
        bloodGroup: p.bloodGroup,
        gender: p.gender,
        age: p.dateOfBirth ? Math.floor((Date.now() - new Date(p.dateOfBirth).getTime()) / (86400000 * 365.25)) : null,
        city: (p as Record<string, unknown>).city,
        state: (p as Record<string, unknown>).state,
        bmi: p.bmi,
        plan: user?.plan,
        phone: user?.phone,
        activePercent: activeData.overall,
      };
    }));

    res.json({ results, count: results.length, query: q });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Search failed" });
  }
});

export default router;
