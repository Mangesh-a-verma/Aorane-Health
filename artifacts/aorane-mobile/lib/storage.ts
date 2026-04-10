import AsyncStorage from "@react-native-async-storage/async-storage";

export const storage = {
  async setToken(token: string): Promise<void> {
    await AsyncStorage.setItem("auth_token", token);
  },
  async getToken(): Promise<string | null> {
    return AsyncStorage.getItem("auth_token");
  },
  async setRefreshToken(token: string): Promise<void> {
    await AsyncStorage.setItem("refresh_token", token);
  },
  async getRefreshToken(): Promise<string | null> {
    return AsyncStorage.getItem("refresh_token");
  },
  async clearTokens(): Promise<void> {
    await AsyncStorage.multiRemove(["auth_token", "refresh_token", "user_data", "onboarding_done", "pin_set", "biometric_enabled"]);
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
    await AsyncStorage.setItem("app_pin", pin);
  },
  async getPin(): Promise<string | null> {
    return AsyncStorage.getItem("app_pin");
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
