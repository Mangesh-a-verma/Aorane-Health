// lib/healthConnectWrapper.ts
import { Platform } from "react-native";

/**
 * WRAPPER: Safely handles react-native-health-connect crashes when Health Connect app is unavailable.
 * Prevents TurboModuleRegistry.getEnforcing() hard-crash by using try-catch.
 */

export type HealthConnectStatus = "available" | "unavailable" | "unknown";

let healthConnect: any = null;
let sdkStatus: HealthConnectStatus = "unknown";

/**
 * Initialize Health Connect wrapper with error handling
 */
export async function initializeHealthConnect(): Promise<boolean> {
  if (Platform.OS !== "android") {
    console.log("[HC Wrapper] Not Android, skipping HC init");
    return false;
  }

  try {
    // Safely require the module
    const raw = require("react-native-health-connect");
    healthConnect = raw?.default || raw;

    if (!healthConnect) {
      console.warn("[HC Wrapper] Module loaded but null/undefined");
      sdkStatus = "unavailable";
      return false;
    }

    // Attempt initialization
    const initialized = await healthConnect.initialize();
    console.log("[HC Wrapper] HC initialized:", initialized);

    if (!initialized) {
      sdkStatus = "unavailable";
      return false;
    }

    // Check SDK status safely
    try {
      const status = await healthConnect.getSdkStatus();
      sdkStatus = status === healthConnect.SdkAvailabilityStatus.SDK_AVAILABLE 
        ? "available" 
        : "unavailable";
      console.log("[HC Wrapper] SDK status:", sdkStatus);
      return sdkStatus === "available";
    } catch (statusErr) {
      console.warn("[HC Wrapper] getSdkStatus failed:", statusErr);
      sdkStatus = "unavailable";
      return false;
    }
  } catch (err) {
    console.warn("[HC Wrapper] Init error (likely HC app missing):", err);
    sdkStatus = "unavailable";
    return false;
  }
}

/**
 * Safely read health records with fallback
 */
export async function readHealthRecords(
  recordType: string,
  timeRangeFilter: any
): Promise<any[]> {
  if (!healthConnect || sdkStatus !== "available") {
    console.log(`[HC Wrapper] HC unavailable, returning empty for ${recordType}`);
    return [];
  }

  try {
    const result = await healthConnect.readRecords(recordType, { timeRangeFilter });
    
    // Handle different response formats
    if (Array.isArray(result)) return result;
    if (result?.records && Array.isArray(result.records)) return result.records;
    return [];
  } catch (err) {
    console.warn(`[HC Wrapper] Failed to read ${recordType}:`, err);
    // Mark as unavailable for future attempts
    sdkStatus = "unavailable";
    return [];
  }
}

/**
 * Batch read multiple record types safely
 */
export async function batchReadRecords(
  recordTypes: string[],
  timeRangeFilter: any
): Promise<Record<string, any[]>> {
  const results: Record<string, any[]> = {};

  if (sdkStatus === "unavailable") {
    console.log("[HC Wrapper] HC unavailable, returning empty results");
    return Object.fromEntries(recordTypes.map(t => [t, []]));
  }

  const promises = recordTypes.map(async (type) => {
    try {
      const records = await readHealthRecords(type, timeRangeFilter);
      results[type] = records;
    } catch (err) {
      console.warn(`[HC Wrapper] Batch read failed for ${type}:`, err);
      results[type] = [];
    }
  });

  await Promise.allSettled(promises);
  return results;
}

/**
 * Get current HC availability status
 */
export function getHealthConnectStatus(): HealthConnectStatus {
  return sdkStatus;
}

/**
 * Reset HC status (useful for testing or recovery)
 */
export function resetHealthConnectStatus(): void {
  sdkStatus = "unknown";
  healthConnect = null;
}