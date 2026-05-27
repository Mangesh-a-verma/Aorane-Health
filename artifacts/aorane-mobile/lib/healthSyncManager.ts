// src/lib/healthSyncManager.ts
import { Platform } from "react-native";
import { api } from "./api"; // Apne api.ts ka sahi path lagayein (e.g., "@/lib/api")
import { SyncStorage } from "./syncStorage";

// Helper function: Safely array extract karne ke liye
const extractRecords = (res: PromiseSettledResult<unknown>): any[] => {
  if (res.status !== "fulfilled") return [];
  const val = res.value as any;
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (val.records && Array.isArray(val.records)) return val.records;
  return [];
};

export async function smartSync(): Promise<{ success: boolean; error?: string }> {
  try {
    // Sirf Android par chalega
    if (Platform.OS !== "android") return { success: true };

    // 1. Time Lock Check (4 hours)
    const should = await SyncStorage.shouldSync();
    if (!should) return { success: true, error: "Too soon for next sync" };

    const raw = require("react-native-health-connect");
    const hc = raw?.default || raw;

    const initialized = await hc.initialize();
    if (!initialized) return { success: false, error: "Health Connect not initialized" };

    const status = await hc.getSdkStatus();
    if (status !== hc.SdkAvailabilityStatus.SDK_AVAILABLE) {
      return { success: false, error: "Health Connect SDK not available" };
    }

    // 2. Aaj ke data ki date range set karein
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const range = { operator: "between" as const, startTime: startOfToday.toISOString(), endTime: now.toISOString() };

    // 3. Sab data ek sath silently fetch karein
    const [stepsRes, hrRes, calRes, activeCalRes, sleepRes, spo2Res, distRes, exerciseRes] = await Promise.allSettled([
      hc.readRecords("Steps", { timeRangeFilter: range }),
      hc.readRecords("HeartRate", { timeRangeFilter: range }),
      hc.readRecords("TotalCaloriesBurned", { timeRangeFilter: range }),
      hc.readRecords("ActiveCaloriesBurned", { timeRangeFilter: range }),
      hc.readRecords("SleepSession", { timeRangeFilter: range }),
      hc.readRecords("OxygenSaturation", { timeRangeFilter: range }),
      hc.readRecords("Distance", { timeRangeFilter: range }),
      hc.readRecords("ExerciseSession", { timeRangeFilter: range }),
    ]);

    let steps: number | null = null;
    let heartRateAvg: number | null = null;
    let heartRateMin: number | null = null;
    let heartRateMax: number | null = null;
    let caloriesBurned: number | null = null;
    let sleepHours: number | null = null;
    let bloodOxygen: number | null = null;
    let distanceKm: number | null = null;
    let activeMinutes: number | null = null;

    // --- Data Parsing ---
    const stepRecs = extractRecords(stepsRes);
    if (stepRecs.length > 0) steps = stepRecs.reduce((s, r) => s + (r.count || 0), 0);

    const hrRecs = extractRecords(hrRes);
    const allSamples = hrRecs.flatMap((r) => r.samples ?? []);
    if (allSamples.length > 0) {
      const bpms = allSamples.map((r) => r.beatsPerMinute).filter(Boolean);
      if (bpms.length > 0) {
        heartRateAvg = Math.round(bpms.reduce((s, v) => s + v, 0) / bpms.length);
        heartRateMin = Math.min(...bpms);
        heartRateMax = Math.max(...bpms);
      }
    }

    const calRecs = extractRecords(calRes);
    const totalCals = calRecs.reduce((s, r) => s + (r.energy?.inKilocalories || 0), 0);
    if (totalCals > 0) {
      caloriesBurned = Math.round(totalCals);
    } else {
      const activeCalRecs = extractRecords(activeCalRes);
      const totalActive = activeCalRecs.reduce((s, r) => s + (r.energy?.inKilocalories || 0), 0);
      if (totalActive > 0) caloriesBurned = Math.round(totalActive);
    }

    const sleepRecs = extractRecords(sleepRes);
    if (sleepRecs.length > 0) {
      const ms = sleepRecs.reduce((s, r) => {
        const start = new Date(r.startTime).getTime();
        const end = new Date(r.endTime).getTime();
        return s + (end > start ? end - start : 0);
      }, 0);
      if (ms > 0) sleepHours = Math.round((ms / 3_600_000) * 10) / 10;
    }

    const spo2Recs = extractRecords(spo2Res);
    if (spo2Recs.length > 0) bloodOxygen = Math.round(spo2Recs.reduce((s, r) => s + (r.percentage || 0), 0) / spo2Recs.length * 10) / 10;

    const distRecs = extractRecords(distRes);
    if (distRecs.length > 0) {
      const totalM = distRecs.reduce((s, r) => s + (r.distance?.inMeters || 0), 0);
      if (totalM > 0) distanceKm = Math.round(totalM / 1000 * 100) / 100;
    }

    const exRecs = extractRecords(exerciseRes);
    if (exRecs.length > 0) {
      const totalMs = exRecs.reduce((s, r) => {
        const start = new Date(r.startTime).getTime();
        const end = new Date(r.endTime).getTime();
        return s + (end > start ? end - start : 0);
      }, 0);
      if (totalMs > 0) activeMinutes = Math.round(totalMs / 60_000);
    }

    // 4. Send Data to Server (Using your Vercel Backend)
    const payload = { 
      steps, heartRateAvg, heartRateMin, heartRateMax, 
      caloriesBurned, sleepHours, bloodOxygen, distanceKm, activeMinutes 
    };
    
    await api.syncHealthConnect(payload);
    
    // 5. Trigger Health Score Calculation Immediately
    const todayStr = now.toISOString().split("T")[0];
    await api.computeHealthScore(todayStr);

    // 6. Update the lock timer so it doesn't run again for 4 hours
    await SyncStorage.setLastSync();
    console.log("[SmartSync] Successfully synced and updated health score.");

    return { success: true };
  } catch (err) {
    console.warn("[SmartSync] Error:", err);
    return { success: false, error: (err as Error).message };
  }
}