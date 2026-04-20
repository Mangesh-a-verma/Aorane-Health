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
import { rawRequest } from "@/lib/api";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
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
