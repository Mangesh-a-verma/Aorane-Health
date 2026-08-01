// lib/health/client.ts
//
// THE ONLY place in the app that touches `react-native-health-connect`.
// Every screen/hook goes through this module. This replaces:
//   - lib/healthConnectWrapper.ts (deleted)
//   - the inline HC singleton that used to live inside app/wearable.tsx
//   - the unsafe static import that used to live inside hooks/useHealthConnect.ts
//
// Design rules:
//   1. Never statically import "react-native-health-connect" — it's an
//      Android-only native module and a static import can crash at
//      bundle-eval time on platforms/builds where it isn't linked
//      (Expo Go, iOS, web). Always `require()` lazily inside a try/catch.
//   2. A failure reading ONE record type must NEVER disable reads for
//      other record types. (This was the root cause of a real bug where
//      one denied/failed permission silently zeroed out all health data
//      for the rest of the app session.)
//   3. Every public function returns a safe fallback value instead of
//      throwing, so callers never need try/catch gymnastics.

import { Platform } from "react-native";
import { HEALTH_RECORD_TYPES, HealthRecordType, RawRecordsByType, buildPermissionRequests } from "./types";

type HCModule = {
  initialize: () => Promise<boolean>;
  getSdkStatus: () => Promise<number>;
  requestPermission: (perms: Array<{ accessType: string; recordType: string }>) => Promise<Array<unknown>>;
  readRecords: (type: string, opts: unknown) => Promise<unknown>;
  SdkAvailabilityStatus: {
    SDK_UNAVAILABLE: number;
    SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED: number;
    SDK_AVAILABLE: number;
  };
};

// Fallback numeric codes match androidx.health.connect.client.HealthConnectClient
// constants, used only if the native module doesn't expose them for some reason.
const FALLBACK_STATUS = {
  SDK_UNAVAILABLE: 1,
  SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED: 2,
  SDK_AVAILABLE: 3,
};

let _mod: HCModule | null = null;
let _loadAttempted = false;

/** Lazily require the native module exactly once. Never throws. */
function loadModule(): HCModule | null {
  if (_loadAttempted) return _mod;
  _loadAttempted = true;

  if (Platform.OS !== "android") {
    return null;
  }

  try {
    const raw = require("react-native-health-connect");
    const candidate: Record<string, unknown> =
      raw?.default && typeof raw.default.initialize === "function" ? raw.default : raw;

    if (typeof candidate?.initialize !== "function") {
      console.warn("[HealthConnect] module loaded but missing expected API surface");
      return null;
    }
    _mod = candidate as unknown as HCModule;
    return _mod;
  } catch (err) {
    // Expected on Expo Go / a build without the native module linked.
    console.warn("[HealthConnect] native module not available:", err);
    return null;
  }
}

/** True if the native module is linked at all (says nothing about
 *  whether the Health Connect *app* is installed on-device). */
export function isModuleLinked(): boolean {
  return loadModule() !== null;
}

export function getSdkAvailabilityConstants() {
  return loadModule()?.SdkAvailabilityStatus ?? FALLBACK_STATUS;
}

/** Returns the raw numeric SDK availability status, or `null` if the
 *  module isn't linked at all. Never throws. */
export async function getSdkStatus(): Promise<number | null> {
  const mod = loadModule();
  if (!mod) return null;
  try {
    return await mod.getSdkStatus();
  } catch (err) {
    console.warn("[HealthConnect] getSdkStatus failed:", err);
    return null;
  }
}

/** Initializes the Health Connect client. Returns false on any failure
 *  (module missing, HC app missing, native init error) — never throws. */
export async function initialize(): Promise<boolean> {
  const mod = loadModule();
  if (!mod) return false;
  try {
    return await mod.initialize();
  } catch (err) {
    console.warn("[HealthConnect] initialize() failed:", err);
    return false;
  }
}

/** Requests permission for every record type this app needs (see
 *  lib/health/types.ts). Returns the list of granted permission
 *  descriptors — empty array if the user denied everything or the
 *  module/HC app isn't available. Never throws. */
export async function requestPermission(): Promise<Array<unknown>> {
  const mod = loadModule();
  if (!mod) return [];
  try {
    const granted = await mod.requestPermission(buildPermissionRequests());
    return Array.isArray(granted) ? granted : [];
  } catch (err) {
    console.warn("[HealthConnect] requestPermission() failed:", err);
    return [];
  }
}

/** Reads a single record type. Returns [] on ANY failure for THIS type
 *  only — does not affect any other type and does not set any global
 *  "unavailable" flag. This is the fix for the old bug where one failed
 *  read silently zeroed out every metric for the rest of the session. */
export async function readRecordType(type: HealthRecordType, timeRangeFilter: unknown): Promise<unknown[]> {
  const mod = loadModule();
  if (!mod) return [];
  try {
    const result = await mod.readRecords(type, { timeRangeFilter });
    if (Array.isArray(result)) return result;
    const withRecords = result as { records?: unknown[] } | undefined;
    if (withRecords?.records && Array.isArray(withRecords.records)) return withRecords.records;
    return [];
  } catch (err) {
    console.warn(`[HealthConnect] readRecords(${type}) failed:`, err);
    return [];
  }
}

/** Reads every configured record type in parallel. Each type is fully
 *  isolated — one failing does not blank out the others. */
export async function readAllRecords(timeRangeFilter: unknown): Promise<RawRecordsByType> {
  const results = await Promise.all(
    HEALTH_RECORD_TYPES.map(async (type) => [type, await readRecordType(type, timeRangeFilter)] as const)
  );
  const out: RawRecordsByType = {};
  for (const [type, records] of results) out[type] = records;
  return out;
}
