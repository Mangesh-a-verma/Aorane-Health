/**
 * Comprehensive Demo User Seeder — 6 diverse Indian health profiles
 * Run: npx tsx src/scripts/seed-demo-users.ts
 */
import "dotenv/config";
import { db } from "@workspace/db";
import {
  usersTable, userProfilesTable, userPreferencesTable,
  userMedicalConditionsTable, userHealthGoalsTable,
} from "@workspace/db";
import {
  foodLogsTable, waterLogsTable, exerciseLogsTable,
  stressLogsTable, medicineSchedulesTable, medicineLogsTable,
  subscriptionsTable,
} from "@workspace/db";
import { bloodDonorsTable } from "@workspace/db";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env["JWT_SECRET"] || "aorane_dev_secret_change_in_prod";

// ── 6 Demo User definitions ───────────────────────────────────────────────────
const DEMO_USERS = [
  {
    id: "cc000001-0001-0001-0001-000000000001",
    phone: "+919900000001",
    email: "arjun.kapoor@demo.aorane.com",
    plan: "max" as const,
    profile: {
      aoraneId: "M28MUM1ARJUN",
      fullName: "Arjun Kapoor",
      dateOfBirth: "1996-03-15",
      gender: "male" as const,
      city: "Mumbai",
      state: "Maharashtra",
      heightCm: "178",
      weightKg: "82",
      bmi: "25.9",
      bloodGroup: "B+",
      foodPreference: "nonveg" as const,
      workProfile: "IT/Software",
      activityLevel: "light" as const,
      sleepHoursAvg: "6.5",
      wakeTime: "07:30",
      sleepTime: "01:00",
      stressLevelSelf: "high",
      onboardingStep: 6,
    },
    conditions: [
      { condition: "Pre-diabetes (HbA1c 5.9%)", conditionType: "metabolic" },
      { condition: "Vitamin D Deficiency", conditionType: "nutritional" },
    ],
    goals: { primaryGoal: "weight_loss", targetWeightKg: "75", secondaryGoals: ["reduce_stress", "better_sleep"] },
    preferences: { languageCode: "hi", waterGoalGlasses: 10, calorieGoal: 1800 },
  },
  {
    id: "cc000002-0002-0002-0002-000000000002",
    phone: "+919900000002",
    email: "sanya.gupta@demo.aorane.com",
    plan: "pro" as const,
    profile: {
      aoraneId: "F24DEL2SANYA",
      fullName: "Sanya Gupta",
      dateOfBirth: "2000-07-22",
      gender: "female" as const,
      city: "Delhi",
      state: "Delhi",
      heightCm: "162",
      weightKg: "58",
      bmi: "22.1",
      bloodGroup: "A+",
      foodPreference: "veg" as const,
      workProfile: "Student",
      activityLevel: "moderate" as const,
      sleepHoursAvg: "7.5",
      wakeTime: "06:30",
      sleepTime: "23:30",
      stressLevelSelf: "moderate",
      onboardingStep: 6,
    },
    conditions: [
      { condition: "PCOS (Polycystic Ovary Syndrome)", conditionType: "hormonal" },
      { condition: "Iron Deficiency Anemia", conditionType: "nutritional" },
    ],
    goals: { primaryGoal: "hormonal_balance", targetWeightKg: "55", secondaryGoals: ["improve_energy", "manage_periods"] },
    preferences: { languageCode: "hi", waterGoalGlasses: 8, calorieGoal: 1600 },
  },
  {
    id: "cc000003-0003-0003-0003-000000000003",
    phone: "+919900000003",
    email: "dr.mehta@demo.aorane.com",
    plan: "max" as const,
    profile: {
      aoraneId: "M45BLR3MEHTA",
      fullName: "Dr. Vikram Mehta",
      dateOfBirth: "1979-11-08",
      gender: "male" as const,
      city: "Bengaluru",
      state: "Karnataka",
      heightCm: "172",
      weightKg: "88",
      bmi: "29.7",
      bloodGroup: "O+",
      foodPreference: "veg" as const,
      workProfile: "Doctor/Healthcare",
      activityLevel: "sedentary" as const,
      sleepHoursAvg: "5.5",
      wakeTime: "05:30",
      sleepTime: "23:00",
      stressLevelSelf: "very_high",
      onboardingStep: 6,
    },
    conditions: [
      { condition: "Hypertension (Stage 2)", conditionType: "cardiovascular" },
      { condition: "High Cholesterol (LDL 160)", conditionType: "metabolic" },
      { condition: "Mild Fatty Liver", conditionType: "hepatic" },
    ],
    goals: { primaryGoal: "heart_health", targetWeightKg: "78", secondaryGoals: ["reduce_bp", "manage_cholesterol"] },
    preferences: { languageCode: "en", waterGoalGlasses: 12, calorieGoal: 2000 },
  },
  {
    id: "cc000004-0004-0004-0004-000000000004",
    phone: "+919900000004",
    email: "rekha.singh@demo.aorane.com",
    plan: "free" as const,
    profile: {
      aoraneId: "F35JAI4REKHA",
      fullName: "Rekha Singh",
      dateOfBirth: "1989-02-14",
      gender: "female" as const,
      city: "Jaipur",
      state: "Rajasthan",
      heightCm: "155",
      weightKg: "72",
      bmi: "29.9",
      bloodGroup: "AB+",
      foodPreference: "veg" as const,
      workProfile: "Housewife",
      activityLevel: "light" as const,
      sleepHoursAvg: "8",
      wakeTime: "06:00",
      sleepTime: "22:00",
      stressLevelSelf: "moderate",
      onboardingStep: 6,
    },
    conditions: [
      { condition: "Hypothyroidism (TSH 8.5)", conditionType: "endocrine" },
      { condition: "Knee Osteoarthritis", conditionType: "musculoskeletal" },
    ],
    goals: { primaryGoal: "weight_loss", targetWeightKg: "62", secondaryGoals: ["thyroid_management", "joint_health"] },
    preferences: { languageCode: "hi", waterGoalGlasses: 8, calorieGoal: 1500 },
  },
  {
    id: "cc000005-0005-0005-0005-000000000005",
    phone: "+919900000005",
    email: "aakash.verma@demo.aorane.com",
    plan: "pro" as const,
    profile: {
      aoraneId: "M22CHN5AAKSH",
      fullName: "Aakash Verma",
      dateOfBirth: "2002-05-30",
      gender: "male" as const,
      city: "Chennai",
      state: "Tamil Nadu",
      heightCm: "183",
      weightKg: "76",
      bmi: "22.7",
      bloodGroup: "O-",
      foodPreference: "nonveg" as const,
      workProfile: "Athlete/Sports",
      activityLevel: "very" as const,
      sleepHoursAvg: "9",
      wakeTime: "05:00",
      sleepTime: "21:30",
      stressLevelSelf: "low",
      onboardingStep: 6,
    },
    conditions: [],
    goals: { primaryGoal: "muscle_gain", targetWeightKg: "82", secondaryGoals: ["performance", "endurance"] },
    preferences: { languageCode: "en", waterGoalGlasses: 14, calorieGoal: 3200 },
  },
  {
    id: "cc000006-0006-0006-0006-000000000006",
    phone: "+919900000006",
    email: "priya.nair@demo.aorane.com",
    plan: "max" as const,
    profile: {
      aoraneId: "F52KOC6PRIYA",
      fullName: "Priya Nair",
      dateOfBirth: "1972-09-03",
      gender: "female" as const,
      city: "Kochi",
      state: "Kerala",
      heightCm: "158",
      weightKg: "68",
      bmi: "27.2",
      bloodGroup: "B+",
      foodPreference: "nonveg" as const,
      workProfile: "Teacher/Professor",
      activityLevel: "light" as const,
      sleepHoursAvg: "7",
      wakeTime: "05:30",
      sleepTime: "22:00",
      stressLevelSelf: "moderate",
      onboardingStep: 6,
    },
    conditions: [
      { condition: "Type 2 Diabetes (HbA1c 7.2%)", conditionType: "metabolic" },
      { condition: "Hypertension (Controlled)", conditionType: "cardiovascular" },
      { condition: "Vitamin B12 Deficiency", conditionType: "nutritional" },
    ],
    goals: { primaryGoal: "diabetes_management", targetWeightKg: "60", secondaryGoals: ["blood_sugar_control", "heart_health"] },
    preferences: { languageCode: "en", waterGoalGlasses: 10, calorieGoal: 1600 },
  },
];

// ── Food logs for last 7 days ─────────────────────────────────────────────────
function getFoodLogs(userId: string, plan: string) {
  const logs: Array<{ userId: string; mealType: "breakfast" | "lunch" | "dinner" | "snack"; foodNameEn: string; calories: string; proteinG: string; carbsG: string; fatG: string; fiberG: string; inputMethod: "text"; loggedAt: Date }> = [];
  const today = new Date();
  const foods: Record<string, Array<{ name: string; calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number; mealType: string }>> = {
    breakfast: [
      { name: "Poha", calories: 250, proteinG: 6, carbsG: 45, fatG: 3, fiberG: 4, mealType: "breakfast" },
      { name: "Idli with Sambar", calories: 220, proteinG: 8, carbsG: 38, fatG: 2, fiberG: 5, mealType: "breakfast" },
      { name: "Paratha with Curd", calories: 320, proteinG: 10, carbsG: 48, fatG: 9, fiberG: 3, mealType: "breakfast" },
    ],
    lunch: [
      { name: "Dal Rice with Sabzi", calories: 480, proteinG: 18, carbsG: 82, fatG: 6, fiberG: 8, mealType: "lunch" },
      { name: "Rajma Rice", calories: 520, proteinG: 20, carbsG: 88, fatG: 5, fiberG: 10, mealType: "lunch" },
      { name: "Chole Bhature", calories: 620, proteinG: 18, carbsG: 92, fatG: 18, fiberG: 9, mealType: "lunch" },
    ],
    dinner: [
      { name: "Roti with Paneer Sabzi", calories: 380, proteinG: 16, carbsG: 52, fatG: 12, fiberG: 5, mealType: "dinner" },
      { name: "Khichdi", calories: 320, proteinG: 14, carbsG: 58, fatG: 4, fiberG: 6, mealType: "dinner" },
      { name: "Moong Dal Soup with Roti", calories: 280, proteinG: 15, carbsG: 44, fatG: 3, fiberG: 7, mealType: "dinner" },
    ],
    snack: [
      { name: "Banana", calories: 90, proteinG: 1, carbsG: 23, fatG: 0, fiberG: 3, mealType: "snack" },
      { name: "Roasted Chana", calories: 130, proteinG: 8, carbsG: 20, fatG: 2, fiberG: 5, mealType: "snack" },
    ],
  };
  for (let d = 6; d >= 0; d--) {
    const date = new Date(today);
    date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().split("T")[0];
    const bf = foods.breakfast[d % 3];
    const lu = foods.lunch[d % 3];
    const di = foods.dinner[d % 3];
    const sn = foods.snack[d % 2];
    [bf, lu, di, sn].forEach(f => {
      if (f) {
        const loggedAt = new Date(date);
        logs.push({
          userId, mealType: f.mealType as "breakfast" | "lunch" | "dinner" | "snack",
          foodNameEn: f.name, calories: String(f.calories), proteinG: String(f.proteinG),
          carbsG: String(f.carbsG), fatG: String(f.fatG), fiberG: String(f.fiberG),
          inputMethod: "text" as const, loggedAt,
        });
      }
    });
  }
  return logs;
}

function getWaterLogs(userId: string) {
  const logs: Array<{ userId: string; glassesCount: number; mlAmount: number; loggedAt: Date }> = [];
  const today = new Date();
  for (let d = 6; d >= 0; d--) {
    const date = new Date(today);
    date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().split("T")[0];
    const glasses = 5 + (d % 4);
    logs.push({ userId, glassesCount: glasses, mlAmount: 250, loggedAt: new Date(date) });
  }
  return logs;
}

function getExerciseLogs(userId: string, activityLevel: string) {
  const logs: Array<{ userId: string; date: string; exerciseName: string; exerciseType: string; metValue: string; durationMinutes: number; caloriesBurned: string }> = [];
  const today = new Date();
  const exercises = activityLevel === "very"
    ? [
        { name: "Running", metValue: "10.0", durationMinutes: 45, caloriesBurned: 480 },
        { name: "Weight Training", metValue: "6.0", durationMinutes: 60, caloriesBurned: 380 },
        { name: "Swimming", metValue: "8.0", durationMinutes: 40, caloriesBurned: 380 },
      ]
    : activityLevel === "moderate"
    ? [
        { name: "Walking", metValue: "3.5", durationMinutes: 30, caloriesBurned: 140 },
        { name: "Yoga", metValue: "2.5", durationMinutes: 45, caloriesBurned: 110 },
        { name: "Cycling", metValue: "6.0", durationMinutes: 30, caloriesBurned: 220 },
      ]
    : [
        { name: "Walking", metValue: "3.5", durationMinutes: 20, caloriesBurned: 90 },
        { name: "Stretching", metValue: "2.3", durationMinutes: 15, caloriesBurned: 40 },
      ];
  for (let d = 6; d >= 0; d--) {
    if (d % 2 === 0) {
      const date = new Date(today);
      date.setDate(date.getDate() - d);
      const dateStr = date.toISOString().split("T")[0];
      const ex = exercises[d % exercises.length];
      if (ex) {
        logs.push({ userId, date: dateStr, exerciseName: ex.name, exerciseType: "cardio", metValue: ex.metValue, durationMinutes: ex.durationMinutes, caloriesBurned: String(ex.caloriesBurned) });
      }
    }
  }
  return logs;
}

function getStressLogs(userId: string) {
  const logs: Array<{ userId: string; stressType: "mood"; stressScore: number; mood: "happy" | "neutral" | "stressed" | "sad"; loggedAt: Date }> = [];
  const today = new Date();
  for (let d = 6; d >= 0; d--) {
    const date = new Date(today);
    date.setDate(date.getDate() - d);
    const stressScore = 35 + Math.round(Math.sin(d) * 20);
    logs.push({
      userId,
      stressType: "mood" as const,
      stressScore,
      mood: (stressScore > 60 ? "stressed" : stressScore > 40 ? "neutral" : "happy") as "happy" | "neutral" | "stressed" | "sad",
      loggedAt: date,
    });
  }
  return logs;
}

async function main() {
  console.log("🌱 Seeding 6 comprehensive demo users...\n");

  for (const user of DEMO_USERS) {
    console.log(`\n👤 Creating: ${user.profile.fullName} (${user.email})`);

    try {
      // 1. Insert user
      await db.insert(usersTable).values({
        id: user.id,
        phone: user.phone,
        email: user.email,
        plan: user.plan,
        languageCode: user.preferences.languageCode,
        isActive: true,
        referralCode: `DEMO${user.id.substring(0, 6).toUpperCase()}`,
      }).onConflictDoUpdate({
        target: usersTable.id,
        set: { plan: user.plan, isActive: true },
      });
      console.log(`  ✅ User created (plan: ${user.plan})`);

      // 2. Insert profile
      await db.insert(userProfilesTable).values({
        userId: user.id,
        ...user.profile,
      }).onConflictDoUpdate({
        target: userProfilesTable.userId,
        set: { ...user.profile, updatedAt: new Date() },
      });
      console.log(`  ✅ Profile created (${user.profile.city}, ${user.profile.bloodGroup})`);

      // 3. Medical conditions
      if (user.conditions.length > 0) {
        for (const cond of user.conditions) {
          await db.insert(userMedicalConditionsTable).values({
            userId: user.id, ...cond, isActive: true,
          }).onConflictDoNothing();
        }
        console.log(`  ✅ Medical conditions: ${user.conditions.map(c => c.condition.split(" ")[0]).join(", ")}`);
      }

      // 4. Health goals
      await db.insert(userHealthGoalsTable).values({
        userId: user.id,
        primaryGoal: user.goals.primaryGoal,
        targetWeightKg: user.goals.targetWeightKg,
        currentWeightKg: user.profile.weightKg,
        secondaryGoals: user.goals.secondaryGoals,
      }).onConflictDoNothing();
      console.log(`  ✅ Health goals: ${user.goals.primaryGoal}`);

      // 5. Preferences
      await db.insert(userPreferencesTable).values({
        userId: user.id,
        languageCode: user.preferences.languageCode,
        waterGoalGlasses: user.preferences.waterGoalGlasses,
        calorieGoal: user.preferences.calorieGoal,
        notificationsEnabled: true,
        medicineReminders: true,
        waterReminders: true,
        foodReminders: true,
        suggestionNotifications: true,
      }).onConflictDoUpdate({
        target: userPreferencesTable.userId,
        set: {
          languageCode: user.preferences.languageCode,
          waterGoalGlasses: user.preferences.waterGoalGlasses,
          calorieGoal: user.preferences.calorieGoal,
        },
      });
      console.log(`  ✅ Preferences set`);

      // 6. Food logs (7 days)
      const foodLogs = getFoodLogs(user.id, user.plan);
      for (const log of foodLogs) {
        await db.insert(foodLogsTable).values(log).onConflictDoNothing();
      }
      console.log(`  ✅ Food logs: ${foodLogs.length} entries (7 days)`);

      // 7. Water logs (7 days)
      const waterLogs = getWaterLogs(user.id);
      for (const log of waterLogs) {
        await db.insert(waterLogsTable).values(log).onConflictDoNothing();
      }
      console.log(`  ✅ Water logs: ${waterLogs.length} entries (7 days)`);

      // 8. Exercise logs (7 days)
      const exerciseLogs = getExerciseLogs(user.id, user.profile.activityLevel);
      for (const log of exerciseLogs) {
        await db.insert(exerciseLogsTable).values(log).onConflictDoNothing();
      }
      console.log(`  ✅ Exercise logs: ${exerciseLogs.length} entries`);

      // 9. Stress logs (7 days)
      const stressLogs = getStressLogs(user.id);
      for (const log of stressLogs) {
        await db.insert(stressLogsTable).values(log).onConflictDoNothing();
      }
      console.log(`  ✅ Stress logs: ${stressLogs.length} entries`);

      // 10. Medicine schedule (for users with conditions)
      if (user.conditions.length > 0) {
        const medicines = user.conditions.flatMap((c, i) => {
          if (c.condition.includes("Hypertension")) return [{ name: "Amlodipine 5mg", times: ["08:00", "21:00"] }];
          if (c.condition.includes("Diabetes")) return [{ name: "Metformin 500mg", times: ["08:00", "21:00"] }, { name: "Glimepiride 2mg", times: ["08:00"] }];
          if (c.condition.includes("Thyroid")) return [{ name: "Levothyroxine 50mcg", times: ["07:00"] }];
          if (c.condition.includes("PCOS")) return [{ name: "Inositol 2g", times: ["09:00"] }];
          if (c.condition.includes("Cholesterol")) return [{ name: "Atorvastatin 10mg", times: ["21:00"] }];
          if (c.condition.includes("Vitamin D")) return [{ name: "Vitamin D3 60K IU", times: ["09:00"] }];
          if (c.condition.includes("B12") || c.condition.includes("Anemia")) return [{ name: "Vitamin B12 500mcg", times: ["09:00"] }];
          return [];
        });
        for (const med of medicines) {
          const [schedule] = await db.insert(medicineSchedulesTable).values({
            userId: user.id,
            medicineName: med.name,
            frequency: "daily",
            reminderTimes: med.times,
            isActive: true,
            startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          }).returning();
          if (schedule?.id) {
            const scheduledAt = new Date();
            scheduledAt.setHours(parseInt(med.times[0]?.split(":")[0] || "9"), 0, 0, 0);
            await db.insert(medicineLogsTable).values({
              userId: user.id, scheduleId: schedule.id,
              status: "taken",
              scheduledAt,
              takenAt: new Date(),
            }).onConflictDoNothing();
          }
        }
        console.log(`  ✅ Medicine schedules: ${medicines.map(m => m.name).join(", ")}`);
      }

      // 11. Active subscription for paid plans
      if (user.plan !== "free") {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        await db.insert(subscriptionsTable).values({
          userId: user.id, plan: user.plan,
          status: "active", source: "demo",
          expiresAt, paymentType: "one_time", autoRenew: false,
        }).onConflictDoNothing();
        console.log(`  ✅ Subscription: ${user.plan} (active, 30 days)`);
      }

      // 12. Blood donor for O+ and O-
      if (user.profile.bloodGroup === "O+" || user.profile.bloodGroup === "O-" || user.profile.bloodGroup === "B+") {
        await db.insert(bloodDonorsTable).values({
          userId: user.id,
          bloodGroup: user.profile.bloodGroup as "A+" | "A-" | "B+" | "B-" | "O+" | "O-" | "AB+" | "AB-",
          city: user.profile.city,
          state: user.profile.state,
          isAvailable: true,
          otpVerified: true,
          verifiedAt: new Date(),
        }).onConflictDoNothing();
        console.log(`  ✅ Blood donor: ${user.profile.bloodGroup} in ${user.profile.city}`);
      }

      // Generate JWT
      const token = jwt.sign({
        userId: user.id,
        phone: user.phone,
        email: user.email,
        plan: user.plan,
      }, JWT_SECRET, { expiresIn: "90d" });
      console.log(`\n  🔑 JWT (${user.email}):\n  ${token}\n`);

    } catch (err) {
      console.error(`  ❌ Error for ${user.profile.fullName}:`, err);
    }
  }

  console.log("\n✅ All 6 demo users seeded successfully!");
  console.log("\n📋 Demo User Summary:");
  DEMO_USERS.forEach(u => {
    console.log(`  • ${u.profile.fullName} | ${u.email} | ${u.plan.toUpperCase()} | ${u.profile.city}`);
  });

  process.exit(0);
}

main().catch(err => { console.error("❌ Fatal:", err); process.exit(1); });
