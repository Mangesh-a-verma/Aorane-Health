import { Router } from "express";
import { db, adminUsersTable, usersTable, userProfilesTable, organizationsTable, featureFlagsTable, adCampaignsTable, foodItemsTable, promoCodesTable, announcementsTable, adminAuditLogsTable, bloodEmergencyRequestsTable, languagesTable, subscriptionsTable, paymentsTable, companySettingsTable, aiConfigTable, planPricingTable } from "@workspace/db";
import { eq, desc, ilike, count, or, sql, and } from "drizzle-orm";
import { requireAdmin } from "../../middlewares/admin-auth";
import { signAdminToken } from "../../lib/jwt";
import type { AdminRequest } from "../../middlewares/admin-auth";
import { invalidateAICache } from "../../lib/ai";
import { invalidateFeatureCache } from "../../middlewares/feature-check";
import crypto from "crypto";

const router = Router();

router.post("/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    if (!email || !password) { res.status(400).json({ error: "Email and password required" }); return; }

    // Brute-force protection: max 10 attempts per email per 15 minutes
    const { cache } = await import("../../lib/redis");
    const rlKey = `admin_login:${email.toLowerCase()}`;
    const attempts = cache.incrementRateLimitFixed(rlKey, 15 * 60);
    if (attempts > 10) {
      res.status(429).json({ error: "Too many login attempts. Try after 15 minutes." });
      return;
    }

    const [admin] = await db.select().from(adminUsersTable).where(eq(adminUsersTable.email, email));
    if (!admin || !admin.isActive) { res.status(401).json({ error: "Invalid credentials" }); return; }
    const passwordHash = crypto.createHash("sha256").update(password).digest("hex");
    if (admin.passwordHash !== passwordHash) { res.status(401).json({ error: "Invalid credentials" }); return; }
    await db.update(adminUsersTable).set({ lastLoginAt: new Date() }).where(eq(adminUsersTable.id, admin.id));
    const token = signAdminToken({ adminId: admin.id, role: admin.role });
    res.json({ token, admin: { id: admin.id, fullName: admin.fullName, role: admin.role } });
  } catch {
    res.status(500).json({ error: "Admin login failed" });
  }
});

router.get("/admin/overview", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const [userCount] = await db.select({ count: count() }).from(usersTable);
    const [orgCount] = await db.select({ count: count() }).from(organizationsTable);
    res.json({ stats: { totalUsers: userCount.count, totalOrganizations: orgCount.count } });
  } catch {
    res.status(500).json({ error: "Failed to fetch overview" });
  }
});

router.get("/admin/users", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const { search, limit = "50", offset = "0" } = req.query as Record<string, string>;
    const baseQuery = db.select().from(usersTable);
    const filtered = search
      ? baseQuery.where(ilike(usersTable.phone, `%${search}%`))
      : baseQuery;
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const offsetNum = Math.max(parseInt(offset, 10) || 0, 0);
    const users = await filtered.orderBy(desc(usersTable.createdAt)).limit(limitNum).offset(offsetNum);
    res.json({ users });
  } catch {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// ─── AORANE ID Search ─────────────────────────────────────────────────────────
router.get("/admin/users/search", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const q = ((req.query.q as string) || "").trim();
    if (!q || q.length < 4) { res.status(400).json({ error: "Minimum 4 characters required" }); return; }
    const isAoraneId = /^\d{8,12}$/.test(q);
    let profiles: typeof userProfilesTable.$inferSelect[] = [];
    if (isAoraneId) {
      profiles = await db.select().from(userProfilesTable).where(eq(userProfilesTable.aoraneId, q)).limit(10);
    } else {
      profiles = await db.select().from(userProfilesTable).where(ilike(userProfilesTable.fullName, `%${q}%`)).limit(10);
    }
    const results = await Promise.all(profiles.map(async (p) => {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, p.userId)).limit(1);
      return {
        userId: p.userId,
        aoraneId: p.aoraneId,
        name: p.fullName,
        bloodGroup: p.bloodGroup,
        gender: p.gender,
        age: p.dateOfBirth ? Math.floor((Date.now() - new Date(p.dateOfBirth).getTime()) / (86400000 * 365.25)) : null,
        city: (p as Record<string, unknown>).city,
        state: (p as Record<string, unknown>).state,
        bmi: p.bmi,
        plan: user?.plan,
        phone: user?.phone,
        isActive: user?.isActive,
        isBanned: user?.isBanned,
        createdAt: user?.createdAt,
      };
    }));
    res.json({ results, count: results.length });
  } catch (err) {
    console.error("Admin search error:", err);
    res.status(500).json({ error: "Search failed" });
  }
});

router.patch("/admin/users/:id", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const { plan, isActive, isBanned } = req.body as { plan?: string; isActive?: boolean; isBanned?: boolean };
    const updates: Record<string, unknown> = {};
    if (plan !== undefined) updates.plan = plan;
    if (isActive !== undefined) updates.isActive = isActive;
    if (isBanned !== undefined) updates.isBanned = isBanned;
    const userId = String(req.params.id);
    const [updated] = await db.update(usersTable).set(updates as Partial<typeof usersTable.$inferInsert>).where(eq(usersTable.id, userId)).returning();
    await db.insert(adminAuditLogsTable).values({ adminId: req.adminId!, action: "update_user", targetType: "user", targetId: userId, details: updates });
    res.json({ user: updated });
  } catch {
    res.status(500).json({ error: "Failed to update user" });
  }
});

router.get("/admin/organizations", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const orgs = await db.select().from(organizationsTable).orderBy(desc(organizationsTable.createdAt));
    res.json({ organizations: orgs });
  } catch {
    res.status(500).json({ error: "Failed to fetch organizations" });
  }
});

router.get("/admin/feature-flags", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const flags = await db.select().from(featureFlagsTable);
    res.json({ flags });
  } catch {
    res.status(500).json({ error: "Failed to fetch feature flags" });
  }
});

router.post("/admin/feature-flags", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const { key, label, description, isEnabled, enabledForPlans, config } = req.body as Record<string, unknown>;
    const [flag] = await db.insert(featureFlagsTable).values({ key: key as string, label: label as string, description: description as string, isEnabled: Boolean(isEnabled), enabledForPlans: enabledForPlans as string[], config }).returning();
    res.status(201).json({ flag });
  } catch {
    res.status(500).json({ error: "Failed to create feature flag" });
  }
});

router.patch("/admin/feature-flags/:key", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const { isEnabled, enabledForPlans, config } = req.body as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    if (isEnabled !== undefined) updates.isEnabled = isEnabled;
    if (enabledForPlans !== undefined) updates.enabledForPlans = enabledForPlans;
    if (config !== undefined) updates.config = config;
    const flagKey = String(req.params.key);
    const [updated] = await db.update(featureFlagsTable).set(updates as Partial<typeof featureFlagsTable.$inferInsert>).where(eq(featureFlagsTable.key, flagKey)).returning();
    await db.insert(adminAuditLogsTable).values({ adminId: req.adminId!, action: "toggle_feature_flag", targetType: "feature_flag", targetId: flagKey, details: { isEnabled } });
    invalidateFeatureCache(flagKey);
    res.json({ flag: updated });
  } catch {
    res.status(500).json({ error: "Failed to update feature flag" });
  }
});

router.get("/admin/food-items", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const { search, limit = "50" } = req.query as Record<string, string>;
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 500);
    const items = await db.select().from(foodItemsTable).limit(limitNum);
    res.json({ items });
  } catch {
    res.status(500).json({ error: "Failed to fetch food items" });
  }
});

router.post("/admin/food-items", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const body = req.body as Partial<typeof foodItemsTable.$inferInsert>;
    const [item] = await db.insert(foodItemsTable).values({ ...body, addedByAdmin: true, isVerified: true } as typeof foodItemsTable.$inferInsert).returning();
    res.status(201).json({ item });
  } catch {
    res.status(500).json({ error: "Failed to create food item" });
  }
});

router.get("/admin/promo-codes", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const codes = await db.select().from(promoCodesTable).orderBy(desc(promoCodesTable.createdAt));
    res.json({ codes });
  } catch {
    res.status(500).json({ error: "Failed to fetch promo codes" });
  }
});

router.post("/admin/promo-codes", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const { code, discountPct, applicablePlans, usageLimit, expiresAt } = req.body as Record<string, unknown>;
    const [created] = await db.insert(promoCodesTable).values({ code: code as string, discountPct: Number(discountPct), applicablePlans: applicablePlans as string[], usageLimit: usageLimit ? Number(usageLimit) : undefined, expiresAt: expiresAt ? new Date(expiresAt as string) : undefined }).returning();
    res.status(201).json({ code: created });
  } catch {
    res.status(500).json({ error: "Failed to create promo code" });
  }
});

router.get("/admin/announcements", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const announcements = await db.select().from(announcementsTable).orderBy(desc(announcementsTable.createdAt));
    res.json({ announcements });
  } catch {
    res.status(500).json({ error: "Failed to fetch announcements" });
  }
});

router.post("/admin/announcements", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const { title, body, imageUrl, linkUrl, targetPlans, startsAt, endsAt } = req.body as Record<string, unknown>;
    const [announcement] = await db.insert(announcementsTable).values({ title: title as string, body: body as string, imageUrl: imageUrl as string, linkUrl: linkUrl as string, targetPlans: targetPlans as string[], startsAt: startsAt ? new Date(startsAt as string) : undefined, endsAt: endsAt ? new Date(endsAt as string) : undefined }).returning();
    res.status(201).json({ announcement });
  } catch {
    res.status(500).json({ error: "Failed to create announcement" });
  }
});

router.get("/admin/blood-requests", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const requests = await db.select().from(bloodEmergencyRequestsTable).orderBy(desc(bloodEmergencyRequestsTable.createdAt)).limit(100);
    res.json({ requests });
  } catch {
    res.status(500).json({ error: "Failed to fetch blood requests" });
  }
});

router.patch("/admin/blood-requests/:id", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const { status, isFlagged } = req.body as { status?: string; isFlagged?: boolean };
    const updates: Record<string, unknown> = {};
    if (status !== undefined) updates.status = status;
    if (isFlagged !== undefined) updates.isFlagged = isFlagged;
    const [updated] = await db.update(bloodEmergencyRequestsTable).set(updates as Partial<typeof bloodEmergencyRequestsTable.$inferInsert>).where(eq(bloodEmergencyRequestsTable.id, String(req.params.id))).returning();
    res.json({ request: updated });
  } catch {
    res.status(500).json({ error: "Failed to update blood request" });
  }
});

router.get("/admin/languages", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const langs = await db.select().from(languagesTable);
    res.json({ languages: langs });
  } catch {
    res.status(500).json({ error: "Failed to fetch languages" });
  }
});

router.post("/admin/languages", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const { code, nameEn, nameLocal, direction = "ltr" } = req.body as Record<string, string>;
    const [lang] = await db.insert(languagesTable).values({ code, nameEn, nameLocal, direction, isActive: false, completionPct: 0 }).returning();
    res.status(201).json({ language: lang });
  } catch {
    res.status(500).json({ error: "Failed to create language" });
  }
});

router.get("/admin/audit-logs", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const logs = await db.select().from(adminAuditLogsTable).orderBy(desc(adminAuditLogsTable.createdAt)).limit(100);
    res.json({ logs });
  } catch {
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

// ─── Subscriptions ────────────────────────────────────────────────────────────
router.get("/admin/subscriptions", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const subs = await db.select().from(subscriptionsTable).orderBy(desc(subscriptionsTable.createdAt)).limit(100);
    res.json({ subscriptions: subs });
  } catch {
    res.status(500).json({ error: "Failed to fetch subscriptions" });
  }
});

router.post("/admin/subscriptions/grant", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const { userId, plan, durationDays = 30 } = req.body as { userId: string; plan: string; durationDays?: number };
    if (!userId || !plan) { res.status(400).json({ error: "userId and plan required" }); return; }
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);
    const [sub] = await db.insert(subscriptionsTable).values({ userId, plan, status: "active", source: "admin_grant", expiresAt }).returning();
    await db.update(usersTable).set({ plan: plan as "free" | "pro" | "max" | "family" }).where(eq(usersTable.id, userId));
    await db.insert(adminAuditLogsTable).values({ adminId: req.adminId!, action: "grant_subscription", targetType: "user", targetId: userId, details: { plan, durationDays } });
    res.status(201).json({ success: true, subscription: sub });
  } catch {
    res.status(500).json({ error: "Failed to grant subscription" });
  }
});

router.patch("/admin/subscriptions/:id/cancel", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const subId = String(req.params.id);
    const [sub] = await db.update(subscriptionsTable).set({ status: "cancelled", cancelledAt: new Date() }).where(eq(subscriptionsTable.id, subId)).returning();
    if (sub?.userId) {
      await db.update(usersTable).set({ plan: "free" }).where(eq(usersTable.id, sub.userId));
    }
    await db.insert(adminAuditLogsTable).values({ adminId: req.adminId!, action: "cancel_subscription", targetType: "subscription", targetId: subId, details: {} });
    res.json({ success: true, subscription: sub });
  } catch {
    res.status(500).json({ error: "Failed to cancel subscription" });
  }
});

// ─── Analytics ────────────────────────────────────────────────────────────────
router.get("/admin/analytics", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const [totalUsers] = await db.select({ count: count() }).from(usersTable);
    const [totalOrgs] = await db.select({ count: count() }).from(organizationsTable);
    const [activeSubs] = await db.select({ count: count() }).from(subscriptionsTable).where(eq(subscriptionsTable.status, "active"));
    const planBreakdown = await db.select({ plan: usersTable.plan, count: count() }).from(usersTable).groupBy(usersTable.plan);
    const [payments] = await db.select({ total: sql<number>`COALESCE(SUM(CAST(amount AS NUMERIC)), 0)` }).from(paymentsTable).where(eq(paymentsTable.status, "success"));
    res.json({
      totalUsers: Number(totalUsers.count),
      totalOrganizations: Number(totalOrgs.count),
      activeSubscriptions: Number(activeSubs.count),
      totalRevenue: Number(payments.total || 0),
      planBreakdown: planBreakdown.map(p => ({ plan: p.plan, count: Number(p.count) })),
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

// ─── Platform Costs ───────────────────────────────────────────────────────────
router.get("/admin/platform-costs", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const [totalUsers] = await db.select({ count: count() }).from(usersTable);
    const userCount = Number(totalUsers.count);
    res.json({
      costs: [
        { category: "Supabase DB",       monthlyUSD: 25,  description: "PostgreSQL hosting + backups" },
        { category: "API Server (Render)",monthlyUSD: 7,   description: "Express API deployment" },
        { category: "Gemini AI API",      monthlyUSD: 15,  description: "Food scan + diet plans + report analysis" },
        { category: "SMS OTP (Fast2SMS)", monthlyUSD: 8,   description: `Approx ${Math.round(userCount * 2)} OTPs/month` },
        { category: "Expo / EAS Build",   monthlyUSD: 29,  description: "Mobile app builds + OTA updates" },
        { category: "Domain & SSL",       monthlyUSD: 3,   description: "aorane.com + certificates" },
      ],
      totalMonthlyUSD: 87,
      totalMonthlyINR: 87 * 84,
      userCount,
      costPerUser: userCount > 0 ? Number((87 / userCount).toFixed(2)) : 87,
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch platform costs" });
  }
});

// ─── Company Settings (Branding + Templates) ─────────────────────────────────
router.get("/admin/settings/company", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const rows = await db.select().from(companySettingsTable).limit(1);
    if (rows.length === 0) {
      const [created] = await db.insert(companySettingsTable).values({ id: 1 }).returning();
      res.json({ settings: created });
    } else {
      res.json({ settings: rows[0] });
    }
  } catch {
    res.status(500).json({ error: "Failed to fetch company settings" });
  }
});

router.put("/admin/settings/company", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const rows = await db.select().from(companySettingsTable).limit(1);
    let result;
    if (rows.length === 0) {
      [result] = await db.insert(companySettingsTable).values({ id: 1, ...body }).returning();
    } else {
      [result] = await db.update(companySettingsTable).set({ ...body, updatedAt: new Date() }).where(eq(companySettingsTable.id, 1)).returning();
    }
    res.json({ settings: result, success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to update company settings" });
  }
});

// Public endpoint — used by mobile app scorecard & report
router.get("/settings/company", async (req, res) => {
  try {
    const rows = await db.select().from(companySettingsTable).limit(1);
    if (rows.length === 0) {
      res.json({ settings: { companyName: "AORANE Health", tagline: "Your Health, In Your Hands", website: "aorane.com", primaryColor: "#0077B6", accentColor: "#00B896", scorecardBgGradientFrom: "#023E8A", scorecardBgGradientTo: "#1B998B", scorecardShowQr: true, scorecardShowBloodGroup: true, scorecardShowBmi: true, scorecardShowActivePercent: true, weeklyReportEnabled: true, monthlyReportEnabled: true } });
    } else {
      res.json({ settings: rows[0] });
    }
  } catch {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

// ─── Revenue Dashboard ────────────────────────────────────────────────────────
router.get("/admin/revenue", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const [totalUsers] = await db.select({ count: count() }).from(usersTable);
    const planBreakdown = await db.select({ plan: usersTable.plan, count: count() }).from(usersTable).groupBy(usersTable.plan);
    const pricingRows = await db.select().from(planPricingTable).where(eq(planPricingTable.type, "individual"));
    const PLAN_RATE: Record<string, number> = {};
    for (const r of pricingRows) { PLAN_RATE[r.planKey] = Number(r.monthlyPrice); }
    const PAID_PLANS = pricingRows.filter(r => Number(r.monthlyPrice) > 0).map(r => r.planKey);
    const paidUsers  = planBreakdown.filter(p => PAID_PLANS.includes(p.plan)).reduce((a, b) => a + Number(b.count), 0);
    const freeUsers  = planBreakdown.filter(p => !PAID_PLANS.includes(p.plan)).reduce((a, b) => a + Number(b.count), 0);

    const [totalRev] = await db.select({ total: sql<number>`COALESCE(SUM(CAST(amount AS NUMERIC)), 0)` }).from(paymentsTable).where(eq(paymentsTable.status, "success"));
    const planRevenue = await db
      .select({ plan: paymentsTable.plan, total: sql<number>`COALESCE(SUM(CAST(amount AS NUMERIC)), 0)`, txns: count() })
      .from(paymentsTable).where(eq(paymentsTable.status, "success")).groupBy(paymentsTable.plan);
    const recentPayments = await db.select().from(paymentsTable).orderBy(desc(paymentsTable.createdAt)).limit(50);

    const [gatewayFees] = await db.select({ total: sql<number>`COALESCE(SUM(CAST(gateway_fee AS NUMERIC)), 0)` }).from(paymentsTable).where(eq(paymentsTable.status, "success"));

    const MONTHLY_COST_INR = 87 * 84;
    const totalRevNum = Number(totalRev.total || 0);

    const expectedMRR = planBreakdown.reduce((sum, p) => sum + (PLAN_RATE[p.plan] || 0) * Number(p.count), 0);

    res.json({
      summary: {
        totalRevenue:    totalRevNum,
        totalUsers:      Number(totalUsers.count),
        paidUsers,
        freeUsers,
        netRevenue:      totalRevNum - Number(gatewayFees.total || 0),
        gatewayFees:     Number(gatewayFees.total || 0),
        monthlyCostINR:  MONTHLY_COST_INR,
        netProfit:       totalRevNum - MONTHLY_COST_INR,
        expectedMRR,
        conversionRate:  Number(totalUsers.count) > 0 ? ((paidUsers / Number(totalUsers.count)) * 100).toFixed(1) : "0.0",
      },
      planBreakdown: planBreakdown.map(p => ({
        plan:         p.plan,
        users:        Number(p.count),
        monthlyRate:  PLAN_RATE[p.plan] || 0,
        expectedMRR:  (PLAN_RATE[p.plan] || 0) * Number(p.count),
        actualRevenue: Number(planRevenue.find(r => r.plan === p.plan)?.total || 0),
        transactions:  Number(planRevenue.find(r => r.plan === p.plan)?.txns || 0),
      })),
      recentPayments: recentPayments.map(p => ({
        id:                 p.id,
        userId:             p.userId,
        plan:               p.plan,
        amount:             Number(p.amount),
        currency:           p.currency,
        status:             p.status,
        razorpayPaymentId:  p.razorpayPaymentId,
        gatewayFee:         p.gatewayFee ? Number(p.gatewayFee) : null,
        createdAt:          p.createdAt,
      })),
    });
  } catch (e) {
    console.error("Revenue error:", e);
    res.status(500).json({ error: "Failed to fetch revenue data" });
  }
});

// ─── AI CONFIG ────────────────────────────────────────────────────────────────
const DEFAULT_AI_FEATURES = [
  { feature: "food_scan",    label: "Food Scan & Nutrition AI",    provider: "gemini", model: "gemini-2.0-flash" },
  { feature: "medical_scan", label: "Medical Report AI",           provider: "gemini", model: "gemini-2.0-flash" },
  { feature: "smart_scan",   label: "Smart Scan (Camera AI)",      provider: "gemini", model: "gemini-2.0-flash" },
  { feature: "diet_plan",    label: "AI Diet Plan Generator",      provider: "gemini", model: "gemini-2.0-flash" },
  { feature: "suggestions",  label: "Daily Health Suggestions",    provider: "gemini", model: "gemini-2.0-flash" },
  { feature: "stress",       label: "Stress Insight Analysis",     provider: "gemini", model: "gemini-2.0-flash" },
  { feature: "health_tip",   label: "Health Tip Generator",        provider: "gemini", model: "gemini-2.0-flash" },
  { feature: "meal_swap",    label: "Meal Swap Suggestions",       provider: "gemini", model: "gemini-2.0-flash" },
];

router.get("/admin/ai-config", requireAdmin, async (_req: AdminRequest, res) => {
  try {
    const rows = await db.select().from(aiConfigTable);
    if (rows.length === 0) {
      res.json({ configs: DEFAULT_AI_FEATURES.map(f => ({ ...f, id: null, isEnabled: true, apiKey: null, systemPrompt: null })) });
    } else {
      const configMap = new Map(rows.map(r => [r.feature, r]));
      const configs = DEFAULT_AI_FEATURES.map(f => configMap.get(f.feature) || { ...f, id: null, isEnabled: true, apiKey: null, systemPrompt: null });
      res.json({ configs });
    }
  } catch { res.status(500).json({ error: "Failed to fetch AI config" }); }
});

router.put("/admin/ai-config/:feature", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const feature = String(req.params.feature);
    const { provider, model, apiKey, systemPrompt, isEnabled } = req.body as Record<string, unknown>;
    const providerStr = (provider as string) || "gemini";
    const modelStr = (model as string) || "gemini-2.0-flash";
    const apiKeyStr = (apiKey as string) || null;
    const systemPromptStr = (systemPrompt as string) || null;
    const label = DEFAULT_AI_FEATURES.find(f => f.feature === feature)?.label || feature;
    const existing = await db.select().from(aiConfigTable).where(eq(aiConfigTable.feature, feature)).limit(1);
    let result;
    if (existing.length === 0) {
      [result] = await db.insert(aiConfigTable).values({ feature, label, provider: providerStr, model: modelStr, apiKey: apiKeyStr, systemPrompt: systemPromptStr, isEnabled: isEnabled !== false }).returning();
    } else {
      [result] = await db.update(aiConfigTable).set({ provider: providerStr, model: modelStr, apiKey: apiKeyStr, systemPrompt: systemPromptStr, isEnabled: Boolean(isEnabled), updatedAt: new Date() }).where(eq(aiConfigTable.feature, feature)).returning();
    }
    invalidateAICache(feature);
    res.json({ config: result, success: true });
  } catch { res.status(500).json({ error: "Failed to update AI config" }); }
});

router.get("/admin/me", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const [admin] = await db.select({
      id: adminUsersTable.id,
      fullName: adminUsersTable.fullName,
      email: adminUsersTable.email,
      role: adminUsersTable.role,
      lastLoginAt: adminUsersTable.lastLoginAt,
      createdAt: adminUsersTable.createdAt,
    }).from(adminUsersTable).where(eq(adminUsersTable.id, req.adminId!));
    if (!admin) { res.status(404).json({ error: "Admin not found" }); return; }
    res.json({ admin });
  } catch { res.status(500).json({ error: "Failed to fetch profile" }); }
});

router.patch("/admin/me", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const { fullName, email } = req.body as { fullName?: string; email?: string };
    if (!fullName?.trim() && !email?.trim()) {
      res.status(400).json({ error: "At least one field (fullName or email) is required" }); return;
    }
    const updates: Record<string, string> = {};
    if (fullName?.trim()) updates.fullName = fullName.trim();
    if (email?.trim()) {
      const normalizedEmail = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        res.status(400).json({ error: "Invalid email address" }); return;
      }
      const [existing] = await db.select({ id: adminUsersTable.id })
        .from(adminUsersTable)
        .where(eq(adminUsersTable.email, normalizedEmail));
      if (existing && existing.id !== req.adminId) {
        res.status(409).json({ error: "Email already in use by another admin" }); return;
      }
      updates.email = normalizedEmail;
    }
    const [updated] = await db.update(adminUsersTable)
      .set(updates)
      .where(eq(adminUsersTable.id, req.adminId!))
      .returning({ id: adminUsersTable.id, fullName: adminUsersTable.fullName, email: adminUsersTable.email, role: adminUsersTable.role });
    res.json({ admin: updated, success: true });
  } catch { res.status(500).json({ error: "Failed to update profile" }); }
});

router.post("/admin/change-password", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
    if (!currentPassword || !newPassword) { res.status(400).json({ error: "Both passwords are required" }); return; }
    if (newPassword.length < 8) { res.status(400).json({ error: "New password must be at least 8 characters" }); return; }
    const [admin] = await db.select().from(adminUsersTable).where(eq(adminUsersTable.id, req.adminId!));
    if (!admin) { res.status(404).json({ error: "Admin not found" }); return; }
    const currentHash = crypto.createHash("sha256").update(currentPassword).digest("hex");
    if (admin.passwordHash !== currentHash) { res.status(401).json({ error: "Current password is incorrect" }); return; }
    const newHash = crypto.createHash("sha256").update(newPassword).digest("hex");
    await db.update(adminUsersTable).set({ passwordHash: newHash }).where(eq(adminUsersTable.id, req.adminId!));
    res.json({ success: true, message: "Password changed successfully" });
  } catch { res.status(500).json({ error: "Failed to change password" }); }
});

export default router;
