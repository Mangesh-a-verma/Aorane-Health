// src/lib/healthSyncManager.ts
import { Platform } from "react-native";
import { api } from "./api";
import { SyncStorage } from "./syncStorage";
import {
  initializeHealthConnect,
  batchReadRecords,
  getHealthConnectStatus,
} from "./healthConnectWrapper";

// Helper function: Safely extract records
const extractRecords = (records: any[]): any[] => {
  return Array.isArray(records) ? records : [];
};

export async function smartSync(): Promise<{ success: boolean; error?: string }> {
  try {
    // Only runs on Android
    if (Platform.OS !== "android") return { success: true };

    // 1. Time Lock Check (4 hours)
    const should = await SyncStorage.shouldSync();
    if (!should) return { success: true, error: "Too soon for next sync" };

    // 2. Initialize Health Connect with safe wrapper
    const initialized = await initializeHealthConnect();
    if (!initialized) {
      console.log("[SmartSync] Health Connect unavailable on this device");
      // Don't fail entirely - just skip sync
      return { success: true, error: "Health Connect not available" };
    }

    // 3. Today's Date Range
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 86400000);
    const range = {
      operator: "between" as const,
      startTime: last24Hours.toISOString(),
      endTime: now.toISOString(),
    };

    // 4. Batch fetch all health records safely
    const recordTypes = [
      "Steps",
      "HeartRate",
      "TotalCaloriesBurned",
      "ActiveCaloriesBurned",
      "SleepSession",
      "OxygenSaturation",
      "Distance",
      "ExerciseSession",
    ];

    const allRecords = await batchReadRecords(recordTypes, range);

    // Extract individual record types
    const stepsRecords = extractRecords(allRecords["Steps"] || []);
    const hrRecords = extractRecords(allRecords["HeartRate"] || []);
    const calRecords = extractRecords(allRecords["TotalCaloriesBurned"] || []);
    const activeCalRecords = extractRecords(allRecords["ActiveCaloriesBurned"] || []);
    const sleepRecords = extractRecords(allRecords["SleepSession"] || []);
    const spo2Records = extractRecords(allRecords["OxygenSaturation"] || []);
    const distRecords = extractRecords(allRecords["Distance"] || []);
    const exRecords = extractRecords(allRecords["ExerciseSession"] || []);

    // 5. Parse and aggregate data
    let steps: number | null = null;
    let heartRateAvg: number | null = null;
    let heartRateMin: number | null = null;
    let heartRateMax: number | null = null;
    let caloriesBurned: number | null = null;
    let sleepHours: number | null = null;
    let bloodOxygen: number | null = null;
    let distanceKm: number | null = null;
    let activeMinutes: number | null = null;

    // Steps
    if (stepsRecords.length > 0) {
      steps = stepsRecords.reduce((s, r) => s + (r.count || 0), 0);
    }

    // Heart Rate
    const allSamples = hrRecords.flatMap((r) => r.samples ?? []);
    if (allSamples.length > 0) {
      const bpms = allSamples.map((r) => r.beatsPerMinute).filter(Boolean);
      if (bpms.length > 0) {
        heartRateAvg = Math.round(bpms.reduce((s, v) => s + v, 0) / bpms.length);
        heartRateMin = Math.min(...bpms);
        heartRateMax = Math.max(...bpms);
      }
    }

    // Calories
    const totalCals = calRecords.reduce((s, r) => s + (r.energy?.inKilocalories || 0), 0);
    if (totalCals > 0) {
      caloriesBurned = Math.round(totalCals);
    } else {
      const totalActive = activeCalRecords.reduce((s, r) => s + (r.energy?.inKilocalories || 0), 0);
      if (totalActive > 0) caloriesBurned = Math.round(totalActive);
    }

    // Sleep
    if (sleepRecords.length > 0) {
      const ms = sleepRecords.reduce((s, r) => {
        const start = new Date(r.startTime).getTime();
        const end = new Date(r.endTime).getTime();
        return s + (end > start ? end - start : 0);
      }, 0);
      if (ms > 0) sleepHours = Math.round((ms / 3_600_000) * 10) / 10;
    }

    // Oxygen Saturation
    if (spo2Records.length > 0) {
      bloodOxygen =
        Math.round((spo2Records.reduce((s, r) => s + (r.percentage || 0), 0) / spo2Records.length) * 10) / 10;
    }

    // Distance
    if (distRecords.length > 0) {
      const totalM = distRecords.reduce((s, r) => s + (r.distance?.inMeters || 0), 0);
      if (totalM > 0) distanceKm = Math.round((totalM / 1000) * 100) / 100;
    }

    // Exercise/Active Minutes
    if (exRecords.length > 0) {
      const totalMs = exRecords.reduce((s, r) => {
        const start = new Date(r.startTime).getTime();
        const end = new Date(r.endTime).getTime();
        return s + (end > start ? end - start : 0);
      }, 0);
      if (totalMs > 0) activeMinutes = Math.round(totalMs / 60_000);
    }

    // 6. Send data to backend
    const payload = {
      steps,
      heartRateAvg,
      heartRateMin,
      heartRateMax,
      caloriesBurned,
      sleepHours,
      bloodOxygen,
      distanceKm,
      activeMinutes,
    };

    await api.syncHealthConnect(payload);

    // 7. Trigger health score calculation
    const todayStr = now.toISOString().split("T")[0];
    await api.computeHealthScore(todayStr);

    // 8. Update sync lock
    await SyncStorage.setLastSync();
    console.log("[SmartSync] Successfully synced and updated health score.");

    return { success: true };
  } catch (err) {
    console.warn("[SmartSync] Error:", err);
    return { success: false, error: (err as Error).message };
  }
}