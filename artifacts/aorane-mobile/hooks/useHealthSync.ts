// hooks/useHealthSync.ts
//
// THIS is what makes Health Connect sync "automatic" for the user:
//   - runs once shortly after the app opens
//   - runs again every time the app comes back to the foreground
//     (e.g. user switches back from another app)
//   - both calls go through smartSync(), which enforces a 4-hour
//     cooldown (see lib/syncStorage.ts) so we don't hammer Health
//     Connect or the backend on every single foreground event —
//     just enough to keep the Health Report and dashboard reasonably
//     fresh without the user ever pressing a manual "sync" button.
//
// Mounted exactly once, from app/_layout.tsx's AppShell. Previously this
// hook existed but was never actually wired up — _layout.tsx had its own
// inline mount-only sync with no foreground re-sync, so returning from
// background never refreshed health data. This restores that behavior
// and is now the single place that decides when auto-sync fires.

import { useEffect, useRef, useCallback } from "react";
import { AppState, AppStateStatus } from "react-native";
import { smartSync, SyncResult } from "@/lib/health/syncManager";
import { logSilentError } from "@/lib/silentCatch";

/** Delay before the very first sync attempt after app launch, so it
 *  never competes with font loading / auth init on the critical
 *  startup path. */
const INITIAL_SYNC_DELAY_MS = 4000;
/** Small delay after returning to foreground — gives the OS a moment
 *  to settle (matches the pattern already used for HC status checks). */
const FOREGROUND_SYNC_DELAY_MS = 1500;

export function useHealthSync() {
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const isSyncingRef = useRef(false);

  const runSync = useCallback(async (): Promise<SyncResult | undefined> => {
    if (isSyncingRef.current) return undefined;
    isSyncingRef.current = true;
    try {
      const result = await smartSync();
      if (__DEV__) console.log("[HealthSync] result:", result.outcome);
      return result;
    } catch (err) {
      logSilentError("health-auto-sync", err);
      return undefined;
    } finally {
      isSyncingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const initialTimer = setTimeout(runSync, INITIAL_SYNC_DELAY_MS);

    const subscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === "active") {
        setTimeout(runSync, FOREGROUND_SYNC_DELAY_MS);
      }
      appStateRef.current = nextState;
    });

    return () => {
      clearTimeout(initialTimer);
      subscription.remove();
    };
  }, [runSync]);

  /** Exposed for screens that want an on-demand sync (e.g. a manual
   *  "Force Sync" button) that still goes through the same cooldown
   *  logic as the automatic one. For a cooldown-bypassing sync (e.g.
   *  right after the user grants permission), use forceSync() from
   *  lib/health/syncManager directly. */
  return { runSync };
}
