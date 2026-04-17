import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// On web browser → use relative path so web-server.js proxy handles it (local API, devOtp works)
// On native (Expo Go / APK) → use production URL from env or fallback
const API_BASE =
  Platform.OS === "web"
    ? "/api"
    : process.env.EXPO_PUBLIC_API_URL || "http://localhost:8080/api";

let _onUnauthorized: (() => void) | null = null;

export function setUnauthorizedCallback(cb: () => void) {
  _onUnauthorized = cb;
}

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem("auth_token");
}

async function request<T>(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  auth = true
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = await getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Network error — check your internet connection");
  }

  if (res.status === 401 && auth) {
    await AsyncStorage.multiRemove(["auth_token", "refresh_token", "user_data", "onboarding_done", "pin_set", "app_pin"]);
    _onUnauthorized?.();
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
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
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

  getWeeklyActivity: () =>
    request<{ activeDays: number; totalDays: number; percentage: number }>("GET", "/health/weekly-activity"),

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

  scanMedicalReport: (data: { imageBase64: string; reportType?: string; mimeType?: string }) =>
    request<{
      report: Record<string, unknown>;
      analysis: {
        reportType: string;
        reportDate?: string;
        labName?: string;
        findings: Array<{ testName: string; value: string; numericValue?: number; unit?: string; normalRange: string; status: string; interpretation: string }>;
        criticalValues?: Array<{ testName: string; value: string; urgency: string }>;
        overallAssessment?: string;
        aiAdvice?: string;
        dietRecommendations?: string[];
        urgencyLevel?: string;
      };
    }>("POST", "/medical/scan", data),

  deleteMedicalReport: (id: string) =>
    request<{ success: boolean }>("DELETE", `/medical/reports/${id}`),

  // ── Health Score ───────────────────────────────────────
  getHealthScore: (date: string) =>
    request<{ score: Record<string, unknown> }>("GET", `/health/score/${date}`),

  computeHealthScore: (date: string) =>
    request<{ score: Record<string, unknown> }>("POST", `/health/score/${date}/compute`),

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
    request<{ success: boolean; requiresOtp: boolean; message: string }>("POST", "/blood/donor/register", data),

  getBloodDonors: (bloodGroup: string, city?: string, coords?: { lat: number; lng: number; radiusKm?: number }) => {
    const params = new URLSearchParams({ bloodGroup });
    if (city) params.set("city", city);
    if (coords) {
      params.set("lat", String(coords.lat));
      params.set("lng", String(coords.lng));
      params.set("radiusKm", String(coords.radiusKm ?? 50));
    }
    return request<{ donors: Array<{ id: string; bloodGroup: string; city: string; state: string; isAvailable: boolean; distanceKm?: number | null }>; nearbySearch: boolean }>(
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
    doctorName?: string;
    doctorPhone?: string;
    contactPhone: string;
    contactName?: string;
    urgency?: string;
    notes?: string;
  }) =>
    request<{ success: boolean; request: Record<string, unknown> }>("POST", "/blood/emergency/direct", data as Record<string, unknown>),

  getBloodEmergencies: () =>
    request<{ requests: Array<Record<string, unknown>> }>("GET", "/blood/requests/active"),

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
    request<{ days: Array<{ date: string; dayLabel: string; dayLabelHi: string; avgScore: number; count: number; dominantMood: string | null }>; weekAvg: number; totalLogs: number; highStreakDays: number; burnoutRisk: boolean }>("GET", "/stress/weekly"),
  getStressInsight: () =>
    request<{ avgScore: number; insight: string; tips: string[]; logsCount: number; aiPowered: boolean }>("GET", "/stress/insight"),

  // ── Family Health ──────────────────────────────────────────
  getFamilyGroup: () =>
    request<{ group: Record<string, unknown> | null; members: Array<Record<string, unknown>>; isOwner: boolean }>("GET", "/family/group"),
  createFamilyGroup: () =>
    request<{ success: boolean; group: Record<string, unknown>; inviteCode: string }>("POST", "/family/create"),
  joinFamilyGroup: (inviteCode: string) =>
    request<{ success: boolean; group: Record<string, unknown> }>("POST", "/family/join", { inviteCode }),
  leaveFamilyGroup: () =>
    request<{ success: boolean }>("DELETE", "/family/leave"),

  // ── Period Tracker ─────────────────────────────────────────
  getPeriodLogs: () =>
    request<{ logs: Array<Record<string, unknown>>; prediction: Record<string, unknown> | null }>("GET", "/period/logs"),
  logPeriod: (data: { startDate: string; endDate?: string; symptoms?: string[]; flow?: string; notes?: string }) =>
    request<{ success: boolean; log: Record<string, unknown>; prediction: Record<string, unknown> | null }>("POST", "/period/log", data),

  // ── Plans / Pricing ────────────────────────────────────────
  getPlans: (type?: string) =>
    request<{ plans: Array<{ planKey: string; displayName: string; type: string; monthlyPrice: string; yearlyPrice: string | null; maxSeats: number | null; features: string[]; badgeText: string | null; badgeColor: string | null; gradientColors: [string,string] | null; isActive: boolean; sortOrder: number }> }>("GET", `/plans${type ? `?type=${type}` : ""}`),

  // ── Payment / Upgrade ──────────────────────────────────────
  createPaymentOrder: (plan: string, promoCode?: string) =>
    request<{ success: boolean; paymentId: string; razorpayOrderId: string | null; razorpayKeyId: string | null; amount: number; plan: string; discount: number; isTestMode: boolean }>("POST", "/payment/order", { plan, promoCode }),
  verifyPayment: (data: { paymentId: string; razorpayOrderId?: string; razorpayPaymentId?: string; razorpaySignature?: string; plan: string; isTestMode?: boolean }) =>
    request<{ success: boolean; message: string; inviteCode?: string | null; expiresAt?: string }>("POST", "/payment/verify", data),
  validatePromoCode: (code: string, plan: string) =>
    request<{ valid: boolean; discount: number; code: string; message: string }>("POST", "/payment/promo/validate", { code, plan }),

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
    request<{ providers: unknown[]; googleFitConfigured: boolean }>("GET", "/wearable/providers"),
  getWearableConnections: () =>
    request<{ connections: unknown[] }>("GET", "/wearable/connections"),
  getWearableData: (params?: { provider?: string; limit?: number }) =>
    request<{ latest: unknown; history: unknown[]; summary: unknown }>("GET", `/wearable/data${params?.limit ? `?limit=${params.limit}` : ""}`),
  getGoogleFitAuthUrl: (returnUrl?: string) =>
    request<{ authUrl: string }>("GET", `/wearable/oauth/google-fit/url${returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ""}`),
  syncWearableProvider: (provider: string) =>
    request<{ success: boolean; data: unknown }>("POST", `/wearable/sync/${provider}`, {}),
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

  calculateExerciseCalories: (exerciseType: string, durationMinutes: number) =>
    request<{ exerciseType: string; durationMinutes: number; weightKg: number; met: number; caloriesBurned: number }>(
      "POST", "/health/intelligence/exercise/calories", { exerciseType, durationMinutes }
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
