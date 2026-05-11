import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const AI_DAILY_LIMITS: Record<string, Record<string, number>> = {
  FREE:   { food_scan: 3,  medical_scan: 1, diet_plan: 1,  health_coach: 5,  meal_swap: 3  },
  PRO:    { food_scan: 15, medical_scan: 5, diet_plan: 3,  health_coach: 30, meal_swap: 10 },
  MAX:    { food_scan: 999, medical_scan: 999, diet_plan: 10, health_coach: 999, meal_swap: 999 },
  FAMILY: { food_scan: 15, medical_scan: 5, diet_plan: 3,  health_coach: 30, meal_swap: 10 },
};

export function getPlanLimit(plan: string, feature: string): number {
  return AI_DAILY_LIMITS[plan?.toUpperCase()]?.[feature] ?? 999;
}

function todayKey(feature: string) {
  const d = new Date().toISOString().slice(0, 10);
  return `ai_usage_${feature}_${d}`;
}

async function readUsage(feature: string): Promise<number> {
  const v = await AsyncStorage.getItem(todayKey(feature));
  return v ? parseInt(v, 10) : 0;
}

async function writeUsage(feature: string, newVal: number): Promise<void> {
  await AsyncStorage.setItem(todayKey(feature), String(newVal));
}

export function useAIScanUsage(feature: string, plan: string) {
  const limit = getPlanLimit(plan, feature);
  const [used, setUsed] = useState(0);

  useEffect(() => {
    readUsage(feature).then(setUsed);
  }, [feature]);

  const increment = useCallback(async (): Promise<{ newUsed: number; remaining: number }> => {
    const current = await readUsage(feature);
    const newUsed = current + 1;
    await writeUsage(feature, newUsed);
    setUsed(newUsed);
    return { newUsed, remaining: Math.max(0, limit - newUsed) };
  }, [feature, limit]);

  const remaining = Math.max(0, limit - used);
  const canUse = limit >= 999 || used < limit;

  return { used, limit, remaining, canUse, increment };
}
