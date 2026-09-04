// lib/health/aggregate.ts
//
// Pure functions: raw Health Connect records -> the metrics payload the
// backend expects. This used to be copy-pasted (with subtly different
// null-handling) in both lib/healthSyncManager.ts and app/wearable.tsx.
// Now it lives in exactly one place.

import { EMPTY_METRICS, EMPTY_SOURCE, HealthMetrics, HealthSource, RawRecordsByType } from "./types";

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

// ── Data-origin attribution ───────────────────────────────────────────────────

/** Health Connect's own package. It appears as the origin on records the user
 *  entered by hand in the Health Connect app itself. Real wearable data always
 *  carries the writing app's package instead, so this is a valid origin — just
 *  a much less interesting one than "Samsung Health". */
const HEALTH_CONNECT_PACKAGE = "com.google.android.apps.healthdata";

type RecordMetadata = {
  metadata?: {
    dataOrigin?: string;
    device?: { manufacturer?: string; model?: string };
  };
};

/** Best-effort human device label from one record's device metadata.
 *  Returns null rather than a half-empty string when neither field is set. */
function deviceLabel(record: unknown): string | null {
  const device = (record as RecordMetadata).metadata?.device;
  if (!device) return null;
  const parts = [device.manufacturer, device.model]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((v) => v.length > 0);
  return parts.length > 0 ? parts.join(" ") : null;
}

/** Which app actually recorded this batch, and on what device.
 *
 *  Picks the package that wrote the most records. Health Connect's own package
 *  only wins if nothing else wrote anything, so a single manually-entered row
 *  never outranks a watch that synced all day. Ties break on package name so
 *  the same input always produces the same answer.
 *
 *  Pure — takes the records already read by client.readAllRecords() and reads
 *  nothing else. Kept out of aggregateHealthMetrics() so that attribution can
 *  never influence hasAnyData(). */
export function resolveDataSource(records: RawRecordsByType): HealthSource {
  const counts = new Map<string, number>();
  const devices = new Map<string, string>();

  for (const list of Object.values(records)) {
    for (const record of list ?? []) {
      const origin = (record as RecordMetadata).metadata?.dataOrigin;
      if (typeof origin !== "string" || origin.length === 0) continue;
      counts.set(origin, (counts.get(origin) ?? 0) + 1);
      if (!devices.has(origin)) {
        const label = deviceLabel(record);
        if (label) devices.set(origin, label);
      }
    }
  }

  if (counts.size === 0) return { ...EMPTY_SOURCE };

  // Rank real writer apps above Health Connect's own manual entries, then by
  // how much each wrote, then alphabetically so the result is deterministic.
  const winner = [...counts.entries()].sort((a, b) => {
    const aIsHC = a[0] === HEALTH_CONNECT_PACKAGE ? 1 : 0;
    const bIsHC = b[0] === HEALTH_CONNECT_PACKAGE ? 1 : 0;
    if (aIsHC !== bIsHC) return aIsHC - bIsHC;
    if (a[1] !== b[1]) return b[1] - a[1];
    return a[0] < b[0] ? -1 : 1;
  })[0][0];

  return { sourcePackage: winner, sourceDevice: devices.get(winner) ?? null };
}

/** True if at least one metric came back non-null — used to tell the
 *  user "connected, data synced" vs "connected, but nothing found yet". */
export function hasAnyData(metrics: HealthMetrics): boolean {
  return Object.values(metrics).some((v) => v !== null);
}