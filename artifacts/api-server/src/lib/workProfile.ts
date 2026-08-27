// ─── Shared work-profile → TDEE logic ───────────────────────────────────────
// Job role → physical-demand multiplier, shared by the Health Score engine
// (scoring.ts) and the AI Coach (routes/modules/suggestions.ts) so a user's
// job type affects their calorie/exercise goals the same way everywhere.
// Previously each had its own formula, and scoring.ts's ignored job role
// entirely -- two users with identical self-reported activityLevel but very
// different jobs (e.g. "Farmer/Agriculture" vs "Office/Desk Job") got
// identical calorie/protein goals from the Health Score, while the AI Coach
// already told them apart correctly.

export const WORK_PROFILE_MULTIPLIERS: Record<string, number> = {
  "Office/Desk Job":     1.2,
  "IT/Software":         1.2,
  "Call Center/BPO":     1.2,
  "Freelancer/WFH":      1.2,
  "Teacher/Professor":   1.375,
  "Doctor/Healthcare":   1.375,
  "Business Owner":      1.375,
  "Housewife":           1.375,
  "House Husband":       1.375,
  "Retired":             1.375,
  "Artist/Creative":     1.375,
  "Student (School)":    1.375,
  "Field/Sales":         1.55,
  "Driver/Delivery":     1.55,
  "Factory Worker":      1.55,
  "ASHA/ANM Worker":     1.55,
  "Student (College)":   1.55,
  "Police/CRPF":         1.725,
  "Army/Defence":        1.725,
  "Farmer/Agriculture":  1.725,
  "Construction Worker": 1.725,
  "Athlete/Sports":      1.9,
};

// Maps work profile → activity level label (for display + AI prompt text)
export const WORK_PROFILE_ACTIVITY: Record<string, string> = {
  "Office/Desk Job":     "sedentary",
  "IT/Software":         "sedentary",
  "Call Center/BPO":     "sedentary",
  "Freelancer/WFH":      "sedentary",
  "Teacher/Professor":   "light",
  "Doctor/Healthcare":   "light",
  "Business Owner":      "light",
  "Housewife":           "light",
  "House Husband":       "light",
  "Retired":             "light",
  "Artist/Creative":     "light",
  "Student (School)":    "light",
  "Field/Sales":         "moderate",
  "Driver/Delivery":     "moderate",
  "Factory Worker":      "moderate",
  "ASHA/ANM Worker":     "moderate",
  "Student (College)":   "moderate",
  "Police/CRPF":         "very",
  "Army/Defence":        "very",
  "Farmer/Agriculture":  "very",
  "Construction Worker": "very",
  "Athlete/Sports":      "athlete",
};

// Some profiles store the older long "_active" form (e.g. "lightly_active")
// from before activityLevel was normalized to the short form used below --
// both are accepted so neither caller silently drops a user's exercise
// bonus depending on which form happens to be stored for them.
const ACTIVITY_LEVEL_ALIASES: Record<string, string> = {
  lightly_active: "light",
  moderately_active: "moderate",
  very_active: "very",
};

const EXERCISE_ACTIVITY_ADD: Record<string, number> = {
  sedentary: 0, light: 0.05, moderate: 0.1, very: 0.175, athlete: 0.25,
};

/**
 * TDEE = BMR × effective multiplier, where the multiplier combines a
 * job-based physical-demand baseline (WORK_PROFILE_MULTIPLIERS) with an
 * additive bonus for self-reported exercise activity level, capped at 2.0
 * total. The one formula both the Health Score engine and the AI Coach
 * use -- keep it here, not duplicated in either file.
 */
export function calculateEffectiveTDEE(
  bmr: number, activityLevel: string, workProfile?: string | null,
): number {
  const workMultiplier = workProfile ? (WORK_PROFILE_MULTIPLIERS[workProfile] || 1.4) : 1.4;
  const normalizedActivity = ACTIVITY_LEVEL_ALIASES[activityLevel] ?? activityLevel;
  const exerciseAdd = EXERCISE_ACTIVITY_ADD[normalizedActivity] ?? 0;
  const effectiveMultiplier = Math.min(2.0, workMultiplier + exerciseAdd);
  return Math.round(bmr * effectiveMultiplier);
}
