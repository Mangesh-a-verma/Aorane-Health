// src/lib/syncStorage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "hc_last_sync";
const MIN_GAP_MS = 4 * 60 * 60 * 1000; // 4 hours

export const SyncStorage = {
  // Last sync time save karo
  async setLastSync(): Promise<void> {
    await AsyncStorage.setItem(KEY, Date.now().toString());
  },

  // Last sync time padho
  async getLastSync(): Promise<number> {
    const val = await AsyncStorage.getItem(KEY);
    return val ? parseInt(val) : 0;
  },

  // Check karo ki 4 ghante se zyada ho gaye kya
  async shouldSync(): Promise<boolean> {
    const last = await this.getLastSync();
    return Date.now() - last > MIN_GAP_MS;
  },

  // Manual reset (agar testing karni ho)
  async resetLastSync(): Promise<void> {
    await AsyncStorage.removeItem(KEY);
  },
};