import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8080/api";

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
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Network error" }));
    throw new Error((err as { error?: string }).error || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  // ── Auth ──────────────────────────────────────────────
  sendOtp: (phone: string) =>
    request<{ success: boolean; message: string }>("POST", "/auth/send-otp", { phone }, false),

  verifyOtp: (phone: string, otp: string, languageCode = "hi") =>
    request<{ accessToken: string; refreshToken: string; isNewUser: boolean; user: { id: string; phone: string; plan: string; languageCode: string } }>(
      "POST", "/auth/verify-otp", { phone, otp, languageCode }, false
    ),

  googleLogin: (idToken: string) =>
    request<{ accessToken: string; refreshToken: string; isNewUser: boolean; user: { id: string; plan: string } }>(
      "POST", "/auth/google", { idToken }, false
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
  logStress: (data: { stressType: string; mood?: string; stressScore?: number; pillars?: Record<string, number> }) =>
    request<{ success: boolean; log: Record<string, unknown>; stressScore: number }>("POST", "/stress/log", data),
  getStressLogs: (limit?: number) =>
    request<{ logs: Array<Record<string, unknown>>; avgScore: number; count: number }>("GET", `/stress/logs${limit ? `?limit=${limit}` : ""}`),
  getStressWeekly: () =>
    request<{ days: Array<{ date: string; dayLabel: string; dayLabelHi: string; avgScore: number; count: number; dominantMood: string | null }>; weekAvg: number; totalLogs: number }>("GET", "/stress/weekly"),
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

  // ── Payment / Upgrade ──────────────────────────────────────
  createPaymentOrder: (plan: string, promoCode?: string) =>
    request<{ success: boolean; paymentId: string; razorpayOrderId: string | null; razorpayKeyId: string | null; amount: number; plan: string; discount: number; isTestMode: boolean }>("POST", "/payment/order", { plan, promoCode }),
  verifyPayment: (data: { paymentId: string; razorpayOrderId?: string; razorpayPaymentId?: string; razorpaySignature?: string; plan: string; isTestMode?: boolean }) =>
    request<{ success: boolean; message: string }>("POST", "/payment/verify", data),
  validatePromoCode: (code: string, plan: string) =>
    request<{ valid: boolean; discount: number; code: string; message: string }>("POST", "/payment/promo/validate", { code, plan }),

  // ── Scorecard ──────────────────────────────────────────────
  getScorecard: () =>
    request<{ aoraneId: string; name: string; bloodGroup: string; bmi: string; bmiCategory: string; plan: string; gender: string; age: number | null; memberSince: string; qrData: string }>("GET", "/users/scorecard"),

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

  // ── Ads ───────────────────────────────────────────────────
  getActiveAds: (screen: string = "dashboard") =>
    request<{ ads: Array<Record<string, unknown>> }>("GET", `/ads/active?screen=${screen}`),
  recordAdImpression: (adId: string) =>
    request<{ success: boolean }>("POST", `/ads/${adId}/impression`, { platform: "mobile" }),
  recordAdClick: (adId: string) =>
    request<{ success: boolean; linkUrl: string | null }>("POST", `/ads/${adId}/click`, {}),
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
