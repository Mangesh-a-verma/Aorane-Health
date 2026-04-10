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

  searchFood: (q: string) =>
    request<{ items: Array<Record<string, unknown>> }>("GET", `/food/search?q=${encodeURIComponent(q)}`),

  getFoodSummary: (date: string) =>
    request<{ summary: Record<string, unknown> }>("GET", `/food/summary/${date}`),

  // AI food scan — text name or image
  scanFood: (data: { foodName?: string; imageBase64?: string }) =>
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
    }>("POST", "/food/scan", data),

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

  logWater: (glasses = 1) =>
    request<{ log: Record<string, unknown> }>("POST", "/health/water", { glassesCount: glasses }),

  // ── Medicine ───────────────────────────────────────────
  getMedicineSchedules: () =>
    request<{ schedules: Array<Record<string, unknown>> }>("GET", "/medicine/schedules"),

  logMedicine: (data: Record<string, unknown>) =>
    request<{ log: Record<string, unknown> }>("POST", "/medicine/log", data),

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
};
