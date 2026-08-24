// hooks/useHealthConnect.ts
//
// UI-facing hook for the "connect Health Connect" flow (used by
// components/HealthConnectButton.tsx and app/wearable.tsx). Does not talk
// to the native module directly — everything goes through lib/health/*.
//
// Public contract is unchanged from before, so existing screens don't
// need to change how they call this hook.

import { useState, useEffect, useCallback, useRef } from "react";
import { AppState, AppStateStatus, Linking } from "react-native";
import { checkConnectionStatus, connectAndSync } from "@/lib/health/syncManager";
import { HealthConnectStatus } from "@/lib/health/types";

export function useHealthConnect() {
  const [status, setStatus] = useState<HealthConnectStatus>("checking");
  const [isLoading, setIsLoading] = useState(false);
  // Tracks a user-declined permission request so the UI can say so instead
  // of silently falling back to the same "Ready — tap to connect" state
  // with no indication anything went wrong.
  const [permissionDenied, setPermissionDenied] = useState(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const checkStatus = useCallback(async () => {
    const next = await checkConnectionStatus();
    setStatus(next);
  }, []);

  // Re-check whenever the app returns to foreground — covers the case
  // where the user just installed/updated Health Connect from the Play
  // Store and came back to the app.
  useEffect(() => {
    checkStatus();

    const subscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === "active") {
        setTimeout(checkStatus, 1000);
      }
      appStateRef.current = nextState;
    });

    return () => subscription.remove();
  }, [checkStatus]);

  const openInstall = useCallback(() => {
    const url = "market://details?id=com.google.android.apps.healthdata&url=healthconnect%3A%2F%2Fonboarding";
    Linking.canOpenURL(url).then((can) => {
      if (can) Linking.openURL(url);
      else Linking.openURL("https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata");
    });
  }, []);

  const openUpdate = useCallback(() => {
    Linking.openURL("market://details?id=com.google.android.apps.healthdata");
  }, []);

  /** Requests permission for every metric the app needs (single list —
   *  see lib/health/types.ts) and, if granted, immediately syncs so the
   *  user gets data right away without a separate manual "sync" step. */
  const requestPermissions = useCallback(async () => {
    if (status !== "available") return false;
    setIsLoading(true);
    setPermissionDenied(false);
    try {
      const { granted } = await connectAndSync();
      setPermissionDenied(!granted);
      return granted;
    } finally {
      setIsLoading(false);
    }
  }, [status]);

  return {
    status,
    isLoading,
    permissionDenied,
    isAvailable: status === "available",
    checkStatus,
    openInstall,
    openUpdate,
    requestPermissions,
  };
}
