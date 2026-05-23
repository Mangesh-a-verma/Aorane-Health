import { useState, useEffect, useCallback, useRef } from "react";
import { AppState, AppStateStatus, Linking, Alert } from "react-native";
import {
  initialize,
  getSdkStatus,
  SdkAvailabilityStatus,
  requestPermission,
  readRecords,
} from "react-native-health-connect";

type HCStatus = 
  | "checking"      // Initial check
  | "available"     // Ready to use
  | "not_installed" // Needs install
  | "needs_update"  // Installed but old
  | "not_supported" // Android < 9
  | "error";        // Unknown error

export function useHealthConnect() {
  const [status, setStatus] = useState<HCStatus>("checking");
  const [isLoading, setIsLoading] = useState(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Core status check function
  const checkStatus = useCallback(async () => {
    try {
      const sdkStatus = await getSdkStatus();
      
      switch (sdkStatus) {
        case SdkAvailabilityStatus.SDK_AVAILABLE:
          // Try to initialize
          const initialized = await initialize();
          if (initialized) {
            setStatus("available");
          } else {
            setStatus("error");
          }
          break;

        case SdkAvailabilityStatus.SDK_UNAVAILABLE:
          setStatus("not_supported");
          break;

        case SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED:
          setStatus("needs_update");
          break;

        default:
          // SDK not installed
          setStatus("not_installed");
          break;
      }
    } catch (err) {
      console.error("Health Connect check error:", err);
      setStatus("error");
    }
  }, []);

  // THE MAIN FIX:
  // Re-check when user comes back from Play Store!
  useEffect(() => {
    checkStatus();

    const subscription = AppState.addEventListener(
      "change",
      async (nextState: AppStateStatus) => {
        // User came back from background (Play Store install)
        if (
          appStateRef.current.match(/inactive|background/) &&
          nextState === "active"
        ) {
          // Wait a moment for install to register
          setTimeout(() => {
            checkStatus();
          }, 1000);
        }
        appStateRef.current = nextState;
      }
    );

    return () => subscription.remove();
  }, [checkStatus]);

  // Install Health Connect
  const openInstall = useCallback(() => {
    const url =
      "market://details?id=com.google.android.apps.healthdata&url=healthconnect%3A%2F%2Fonboarding";
    
    Linking.canOpenURL(url).then((can) => {
      if (can) {
        Linking.openURL(url);
      } else {
        Linking.openURL(
          "https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata"
        );
      }
    });
  }, []);

  // Open update page
  const openUpdate = useCallback(() => {
    Linking.openURL(
      "market://details?id=com.google.android.apps.healthdata"
    );
  }, []);

  // Request permissions
  const requestPermissions = useCallback(async () => {
    if (status !== "available") return false;
    setIsLoading(true);
    try {
      const granted = await requestPermission([
        { accessType: "read", recordType: "Steps" },
        { accessType: "read", recordType: "HeartRate" },
        { accessType: "read", recordType: "TotalCaloriesBurned" },
        { accessType: "read", recordType: "SleepSession" },
        { accessType: "read", recordType: "ExerciseSession" },
      ]);
      return granted.length > 0;
    } catch (err) {
      console.error("Permission error:", err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [status]);

  return {
    status,
    isLoading,
    isAvailable: status === "available",
    checkStatus,
    openInstall,
    openUpdate,
    requestPermissions,
  };
}