const API_BASE = (import.meta.env.VITE_API_URL ?? "") + "/api";

export function getToken(): string | null { return localStorage.getItem("ap_token"); }

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(opts?.headers as Record<string, string>),
  };
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, { ...opts, headers });
  const text = await res.text();
  if (!text || text.trim() === "") {
    throw new Error(`Empty response from server (${res.status}) at ${url}`);
  }
  let data: unknown;
  try { data = JSON.parse(text); }
  catch { throw new Error(`Server returned non-JSON response (${res.status}): ${text.slice(0, 120)}`); }
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  return data as T;
}

export type User = {
  id: string; phone: string; plan: string; isActive: boolean; isBanned: boolean;
  createdAt: string; lastActiveAt: string | null;
};
export type Org = {
  id: string; name: string; orgType: string; orgCode: string; contactEmail: string;
  city: string; state: string; totalSeats: number; usedSeats: number; isActive: boolean; createdAt: string;
};
export type Flag = {
  id: string; key: string; label: string; description: string; isEnabled: boolean;
  enabledForPlans: string[]; config: Record<string, unknown> | null;
};
export type FoodItem = {
  id: string; name: string; calories: number; protein: number; carbs: number;
  fat: number; category: string; isVerified: boolean;
};
export type PromoCode = {
  id: string; code: string; discountPct: number; applicablePlans: string[];
  usageLimit: number | null; timesUsed: number; expiresAt: string | null; isActive: boolean; createdAt: string;
};
export type Announcement = {
  id: string; title: string; body: string; targetPlans: string[];
  startsAt: string | null; endsAt: string | null; isActive: boolean; createdAt: string;
};
export type BloodRequest = {
  id: string; requesterId: string; bloodGroup: string; unitsNeeded: number;
  hospitalName: string; city: string; state: string; status: string; isFlagged: boolean; createdAt: string;
};
export type SearchResult = {
  userId: string; aoraneId: string | null; name: string | null; bloodGroup: string | null;
  gender: string | null; age: number | null; city: string | null; state: string | null;
  bmi: string | null; plan: string; phone: string; isActive: boolean; isBanned: boolean; createdAt: string;
};
export type Language = {
  id: string; code: string; nameEn: string; nameLocal: string;
  direction: string; isActive: boolean; completionPct: number;
};
export type AuditLog = {
  id: string; adminId: string; action: string; targetType: string; targetId: string;
  details: Record<string, unknown> | null; createdAt: string;
};
export type AdCampaign = {
  id: string;
  adType: "google" | "direct";
  title: string;
  advertiserName: string | null;
  bannerUrl: string | null;
  linkUrl: string | null;
  targetPlans: string[] | null;
  targetCities: string[] | null;
  targetAgeMin: number | null;
  targetAgeMax: number | null;
  status: "active" | "paused" | "expired" | "pending";
  priority: number;
  dealAmount: string | null;
  impressionCount: number;
  clickCount: number;
  startsAt: string | null;
  endsAt: string | null;
  slidePosition: number | null;
  targetScreen: string | null;
  googleAdCode: string | null;
  createdAt: string;
  updatedAt: string;
};

export const api = {
  login: (email: string, password: string) =>
    req<{ token: string; admin: { id: string; fullName: string; role: string } }>("/admin/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  overview: () => req<{ stats: { totalUsers: number; totalOrganizations: number } }>("/admin/overview"),
  users: (params?: { limit?: number; offset?: number }) =>
    req<{ users: User[] }>(`/admin/users?limit=${params?.limit || 50}&offset=${params?.offset || 0}`),
  updateUser: (id: string, data: Partial<{ plan: string; isActive: boolean; isBanned: boolean }>) =>
    req<{ user: User }>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  searchUsers: (q: string) =>
    req<{ results: SearchResult[]; count: number }>(`/admin/users/search?q=${encodeURIComponent(q)}`),

  organizations: () => req<{ organizations: Org[] }>("/admin/organizations"),
  flags: () => req<{ flags: Flag[] }>("/admin/feature-flags"),
  createFlag: (data: Partial<Flag>) => req<{ flag: Flag }>("/admin/feature-flags", { method: "POST", body: JSON.stringify(data) }),
  updateFlag: (key: string, data: Partial<Flag>) => req<{ flag: Flag }>(`/admin/feature-flags/${key}`, { method: "PATCH", body: JSON.stringify(data) }),

  foodItems: () => req<{ items: FoodItem[] }>("/admin/food-items"),
  createFoodItem: (data: Partial<FoodItem>) => req<{ item: FoodItem }>("/admin/food-items", { method: "POST", body: JSON.stringify(data) }),

  promoCodes: () => req<{ codes: PromoCode[] }>("/admin/promo-codes"),
  createPromoCode: (data: Partial<PromoCode>) => req<{ code: PromoCode }>("/admin/promo-codes", { method: "POST", body: JSON.stringify(data) }),

  announcements: () => req<{ announcements: Announcement[] }>("/admin/announcements"),
  createAnnouncement: (data: Partial<Announcement>) => req<{ announcement: Announcement }>("/admin/announcements", { method: "POST", body: JSON.stringify(data) }),

  bloodRequests: () => req<{ requests: BloodRequest[] }>("/admin/blood-requests"),
  updateBloodRequest: (id: string, data: { status?: string; isFlagged?: boolean }) =>
    req<{ request: BloodRequest }>(`/admin/blood-requests/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  languages: () => req<{ languages: Language[] }>("/admin/languages"),
  createLanguage: (data: Partial<Language>) => req<{ language: Language }>("/admin/languages", { method: "POST", body: JSON.stringify(data) }),

  auditLogs: () => req<{ logs: AuditLog[] }>("/admin/audit-logs"),

  subscriptions: () => req<{ subscriptions: Array<Record<string, unknown>> }>("/admin/subscriptions"),
  grantSubscription: (userId: string, plan: string, durationDays?: number) =>
    req<{ success: boolean; subscription: Record<string, unknown> }>("/admin/subscriptions/grant", { method: "POST", body: JSON.stringify({ userId, plan, durationDays }) }),
  cancelSubscription: (id: string) =>
    req<{ success: boolean }>(`/admin/subscriptions/${id}/cancel`, { method: "PATCH" }),

  analytics: () => req<{ totalUsers: number; totalOrganizations: number; activeSubscriptions: number; totalRevenue: number; planBreakdown: Array<{ plan: string; count: number }> }>("/admin/analytics"),
  platformCosts: () => req<{ costs: Array<{ category: string; monthlyUSD: number; description: string }>; totalMonthlyUSD: number; totalMonthlyINR: number; userCount: number; costPerUser: number }>("/admin/platform-costs"),

  ads: () => req<{ ads: AdCampaign[] }>("/admin/ads"),
  createAd: (data: Partial<AdCampaign>) => req<{ ad: AdCampaign }>("/admin/ads", { method: "POST", body: JSON.stringify(data) }),
  updateAd: (id: string, data: Partial<AdCampaign>) => req<{ ad: AdCampaign }>(`/admin/ads/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteAd: (id: string) => req<{ success: boolean }>(`/admin/ads/${id}`, { method: "DELETE" }),
  toggleAd: (id: string) => req<{ status: string }>(`/admin/ads/${id}/toggle`, { method: "PATCH" }),

  getCompanySettings: () => req<{ settings: Record<string, unknown> }>("/admin/settings/company"),
  updateCompanySettings: (data: Record<string, unknown>) =>
    req<{ settings: Record<string, unknown>; success: boolean }>("/admin/settings/company", { method: "PUT", body: JSON.stringify(data) }),

  revenue: () => req<{
    summary: {
      totalRevenue: number; totalUsers: number; paidUsers: number; freeUsers: number;
      netRevenue: number; gatewayFees: number; monthlyCostINR: number; netProfit: number;
      expectedMRR: number; conversionRate: string;
    };
    planBreakdown: Array<{ plan: string; users: number; monthlyRate: number; expectedMRR: number; actualRevenue: number; transactions: number }>;
    recentPayments: Array<{ id: string; userId: string | null; plan: string; amount: number; currency: string; status: string; razorpayPaymentId: string | null; gatewayFee: number | null; createdAt: string }>;
  }>("/admin/revenue"),

  getAiConfig: () => req<{ configs: AiConfig[] }>("/admin/ai-config"),
  updateAiConfig: (feature: string, data: Partial<AiConfig>) =>
    req<{ config: AiConfig; success: boolean }>(`/admin/ai-config/${feature}`, { method: "PUT", body: JSON.stringify(data) }),

  getPlanPricing: () => req<{ plans: PlanPricingItem[] }>("/admin/plan-pricing"),
  updatePlanPricing: (planKey: string, data: Partial<PlanPricingItem>) =>
    req<{ success: boolean; plan: PlanPricingItem }>(`/admin/plan-pricing/${planKey}`, { method: "PUT", body: JSON.stringify(data) }),
  resetPlanPricing: () =>
    req<{ success: boolean; plans: PlanPricingItem[] }>("/admin/plan-pricing/reset", { method: "POST" }),
};

export type AiConfig = {
  id: string | null; feature: string; label: string; provider: string; model: string;
  apiKey: string | null; systemPrompt: string | null; isEnabled: boolean;
};

export type PlanPricingItem = {
  id: string; planKey: string; displayName: string; type: string;
  monthlyPrice: string; yearlyPrice: string | null; maxSeats: number | null;
  features: string[]; badgeText: string | null; badgeColor: string | null;
  gradientColors: [string, string] | null; isActive: boolean; sortOrder: number;
  createdAt: string; updatedAt: string;
};
