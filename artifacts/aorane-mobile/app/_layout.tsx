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

function PushNotificationRegistrar() {
  const { isAuthenticated } = useAuth();
  useEffect(() => {
    if (isAuthenticated) {
      registerPushToken();
    }
  }, [isAuthenticated]);
  return null;
}

function AppShell() {
  const { isOnline, pendingCount, syncing } = useNetworkSync();

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
