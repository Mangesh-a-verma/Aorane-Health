// lib/health/syncManager.ts
//
// THE ONLY place that orchestrates a full Health Connect sync:
//   status check -> initialize -> read records -> aggregate -> push to
//   backend -> recompute health score -> update last-sync timestamp.
//
// Replaces the old lib/healthSyncManager.ts and the duplicate
// syncHealthConnectNative()/runHCFlow() logic that used to live inside
// app/wearable.tsx.

import { Platform } from "react-native";
import { api } from "@/lib/api";
import { SyncStorage } from "@/lib/syncStorage";
import * as hc from "./client";
import { aggregateHealthMetrics, hasAnyData } from "./aggregate";
import { HealthConnectStatus } from "./types";

export type SyncResult =
  | { outcome: "skipped_cooldown" }
  | { outcome: "skipped_in_progress" }
  | { outcome: "skipped_platform" }
  | { outcome: "not_connected" }
  | { outcome: "synced"; hasData: boolean }
  | { outcome: "error"; message: string };

// Module-level lock (not a React ref) so it's shared across EVERY entry
// point below regardless of which component/hook called in — the
// automatic foreground sync (useHealthSync.ts's runSync -> smartSync) and
// the manual "Connect/Force Sync" button (HealthConnectButton.tsx ->
// connectAndSync -> forceSync) previously had no shared guard, so a manual
// tap landing in the same window as an automatic sync could trigger two
// concurrent readAndPush() calls, each inserting its own wearable_data row.
let isSyncInFlight = false;

/** Last 24 hours — matches the granularity the backend health-score
 *  computation expects (one sync == "today's" rollup). */
function last24HoursRange() {
  const now = new Date();
  const start = new Date(now.getTime() - 86_400_000);
  return { operator: "between" as const, startTime: start.toISOString(), endTime: now.toISOString() };
}

async function readAndPush(): Promise<SyncResult> {
  if (isSyncInFlight) return { outcome: "skipped_in_progress" };
  isSyncInFlight = true;
  try {
    const initialized = await hc.initialize();
    if (!initialized) return { outcome: "not_connected" };

    const raw = await hc.readAllRecords(last24HoursRange());
    const metrics = aggregateHealthMetrics(raw);

    try {
      const result = await api.syncHealthConnect(metrics);

      const today = new Date().toISOString().split("T")[0];
      // Best-effort — a failure to recompute the score should not make the
      // sync itself look like it failed; the next sync/report load recomputes.
      await api.computeHealthScore(today).catch((e) => console.warn("[HealthSync] computeHealthScore failed:", e));

      await SyncStorage.setLastSync();
      return { outcome: "synced", hasData: result.hasData ?? hasAnyData(metrics) };
    } catch (err) {
      return { outcome: "error", message: (err as Error)?.message || "Sync failed" };
    }
  } finally {
    isSyncInFlight = false;
  }
}

/** Auto-sync, meant to be called on app open / app-foreground. Silently
 *  no-ops if synced recently (4h cooldown) or on non-Android platforms —
 *  safe to call as often as you like from UI lifecycle events. */
export async function smartSync(): Promise<SyncResult> {
  if (Platform.OS !== "android") return { outcome: "skipped_platform" };

  const shouldSync = await SyncStorage.shouldSync();
  if (!shouldSync) return { outcome: "skipped_cooldown" };

  return readAndPush();
}

/** Ignores the cooldown — used right after the user grants permission,
 *  or taps "Force Sync" / "Sync now" in the UI. Still platform-gated. */
export async function forceSync(): Promise<SyncResult> {
  if (Platform.OS !== "android") return { outcome: "skipped_platform" };
  return readAndPush();
}

// ── Connection status (for permission UI) ────────────────────────────

export async function checkConnectionStatus(): Promise<HealthConnectStatus> {
  if (Platform.OS !== "android") return "not_supported";
  if (!hc.isModuleLinked()) return "error";

  const status = await hc.getSdkStatus();
  const STATUS = hc.getSdkAvailabilityConstants();

  if (status === null) return "error";
  if (status === STATUS.SDK_UNAVAILABLE) return "not_supported";
  if (status === STATUS.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return "needs_update";
  if (status === STATUS.SDK_AVAILABLE) {
    const initialized = await hc.initialize();
    return initialized ? "available" : "error";
  }
  return "not_installed";
}

/** Full "connect" flow: request permission, then immediately sync so the
 *  user never has to find a manual sync button. Returns whether at least
 *  one permission was granted, and the resulting sync outcome. */
export async function connectAndSync(): Promise<{ granted: boolean; sync: SyncResult }> {
  const granted = await hc.requestPermission();
  if (granted.length === 0) {
    return { granted: false, sync: { outcome: "not_connected" } };
  }
  const sync = await forceSync();
  return { granted: true, sync };
}
