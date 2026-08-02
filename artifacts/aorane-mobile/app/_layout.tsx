import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { View, StatusBar, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import Constants from "expo-constants";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import OfflineBanner from "@/components/OfflineBanner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { useNetworkSync } from "@/hooks/useNetworkSync";
import { rawRequest, warmupServer } from "@/lib/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  setupNotificationChannels,
  scheduleWaterReminders,
  scheduleFoodReminders,
  scheduleMedicineReminders,
  cancelWaterReminders,
  cancelFoodReminders,
  cancelMedicineReminders,
  cancelAllNotifications,
  cleanupOrphanMedicineNotifications,
  registerNotificationCategories,
  getScheduledNotificationSummary,
} from "@/lib/notifications";

import { useHealthSync } from "@/hooks/useHealthSync";
import { logSilentError } from "@/lib/silentCatch";

// NOTE: setNotificationHandler() is registered exactly once, inside
// lib/notifications.ts (which is imported above). Do NOT add a second
// registration here — a duplicate previously existed at this exact spot and
// silently overrode the one in lib/notifications.ts with a different config,
// which is confusing and error-prone. Single source of truth now.

SplashScreen.preventAutoHideAsync();
// Optional: fade the splash instead of instant cut (smoother on slow devices)
SplashScreen.setOptions?.({ fade: true, duration: 200 });

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="index" options={{ gestureEnabled: false, animation: "none" }} />
      <Stack.Screen name="(auth)" options={{ gestureEnabled: false, animation: "none" }} />
      <Stack.Screen name="(onboarding)" options={{ gestureEnabled: false, animation: "none" }} />
      <Stack.Screen name="(tabs)" options={{ gestureEnabled: false, animation: "none" }} />
      {/* Sub-pages — enable swipe-back and slide animation */}
      <Stack.Screen name="water" />
      <Stack.Screen name="stress" />
      <Stack.Screen name="period" />
      <Stack.Screen name="family" />
      <Stack.Screen name="edit-profile" />
      <Stack.Screen name="edit-work-profile" />
      <Stack.Screen name="help" />
      <Stack.Screen name="intelligence" />
      <Stack.Screen name="medical-emergency" />
      <Stack.Screen name="health-report" />
      <Stack.Screen name="scorecard" />
      <Stack.Screen name="wearable" />
      <Stack.Screen name="upgrade" />
      <Stack.Screen name="enrollment" />
      <Stack.Screen name="blood" />
      <Stack.Screen name="suggestions" />
      <Stack.Screen name="notification-settings" />
      <Stack.Screen name="sleep" />
    </Stack>
  );
}

// setupAndroidChannels is now handled by setupNotificationChannels() from lib/notifications.ts
// Kept as alias for backward compatibility with the deferred call below
const setupAndroidChannels = setupNotificationChannels;


// ── Updated Bulletproof Push Token Registration ─────────────────────────────────
async function registerPushToken() {
  if (Platform.OS === "web") return;
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== "granted") {
      // FIX: Strict iOS permissions request
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      finalStatus = status;
    }
    
    if (finalStatus !== "granted") {
      console.log("Notification permission denied by user.");
      return;
    }
    
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return; // Fail safely if EAS config is missing

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;
    
    // FIX: Removed strict ExponentPushToken check for broader compatibility
    if (token) {
      await rawRequest("POST", "/users/push-token", { token, platform: Platform.OS }).catch((err) => {
         console.debug("Failed to send token to backend:", err);
      });
    }
  } catch (error) {
    // Silent fail — gracefully handles iOS Simulator rejection
    console.debug("Push token registration bypassed (likely simulator or missing config).");
  }
}

// ── NOTIFICATION RESTORE v2.0 ─────────────────────────────────────────────────
//
// WHAT CHANGED vs the old version:
// ❌ OLD: 24h AsyncStorage cooldown → notifications were PERMANENTLY SILENT after
//         the first successful restore. Settings changes, new medicines = ignored.
// ❌ OLD: cancelAllScheduledNotificationsAsync() called BEFORE rescheduling → if
//         any network call failed after that, ALL notifications were gone forever.
// ❌ OLD: isRestoring flag was module-level but reset via finally → if multiple
//         app launches overlapped (race), both could proceed.
//
// ✅ NEW: No cooldown — restoreAllNotifications is safe to call on every login.
//         It is idempotent: each schedule function cancels only its own type
//         before rescheduling, so re-running is safe and atomic per-type.
// ✅ NEW: Atomic swap per type: cancel water → schedule water (not cancel-all-then-
//         schedule-all). If medicine scheduling fails, water/food still work.
// ── Notification Settings Cache Key ──────────────────────────────────────────
const NOTIF_SETTINGS_KEY = "aorane_notif_settings_v1";

// Default notification settings — used when backend is unreachable
// (Render cold start, no internet, etc.)
const DEFAULT_NOTIF_SETTINGS = {
  notificationsEnabled: true,
  medicineReminders:    true,
  waterReminders:       true,
  foodReminders:        true,
  periodReminders:      true,
  wakeUpTime:           "07:00",
  bedTime:              "22:30",
  waterGoalGlasses:     8,
};

type NotifSettings = typeof DEFAULT_NOTIF_SETTINGS;

/**
 * Save notification settings to local cache.
 * Called after successful backend fetch so we always have a fresh copy.
 */
async function cacheNotifSettings(s: NotifSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIF_SETTINGS_KEY, JSON.stringify(s));
  } catch { /* best-effort */ }
}

/**
 * Read notification settings — local cache first, then defaults.
 * NEVER throws, NEVER returns null.
 */
async function readCachedNotifSettings(): Promise<NotifSettings> {
  try {
    const raw = await AsyncStorage.getItem(NOTIF_SETTINGS_KEY);
    if (raw) return { ...DEFAULT_NOTIF_SETTINGS, ...JSON.parse(raw) };
  } catch { /* fall through */ }
  return DEFAULT_NOTIF_SETTINGS;
}

// ── In-session guard — prevents overlapping restore calls ────────────────────
let isRestoring = false;

/**
 * restoreAllNotifications — LOCAL-FIRST, BACKEND-OPTIONAL
 *
 * KEY DESIGN CHANGE (v3.0):
 *
 * Previous problem: backend dependency = silent failure
 *   rawRequest("/notifications/settings") fails on Render cold start
 *   → s = null → early return → ZERO notifications ever scheduled
 *   This was the root cause of "notifications not coming at all"
 *
 * New approach:
 *   1. Always schedule notifications using cached/default settings (instant)
 *   2. Try to fetch fresh settings from backend in background
 *   3. If backend responds, update cache + reschedule with fresh values
 *   4. If backend fails → cached/default settings already working ✅
 *
 * Notifications will ALWAYS be scheduled on login, regardless of backend state.
 */
async function restoreAllNotifications() {
  if (Platform.OS === "web") return;
  if (isRestoring) return;

  isRestoring = true;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      console.debug("[Notifications] Permission not granted — skipping restore");
      return;
    }

    // iOS: register action button categories (no-op on Android)
    registerNotificationCategories().catch((e) => logSilentError('notif-categories', e));

    // ── STEP 1: Schedule with cached/default settings IMMEDIATELY ──────────
    // This ensures notifications are scheduled even if backend is down.
    const cachedSettings = await readCachedNotifSettings();
    await _scheduleFromSettings(cachedSettings);

    // ── STEP 2: Try backend for fresh settings (fire-and-forget) ────────────
    // If it succeeds, update cache + reschedule with latest values.
    // If it fails, the cached notifications from step 1 are already set.
    rawRequest("GET", "/notifications/settings")
      .then(async (res) => {
        const s = (res as Record<string, unknown>)?.settings as Record<string, unknown> | undefined;
        if (!s) return;

        const fresh: NotifSettings = {
          notificationsEnabled: (s.notificationsEnabled as boolean) ?? true,
          medicineReminders:    (s.medicineReminders as boolean)    ?? true,
          waterReminders:       (s.waterReminders as boolean)       ?? true,
          foodReminders:        (s.foodReminders  as boolean)       ?? true,
          periodReminders:      (s.periodReminders as boolean)      ?? true,
          wakeUpTime:           (s.wakeUpTime      as string)       || "07:00",
          bedTime:              (s.bedTime         as string)       || "22:30",
          waterGoalGlasses:     (s.waterGoalGlasses as number)      || 8,
        };

        // Save for next cold start
        await cacheNotifSettings(fresh);

        // Only reschedule if settings actually differ from cached
        const changed =
          fresh.wakeUpTime       !== cachedSettings.wakeUpTime       ||
          fresh.bedTime          !== cachedSettings.bedTime          ||
          fresh.waterGoalGlasses !== cachedSettings.waterGoalGlasses ||
          fresh.waterReminders   !== cachedSettings.waterReminders   ||
          fresh.foodReminders    !== cachedSettings.foodReminders    ||
          fresh.medicineReminders !== cachedSettings.medicineReminders;

        if (changed) {
          console.debug("[Notifications] Fresh settings differ — rescheduling");
          await _scheduleFromSettings(fresh);
        }
      })
      .catch(() => {
        // Backend unreachable — step 1 already handled this. Safe to ignore.
        console.debug("[Notifications] Backend unavailable — using cached/default settings");
      });

  } catch (err) {
    console.debug("[Notifications] restoreAllNotifications error:", err);
  } finally {
    isRestoring = false;
  }
}

/**
 * Internal: schedule all notification types from a settings object.
 * Handles "disabled" state by cancelling the relevant type.
 */
async function _scheduleFromSettings(s: NotifSettings): Promise<void> {
  // If all notifications disabled — cancel everything and stop
  if (s.notificationsEnabled === false) {
    await cancelAllNotifications();
    return;
  }

  const wakeUp    = s.wakeUpTime        || "07:00";
  const bedTime   = s.bedTime           || "22:30";
  const waterGoal = s.waterGoalGlasses  || 8;

  // Water + Food in parallel (independent of each other)
  await Promise.allSettled([
    s.waterReminders !== false
      ? scheduleWaterReminders(wakeUp, bedTime, waterGoal)
      : cancelWaterReminders(),
    s.foodReminders !== false
      ? scheduleFoodReminders(wakeUp, bedTime)
      : cancelFoodReminders(),
  ]);

  // ── Medicine reminders ──────────────────────────────────────────────────
  // BUG FIX: this used to always (re)schedule medicine reminders regardless
  // of the user's "Medicine Reminders" toggle in Settings — that toggle was
  // silently a no-op. Now we actually respect it.
  if (s.medicineReminders === false) {
    await cancelMedicineReminders();
  } else {
    // needs backend, but don't block on it — wrapped separately so
    // water/food still work even if this fetch fails
    try {
      const medRes = await rawRequest("GET", "/medicine/schedules")
        .catch(() => null) as Record<string, unknown> | null;

      const medicines = ((medRes?.schedules as Array<{
        id: string; medicineName: string; dosage?: string;
        reminderTimes: string[]; mealTiming?: string; isActive: boolean;
      }>) || []);

      const activeMedicines = medicines.filter(
        (med) => med.isActive && (med.reminderTimes?.length ?? 0) > 0
      );

      if (activeMedicines.length > 0) {
        await Promise.allSettled(
          activeMedicines.map((med) =>
            scheduleMedicineReminders({
              medicineId:   `medicine_${med.id}`,
              medicineName: med.medicineName,
              dosage:       med.dosage,
              times:        med.reminderTimes,
              mealTiming:   med.mealTiming,
            })
          )
        );
      }

      // BUG FIX: clear out any legacy name-based-id medicine notifications
      // that were scheduled before the medicineId consistency fix (or any
      // that belong to medicines that were deleted/paused). Without this,
      // old copies stack up forever across app restarts.
      const validIds = medicines.map((med) => `medicine_${med.id}`);
      cleanupOrphanMedicineNotifications(validIds).catch((e) =>
        logSilentError("medicine-notif-cleanup", e)
      );
    } catch { /* medicine reminders non-critical */ }
  }

  // Period reminders — also non-blocking
  if (s.periodReminders !== false) {
    rawRequest("GET", "/period/logs")
      .then(async (periodData) => {
        const nextDate = ((periodData as Record<string, unknown>)
          ?.prediction as Record<string, unknown>)
          ?.nextPeriodDate as string | undefined;
        if (nextDate) {
          const { schedulePeriodReminders } = await import("@/lib/notifications");
          await schedulePeriodReminders(nextDate).catch((e) => logSilentError('period-reminder', e));
        }
      })
      .catch((e) => logSilentError('background-task', e));
  }

  if (__DEV__) {
    getScheduledNotificationSummary()
      .then((s) => console.debug("[Notifications] Scheduled:", s))
      .catch((e) => logSilentError('background-task', e));
  }
}


function PushNotificationRegistrar() {
  const { isAuthenticated } = useAuth();
  // ✅ FIX: guards against `isAuthenticated` flipping true more than once in
  // the same app session (e.g. token refresh causing a re-render) from
  // re-running token registration + notification restore each time.
  const hasInitializedRef = React.useRef(false);

  useEffect(() => {
    // FIX: Race Condition & Parallel Request Prevention
    // Inko async/await se queue kiya gaya hai taaki backend par ek saath overload na ho
    const initializeAppServices = async () => {
      if (isAuthenticated && !hasInitializedRef.current) {
        hasInitializedRef.current = true;
        try {
          await registerPushToken(); // Pehle token register karo
          await restoreAllNotifications(); // Jab token ho jaye, tab alarms set karo
        } catch (error) {
          console.debug("Error initializing services:", error);
        }
      } else if (!isAuthenticated) {
        // Reset guard on logout so a fresh login (possibly a different user)
        // re-registers the push token and re-syncs notifications correctly.
        hasInitializedRef.current = false;
      }
    };

    initializeAppServices();
  }, [isAuthenticated]);

  // Handle tap on notification (works in foreground, background, and killed state)
  useEffect(() => {
    // Tap handler — navigate to the right screen
    const tapSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      const screen = data?.screen as string | undefined;

      // iOS action buttons (MEDICINE_REMINDER category)
      if (response.actionIdentifier === "MARK_TAKEN") {
        router.push("/(tabs)/medicine" as never);
        return;
      }
      if (response.actionIdentifier === "SNOOZE_15") {
        // Snooze: schedule a one-off notification 15 minutes from now
        Notifications.scheduleNotificationAsync({
          content: {
            title: response.notification.request.content.title ?? "💊 Medicine Reminder",
            body:  "(Snoozed) " + (response.notification.request.content.body ?? ""),
            sound: true,
            data,
          },
          trigger: {
            type:    "timeInterval" as never,
            seconds: 15 * 60,
            repeats: false,
          },
        }).catch((e) => logSilentError('background-task', e));
        return;
      }

      // Navigate to screen embedded in notification data, or type-based fallback
      if (screen) {
        router.push(screen as never);
      } else {
        switch (data?.type) {
          case "medicine_reminder": router.push("/(tabs)/medicine" as never); break;
          case "water_reminder":    router.push("/water"           as never); break;
          case "food_reminder":     router.push("/(tabs)/food"     as never); break;
          case "period_reminder":   router.push("/sleep"           as never); break;
          case "health_score":      router.push("/(tabs)/dashboard" as never); break;
          default: break;
        }
      }
    });

    return () => tapSub.remove();
  }, []);

  return null;
}

function AppShell() {
  const { isOnline, pendingCount, syncing } = useNetworkSync();

  // Auto-syncs Health Connect data on app open, and again whenever the app
  // returns to the foreground — the user never needs a manual sync button.
  // The hook itself defers the first sync so it never competes with auth
  // init / font loading on the critical startup path, and every sync goes
  // through a 4-hour cooldown (see lib/syncStorage.ts) so it's cheap to
  // call often.
  useHealthSync();

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <OfflineBanner isOnline={isOnline} pendingCount={pendingCount} syncing={syncing} />
      <View style={{ flex: 1 }}>
        <AuthProvider>
          <PushNotificationRegistrar />
          <RootLayoutNav />
        </AuthProvider>
      </View>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    // Inter_800ExtraBold loaded lazily by HealthReportSummary when needed
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // ── FIX STARTUP DELAY: warmupServer() and setupAndroidChannels() are now
  // deferred by 1.5 seconds. Previously they fired immediately at module load,
  // competing with font loading and auth initialization. Android channels don't
  // need to be ready before the first screen renders — they just need to exist
  // before the first notification fires (which happens much later).
  useEffect(() => {
    const id = setTimeout(() => {
      warmupServer();
      setupAndroidChannels();
    }, 1500);
    return () => clearTimeout(id);
  }, []);

  // ── FIX STARTUP DELAY: Return a lightweight splash instead of null while
  // fonts load. Returning null causes a white flash; the SplashScreen
  // (from expo-splash-screen) stays visible as long as hideAsync() hasn't been
  // called, so this View is actually invisible during that window — but having
  // a View (instead of null) means the JS tree is already mounted and the
  // AuthProvider inside AppShell can start initAuth() in parallel.
  // The actual visible splash is controlled by expo-splash-screen.
  if (!fontsLoaded && !fontError) return <View style={{ flex: 1 }} />;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <LanguageProvider>
                <AppShell />
              </LanguageProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}