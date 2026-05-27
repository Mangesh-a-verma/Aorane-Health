// aorane-mobile/hooks/useHealthSync.ts
import { useEffect, useRef, useCallback } from "react";
import { AppState, AppStateStatus } from "react-native";
// Agar aap @ alias use karte hain toh ye perfectly kaam karega:
import { smartSync } from "@/lib/healthSyncManager"; 
// (Agar error aaye toh ise use karein: import { smartSync } from "../src/lib/healthSyncManager"; )

export function useHealthSync() {
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const isSyncingRef = useRef(false);

  const runSync = useCallback(async () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    try {
      await smartSync();
    } finally {
      isSyncingRef.current = false;
    }
  }, []);

  useEffect(() => {
    runSync();

    const subscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === "active") {
        setTimeout(runSync, 2000); 
      }
      appStateRef.current = nextState;
    });

    return () => subscription.remove();
  }, [runSync]);

  return { runSync };
}