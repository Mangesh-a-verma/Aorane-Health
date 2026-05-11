import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * FIX C4 — Sensitive data (PIN, JWT access token, JWT refresh token) is moved
 * from plaintext AsyncStorage to expo-secure-store (iOS Keychain / Android Keystore).
 *
 * Non-sensitive UX flags (language, theme, onboarding step, biometric enabled)
 * stay in AsyncStorage because:
 *  - SecureStore has a ~2KB size limit per key
 *  - Keychain access is slower than AsyncStorage
 *  - These flags don't pose a security risk if read
 *
 * On web, SecureStore is unavailable, so we fall back to AsyncStorage on web
 * (the web build runs in-browser, where storage encryption is the browser's
 * responsibility anyway).
 *
 * Migration: on every getter, we first check SecureStore. If not present, we
 * check AsyncStorage (legacy storage from before this fix), and if found there,
 * we silently migrate it to SecureStore + remove from AsyncStorage.
 */

const SENSITIVE_KEYS = ["auth_token", "refresh_token", "app_pin"] as const;
type SensitiveKey = (typeof SENSITIVE_KEYS)[number];

// SecureStore is not supported on web — fall back to AsyncStorage there.
const secureAvailable = Platform.OS !== "web";

async function secureGet(key: SensitiveKey): Promise<string | null> {
  if (!secureAvailable) return AsyncStorage.getItem(key);
  try {
    const v = await SecureStore.getItemAsync(key);
    if (v) return v;
    // One-time migration: if value exists in plaintext AsyncStorage, move it.
    const legacy = await AsyncStorage.getItem(key);
    if (legacy) {
      await SecureStore.setItemAsync(key, legacy);
      await AsyncStorage.removeItem(key).catch(() => {});
      return legacy;
    }
    return null;
  } catch {
    // SecureStore can throw on some Android devices (e.g. Keystore unavailable
    // during system update). Fall back to AsyncStorage so the user is not
    // locked out — far better than blocking auth entirely.
    return AsyncStorage.getItem(key);
  }
}

async function secureSet(key: SensitiveKey, value: string): Promise<void> {
  if (!secureAvailable) {
    await AsyncStorage.setItem(key, value);
    return;
  }
  try {
    await SecureStore.setItemAsync(key, value);
    // Clean up any legacy plaintext copy
    await AsyncStorage.removeItem(key).catch(() => {});
  } catch {
    // Fallback to AsyncStorage if SecureStore fails (Keystore issues)
    await AsyncStorage.setItem(key, value);
  }
}

async function secureRemove(key: SensitiveKey): Promise<void> {
  if (!secureAvailable) {
    await AsyncStorage.removeItem(key);
    return;
  }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch { /* ignore */ }
  await AsyncStorage.removeItem(key).catch(() => {});
}

export const storage = {
  async setToken(token: string): Promise<void> {
    await secureSet("auth_token", token);
  },
  async getToken(): Promise<string | null> {
    return secureGet("auth_token");
  },
  async setRefreshToken(token: string): Promise<void> {
    await secureSet("refresh_token", token);
  },
  async getRefreshToken(): Promise<string | null> {
    return secureGet("refresh_token");
  },
  async clearTokens(): Promise<void> {
    await Promise.allSettled([
      secureRemove("auth_token"),
      secureRemove("refresh_token"),
      secureRemove("app_pin"),
      AsyncStorage.multiRemove(["user_data", "onboarding_done", "pin_set", "biometric_enabled"]),
    ]);
  },
  async setUser(user: Record<string, unknown>): Promise<void> {
    await AsyncStorage.setItem("user_data", JSON.stringify(user));
  },
  async getUser(): Promise<Record<string, unknown> | null> {
    const data = await AsyncStorage.getItem("user_data");
    return data ? JSON.parse(data) : null;
  },
  async setOnboardingDone(done: boolean): Promise<void> {
    await AsyncStorage.setItem("onboarding_done", done ? "1" : "0");
  },
  async isOnboardingDone(): Promise<boolean> {
    const val = await AsyncStorage.getItem("onboarding_done");
    return val === "1";
  },
  async setPinSet(done: boolean): Promise<void> {
    await AsyncStorage.setItem("pin_set", done ? "1" : "0");
  },
  async isPinSet(): Promise<boolean> {
    const val = await AsyncStorage.getItem("pin_set");
    return val === "1";
  },
  async setPin(pin: string): Promise<void> {
    await secureSet("app_pin", pin);
  },
  async getPin(): Promise<string | null> {
    return secureGet("app_pin");
  },
  async setBiometricEnabled(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem("biometric_enabled", enabled ? "1" : "0");
  },
  async isBiometricEnabled(): Promise<boolean> {
    const val = await AsyncStorage.getItem("biometric_enabled");
    return val === "1";
  },
  async setLanguage(lang: string): Promise<void> {
    await AsyncStorage.setItem("language", lang);
  },
  async getLanguage(): Promise<string> {
    return (await AsyncStorage.getItem("language")) || "hi";
  },
  async setTheme(theme: "light" | "dark"): Promise<void> {
    await AsyncStorage.setItem("theme", theme);
  },
  async getTheme(): Promise<"light" | "dark" | null> {
    const val = await AsyncStorage.getItem("theme");
    return (val as "light" | "dark") || null;
  },
};
