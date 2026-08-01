// lib/health/types.ts
//
// SINGLE SOURCE OF TRUTH for everything Health Connect needs:
//   - which record types the app reads
//   - what permission request shape react-native-health-connect expects
//   - the metrics payload shape sent to the backend
//
// If the app ever needs a new metric, add it ONLY here — the client,
// aggregator, sync manager and UI all import from this file.

/** The exact record types Health Connect exposes that this app consumes.
 *  Each one maps 1:1 to a screen that displays it — see the comment
 *  next to each entry. Do not add a type here unless a screen uses it;
 *  Play Store review checks that requested health permissions are
 *  actually used by the app. */
export const HEALTH_RECORD_TYPES = [
  "Steps",               // wearable.tsx MetricCard + WHO daily steps target
  "HeartRate",           // wearable.tsx MetricCard + WHO resting HR target
  "TotalCaloriesBurned", // wearable.tsx MetricCard (falls back to ActiveCaloriesBurned)
  "ActiveCaloriesBurned",// fallback source for calories when Total is empty
  "SleepSession",        // wearable.tsx MetricCard + WHO sleep duration target
  "OxygenSaturation",    // wearable.tsx MetricCard + WHO SpO2 target
  "Distance",            // wearable.tsx MetricCard
  "ExerciseSession",     // wearable.tsx MetricCard + WHO weekly active-minutes target
] as const;

export type HealthRecordType = (typeof HEALTH_RECORD_TYPES)[number];

/** Android manifest permission string for each record type (read-only —
 *  this app never writes to Health Connect). Kept here so the Expo config
 *  plugin (plugins/with-health-connect.js) and app.json can both be
 *  generated/validated from one list instead of hand-duplicated. */
export const HEALTH_PERMISSION_MAP: Record<HealthRecordType, string> = {
  Steps: "android.permission.health.READ_STEPS",
  HeartRate: "android.permission.health.READ_HEART_RATE",
  TotalCaloriesBurned: "android.permission.health.READ_TOTAL_CALORIES_BURNED",
  ActiveCaloriesBurned: "android.permission.health.READ_ACTIVE_CALORIES_BURNED",
  SleepSession: "android.permission.health.READ_SLEEP",
  OxygenSaturation: "android.permission.health.READ_OXYGEN_SATURATION",
  Distance: "android.permission.health.READ_DISTANCE",
  ExerciseSession: "android.permission.health.READ_EXERCISE",
};

/** Build the exact request shape react-native-health-connect's
 *  requestPermission() expects, from the single record-type list above. */
export function buildPermissionRequests(): Array<{ accessType: "read"; recordType: HealthRecordType }> {
  return HEALTH_RECORD_TYPES.map((recordType) => ({ accessType: "read" as const, recordType }));
}

export type HealthConnectStatus =
  | "checking"      // initial check in progress
  | "available"     // installed, initialized, permissions can be requested
  | "not_installed" // Health Connect app missing
  | "needs_update"  // installed but provider update required
  | "not_supported" // Android < 9 / SDK unavailable
  | "error";        // native module missing / unexpected failure

/** Raw records grouped by type, exactly as read from Health Connect.
 *  Any record type that failed to read (permission denied, transient
 *  IPC error, etc.) is simply an empty array — a failure on one type
 *  must never affect the others. */
export type RawRecordsByType = Partial<Record<HealthRecordType, unknown[]>>;

/** The aggregated metrics payload the backend's /health/sync endpoint expects. */
export type HealthMetrics = {
  steps: number | null;
  heartRateAvg: number | null;
  heartRateMin: number | null;
  heartRateMax: number | null;
  caloriesBurned: number | null;
  sleepHours: number | null;
  bloodOxygen: number | null;
  distanceKm: number | null;
  activeMinutes: number | null;
};

export const EMPTY_METRICS: HealthMetrics = {
  steps: null,
  heartRateAvg: null,
  heartRateMin: null,
  heartRateMax: null,
  caloriesBurned: null,
  sleepHours: null,
  bloodOxygen: null,
  distanceKm: null,
  activeMinutes: null,
};
