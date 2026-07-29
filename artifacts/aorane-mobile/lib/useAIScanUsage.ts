/**
 * useAIScanUsage — real, server-tracked AI feature usage.
 *
 * IMPORTANT (fixed July 2026): this used to be a purely local AsyncStorage
 * counter with its own hardcoded limit numbers, completely disconnected
 * from the backend. That meant (a) the numbers shown here didn't match
 * what the server actually enforced, and (b) clearing app data / reinstalling
 * reset the "usage" to 0 — the limit shown here was never actually a real
 * constraint. This hook now fetches the real numbers from GET /my/ai-usage
 * (server-tracked, DB-persisted, admin-editable via plan_features).
 *
 * Interface kept identical to the old hook so screens didn't need changes:
 *   const { used, limit, remaining, canUse, increment } = useAIScanUsage(feature, plan);
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { logSilentError } from "@/lib/silentCatch";

// Maps the short keys screens already use to the actual plan_features
// feature_name in the backend.
const FEATURE_KEY_MAP: Record<string, string> = {
  food_scan: "ai_food_scan_photo_daily",
  food_scan_text: "ai_food_scan_text_daily",
  medical_scan: "ai_medical_scan_daily",
  diet_plan: "ai_diet_plan_daily",
  health_coach: "ai_health_coach_daily",
  meal_swap: "ai_meal_swap_daily",
  health_prediction: "ai_health_prediction_weekly",
};

interface UsageState {
  used: number;
  limit: number; // 999 stands in for "unlimited" (kept for compatibility with old callers)
  loaded: boolean;
}

export function useAIScanUsage(feature: string, _plan?: string) {
  // _plan kept in the signature for call-site compatibility — the real
  // plan comes from the authenticated request server-side now, so it's
  // no longer needed here, but removing the param would break existing
  // call sites like `useAIScanUsage("food_scan", userPlan)`.
  const backendFeatureName = FEATURE_KEY_MAP[feature] ?? feature;
  const [state, setState] = useState<UsageState>({ used: 0, limit: 999, loaded: false });
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const res = await api.getAiUsage();
      const row = res.usage.find((u) => u.featureName === backendFeatureName);
      if (!mountedRef.current) return;
      if (row) {
        setState({ used: row.usedToday, limit: row.unlimited ? 999 : row.limitToday, loaded: true });
      } else {
        // Feature not tracked server-side (e.g. shared/ungated features) —
        // fail-open, don't block the user on a missing config row.
        setState({ used: 0, limit: 999, loaded: true });
      }
    } catch (e) {
      logSilentError("ai-scan-usage-fetch", e);
      // Fail-open: don't block usage just because the summary fetch failed —
      // the actual API call still enforces the real limit server-side
      // regardless of what this hook shows.
      if (mountedRef.current) setState((s) => ({ ...s, loaded: true }));
    }
  }, [backendFeatureName]);

  useEffect(() => {
    mountedRef.current = true;
    refresh();
    return () => { mountedRef.current = false; };
  }, [refresh]);

  // Previously did its own local increment; now the server already
  // increments on a successful call (see checkAndUseAILimit backend-side),
  // so this just re-syncs with the server's real count.
  const increment = useCallback(async (): Promise<{ newUsed: number; remaining: number }> => {
    await refresh();
    // refresh() is async and updates state, but we also want an immediate
    // return value for callers that destructure `{ remaining }` right away.
    const res = await api.getAiUsage().catch(() => null);
    const row = res?.usage.find((u) => u.featureName === backendFeatureName);
    const limit = row ? (row.unlimited ? 999 : row.limitToday) : 999;
    const used = row ? row.usedToday : 0;
    return { newUsed: used, remaining: Math.max(0, limit - used) };
  }, [backendFeatureName, refresh]);

  const remaining = Math.max(0, state.limit - state.used);
  const canUse = state.limit >= 999 || state.used < state.limit;

  return { used: state.used, limit: state.limit, remaining, canUse, increment, loaded: state.loaded };
}
