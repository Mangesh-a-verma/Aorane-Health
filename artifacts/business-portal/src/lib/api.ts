const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : `${import.meta.env.BASE_URL}api`;

function getToken(): string | null {
  return localStorage.getItem("bp_token");
}

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
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

export interface Org {
  id: string; orgType: string; name: string; orgCode: string;
  contactEmail: string; contactPhone: string; city: string; state: string;
  totalSeats: number; usedSeats: number; isActive: boolean; isVerified: boolean;
  plan: string; gstin?: string; createdAt: string;
}

export interface Admin {
  id: string; fullName: string; role: string; email: string;
}

export interface Member {
  memberId: string; userId: string; role: string; joinedAt: string;
  fullName: string | null; bloodGroup: string | null;
}

export interface MemberSearchResult {
  userId: string; aoraneId: string | null; name: string | null;
  bloodGroup: string | null; gender: string | null; age: number | null;
  city: string | null; bmi: string | null; plan: string;
}

export interface EnrollmentCode {
  id: string; code: string; planType: string; totalSeats: number;
  usedSeats: number; validityDays: number; expiresAt: string;
  isActive: boolean; createdAt: string;
}

export interface Overview {
  org: Org; memberCount: number; activeSeats: number;
}

export interface CorporateReport {
  org: { id: string; name: string; orgType: string; industry: string | null; companySize: string | null; contactEmail: string; city: string | null; state: string | null };
  month: string;
  totalMembers: number;
  activeMembers: number;
  dataPoints: number;
  averages: { healthScore: number; exerciseScore: number; foodScore: number; waterScore: number; sleepScore: number; stressScore: number; medicineScore: number } | null;
  compliance: { exercisePct: number; waterPct: number };
  gradeDistribution: { excellent: number; veryGood: number; good: number; average: number; needsImprovement: number } | null;
  grade: string | null;
  gradeLabel: string | null;
  gradeColor: string | null;
}

export interface OrgPlan {
  label: string; seats: number; price: number; priceYearly: number; color: string;
}

export interface Analytics {
  totalMembers: number;
  genderDist: { name: string; value: number; color: string }[];
  planDist: { name: string; value: number }[];
  ageDist: { name: string; value: number }[];
  avgBmi: string | null;
  joinTrend: { date: string; count: number }[];
}

export interface HealthAnalytics {
  totalMembers: number;
  activeToday: number;
  activeLast7Days: number;
  avgHealthScore: number;
  healthScoreTrendPct: number | null;
  // null when nobody in the company tracked that metric at all. A sub-score
  // of 0 means "tracked, and scored badly" — the two must not be conflated.
  avgFood: number | null;
  avgWater: number | null;
  avgExercise: number | null;
  avgMedicine: number | null;
  healthyCount: number;
  atRiskCount: number;
  inactiveCount: number;
  dailyActiveTrend: { date: string; activeCount: number }[];
  avgStressScore: number | null;
  highStressCount: number;
  moderateStressCount: number;
  lowStressCount: number;
  stressTrackedCount: number;
}

export interface SeatOrder {
  paymentId: string;
  invoiceNumber: string;
  plan: string;
  planLabel: string;
  seats: number;
  billingCycle: string;
  pricePerSeat: number;
  months: number;
  baseAmount: number;
  gstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
  isSameState: boolean;
  gstRate: number;
  orgGstin?: string;
  orgState?: string;
  orgName: string;
  aoranGstin: string;
  razorpayOrderId: string | null;
  razorpayKeyId: string | null;
  isTestMode: boolean;
  razorpayError?: string | null;
}

export interface Announcement {
  id: string; title: string; body: string; type: string; sentCount: number; createdAt: string;
}

export interface MemberDetail {
  member: { userId: string; role: string; joinedAt: string; isActive: boolean };
  profile: { fullName: string | null; bloodGroup: string | null; gender: string | null; bmi: string | null; dateOfBirth: string | null } | null;
  user: { plan: string; aoraneId: string | null };
  recentScores: { scoreDate: string; overallScore: number | null }[];
}

export interface MemberStress {
  userId: string;
  name: string | null;
  latestScore: number | null;
  avgScore: number | null;
  logsCount: number;
  burnoutRisk: boolean;
  level: string;
  trend: { date: string; score: number }[];
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; admin: Admin; org: Org }>("/business/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  verifyLoginOtp: (email: string, otp: string) =>
    request<{ token: string; admin: Admin; org: Org }>("/business/login/verify-otp", { method: "POST", body: JSON.stringify({ email, otp }) }),

  sendBusinessEmailOtp: (email: string) =>
    request<{ success: boolean; message: string; devOtp?: string; sent: boolean }>("/business/login/send-email-otp", { method: "POST", body: JSON.stringify({ email }) }),

  forgotPassword: (email: string) =>
    request<{ sent: boolean; message: string; devOtp?: string }>("/business/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),

  forgotPasswordVerify: (email: string, otp: string, newPassword: string) =>
    request<{ success: boolean; message: string }>("/business/forgot-password/verify", { method: "POST", body: JSON.stringify({ email, otp, newPassword }) }),

  toggleMemberActive: (userId: string) =>
    request<{ success: boolean; isActive: boolean; message: string }>(`/business/members/${userId}/toggle-active`, { method: "POST" }),

  getMe: (token: string) =>
    request<{ admin: Admin; org: Org }>("/business/me", { headers: { Authorization: `Bearer ${token}` } }),

  sendRegOtp: (email: string) =>
    request<{ success: boolean; message: string; devOtp?: string; sent: boolean }>("/business/send-reg-otp", { method: "POST", body: JSON.stringify({ email }) }),

  verifyRegOtp: (email: string, otp: string) =>
    request<{ success: boolean; verified: boolean }>("/business/verify-reg-otp", { method: "POST", body: JSON.stringify({ email, otp }) }),

  sendEmailOtp: (email: string) =>
    request<{ success: boolean; message: string; devOtp?: string; sent: boolean }>("/auth/send-email-otp", { method: "POST", body: JSON.stringify({ email }) }),

  verifyEmailOtp: (email: string, otp: string) =>
    request<{ accessToken: string; refreshToken: string; isNewUser: boolean; user: { id: string; email: string; plan: string } }>("/auth/verify-email-otp", { method: "POST", body: JSON.stringify({ email, otp }) }),

  register: (data: Record<string, unknown>) =>
    request<{ success: boolean; org: Org; token: string; orgCode: string }>("/business/register", { method: "POST", body: JSON.stringify(data) }),

  overview: () => request<Overview>("/business/overview"),

  members: () => request<{ members: Member[] }>("/business/members"),

  searchMembers: (q: string) =>
    request<{ results: MemberSearchResult[]; count: number }>(`/business/members/search?q=${encodeURIComponent(q)}`),

  getMemberDetail: (userId: string) =>
    request<MemberDetail>(`/business/members/${userId}/detail`),

  getMemberStress: (userId: string) =>
    request<MemberStress>(`/business/members/${userId}/stress`),

  removeMember: (userId: string) =>
    request<{ success: boolean }>(`/business/members/${userId}/remove`, { method: "POST" }),

  suspendMember: (userId: string) =>
    request<{ success: boolean; message: string }>(`/business/members/${userId}/suspend`, { method: "POST" }),

  restoreMember: (userId: string) =>
    request<{ success: boolean; message: string }>(`/business/members/${userId}/restore`, { method: "POST" }),

  getSuspendedMembers: () =>
    request<{ members: Member[] }>("/business/members/suspended"),

  cancelMemberSubscription: (userId: string) =>
    request<{ success: boolean; message: string }>(`/business/members/${userId}/cancel-subscription`, { method: "POST" }),

  getCodes: () => request<{ codes: EnrollmentCode[] }>("/business/enrollment-codes"),

  createCode: (data: { planType: string; totalSeats: number; validityDays: number }) =>
    request<{ code: EnrollmentCode }>("/business/enrollment-codes", { method: "POST", body: JSON.stringify(data) }),

  getBillingPlans: () => request<{ plans: Record<string, OrgPlan> }>("/business/billing/plans"),

  getBillingSubscription: () => request<{ payment: { plan: string; status: string; paymentType?: string; payment_type?: string; autoRenew?: boolean; auto_renew?: boolean; nextRenewalAt?: string; next_renewal_at?: string; expiresAt?: string; expires_at?: string } | null; org: Org; plans: Record<string, OrgPlan> }>("/business/billing/subscription"),

  // Seat-based billing
  createSeatOrder: (plan: string, seats: number, billingCycle: "monthly" | "yearly", orgGstin?: string, orgState?: string) =>
    request<SeatOrder>("/business/billing/seat-order", { method: "POST", body: JSON.stringify({ plan, seats, billingCycle, orgGstin, orgState }) }),

  verifySeatPayment: (data: Record<string, unknown>) =>
    request<{ success: boolean; org: Org; message: string; expiresAt?: string }>("/business/billing/seat-verify", { method: "POST", body: JSON.stringify(data) }),

  getInvoices: () => request<{ invoices: Record<string, unknown>[] }>("/business/billing/invoices"),

  getSeatPlans: () => request<{ plans: Record<string, { label: string; pricePerSeat: number; yearlyPricePerSeat: number }>; gstRate: number }>("/business/billing/seat-plans"),

  // Public marketing endpoints — unauthenticated, safe to call from the
  // logged-out landing page. Real pricing + a real, aggregate-only,
  // minimum-sample-gated engagement rate (see api-server for the guard).
  getPublicPlans: () =>
    request<{ plans: Record<string, { label: string; pricePerSeat: number; yearlyPricePerSeat: number; features: string[]; discountPercent: number; offerLabel: string | null }>; gstRate: number }>("/business/public/plans"),

  getPublicEngagementStat: () =>
    request<{ sampleSufficient: boolean; totalMembers: number; activeLast7Days: number; engagementRatePercent: number | null }>("/business/public/engagement-stat"),

  // Legacy billing (kept for backward compat)
  createBillingOrder: (plan: string, billing: string) =>
    request<{ paymentId: string; razorpayOrderId: string | null; razorpayKeyId: string | null; amount: number; plan: string; planLabel: string; seats: number; isTestMode: boolean }>("/business/billing/order", { method: "POST", body: JSON.stringify({ plan, billing }) }),

  verifyBillingPayment: (data: Record<string, unknown>) =>
    request<{ success: boolean; org: Org; message: string; expiresAt?: string }>("/business/billing/verify", { method: "POST", body: JSON.stringify(data) }),

  createBillingSubscription: (plan: string, billing: string) =>
    request<{ isTestMode: boolean; paymentId: string; razorpaySubscriptionId?: string; razorpayKeyId?: string; plan: string; planLabel?: string; amount: number; seats?: number; message?: string; nextRenewalAt?: string; expiresAt?: string; org?: Org }>("/business/billing/subscription/create", { method: "POST", body: JSON.stringify({ plan, billing }) }),

  verifyBillingSubscription: (data: Record<string, unknown>) =>
    request<{ success: boolean; org: Org; message: string; expiresAt?: string }>("/business/billing/subscription/verify", { method: "POST", body: JSON.stringify(data) }),

  cancelBillingSubscription: () =>
    request<{ success: boolean; message: string; nextRenewalAt?: string }>("/business/billing/subscription/cancel", { method: "DELETE" }),

  // Health Analytics (aggregate, privacy-safe)
  getHealthAnalytics: () => request<HealthAnalytics>("/business/health-analytics"),

  getAnalytics: () => request<Analytics>("/business/analytics"),

  getAnnouncements: () => request<{ announcements: Announcement[] }>("/business/announcements"),

  createAnnouncement: (data: { title: string; body: string; type: string }) =>
    request<{ announcement: Announcement }>("/business/announcements", { method: "POST", body: JSON.stringify(data) }),

  updateSettings: (data: Record<string, string>) =>
    request<{ org: Org }>("/business/settings", { method: "PATCH", body: JSON.stringify(data) }),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ success: boolean }>("/business/admin/password", { method: "PATCH", body: JSON.stringify({ currentPassword, newPassword }) }),

  // Verification stubs
  sendEmailVerification: () =>
    request<{ success: boolean; message: string; stub: boolean }>("/business/verify/send-email", { method: "POST" }),

  sendPhoneOtp: () =>
    request<{ success: boolean; message: string; stub: boolean }>("/business/verify/send-phone-otp", { method: "POST" }),

  // Corporate Monthly Health Reports
  getReportData: (month: string) =>
    request<{ report: CorporateReport }>(`/business/report/data?month=${month}`),

  getReportInsights: (month: string) =>
    request<{ insights: string | null }>(`/business/report/insights?month=${month}`),

  sendReportEmail: (month: string) =>
    request<{ success: boolean; sentTo: string }>("/business/report/email", { method: "POST", body: JSON.stringify({ month }) }),

  // ESG/CSRD (ESRS S1) readiness summary — Phase 2. Reshapes the same real
  // monthly report data into ESRS S1 categories; not a certified audit
  // (see the `disclaimer` field returned alongside it).
  getEsgSummary: (month: string) =>
    request<{ esg: {
      month: string; monthLabel: string;
      org: { name: string; industry: string | null };
      disclaimer: string; hasData: boolean;
      categories: { key: string; esrsRef: string; title: string; value: string; detail: string }[];
    } }>(`/business/report/esg-summary?month=${month}`),

  // "Aorane Health-Certified Workplace" — Phase 4. Public on purpose (see
  // api-server for why), but exposed here too so the org's own portal can
  // show the same status before they embed the badge elsewhere.
  getCertificationStatus: (orgId: string) =>
    request<{ orgName: string; month: string; certified: boolean; engagementPct: number; avgHealthScore: number; thresholds: { minEngagementPct: number; minAvgHealthScore: number } }>(`/business/public/certification/${orgId}`),

  // Smart Alerts — Phase 4. Computed live from real data, no stored
  // notifications table; see api-server for exact conditions.
  getAlerts: () =>
    request<{ alerts: { id: string; severity: "info" | "warning" | "critical"; title: string; detail: string; href: string }[] }>("/business/alerts"),
};
