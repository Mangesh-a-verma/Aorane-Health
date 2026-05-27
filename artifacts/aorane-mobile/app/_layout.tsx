import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
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
import {
  scheduleWaterReminders,
  scheduleFoodReminders,
  scheduleMedicineReminders,
} from "@/lib/notifications";

// --- NEW ADDITION FOR SMART AUTO SYNC ---
import { useHealthSync } from "@/hooks/useHealthSync";
// ----------------------------------------

// ── Must be at module level so ALL notifications show alert/sound from app start ──
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

SplashScreen.preventAutoHideAsync();

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

// ── Android notification channel setup ───────────────────────────────────────
async function setupAndroidChannels() {
  if (Platform.OS !== "android") return;
  await Promise.allSettled([
    Notifications.setNotificationChannelAsync("medicine", {
      name: "Medicine Reminders",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#0B84D6",
      sound: "default",
    }),
    Notifications.setNotificationChannelAsync("water", {
      name: "Water Reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "default",
    }),
    Notifications.setNotificationChannelAsync("food", {
      name: "Meal Reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "default",
    }),
    Notifications.setNotificationChannelAsync("health", {
      name: "Health Alerts",
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: "#0B84D6",
      sound: "default",
    }),
    Notifications.setNotificationChannelAsync("default", {
      name: "General",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "default",
    }),
  ]);
}

async function registerPushToken() {
  if (Platform.OS === "web") return;
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    const token = tokenData.data;
    if (token?.startsWith("ExponentPushToken[")) {
      await rawRequest("POST", "/users/push-token", { token, platform: Platform.OS }).catch(() => {});
    }
  } catch {
  }
}

// ── Auto-restore all scheduled notifications on every app launch ──────────────
async function restoreAllNotifications() {
  if (Platform.OS === "web") return;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return;

    // Fetch notification preferences from server
    const settingsRes = await rawRequest("GET", "/notifications/settings").catch(() => null) as Record<string, unknown> | null;
    const s = settingsRes?.settings as Record<string, unknown> | undefined;
    if (!s || s.notificationsEnabled === false) return;

    const wakeUp = (s.wakeUpTime as string) || "07:00";
    const bedTime = (s.bedTime as string) || "22:30";
    const waterGoal = (s.waterGoalGlasses as number) || 8;

    await Promise.allSettled([
      s.waterReminders !== false
        ? scheduleWaterReminders(wakeUp, bedTime, waterGoal)
        : Promise.resolve(),
      s.foodReminders !== false
        ? scheduleFoodReminders(wakeUp, bedTime)
        : Promise.resolve(),
    ]);

    // Re-schedule medicine reminders from active medicine schedules
    const medRes = await rawRequest("GET", "/medicine/schedules").catch(() => null) as Record<string, unknown> | null;
    const medicines: Array<{
      id: string; medicineName: string; dosage?: string;
      reminderTimes: string[]; mealTiming?: string; isActive: boolean;
    }> = (medRes?.schedules as Array<{
      id: string; medicineName: string; dosage?: string;
      reminderTimes: string[]; mealTiming?: string; isActive: boolean;
    }>) || [];

    for (const med of medicines) {
      if (med.isActive && med.reminderTimes?.length > 0) {
        await scheduleMedicineReminders({
          medicineId: `medicine_${med.id}`,
          medicineName: med.medicineName,
          dosage: med.dosage,
          times: med.reminderTimes,
          mealTiming: med.mealTiming,
        }).catch(() => {});
      }
    }
  } catch {
    // Silent fail — notifications are best-effort
  }
}

function PushNotificationRegistrar() {
  const { isAuthenticated } = useAuth();
  useEffect(() => {
    if (isAuthenticated) {
      registerPushToken();
      restoreAllNotifications();
    }
  }, [isAuthenticated]);
  return null;
}

function AppShell() {
  const { isOnline, pendingCount, syncing } = useNetworkSync();

  // --- NEW ADDITION FOR SMART AUTO SYNC ---
  // Activate background health syncing when app shell loads
  useHealthSync();
  // ----------------------------------------

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
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Warm up server on app launch so Render wakes up before user tries to login
  useEffect(() => {
    warmupServer();
    setupAndroidChannels();
  }, []);

  if (!fontsLoaded && !fontError) return null;

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