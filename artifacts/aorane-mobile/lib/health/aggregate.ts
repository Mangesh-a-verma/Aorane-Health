// lib/health/aggregate.ts
//
// Pure functions: raw Health Connect records -> the metrics payload the
// backend expects. This used to be copy-pasted (with subtly different
// null-handling) in both lib/healthSyncManager.ts and app/wearable.tsx.
// Now it lives in exactly one place.

import { EMPTY_METRICS, HealthMetrics, RawRecordsByType } from "./types";

function durationHours(records: unknown[]): number | null {
  if (records.length === 0) return null;
  const ms = records.reduce<number>((sum, r) => {
    const rec = r as { startTime?: string; endTime?: string };
    const start = rec.startTime ? new Date(rec.startTime).getTime() : NaN;
    const end = rec.endTime ? new Date(rec.endTime).getTime() : NaN;
    return sum + (Number.isFinite(start) && Number.isFinite(end) && end > start ? end - start : 0);
  }, 0);
  return ms > 0 ? Math.round((ms / 3_600_000) * 10) / 10 : null;
}

function durationMinutes(records: unknown[]): number | null {
  if (records.length === 0) return null;
  const ms = records.reduce<number>((sum, r) => {
    const rec = r as { startTime?: string; endTime?: string };
    const start = rec.startTime ? new Date(rec.startTime).getTime() : NaN;
    const end = rec.endTime ? new Date(rec.endTime).getTime() : NaN;
    return sum + (Number.isFinite(start) && Number.isFinite(end) && end > start ? end - start : 0);
  }, 0);
  return ms > 0 ? Math.round(ms / 60_000) : null;
}

export function aggregateHealthMetrics(records: RawRecordsByType): HealthMetrics {
  const steps = records.Steps ?? [];
  const heartRate = records.HeartRate ?? [];
  const totalCalories = records.TotalCaloriesBurned ?? [];
  const activeCalories = records.ActiveCaloriesBurned ?? [];
  const sleep = records.SleepSession ?? [];
  const spo2 = records.OxygenSaturation ?? [];
  const distance = records.Distance ?? [];
  const exercise = records.ExerciseSession ?? [];

  const metrics: HealthMetrics = { ...EMPTY_METRICS };

  // Steps
  if (steps.length > 0) {
    const total = steps.reduce<number>((s, r) => s + ((r as { count?: number }).count || 0), 0);
    metrics.steps = total > 0 ? total : null;
  }

  // Heart rate — flatten samples across all records in the range
  const samples = heartRate.flatMap((r) => (r as { samples?: Array<{ beatsPerMinute?: number }> }).samples ?? []);
  const bpms = samples.map((s) => s.beatsPerMinute).filter((v): v is number => typeof v === "number" && v > 0);
  if (bpms.length > 0) {
    metrics.heartRateAvg = Math.round(bpms.reduce((s, v) => s + v, 0) / bpms.length);
    metrics.heartRateMin = Math.min(...bpms);
    metrics.heartRateMax = Math.max(...bpms);
  }

  // Calories — prefer TotalCaloriesBurned, fall back to ActiveCaloriesBurned
  const totalCals = totalCalories.reduce<number>(
    (s, r) => s + ((r as { energy?: { inKilocalories?: number } }).energy?.inKilocalories || 0),
    0
  );
  if (totalCals > 0) {
    metrics.caloriesBurned = Math.round(totalCals);
  } else {
    const activeCals = activeCalories.reduce<number>(
      (s, r) => s + ((r as { energy?: { inKilocalories?: number } }).energy?.inKilocalories || 0),
      0
    );
    if (activeCals > 0) metrics.caloriesBurned = Math.round(activeCals);
  }

  // Sleep
  metrics.sleepHours = durationHours(sleep);

  // Blood oxygen (SpO2) — average of all readings in range
  if (spo2.length > 0) {
    const total = spo2.reduce<number>((s, r) => s + ((r as { percentage?: number }).percentage || 0), 0);
    metrics.bloodOxygen = Math.round((total / spo2.length) * 10) / 10;
  }

  // Distance
  if (distance.length > 0) {
    const totalM = distance.reduce<number>(
      (s, r) => s + ((r as { distance?: { inMeters?: number } }).distance?.inMeters || 0),
      0
    );
    metrics.distanceKm = totalM > 0 ? Math.round((totalM / 1000) * 100) / 100 : null;
  }

  // Active minutes (from exercise sessions)
  metrics.activeMinutes = durationMinutes(exercise);

  return metrics;
}

/** True if at least one metric came back non-null — used to tell the
 *  user "connected, data synced" vs "connected, but nothing found yet". */
export function hasAnyData(metrics: HealthMetrics): boolean {
  return Object.values(metrics).some((v) => v !== null);
}