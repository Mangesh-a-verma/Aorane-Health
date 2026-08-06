import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { setCachedResponse, getCachedResponse, setOnlineState } from "./offlineQueue";
import { APILimitError } from "./apiErrors";
import { storage } from "./storage";
import { logSilentError } from "@/lib/silentCatch";

// On web browser → always use relative /api (routed by Replit proxy → local api-server)
// On native (Expo Go / APK) → use EXPO_PUBLIC_API_URL env var or production fallback
// FIX CB1: Remove Hardcoded URL hatakar, use environment variable
const API_BASE = process.env.EXPO_PUBLIC_API_URL || "https://aorane.onrender.com/api";

let _onUnauthorized: (() => void) | null = null;

export function setUnauthorizedCallback(cb: () => void) {
  _onUnauthorized = cb;
}

// FIX C4 — Read sensitive credentials from SecureStore via the storage helper,
// which transparently migrates legacy AsyncStorage values on first read.
async function getToken(): Promise<string | null> {
  return storage.getToken();
}

const NON_SENSITIVE_AUTH_KEYS = ["user_data", "onboarding_done", "pin_set"];

async function clearAuthAndNotify() {
  console.warn("[API] clearAuthAndNotify — session cleared, logging out user");
  await storage.clearTokens();
  await AsyncStorage.multiRemove(NON_SENSITIVE_AUTH_KEYS).catch((e) => logSilentError('storage-write', e));
  _onUnauthorized?.();
}

let refreshPromise: Promise<boolean> | null = null;

/**
 * Tries to silently refresh the access token using the stored refresh_token.
 * Uses a Promise Queue to prevent multiple API calls from logging the user out.
 */
async function attemptTokenRefresh(): Promise<boolean> {
  // Agar pehle se token refresh ho raha hai, toh dusri calls wait karengi
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const refreshToken = await storage.getRefreshToken();
      if (!refreshToken) return false;
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const data = await res.json() as { accessToken?: string; refreshToken?: string };
      if (data.accessToken) {
        await storage.setToken(data.accessToken);
        if (data.refreshToken) await storage.setRefreshToken(data.refreshToken);
        return true;
      }
      return false;
    } catch { 
      return false; 
    }
  })();

  const result = await refreshPromise;
  refreshPromise = null;
  return result;
}

/** Exported so syncOfflineQueue can use it directly */
// Ping the server on app startup so Render wakes up before user tries to login
export async function warmupServer(): Promise<void> {
  // Fire-and-forget: wake up Render free-tier server.
  // Two quick pings with short timeouts — this is best-effort only.
  // ⚠️ Never await this function from the critical startup path —
  //    it should always be called inside a setTimeout (see _layout.tsx).
  const ping = async (timeoutMs: number) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      await fetch(`${API_BASE}/health`, { method: "GET", signal: ctrl.signal });
    } catch { /* silent */ } finally {
      clearTimeout(t);
    }
  };
  // First quick ping (8s timeout) — if Render is warm, this succeeds fast.
  // If cold, it will abort and a second ping fires after 20s (by then Render
  // is usually almost ready and the user is on the login screen).
  await ping(8000);
  setTimeout(() => ping(30000), 20000);
}

/**
 * FIX C3 + B1 — Force-refresh stored tokens via /auth/refresh.
 * Server re-reads plan from DB and re-signs, so the new access token carries
 * the current plan claim. Call this after polling-based plan upgrades
 * (Razorpay browser checkout) where the verify endpoint isn't hit directly.
 * Returns true on success.
 */
export async function refreshTokensFromServer(): Promise<boolean> {
  return attemptTokenRefresh();
}

export async function rawRequest<T>(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  auth = true
): Promise<T> {
  // FIX CB2: Remov console log to fix path leak.
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = await getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  // 15s timeout — previously 60s "to handle Render cold start" but:
  // 1. Keep-alive is now fixed (running in production), so cold starts are rare
  // 2. A 60s timeout meant the app appeared frozen for a full minute on errors
  // 3. If Render is genuinely cold, warmupServer() handles that separately
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    setOnlineState(true);
  } catch (err) {
    clearTimeout(timeoutId);
    setOnlineState(false);
    // Log the actual fetch error to the developer console for debugging
    console.error(`[API Error] Request to ${path} failed:`, err);
    const isTimeout = (err as Error)?.name === "AbortError";
    if (isTimeout) throw new Error("Server is starting up — please try again in a moment");
    throw new Error("Network error — check your internet connection");
  }

  if (res.status === 401 && auth) {
    // Try silent token refresh before logging out
    const refreshed = await attemptTokenRefresh();
    if (refreshed) {
      // Retry the original request with the new token
      const newToken = await storage.getToken();
      const retryHeaders: Record<string, string> = { "Content-Type": "application/json" };
      if (newToken) retryHeaders["Authorization"] = `Bearer ${newToken}`;
      try {
        const retryRes = await fetch(`${API_BASE}${path}`, {
          method,
          headers: retryHeaders,
          body: body ? JSON.stringify(body) : undefined,
        });
        if (retryRes.status !== 401) {
          const retryText = await retryRes.text().catch(() => "");
          if (!retryText || retryText.trim() === "") {
            if (!retryRes.ok) throw new Error(`Server error (${retryRes.status}) — please try again`);
            return {} as T;
          }
          let retryData: unknown;
          try { retryData = JSON.parse(retryText); } catch { throw new Error(`Unexpected server response (${retryRes.status})`); }
          if (!retryRes.ok) throw new Error((retryData as { error?: string }).error || `Request failed (${retryRes.status})`);
          return retryData as T;
        }
      } catch (retryErr) {
        if ((retryErr as Error)?.message !== "Session expired — please log in again") throw retryErr;
      }
    }
    // Refresh failed or retry still 401 — log out
    await clearAuthAndNotify();
    throw new Error("Session expired — please log in again");
  }

  let text = "";
  try { text = await res.text(); } catch { text = ""; }

  if (!text || text.trim() === "") {
    if (!res.ok) throw new Error(`Server error (${res.status}) — please try again`);
    return {} as T;
  }

  let data: unknown;
  try { data = JSON.parse(text); }
  catch { throw new Error(`Unexpected server response (${res.status})`); }

  if (!res.ok) {
    const errData = data as { error?: string; required?: string; planRequired?: string; used?: number; usedToday?: number; limit?: number; limitPerDay?: number; feature?: string };
    if (res.status === 403) {
      throw new APILimitError("plan_limit", errData.error || "Feature not available in your plan", {
        requiredPlan: errData.planRequired || errData.required,
        feature: errData.feature,
      });
    }
    if (res.status === 429) {
      throw new APILimitError("daily_limit", errData.error || "Daily limit reached", {
        used: errData.usedToday ?? errData.used,
        limit: errData.limitPerDay ?? errData.limit,
        feature: errData.feature,
      });
    }
    throw new Error(errData.error || `Request failed (${res.status})`);
  }
  return data as T;
}

/**
 * GET request with offline cache fallback.
 * On network error: returns cached response if available (no error thrown).
 * Returns { data, fromCache } so callers know if it's fresh.
 */
export async function cachedGet<T>(path: string): Promise<{ data: T; fromCache: boolean }> {
  try {
    const data = await rawRequest<T>("GET", path);
    await setCachedResponse(path, data);
    return { data, fromCache: false };
  } catch (e: unknown) {
    const msg = (e as Error).message || "";
    const name = (e as Error).name || "";
    const isNetworkError =
      msg.toLowerCase().includes("network") ||
      msg.toLowerCase().includes("fetch") ||
      msg.toLowerCase().includes("timeout") ||
      msg.toLowerCase().includes("starting up") ||
      msg.toLowerCase().includes("abort") ||
      msg.toLowerCase().includes("failed to connect") ||
      name === "AbortError" ||
      name === "TypeError";
    if (isNetworkError) {
      const cached = await getCachedResponse<T>(path);
      if (cached) return { data: cached, fromCache: true };
    }
    throw e;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  auth = true
): Promise<T> {
  return rawRequest<T>(method, path, body, auth);
}

export const api = {
  // ── Auth ──────────────────────────────────────────────
  sendOtp: (phone: string) =>
    request<{ success: boolean; message: string; devOtp?: string }>("POST", "/auth/send-otp", { phone }, false),

  sendWhatsappOtp: (phone: string) =>
    request<{ success: boolean; message: string; channel: "whatsapp" | "sms"; devOtp?: string }>("POST", "/auth/send-otp-whatsapp", { phone }, false),

  verifyOtp: (phone: string, otp: string, languageCode = "hi") =>
    request<{ accessToken: string; refreshToken: string; isNewUser: boolean; user: { id: string; phone: string; plan: string; languageCode: string } }>(
      "POST", "/auth/verify-otp", { phone, otp, languageCode }, false
    ),

  sendEmailOtp: (email: string) =>
    request<{ success: boolean; message: string; devOtp?: string; sent: boolean }>(
      "POST", "/auth/send-email-otp", { email }, false
    ),

  verifyEmailOtp: (email: string, otp: string, languageCode = "hi") =>
    request<{ accessToken: string; refreshToken: string; isNewUser: boolean; user: { id: string; email: string; plan: string; languageCode: string } }>(
      "POST", "/auth/verify-email-otp", { email, otp, languageCode }, false
    ),

  googleLogin: (accessToken: string) =>
    request<{ accessToken: string; refreshToken: string; isNewUser: boolean; user: { id: string; plan: string } }>(
      "POST", "/auth/google", { accessToken }, false
    ),

  firebaseLogin: (idToken: string, phone: string, languageCode = "hi") =>
    request<{ accessToken: string; refreshToken: string; isNewUser: boolean; user: { id: string; phone: string; plan: string; languageCode: string } }>(
      "POST", "/auth/firebase-login", { idToken, phone, languageCode }, false
    ),

  getMe: () =>
    request<{ user: { id: string; phone: string; email: string; plan: string; languageCode: string } }>("GET", "/auth/me"),

  // ── Users / Profile ────────────────────────────────────
  getProfile: () =>
    request<{ profile: Record<string, unknown>; user: { plan: string; phone: string; email: string }; preferences: Record<string, unknown>; conditions: Array<Record<string, unknown>>; goals: Record<string, unknown> }>("GET", "/users/profile"),

  updateProfile: (data: Record<string, unknown>) =>
    request<{ profile: Record<string, unknown> }>("PATCH", "/users/profile", data),

  updateOnboardingStep: (step: number) =>
    request<{ success: boolean; step: number }>("PATCH", "/users/onboarding/step", { step }),

  saveMedicalConditions: (conditions: Array<{ condition: string }>) =>
    request<{ conditions: Array<Record<string, unknown>> }>("POST", "/users/medical-conditions", { conditions }),

  saveHealthGoals: (goals: { primaryGoal: string; currentWeightKg?: number; targetWeightKg?: number; targetDate?: string; secondaryGoals?: string[] }) =>
    request<{ goals: Record<string, unknown> }>("POST", "/users/health-goals", goals),

  getPrivacy: () => request<{ privacy: Record<string, boolean> }>("GET", "/users/privacy"),

  updatePrivacy: (settings: Record<string, boolean>) =>
    request<{ privacy: Record<string, boolean> }>("PATCH", "/users/privacy", settings),

  // ── Food ───────────────────────────────────────────────
  getFoodLogs: (date: string) =>
    request<{ logs: Array<Record<string, unknown>> }>("GET", `/food/logs?date=${date}`),

  logFood: (data: Record<string, unknown>) =>
    request<{ log: Record<string, unknown> }>("POST", "/food/log", data),

  deleteFoodLog: (id: string) =>
    request<{ success: boolean }>("DELETE", `/food/log/${id}`),

  searchFood: (q: string) =>
    request<{ items: Array<Record<string, unknown>> }>("GET", `/food/search?q=${encodeURIComponent(q)}`),

  searchFoodHistory: (q: string) =>
    request<{ items: Array<{ foodNameEn: string; calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number; count: number; lastEaten: string }> }>(
      "GET", `/food/history-search?q=${encodeURIComponent(q)}`
    ),

  getFoodFavorites: () =>
    request<{ favorites: Array<{ foodNameEn: string; calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number; count: number; lastEaten: string }> }>(
      "GET", "/food/favorites"
    ),

  getFoodSummary: (date: string) =>
    request<{ summary: Record<string, unknown> }>("GET", `/food/summary/${date}`),

  getActivePercent: () =>
    request<{ pct: number; todayPct: number; weekPct: number; daysTracked: number; trend: string }>("GET", "/health/active-percent"),

  getScoreRange: (startDate: string, endDate: string) =>
    request<{ score: number; daysTracked: number; startDate: string; endDate: string }>("GET", `/health/score-range?startDate=${startDate}&endDate=${endDate}`),

  getWeatherFoodSuggestions: () =>
    request<{
      weatherContext: string;
      season: string;
      suggestions: Array<{
        name: string; nameHindi: string; emoji: string; reason: string;
        calories: number; benefit: string; category: string; isSeasonalSpecial: boolean;
      }>;
      weatherTip: string;
      fallback?: boolean;
    }>("POST", "/food/weather-suggestions", {}),

  // AI food scan — History → DB → Cache → Gemini (4-level, cost-optimized)
  scanFood: (data: { foodName?: string; imageBase64?: string; mimeType?: string }) =>
    request<{
      result: {
        foodNameEn: string; calories: number; proteinG: number; carbsG: number; fatG: number;
        fiberG: number; sodiumMg?: number; sugarG?: number; servingSizeG: number;
        servingDescription: string; category: string; dietaryTags: string[];
        vitamins?: { vitaminA_mcg?: number; vitaminC_mg?: number; vitaminD_mcg?: number; vitaminB12_mcg?: number; iron_mg?: number; calcium_mg?: number; potassium_mg?: number; zinc_mg?: number };
        glycemicIndex?: number; healthTip?: string;
      };
      fromCache: boolean;
      fromDb: boolean;
      fromHistory: boolean;
      historyCount?: number;
    }>("POST", "/food/scan", data as Record<string, unknown>),

  // ── Exercise ───────────────────────────────────────────
  getExerciseLogs: (date: string) =>
    request<{ logs: Array<Record<string, unknown>> }>("GET", `/health/exercise?date=${date}`),

  logExercise: (data: Record<string, unknown>) =>
    request<{ log: Record<string, unknown>; calculation?: { weightKg: number; gender: string; metValue: number; caloriesBurned: number } }>(
      "POST", "/health/exercise", data
    ),

  calculateExercise: (data: { exerciseType: string; durationMinutes: number; intensity: string }) =>
    request<{
      exerciseType: string; durationMinutes: number; intensity: string;
      weightKg: number; gender: string; metValue: number; caloriesBurned: number; formula: string;
    }>("POST", "/health/exercise/calculate", data),

  // ── Sleep ──────────────────────────────────────────────
  logSleep: (data: { sleepDate: string; sleepHours: number; bedtime?: string; wakeTime?: string; quality?: "poor" | "fair" | "good" | "excellent"; notes?: string; isOfflineEntry?: boolean }) =>
    request<{ success: boolean; log: Record<string, unknown>; sleepHours: number }>("POST", "/health/sleep", data as Record<string, unknown>),

  getSleepLog: (date: string) =>
    request<{ log: Record<string, unknown> | null; sleepHours: number | null; quality: string | null; isLogged: boolean }>("GET", `/health/sleep/${date}`),

  updateSleepLog: (date: string, data: { sleepHours: number; bedtime?: string; wakeTime?: string; quality?: string; notes?: string }) =>
    request<{ success: boolean; log: Record<string, unknown>; sleepHours: number }>("PUT", `/health/sleep/${date}`, data as Record<string, unknown>),

  getSleepHistory: (days = 7) =>
    request<{ logs: Array<Record<string, unknown>>; count: number; avgHours: number | null }>("GET", `/health/sleep/history?days=${days}`),

  // ── Water ──────────────────────────────────────────────
  getWaterLog: (date: string) =>
    request<{ logs: Array<Record<string, unknown>>; totalGlasses: number; goal: number }>("GET", `/health/water/${date}`),

  // ── Medicine ───────────────────────────────────────────
  getMedicineSchedules: () =>
    request<{ schedules: Array<Record<string, unknown>> }>("GET", "/medicine/schedules"),

  createMedicineSchedule: (data: { medicineName: string; dosage?: string; mealTiming: string; reminderTimes: string[]; startDate: string; frequency?: string; doseCount?: number; notes?: string }) =>
    request<{ schedule: Record<string, unknown> }>("POST", "/medicine/schedule", data as Record<string, unknown>),

  updateMedicineSchedule: (id: string, data: Record<string, unknown>) =>
    request<{ schedule: Record<string, unknown> }>("PATCH", `/medicine/schedule/${id}`, data),

  deleteMedicineSchedule: (id: string) =>
    request<{ success: boolean }>("DELETE", `/medicine/schedule/${id}`),

  logMedicine: (data: Record<string, unknown>) =>
    request<{ log: Record<string, unknown> }>("POST", "/medicine/log", data),

  getMedicineLogs: (date?: string) =>
    request<{ logs: Array<Record<string, unknown>> }>("GET", `/medicine/logs${date ? `?date=${date}` : ""}`),

  // ── Medical Reports (AI scan) ──────────────────────────
  getMedicalReports: () =>
    request<{ reports: Array<Record<string, unknown>> }>("GET", "/medical/reports"),

  scanMedicalReport: (data: { imageBase64?: string; images?: Array<{ data: string; mimeType?: string }>; reportType?: string; mimeType?: string }) =>
    request<{
      report: Record<string, unknown>;
      analysis: {
        reportType: string;
        reportDate?: string;
        labName?: string;
        patientName?: string;
        pagesAnalyzed?: number;
        findings: Array<{ testName: string; value: string; numericValue?: number; unit?: string; normalRange: string; status: string; interpretation: string }>;
        criticalValues?: Array<{ testName: string; value: string; urgency: string }>;
        overallAssessment?: string;
        aiAdvice?: string;
        dietRecommendations?: string[];
        urgencyLevel?: string;
        followUpRequired?: boolean;
      };
    }>("POST", "/medical/scan", data),

  deleteMedicalReport: (id: string) =>
    request<{ success: boolean }>("DELETE", `/medical/reports/${id}`),

  // ── Health Score ───────────────────────────────────────
  getHealthScore: (date: string) =>
    request<{ score: Record<string, unknown> }>("GET", `/health/score/${date}`),

  computeHealthScore: (date: string) =>
    request<{ score: Record<string, unknown> }>("POST", `/health/score/${date}/compute`),

  // ── User Preferences (language, dark mode, water/calorie goals, etc.) ──
  getPreferences: () =>
    request<{ preferences: Record<string, unknown> | null }>("GET", "/users/preferences"),
  updatePreferences: (data: Record<string, unknown>) =>
    request<{ success: boolean }>("PATCH", "/users/preferences", data),


  // ── AI Usage (real server-tracked limits, replaces old local-only counter) ──
  getAiUsage: () =>
    request<{
      plan: string;
      date: string;
      usage: Array<{
        featureName: string;
        description: string;
        usedToday: number;
        limitToday: number;
        unlimited: boolean;
        period: "daily" | "weekly" | "monthly";
      }>;
    }>("GET", "/my/ai-usage"),


  // ── AI Coach ────────────────────────────────────────────
  getDietPlan: (days = 1, language = "en") =>
    request<{
      plan: {
        targetCalories: number;
        targetProteinG: number;
        targetCarbsG: number;
        targetFatG: number;
        days: Array<{
          day: number;
          dayName: string;
          totalCalories: number;
          meals: {
            breakfast: { items: MealItem[]; totalCalories: number };
            lunch: { items: MealItem[]; totalCalories: number };
            dinner: { items: MealItem[]; totalCalories: number };
            snacks: { items: MealItem[]; totalCalories: number };
          };
          waterIntakeMl: number;
          tip: string;
        }>;
        generalTips: string[];
      };
      generatedAt: string;
    }>("POST", "/ai/diet-plan", { days, preferences: { language } }),

  getHealthTip: (context?: string) =>
    request<{ tip: string; tipHindi: string; category: string; emoji: string }>(
      "POST", "/ai/health-tip", { context }
    ),

  getMealSwap: (mealName: string, reason?: string, dietaryPref = "vegetarian") =>
    request<{
      original: string;
      swaps: Array<{ name: string; nameHindi: string; reason: string; calories: number; benefit: string }>;
    }>("POST", "/ai/meal-swap", { mealName, reason, dietaryPref }),

  // ── Blood Emergency ──────────────────────────────────────
  registerBloodDonor: (data: { bloodGroup: string; city: string; state: string; phone?: string; lat?: number; lng?: number }) =>
    request<{ success: boolean; donor: Record<string, unknown>; message: string }>("POST", "/blood/donor/register", data),

  getMyDonorStatus: () =>
    request<{ registered: boolean; isAvailable?: boolean; otpVerified?: boolean; isOnCooldown?: boolean; daysLeft?: number; inactiveUntil?: string | null; bloodGroup?: string; city?: string; state?: string; donationCount?: number }>("GET", "/blood/donor/me"),

  toggleDonorAvailability: (available: boolean) =>
    request<{ success: boolean; isAvailable: boolean }>("PATCH", "/blood/donor/availability", { available }),

  getBloodDonors: (bloodGroup: string, city?: string, coords?: { lat: number; lng: number; radiusKm?: number }) => {
    const params = new URLSearchParams({ bloodGroup });
    if (city) params.set("city", city);
    if (coords) {
      params.set("lat", String(coords.lat));
      params.set("lng", String(coords.lng));
      params.set("radiusKm", String(coords.radiusKm ?? 50));
    }
    return request<{ donors: Array<{ id: string; bloodGroup: string; city: string; state: string; isAvailable: boolean; distanceKm?: number | null }>; nearbySearch: boolean; searchedRadiusKm?: number; expanded?: boolean }>(
      "GET", `/blood/donors?${params.toString()}`
    );
  },

  createBloodEmergency: (data: {
    patientName: string;
    bloodGroup: string;
    unitsNeeded: number;
    hospitalName: string;
    hospitalAddress: string;
    hospitalCity: string;
    hospitalState: string;
    hospitalPincode?: string;
    hospitalPhone: string;
    hospitalLat?: number;
    hospitalLng?: number;
    doctorName?: string;
    doctorPhone?: string;
    contactPhone: string;
    contactName?: string;
    urgency?: string;
    notes?: string;
  }) =>
    request<{ success: boolean; request: Record<string, unknown> }>("POST", "/blood/emergency/direct", data as Record<string, unknown>),

  cancelBloodRequest: (requestId: string) =>
    request<{ success: boolean }>("PATCH", `/blood/request/${requestId}/cancel`, {}),

  getBloodEmergencies: () =>
    request<{ requests: Array<Record<string, unknown>> }>("GET", "/blood/requests/active"),

  getMyBloodRequests: () =>
    request<{ requests: Array<{ id: string; patientName: string; bloodGroupNeeded: string; unitsNeeded: number; urgency: string; hospitalName: string; hospitalCity: string; hospitalState: string; status: string; expiresAt?: string; fulfilledAt?: string; createdAt: string; donorsNotified?: number; donorsResponded?: number }> }>("GET", "/blood/requests/mine"),

  respondToBloodEmergency: (requestId: string, response: "can_help" | "later" | "unavailable") =>
    request<{ success: boolean }>("POST", `/blood/request/${requestId}/respond`, { response }),

  flagBloodRequest: (requestId: string) =>
    request<{ success: boolean }>("POST", `/blood/request/${requestId}/flag`, {}),

  markBloodFulfilled: (requestId: string) =>
    request<{ success: boolean }>("PATCH", `/blood/request/${requestId}/fulfil`, {}),

  // ── Stress Tracking ────────────────────────────────────────
  logStress: (data: {
    stressType: string; mood?: string; stressScore?: number; pillars?: Record<string, number>;
    moodScore?: number; energyScore?: number; pssScores?: number[]; symptoms?: string[];
  }) =>
    request<{ success: boolean; log: Record<string, unknown>; stressScore: number }>("POST", "/stress/log", data),
  getStressToday: () =>
    request<{ checkedIn: boolean; latestScore: number | null; avgScore: number | null; count: number; latestMood: string | null; latestMode: string | null; burnoutRisk: boolean }>("GET", "/stress/today"),
  getStressLogs: (limit?: number) =>
    request<{ logs: Array<Record<string, unknown>>; avgScore: number; count: number }>("GET", `/stress/logs${limit ? `?limit=${limit}` : ""}`),
  getStressWeekly: () =>
    request<{ days: Array<{ date: string; dayLabel: string; dayLabelHi: string; avgScore: number; count: number; dominantMood: string | null }>; weekAvg: number; totalLogs: number; highStreakDays: number; burnoutRisk: boolean; personalBaseline: number | null; vsBaseline: number | null; baselineLogsCount: number }>("GET", "/stress/weekly"),
  getStressInsight: () =>
    request<{ avgScore: number; insight: string; tips: string[]; logsCount: number; aiPowered: boolean }>("GET", "/stress/insight"),

  // ── Family Health ──────────────────────────────────────────
  getFamilyGroup: () =>
    request<{ group: Record<string, unknown> | null; members: Array<Record<string, unknown>>; isOwner: boolean }>("GET", "/family/group"),
  createFamilyGroup: () =>
    request<{ success: boolean; group: Record<string, unknown>; inviteCode: string }>("POST", "/family/create"),
  joinFamilyGroup: (inviteCode: string, relation?: string, isMinor?: boolean) =>
    request<{ success: boolean; group: Record<string, unknown> }>("POST", "/family/join", { inviteCode, relation, isMinor }),
  leaveFamilyGroup: () =>
    request<{ success: boolean }>("DELETE", "/family/leave"),
  dissolveFamilyGroup: () =>
    request<{ success: boolean }>("DELETE", "/family/dissolve"),
  getMemberHealth: (memberId: string) =>
    request<Record<string, unknown>>("GET", `/family/member/${memberId}/health`),
  getMemberHistory: (memberId: string, period?: "week" | "month") =>
    request<Record<string, unknown>>("GET", `/family/member/${memberId}/history?period=${period || "week"}`),
  sendMemberReminder: (memberId: string, message?: string) =>
    request<{ success: boolean; notified: boolean }>("POST", `/family/member/${memberId}/reminder`, { message }),
  updateMyPermission: (permission: "full" | "basic" | "none") =>
    request<{ success: boolean }>("PATCH", "/family/member/permission", { permission }),
  updateMemberRelation: (memberId: string, relation: string, isMinor?: boolean) =>
    request<{ success: boolean }>("PATCH", `/family/member/${memberId}/relation`, { relation, isMinor }),
  getFamilyAlerts: () =>
    request<{ alerts: Array<Record<string, unknown>>; total: number }>("GET", "/family/alerts"),

  // ── Period Tracker ─────────────────────────────────────────
  getPeriodLogs: () =>
    request<{ logs: Array<Record<string, unknown>>; prediction: Record<string, unknown> | null }>("GET", "/period/logs"),
  logPeriod: (data: { startDate: string; endDate?: string; symptoms?: string[]; flow?: string; notes?: string }) =>
    request<{ success: boolean; log: Record<string, unknown>; prediction: Record<string, unknown> | null }>("POST", "/period/log", data),

  // ── Org Enrollment ─────────────────────────────────────────
  enrollWithOrgCode: (orgCode: string) =>
    request<{ success: boolean; planUpgraded: string; org: { name: string; type: string }; accessToken?: string; refreshToken?: string }>("POST", "/business/enroll", { orgCode }),
  useEnrollmentCode: (code: string) =>
    request<{ success: boolean; planUpgraded: string; expiresAt: string; org: { name: string; type: string }; message: string; accessToken?: string; refreshToken?: string }>("POST", "/business/use-enrollment-code", { code }),

  // ── Plans / Pricing ────────────────────────────────────────
  getPlans: (type?: string) =>
    request<{ plans: Array<{ planKey: string; displayName: string; type: string; monthlyPrice: string; yearlyPrice: string | null; maxSeats: number | null; features: string[]; badgeText: string | null; badgeColor: string | null; gradientColors: [string,string] | null; isActive: boolean; sortOrder: number }> }>("GET", `/plans${type ? `?type=${type}` : ""}`),

  // ── Payment / Upgrade ──────────────────────────────────────
  createPaymentOrder: (
  plan: string,
  promoCode?: string,
  billingCycle: "monthly" | "yearly" = "monthly"
) =>
  request<{
    success: boolean;
    paymentId: string;
    razorpayOrderId: string | null;
    razorpayKeyId: string | null;
    amount: number;
    plan: string;
    billingCycle: "monthly" | "yearly";
    discount: number;
    promoUsed?: string | null;
    planLabel?: string;
    isTestMode: boolean;
  }>("POST", "/payment/order", {
    plan,
    promoCode,
    billingCycle,
  }),
  verifyPayment: (data: { paymentId: string; razorpayOrderId?: string; razorpayPaymentId?: string; razorpaySignature?: string; plan: string; isTestMode?: boolean }) =>
    request<{ success: boolean; message: string; inviteCode?: string | null; expiresAt?: string; accessToken?: string; refreshToken?: string; plan?: string }>("POST", "/payment/verify", data),
  validatePromoCode: (code: string, plan: string) =>
    request<{ valid: boolean; discount: number; code: string; message: string }>("POST", "/payment/promo/validate", { code, plan }),
  getOrderStatus: (orderId: string) =>
    request<{ status: string; plan: string; paymentId: string; razorpayPaymentId: string | null }>("GET", `/payment/order-status?orderId=${encodeURIComponent(orderId)}`),

  // ── Autopay Subscription ───────────────────────────────────
  createSubscription: (
  plan: string,
  promoCode?: string,
  billingCycle: "monthly" | "yearly" = "monthly"
) =>
  request<{
    subscriptionId: string;
    razorpaySubscriptionId?: string;
    razorpayKeyId?: string;
    plan: string;
    amount: number;
    discount: number;
    billingCycle?: "monthly" | "yearly";
    promoUsed?: string | null;
    planLabel?: string;
    isTestMode: boolean;
    expiresAt?: string;
    nextRenewalAt?: string;
    message?: string;
    accessToken?: string;
    refreshToken?: string;
  }>("POST", "/payment/subscription/create", {
    plan,
    promoCode,
    billingCycle,
  }),
  verifySubscription: (data: { subscriptionId: string; razorpaySubscriptionId: string; razorpayPaymentId: string; razorpaySignature: string; plan: string }) =>
    request<{ success: boolean; message: string; expiresAt?: string; inviteCode?: string | null; accessToken?: string; refreshToken?: string; plan?: string }>("POST", "/payment/subscription/verify", data),
  cancelSubscription: () =>
    request<{ success: boolean; message: string; expiresAt?: string }>("DELETE", "/payment/subscription/cancel"),
  getSubscriptionStatus: () =>
    request<{ subscription: { id: string; plan: string; status: string; expiresAt: string; autoRenew: boolean; nextRenewalAt: string | null; razorpaySubscriptionId: string | null } | null; plan: string }>("GET", "/payment/subscription"),

  // ── Scorecard ──────────────────────────────────────────────
  getScorecard: () =>
    request<{
      aoraneId: string; name: string; bloodGroup: string; bmi: string; bmiCategory: string;
      plan: string; gender: string; age: number | null; memberSince: string; qrData: string;
      city: string | null; state: string | null; workProfile: string | null;
      activePercent: { overall: number; foodPct: number; waterPct: number; exercisePct: number; medicinePct: number; breakdown: { food: number; water: number; exercise: number; medicine: number } };
    }>("GET", "/users/scorecard"),

  // ── Active Percentage ───────────────────────────────────────
  getActivityScore: (date?: string) =>
    request<{ date: string; overall: number; foodPct: number; waterPct: number; exercisePct: number; medicinePct: number; label: string; breakdown: { food: number; water: number; exercise: number; medicine: number } }>("GET", `/users/activity-score${date ? `?date=${date}` : ""}`),

  // ── Water ─────────────────────────────────────────────────
  logWater: (data: { glassesCount: number; drinkType?: string }) =>
    request<{ success: boolean; log: Record<string, unknown> }>("POST", "/health/water", data),
  getWaterLogs: (date: string) =>
    request<{ logs: Array<Record<string, unknown>>; totalGlasses: number; goalGlasses: number; progressPct: number }>("GET", `/health/water/${date}`),

  // ── PIN Auth ───────────────────────────────────────────────
  setPIN: (pin: string) =>
    request<{ success: boolean; message: string }>("POST", "/auth/pin/set", { pin }),
  loginWithPIN: (phone: string, pin: string) =>
    request<{ accessToken: string; refreshToken: string; user: Record<string, unknown> }>("POST", "/auth/pin/login", { phone, pin }, false),

  // ── Suggestions & Notification Settings ───────────────────
  getDailySuggestions: () =>
    request<{ suggestions: Record<string, unknown>; fromCache: boolean; generatedAt: string; date: string }>("GET", "/suggestions/daily"),
  refreshSuggestions: () =>
    request<{ success: boolean }>("POST", "/suggestions/refresh", {}),
  getNotificationSettings: () =>
    request<{ settings: Record<string, unknown> }>("GET", "/notifications/settings"),
  updateNotificationSettings: (settings: Record<string, unknown>) =>
    request<{ success: boolean }>("PUT", "/notifications/settings", settings),

  // ── Ads ───────────────────────────────────────────────────
  getActiveAds: (screen: string = "dashboard") =>
    request<{ ads: Array<Record<string, unknown>> }>("GET", `/ads/active?screen=${screen}`),
  recordAdImpression: (adId: string) =>
    request<{ success: boolean }>("POST", `/ads/${adId}/impression`, { platform: "mobile" }),
  recordAdClick: (adId: string) =>
    request<{ success: boolean; linkUrl: string | null }>("POST", `/ads/${adId}/click`, {}),

  // ── Wearable / Smart Watch ─────────────────────────────────
  getWearableProviders: () =>
    request<{ providers: unknown[] }>("GET", "/wearable/providers"),
  getWearableConnections: () =>
    request<{ connections: unknown[] }>("GET", "/wearable/connections"),
  getWearableData: (params?: { provider?: string; limit?: number; days?: number }) =>
    request<{ latest: unknown; history: unknown[]; summary: unknown }>(
      "GET",
      `/wearable/data${
        params?.limit || params?.days
          ? `?${[
              params?.limit ? `limit=${params.limit}` : null,
              params?.days ? `days=${params.days}` : null,
            ].filter(Boolean).join("&")}`
          : ""
      }`
    ),
  syncHealthConnect: (data: {
    steps?: number | null; heartRateAvg?: number | null; caloriesBurned?: number | null;
    sleepHours?: number | null; bloodOxygen?: number | null; distanceKm?: number | null;
    activeMinutes?: number | null; heartRateMin?: number | null; heartRateMax?: number | null;
  }) =>
    request<{ success: boolean; hasData: boolean; data: unknown }>("POST", "/wearable/sync/health_connect", data),
  addManualWearableData: (data: Record<string, unknown>) =>
    request<{ success: boolean; data: unknown }>("POST", "/wearable/data/manual", data),
  disconnectWearable: (provider: string) =>
    request<{ success: boolean }>("DELETE", `/wearable/connections/${provider}`),

  // ── AI Smart Scan ────────────────────────────────────────
  smartScan: (data: { imageBase64: string; mimeType?: string }) =>
    request<{
      type: "food" | "medical_report" | "medicine" | "unknown";
      foodName?: string; confidence?: number; calories?: number; proteinG?: number;
      carbsG?: number; fatG?: number; fiberG?: number; servingSize?: string;
      healthScore?: number; tags?: string[]; tip?: string; ingredients?: string[];
      reportType?: string; patientName?: string | null; date?: string | null;
      summary?: string; urgencyLevel?: "normal" | "attention" | "urgent";
      keyFindings?: { parameter: string; value: string; normalRange: string; status: "normal" | "high" | "low" }[];
      recommendations?: string[]; disclaimer?: string;
      medicineName?: string; genericName?: string; uses?: string;
      commonDosage?: string; sideEffects?: string[]; warnings?: string[];
      message?: string;
    }>("POST", "/ai/smart-scan", data as Record<string, unknown>),

  // ── Health Intelligence (DeepSeek AI) ─────────────────────
  getHealthPrediction: () =>
    request<{
      prediction: {
        overallScore: number; overallLabel: string;
        risks: { name: string; percentage: number; level: string; reason: string; icon: string }[];
        recommendations: { title: string; detail: string; priority: string }[];
        disclaimer: string; generatedFor: string;
      };
      cached: boolean; month: string; generatedAt: string;
    }>("GET", "/health/intelligence/predict"),

  refreshHealthPrediction: () =>
    request<{ prediction: Record<string, unknown>; cached: boolean; month: string }>("POST", "/health/intelligence/predict/refresh", {}),

  getWeeklyDietChart: () =>
    request<{
      dietChart: {
        weekStart: string; targetCalories: number;
        days: {
          day: string; date: string;
          breakfast: { time: string; items: string[]; calories: number };
          lunch: { time: string; items: string[]; calories: number };
          dinner: { time: string; items: string[]; calories: number };
          snacks: { time: string; item: string; calories: number }[];
          totalCalories: number; water: string; tip: string;
        }[];
        weeklyTips: string[];
      };
      cached: boolean; weekStart: string; generatedAt: string;
    }>("GET", "/health/intelligence/diet-chart"),

  refreshWeeklyDietChart: () =>
    request<{ dietChart: Record<string, unknown>; weekStart: string }>("POST", "/health/intelligence/diet-chart/refresh", {}),

  getWeeklyFoodNutrition: () =>
    request<{
      days: Array<{ date: string; totalCalories: number; totalProteinG: number; totalCarbsG: number; totalFatG: number; totalCalciumMg: number; totalVitaminB12Mcg: number; totalVitaminCMg: number; totalIronMg: number; mealCount: number }>;
      weeklyTotals: { totalCalories: number; totalProteinG: number; totalCarbsG: number; totalFatG: number; totalCalciumMg: number; totalVitaminB12Mcg: number; totalVitaminCMg: number; totalIronMg: number };
      weeklyAverages: Record<string, number>;
    }>("GET", "/food/weekly-nutrition"),

  getMonthlyFoodNutrition: () =>
    request<{
      weeks: Array<{ weekLabel: string; startDate: string; endDate: string; totalCalories: number; totalProteinG: number; totalCarbsG: number; totalFatG: number; totalCalciumMg: number; totalVitaminB12Mcg: number; totalVitaminCMg: number; totalIronMg: number; mealCount: number }>;
      monthlyTotals: { totalCalories: number; totalProteinG: number; totalCarbsG: number; totalFatG: number; totalCalciumMg: number; totalVitaminB12Mcg: number; totalVitaminCMg: number; totalIronMg: number };
      monthlyAverages: Record<string, number>;
    }>("GET", "/food/monthly-nutrition"),

  calculateExerciseCalories: (exerciseType: string, durationMinutes: number) =>
    request<{ exerciseType: string; durationMinutes: number; weightKg: number; met: number; caloriesBurned: number }>(
      "POST", "/health/intelligence/exercise/calories", { exerciseType, durationMinutes }
    ),

  // ── Account Deletion ─────────────────────────────────────
  /**
   * Soft-deletes the authenticated user's account.
   * Requires OTP verification. Backend will:
   *   1. Validate OTP against phone/email
   *   2. Set users.deleted_at + users.is_active = false
   *   3. Cancel active subscriptions
   *   4. Delete all child records (cascade)
   *   5. Purge Supabase Storage files
   */
  deleteAccount: (payload: { otp: string }) =>
    request<{ success: boolean; message: string; deletedAt: string }>(
      "POST",
      "/users/delete-account",
      payload
    ),

  // ── Company Settings (public) ──────────────────────────────
  getCompanySettings: () =>
    request<{ settings: {
      companyName: string; companyLogoUrl: string | null; tagline: string | null;
      website: string | null; supportPhone: string | null; supportEmail: string | null;
      address: string | null; primaryColor: string; accentColor: string;
      scorecardShowQr: boolean; scorecardShowBloodGroup: boolean; scorecardShowBmi: boolean;
      scorecardShowActivePercent: boolean; scorecardBgGradientFrom: string; scorecardBgGradientTo: string;
      reportHeaderText: string | null; reportFooterText: string | null; reportLogoUrl: string | null;
      weeklyReportEnabled: boolean; monthlyReportEnabled: boolean;
    } }>("GET", "/settings/company", undefined, false),
};

interface MealItem {
  name: string;
  nameHindi: string;
  quantityG: number;
  quantityDesc: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}