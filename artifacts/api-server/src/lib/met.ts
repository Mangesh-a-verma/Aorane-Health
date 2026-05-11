/**
 * MET (Metabolic Equivalent of Task) formula for exercise calorie calculation
 * Calories = MET × weight_kg × duration_hours
 * No AI needed — pure formula
 */

export const MET_VALUES: Record<string, number> = {
  // Walking / Running
  walking: 3.5,
  brisk_walking: 4.5,
  running: 8.0,
  jogging: 7.0,
  hiking: 5.5,
  // Cycling
  cycling: 6.0,
  cycling_fast: 10.0,
  // Strength
  weight_training: 3.5,
  bodyweight: 3.8,
  // Yoga / Flexibility
  yoga: 2.5,
  stretching: 2.3,
  pilates: 3.0,
  // Indian exercises
  surya_namaskar: 5.0,
  // Sports
  cricket: 4.5,
  badminton: 5.5,
  football: 7.0,
  basketball: 6.5,
  swimming: 7.0,
  // Daily activity
  dancing: 4.8,
  household_chores: 3.0,
  gardening: 3.5,
  // Default
  default: 4.0,
};

export function calculateCaloriesBurned(
  exerciseType: string,
  durationMinutes: number,
  weightKg: number,
): number {
  const key = exerciseType.toLowerCase().replace(/[\s-]/g, "_");
  const met = MET_VALUES[key] ?? MET_VALUES.default;
  const hours = durationMinutes / 60;
  return Math.round(met * weightKg * hours);
}

export function getMet(exerciseType: string): number {
  const key = exerciseType.toLowerCase().replace(/[\s-]/g, "_");
  return MET_VALUES[key] ?? MET_VALUES.default;
}
