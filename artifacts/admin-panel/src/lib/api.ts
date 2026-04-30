const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : `${import.meta.env.BASE_URL}api`;

export const apiBase = API_BASE;

export function getToken(): string | null { return localStorage.getItem("ap_token"); }

function clearSessionAndRedirect() {
  localStorage.removeItem("ap_token");
  localStorage.removeItem("ap_admin");
  if (!window.location.pathname.endsWith("/") || window.location.pathname !== import.meta.env.BASE_URL) {
    window.location.href = import.meta.env.BASE_URL || "/admin-panel/";
  }
}

export async function adminRequest<T>(path: string, opts?: { method?: string; body?: Record<string, unknown> }): Promise<T> {
  return req<T>(path, {
    method: opts?.method ?? "GET",
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
}

async function req<T>(path: string, opts?: RequestInit, skipAutoLogout = false): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(opts?.headers as Record<string, string>),
  };
  const url = `${API_BASE}${path}`;
  let res: Response;
  try {
    res = await fetch(url, { ...opts, headers });
  } catch (networkErr) {
    console.error("[API] Network error:", networkErr);
    throw new Error("Network error — check your connection and try again");
  }
  let text = "";
  try {
    text = await res.text();
  } catch (textErr) {
    console.error("[API] Failed to read response body:", textErr);
    throw new Error(`Failed to read server response (${res.status})`);
  }
  console.debug(`[API] ${opts?.method ?? "GET"} ${url} → ${res.status} | body: ${text.slice(0, 80)}`);
  if (!text || text.trim() === "") {
    throw new Error(`Empty response from server (${res.status})`);
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    console.error("[API] Non-JSON response:", text.slice(0, 200));
    throw new Error(`Server error (${res.status}) — please try again`);
  }
  if (res.status === 401 && !skipAutoLogout) {
    clearSessionAndRedirect();
    throw new Error("Session expired. Please log in again.");
  }
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  return data as T;
}

export type User = {
  id: string; phone: string; email: string | null; plan: string; isActive: boolean; isBanned: boolean;
  createdAt: string; lastActiveAt: string | null; lastLoginAt: string | null;
  fullName: string | null; aoraneId: string | null;
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
  id: string; foodNameEn: string; foodNameLocal?: Record<string, string> | null;
  calories: string | number; proteinG: string | number; carbsG: string | number; fatG: string | number;
  servingSizeG?: string | number | null; servingDescription?: string | null;
  category: string; isVerified: boolean; aiGenerated?: boolean;
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
  userId: string; aoraneId: string | null; name: string | null; email: string | null;
  bloodGroup: string | null; gender: string | null; age: number | null;
  city: string | null; state: string | null; bmi: string | null;
  plan: string; phone: string; isActive: boolean; isBanned: boolean; createdAt: string;
};
export type Language = {
  id: string; code: string; nameEn: string; nameLocal: string;
  direction: string; isActive: boolean; completionPct: number;
};
export type AuditLog = {
  id: string; adminId: string; action: string; targetType: string; targetId: string;
  details: Record<string, unknown> | null; createdAt: string;
};
export type Enquiry = {
  id: string;
  type: "expert" | "investor_deck" | "general" | "notify_me";
  name: string;
  email: string;
  mobile: string | null;
  city: string | null;
  accountType: string | null;
  companyName: string | null;
  message: string | null;
  source: string | null;
  status: "new" | "contacted" | "closed";
  notifiedAt: string | null;
  createdAt: string;
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
    req<{ token: string; admin: { id: string; fullName: string; role: string } }>("/admin/login", { method: "POST", body: JSON.stringify({ email, password }) }, true),

  overview: () => req<{ stats: { totalUsers: number; totalOrganizations: number; activeSubscriptions: number; totalBloodRequests: number; totalRevenue: number; monthRevenue: number; newUsersToday: number; newUsersThisMonth: number; planBreakdown: Array<{ plan: string; count: number }> } }>("/admin/overview"),
  users: (params?: { limit?: number; offset?: number; search?: string }) => {
    const qs = new URLSearchParams({
      limit: String(params?.limit || 100),
      offset: String(params?.offset || 0),
    });
    if (params?.search) qs.set("search", params.search);
    return req<{ users: User[]; total: number; offset: number; limit: number }>(`/admin/users?${qs.toString()}`);
  },
  updateUser: (id: string, data: Partial<{ plan: string; isActive: boolean; isBanned: boolean }>) =>
    req<{ user: User }>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  searchUsers: (q: string) =>
    req<{ results: SearchResult[]; count: number }>(`/admin/users/search?q=${encodeURIComponent(q)}`),

  organizations: () => req<{ organizations: Org[] }>("/admin/organizations"),
  createOrg: (data: Partial<Org>) => req<{ organization: Org; success: boolean }>("/admin/organizations", { method: "POST", body: JSON.stringify(data) }),
  toggleOrgActive: (id: string) => req<{ organization: Org; success: boolean }>(`/admin/organizations/${id}/toggle-active`, { method: "PATCH" }),
  updateOrg: (id: string, data: Partial<Org>) => req<{ organization: Org; success: boolean }>(`/admin/organizations/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteOrg: (id: string) => req<{ success: boolean }>(`/admin/organizations/${id}`, { method: "DELETE" }),
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

  enquiries: (params?: { status?: string; type?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.type)   qs.set("type",   params.type);
    const q = qs.toString();
    return req<{ enquiries: Enquiry[]; stats: { total: number; newCount: number; contactedCount: number; closedCount: number } }>(`/admin/enquiries${q ? `?${q}` : ""}`);
  },
  updateEnquiry: (id: string, status: "new" | "contacted" | "closed") =>
    req<{ success: boolean; enquiry: Enquiry }>(`/admin/enquiries/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
  deleteEnquiry: (id: string) =>
    req<{ success: boolean }>(`/admin/enquiries/${id}`, { method: "DELETE" }),

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

  getMyProfile: () => req<{ admin: { id: string; fullName: string; email: string; role: string; lastLoginAt: string | null; createdAt: string } }>("/admin/me"),
  updateMyProfile: (data: { fullName?: string; email?: string }) =>
    req<{ admin: { id: string; fullName: string; email: string; role: string }; success: boolean }>("/admin/me", { method: "PATCH", body: JSON.stringify(data) }),
  changePassword: (currentPassword: string, newPassword: string) =>
    req<{ success: boolean; message: string }>("/admin/change-password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) }),

  foodCacheStats: () => req<FoodCacheStats>("/admin/food-cache/stats"),
  foodCache: (params?: { filter?: string; search?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.filter)  qs.set("filter",  params.filter);
    if (params?.search)  qs.set("search",  params.search);
    if (params?.limit)   qs.set("limit",   String(params.limit));
    if (params?.offset)  qs.set("offset",  String(params.offset));
    return req<{ entries: FoodCacheEntry[]; total: number }>(`/admin/food-cache?${qs}`);
  },
  promoteFood: (id: string) => req<{ success: boolean; foodItem: { id: string; foodNameEn: string } | null }>(`/admin/food-cache/${id}/promote`, { method: "POST" }),
  rejectFood:  (id: string) => req<{ success: boolean }>(`/admin/food-cache/${id}/reject`, { method: "POST" }),
  exportFoodCache: async (filter = "all", format: "csv" | "json" = "json") => {
    const token = getToken();
    const url = `${API_BASE}/admin/food-cache/export?filter=${filter}&format=${format}`;
    const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ai-food-discovery-${filter}-${Date.now()}.${format}`;
    a.click();
    URL.revokeObjectURL(a.href);
  },
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

export type FoodCacheEntry = {
  id: string;
  foodNameEn: string;
  hitCount: number;
  sourceAi: string | null;
  isPromoted: boolean;
  isRejected: boolean;
  reviewedAt: string | null;
  createdAt: string;
  lastUsedAt: string;
  promotedFoodItemId: string | null;
  aiResult: Record<string, unknown>;
};

export type FoodCacheStats = {
  total: number;
  pending: number;
  promoted: number;
  rejected: number;
  autoPromoted: number;
};
