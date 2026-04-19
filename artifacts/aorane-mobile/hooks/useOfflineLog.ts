/**
 * AORANE — Offline Log Hook
 *
 * Provides offline-safe logging for food, water, medicine, exercise.
 *
 * When ONLINE:  → sends directly to server → refreshes UI
 * When OFFLINE: → saves to local queue + adds optimistic entry to local state
 *               → syncs automatically when internet returns
 *               → calls onSynced() so screen refreshes from server
 */

import { useCallback, useEffect, useRef } from "react";
import { enqueue, isOnlineFast, OfflineEntry } from "@/lib/offlineQueue";
import { rawRequest } from "@/lib/api";
import { addSyncListener } from "@/hooks/useNetworkSync";

type LogOptions = {
  method?: "POST" | "PATCH" | "DELETE";
  path: string;
  body?: Record<string, unknown>;
  category: OfflineEntry["category"];
  /** Called after a successful sync (so screen can reload from server) */
  onSynced: () => void;
  /** Called on optimistic add (so screen can show item immediately) */
  onOptimistic?: (tempEntry: Record<string, unknown>) => void;
  /** Called when log saved offline (for toast/banner) */
  onOfflineSaved?: (count: number) => void;
};

export function useOfflineLog() {
  const mounted = useRef(true);
  useEffect(() => { return () => { mounted.current = false; }; }, []);

  /**
   * logEntry — main function to call when user logs food/water/exercise/medicine.
   *
   * Returns:
   *   { saved: true, offline: false } — saved to server
   *   { saved: true, offline: true }  — queued locally (no internet)
   *   throws Error                    — only for non-network errors (validation etc.)
   */
  const logEntry = useCallback(async (opts: LogOptions): Promise<{ saved: boolean; offline: boolean }> => {
    const { method = "POST", path, body, category, onSynced, onOptimistic, onOfflineSaved } = opts;

    // Optimistic UI: add temp entry immediately
    if (onOptimistic && body) {
      const tempId = "temp-" + Date.now().toString(36);
      onOptimistic({ id: tempId, _offline: true, ...body });
    }

    // Try the server
    const fast = isOnlineFast();
    if (fast) {
      try {
        await rawRequest(method, path, body);
        onSynced();
        return { saved: true, offline: false };
      } catch (e: unknown) {
        const msg = (e as Error).message || "";
        const isNet = msg.toLowerCase().includes("network") || msg.toLowerCase().includes("fetch");
        if (!isNet) throw e; // Real error — don't queue
        // Fall through to offline handling below
      }
    }

    // Offline: queue the operation
    await enqueue({ method, path, body, category, date: new Date().toISOString().slice(0, 10) });
    const q = await import("@/lib/offlineQueue").then((m) => m.getQueueCount());
    onOfflineSaved?.(q);
    return { saved: true, offline: true };
  }, []);

  /**
   * Register a refresh callback that runs when the offline queue syncs.
   * Call this in each screen with its `loadData` function.
   */
  const onSync = useCallback((callback: () => void): (() => void) => {
    return addSyncListener(callback);
  }, []);

  return { logEntry, onSync };
}
