import { Router } from "express";
import { db, planPricingTable, adminAuditLogsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../../middlewares/admin-auth";
import type { AdminRequest } from "../../middlewares/admin-auth";
import { pool } from "@workspace/db";
import { requireAuth } from "../../middlewares/user-auth";
import type { AuthRequest } from "../../middlewares/user-auth";
import { getUserUsageSummary, invalidatePlanLimitsCache } from "../../middlewares/plan-limits";
import { invalidateAILimiterCache, type AIFeature } from "../../lib/aiLimiter";

const router = Router();

// ── Default seed data ────────────────────────────────────────────────────────
const DEFAULT_PLANS = [
  // Individual plans
  {
    planKey: "free", displayName: "Free", type: "individual",
    monthlyPrice: "0", yearlyPrice: null, maxSeats: 1,
    features: ["AI Meal Logging (Text) — 5/day", "Exercise Logging", "Water Tracker & Reminders", "Basic Daily Health Score", "Blood Emergency SOS", "Period Cycle Tracker (Female)", "Manual Logging (Sleep, Stress, Heart Rate, BP, Steps)"],
    badgeText: null, badgeColor: "#4B5563",
    gradientColors: ["#374151", "#1F2937"] as [string, string],
    isActive: true, sortOrder: 0,
  },
  {
    planKey: "pro", displayName: "Pro", type: "individual",
    monthlyPrice: "199", yearlyPrice: "1990", maxSeats: 1,
    features: ["Meal Logging (Text) — 10/day", "AI Food Scan — 5/day", "AI Medical Report Analysis — 1/month", "AI Health Coach", "Health Prediction", "AI Diet Planner", "Health Reports (Weekly & Monthly)", "Smart Watch Integration (Auto Sync)", "Stress & Burnout AI Monitoring", "All Basic Plan Features"],
    badgeText: "Popular", badgeColor: "#0077B6",
    gradientColors: ["#0077B6", "#023E8A"] as [string, string],
    isActive: true, sortOrder: 1,
  },
  {
    planKey: "max", displayName: "Max", type: "individual",
    monthlyPrice: "249", yearlyPrice: "2490", maxSeats: 1,
    features: ["Everything in Pro", "AI Food Scan — 10/day", "Meal Logging (Text) — 15/day", "AI Medical Report Analysis — Up to 4/month", "Advanced Health Prediction", "Advanced Health Reports"],
    badgeText: "Best Value", badgeColor: "#8B5CF6",
    gradientColors: ["#8B5CF6", "#6D28D9"] as [string, string],
    isActive: true, sortOrder: 2,
  },
  {
    planKey: "family", displayName: "Family", type: "individual",
    monthlyPrice: "499", yearlyPrice: "4990", maxSeats: 4,
    features: ["Everything in Max", "Up to 4 Members", "Shared Health Reports", "Member Health Alerts", "Family Reminders"],
    badgeText: "4 Members", badgeColor: "#F59E0B",
    gradientColors: ["#F59E0B", "#D97706"] as [string, string],
    isActive: true, sortOrder: 3,
  },
  // Organization plans (landing page display)
  {
    planKey: "starter", displayName: "Starter", type: "organization",
    monthlyPrice: "999", yearlyPrice: "9990", maxSeats: 50,
    features: ["50 member seats", "Team health dashboard", "Aorane ID search", "Enrollment code management", "Basic analytics"],
    badgeText: null, badgeColor: "#0077B6",
    gradientColors: ["#0077B6", "#0369A1"] as [string, string],
    isActive: true, sortOrder: 10,
  },
  {
    planKey: "growth", displayName: "Growth", type: "organization",
    monthlyPrice: "2999", yearlyPrice: "29990", maxSeats: 200,
    features: ["200 member seats", "Everything in Starter", "Advanced health analytics", "Team announcements", "Priority support"],
    badgeText: "Popular", badgeColor: "#7C3AED",
    gradientColors: ["#7C3AED", "#6D28D9"] as [string, string],
    isActive: true, sortOrder: 11,
  },
  {
    planKey: "enterprise", displayName: "Enterprise", type: "organization",
    monthlyPrice: "6999", yearlyPrice: "69990", maxSeats: 500,
    features: ["500 member seats", "Everything in Growth", "Custom enrollment codes", "Data export (CSV)", "Dedicated account manager"],
    badgeText: "Enterprise", badgeColor: "#DC2626",
    gradientColors: ["#DC2626", "#B91C1C"] as [string, string],
    isActive: true, sortOrder: 12,
  },
  // Org seat-based plans (Business Portal billing) — same per-employee health
  // features as the matching individual plan (org enrollment sets the
  // employee's own `plan` to "pro"/"max", so they get identical aiLimiter/
  // plan_features limits already); the org itself additionally gets the CRM
  // dashboard for free, and Max adds weekly report generation for admins.
  {
    planKey: "org_pro", displayName: "Pro", type: "org_seat",
    monthlyPrice: "199", yearlyPrice: "2028", maxSeats: null,
    features: ["Meal Logging (Text) — 10/day", "AI Food Scan — 5/day", "AI Medical Report Analysis — 1/month", "AI Health Coach", "Health Prediction", "AI Diet Planner", "Health Reports (Weekly & Monthly)", "Smart Watch Integration (Auto Sync)", "Stress & Burnout AI Monitoring", "All Basic Plan Features", "Free CRM Dashboard Access"],
    badgeText: null, badgeColor: "#0077B6",
    gradientColors: ["#0077B6", "#023E8A"] as [string, string],
    isActive: true, sortOrder: 20,
  },
  {
    planKey: "org_max", displayName: "Max", type: "org_seat",
    monthlyPrice: "249", yearlyPrice: "2532", maxSeats: null,
    features: ["Everything in Pro", "AI Food Scan — 10/day", "Meal Logging (Text) — 15/day", "AI Medical Report Analysis — Up to 4/month", "Advanced Health Prediction", "Advanced Health Reports", "Free CRM Dashboard Access", "Weekly Report Generation"],
    badgeText: "Popular", badgeColor: "#7C3AED",
    gradientColors: ["#7C3AED", "#6D28D9"] as [string, string],
    isActive: true, sortOrder: 21,
  },
];

// ── Effective price helper ────────────────────────────────────────────────────
function computeEffective(p: typeof planPricingTable.$inferSelect) {
  const disc = p.discountPercent ? Number(p.discountPercent) : 0;
  if (disc <= 0) {
    return { effectiveMonthlyPrice: p.monthlyPrice, effectiveYearlyPrice: p.yearlyPrice, isOfferActive: false };
  }
  const now = new Date();
  if (p.offerValidFrom && now < new Date(p.offerValidFrom)) {
    return { effectiveMonthlyPrice: p.monthlyPrice, effectiveYearlyPrice: p.yearlyPrice, isOfferActive: false };
  }
  if (p.offerValidTo && now > new Date(p.offerValidTo)) {
    return { effectiveMonthlyPrice: p.monthlyPrice, effectiveYearlyPrice: p.yearlyPrice, isOfferActive: false };
  }
  const effMonthly = String(Math.round(Number(p.monthlyPrice) * (1 - disc / 100)));
  const effYearly = p.yearlyPrice ? String(Math.round(Number(p.yearlyPrice) * (1 - disc / 100))) : null;
  return { effectiveMonthlyPrice: effMonthly, effectiveYearlyPrice: effYearly, isOfferActive: true };
}

// ── Seed helper ──────────────────────────────────────────────────────────────
async function seedIfEmpty() {
  const existing = await db.select().from(planPricingTable).limit(1);
  if (existing.length === 0) {
    await db.insert(planPricingTable).values(DEFAULT_PLANS);
  }
}

// ── PUBLIC: GET /plans ───────────────────────────────────────────────────────
// ?type=individual | organization | org_seat (optional)
// Returns effectiveMonthlyPrice / effectiveYearlyPrice based on active discount
router.get("/plans", async (req, res) => {
  try {
    await seedIfEmpty();
    const typeFilter = req.query["type"] as string | undefined;
    let plans = await db.select().from(planPricingTable)
      .where(eq(planPricingTable.isActive, true))
      .orderBy(planPricingTable.sortOrder);
    if (typeFilter) {
      plans = plans.filter(p => p.type === typeFilter);
    }
    const enriched = plans.map(p => ({
      ...p,
      ...computeEffective(p),
    }));
    res.json({ plans: enriched });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch plans" });
  }
});

// ── ADMIN: GET /admin/plan-pricing ───────────────────────────────────────────
router.get("/admin/plan-pricing", requireAdmin, async (_req: AdminRequest, res) => {
  try {
    await seedIfEmpty();
    const plans = await db.select().from(planPricingTable).orderBy(planPricingTable.sortOrder);
    const enriched = plans.map(p => ({ ...p, ...computeEffective(p) }));
    res.json({ plans: enriched });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch plan pricing" });
  }
});

// ── ADMIN: PUT /admin/plan-pricing/:planKey ──────────────────────────────────
router.put("/admin/plan-pricing/:planKey", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const { planKey } = req.params as { planKey: string };
    const {
      displayName, monthlyPrice, yearlyPrice, maxSeats,
      features, badgeText, badgeColor, gradientColors, isActive, sortOrder,
      discountPercent, offerLabel, offerValidFrom, offerValidTo,
    } = req.body as Record<string, unknown>;

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (displayName !== undefined) updates["displayName"] = displayName;
    if (monthlyPrice !== undefined) updates["monthlyPrice"] = String(monthlyPrice);
    if (yearlyPrice !== undefined) updates["yearlyPrice"] = yearlyPrice ? String(yearlyPrice) : null;
    if (maxSeats !== undefined) updates["maxSeats"] = maxSeats ? Number(maxSeats) : null;
    if (features !== undefined) updates["features"] = features;
    if (badgeText !== undefined) updates["badgeText"] = badgeText || null;
    if (badgeColor !== undefined) updates["badgeColor"] = badgeColor;
    if (gradientColors !== undefined) updates["gradientColors"] = gradientColors;
    if (isActive !== undefined) updates["isActive"] = Boolean(isActive);
    if (sortOrder !== undefined) updates["sortOrder"] = Number(sortOrder);
    if (discountPercent !== undefined) updates["discountPercent"] = discountPercent !== null && discountPercent !== "" ? String(discountPercent) : null;
    if (offerLabel !== undefined) updates["offerLabel"] = offerLabel || null;
    if (offerValidFrom !== undefined) updates["offerValidFrom"] = offerValidFrom ? new Date(String(offerValidFrom)) : null;
    if (offerValidTo !== undefined) updates["offerValidTo"] = offerValidTo ? new Date(String(offerValidTo)) : null;

    const [updated] = await db.update(planPricingTable)
      .set(updates as typeof planPricingTable.$inferInsert)
      .where(eq(planPricingTable.planKey, planKey))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Plan not found" });
      return;
    }
    res.json({ success: true, plan: { ...updated, ...computeEffective(updated) } });
  } catch (e) {
    res.status(500).json({ error: "Failed to update plan pricing" });
  }
});

// ── ADMIN: POST /admin/plan-pricing/reset ───────────────────────────────────
router.post("/admin/plan-pricing/reset", requireAdmin, async (_req: AdminRequest, res) => {
  try {
    for (const def of DEFAULT_PLANS) {
      await db.update(planPricingTable)
        .set({
          monthlyPrice: def.monthlyPrice,
          yearlyPrice: def.yearlyPrice ?? null,
          features: def.features,
          badgeText: def.badgeText ?? null,
          badgeColor: def.badgeColor,
          gradientColors: def.gradientColors,
          isActive: def.isActive,
          sortOrder: def.sortOrder,
          discountPercent: "0",
          offerLabel: null,
          offerValidFrom: null,
          offerValidTo: null,
          updatedAt: new Date(),
        })
        .where(eq(planPricingTable.planKey, def.planKey));
    }
    const plans = await db.select().from(planPricingTable).orderBy(planPricingTable.sortOrder);
    const enriched = plans.map(p => ({ ...p, ...computeEffective(p) }));
    res.json({ success: true, plans: enriched });
  } catch (e) {
    res.status(500).json({ error: "Failed to reset plans" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PLAN FEATURES — public + authenticated endpoints
// ══════════════════════════════════════════════════════════════════════════════

// ── PUBLIC: GET /plan-features ───────────────────────────────────────────────
// Returns all feature rows (full matrix). Used by landing page plan comparison.
router.get("/plan-features", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT feature_name, free_value, max_value, pro_value, family_value, description
         FROM plan_features ORDER BY feature_name`
    );
    res.json({ features: rows });
  } catch {
    res.status(500).json({ error: "Failed to fetch plan features" });
  }
});

// ── PUBLIC: GET /plan-features/:plan ─────────────────────────────────────────
// Returns limits for a specific plan. Used by mobile app to gate features.
// ?plan=free|max|pro|family
router.get("/plan-features/:plan", async (req, res) => {
  const plan = (req.params["plan"] ?? "free").toLowerCase();
  const validPlans = ["free", "max", "pro", "family"];
  if (!validPlans.includes(plan)) {
    res.status(400).json({ error: "Invalid plan. Must be one of: free, max, pro, family" });
    return;
  }
  const col = plan === "max" ? "max_value" : plan === "pro" ? "pro_value" : plan === "family" ? "family_value" : "free_value";
  try {
    const { rows } = await pool.query(
      `SELECT feature_name, ${col} AS value, description FROM plan_features ORDER BY feature_name`
    );
    const limits: Record<string, string> = {};
    for (const r of rows) limits[r.feature_name as string] = r.value as string;
    res.json({ plan, limits });
  } catch {
    res.status(500).json({ error: "Failed to fetch plan features" });
  }
});

// ── AUTH: GET /my/ai-usage ───────────────────────────────────────────────────
// Returns current user's daily AI usage vs limits.
router.get("/my/ai-usage", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const plan = (req.userPlan || "free").toLowerCase();
    const summary = await getUserUsageSummary(userId);
    // Filter to only features relevant to their plan
    res.json({ plan, date: new Date().toISOString().slice(0, 10), usage: summary });
  } catch {
    res.status(500).json({ error: "Failed to fetch AI usage" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION PLANS — canonical catalogue (new table)
// ══════════════════════════════════════════════════════════════════════════════

// ── PUBLIC: GET /subscription-plans ─────────────────────────────────────────
// ?type=individual|business (optional filter)
router.get("/subscription-plans", async (req, res) => {
  try {
    const type = req.query["type"] as string | undefined;
    let query = `SELECT * FROM subscription_plans WHERE is_active = true ORDER BY display_order`;
    const params: string[] = [];
    if (type) {
      query = `SELECT * FROM subscription_plans WHERE is_active = true AND plan_type = $1 ORDER BY display_order`;
      params.push(type);
    }
    const { rows } = await pool.query(query, params);

    // Attach b2b_plan_config for business plans
    const b2bRes = await pool.query(`SELECT * FROM b2b_plan_config`);
    const b2bMap = new Map<string, Record<string, unknown>>();
    for (const r of b2bRes.rows) b2bMap.set(r.plan_id as string, r as Record<string, unknown>);

    const enriched = rows.map(r => ({
      ...r,
      b2bConfig: b2bMap.get(r.plan_id as string) ?? null,
    }));

    res.json({ plans: enriched });
  } catch {
    res.status(500).json({ error: "Failed to fetch subscription plans" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN: Plan Features management
// ══════════════════════════════════════════════════════════════════════════════

// ── ADMIN: GET /admin/plan-features ─────────────────────────────────────────
router.get("/admin/plan-features", requireAdmin, async (_req: AdminRequest, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT feature_name, free_value, max_value, pro_value, family_value, description, period, updated_at
         FROM plan_features ORDER BY feature_name`
    );
    res.json({ features: rows });
  } catch {
    res.status(500).json({ error: "Failed to fetch plan features" });
  }
});

// ── ADMIN: PUT /admin/plan-features/:featureName ─────────────────────────────
router.put("/admin/plan-features/:featureName", requireAdmin, async (req: AdminRequest, res) => {
  const featureName = req.params["featureName"];
  const { freeValue, maxValue, proValue, familyValue, description, period } = req.body as {
    freeValue?: string; maxValue?: string; proValue?: string; familyValue?: string; description?: string;
    period?: "daily" | "weekly" | "monthly";
  };
  try {
    const setParts: string[] = ["updated_at = now()"];
    const params: unknown[] = [featureName];
    let idx = 2;
    if (freeValue !== undefined)  { setParts.push(`free_value = $${idx++}`);   params.push(freeValue); }
    if (maxValue !== undefined)   { setParts.push(`max_value = $${idx++}`);    params.push(maxValue); }
    if (proValue !== undefined)   { setParts.push(`pro_value = $${idx++}`);    params.push(proValue); }
    if (familyValue !== undefined){ setParts.push(`family_value = $${idx++}`); params.push(familyValue); }
    if (description !== undefined){ setParts.push(`description = $${idx++}`);  params.push(description); }
    if (period !== undefined && ["daily", "weekly", "monthly"].includes(period)) {
      setParts.push(`period = $${idx++}`); params.push(period);
    }

    const { rows } = await pool.query(
      `UPDATE plan_features SET ${setParts.join(", ")} WHERE feature_name = $1 RETURNING *`,
      params
    );
    if (!rows.length) { res.status(404).json({ error: "Feature not found" }); return; }
    const fname = Array.isArray(featureName) ? featureName[0] : featureName;
    // Two separate systems each cache plan_features for 5 minutes
    // (middlewares/plan-limits.ts and lib/aiLimiter.ts) — both must be
    // invalidated or one could keep serving the old value.
    invalidatePlanLimitsCache(fname);
    invalidateAILimiterCache(fname as AIFeature);
    await db.insert(adminAuditLogsTable).values({
      adminId: req.adminId!, action: "update_plan_feature",
      targetType: "plan_feature", targetId: fname,
      details: { freeValue, maxValue, proValue, familyValue, period },
    });
    res.json({ success: true, feature: rows[0] });
  } catch {
    res.status(500).json({ error: "Failed to update plan feature" });
  }
});

// ── ADMIN: GET /admin/subscription-plans ─────────────────────────────────────
router.get("/admin/subscription-plans", requireAdmin, async (_req: AdminRequest, res) => {
  try {
    const [plansRes, b2bRes] = await Promise.all([
      pool.query(`SELECT * FROM subscription_plans ORDER BY display_order`),
      pool.query(`SELECT * FROM b2b_plan_config ORDER BY plan_id`),
    ]);
    const b2bMap = new Map<string, Record<string, unknown>>();
    for (const r of b2bRes.rows) b2bMap.set(r.plan_id as string, r as Record<string, unknown>);
    const enriched = plansRes.rows.map(r => ({ ...r, b2bConfig: b2bMap.get(r.plan_id as string) ?? null }));
    res.json({ plans: enriched });
  } catch {
    res.status(500).json({ error: "Failed to fetch subscription plans" });
  }
});

// ── ADMIN: PUT /admin/subscription-plans/:planId ──────────────────────────────
router.put("/admin/subscription-plans/:planId", requireAdmin, async (req: AdminRequest, res) => {
  const planId = req.params["planId"];
  const { planName, priceMonthly, priceYearly, currency, isActive, displayOrder } = req.body as {
    planName?: string; priceMonthly?: number; priceYearly?: number;
    currency?: string; isActive?: boolean; displayOrder?: number;
  };
  try {
    const setParts: string[] = ["updated_at = now()"];
    const params: unknown[] = [planId];
    let idx = 2;
    if (planName !== undefined)      { setParts.push(`plan_name = $${idx++}`);      params.push(planName); }
    if (priceMonthly !== undefined)  { setParts.push(`price_monthly = $${idx++}`);  params.push(priceMonthly); }
    if (priceYearly !== undefined)   { setParts.push(`price_yearly = $${idx++}`);   params.push(priceYearly); }
    if (currency !== undefined)      { setParts.push(`currency = $${idx++}`);       params.push(currency); }
    if (isActive !== undefined)      { setParts.push(`is_active = $${idx++}`);      params.push(isActive); }
    if (displayOrder !== undefined)  { setParts.push(`display_order = $${idx++}`);  params.push(displayOrder); }

    const { rows } = await pool.query(
      `UPDATE subscription_plans SET ${setParts.join(", ")} WHERE plan_id = $1 RETURNING *`,
      params
    );
    if (!rows.length) { res.status(404).json({ error: "Plan not found" }); return; }
    res.json({ success: true, plan: rows[0] });
  } catch {
    res.status(500).json({ error: "Failed to update subscription plan" });
  }
});

// ── ADMIN: GET /admin/ai-usage-stats ─────────────────────────────────────────
// Aggregate AI usage by feature for today
router.get("/admin/ai-usage-stats", requireAdmin, async (_req: AdminRequest, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        feature_name,
        SUM(usage_count) AS total_calls,
        COUNT(DISTINCT user_id) AS unique_users,
        usage_date
      FROM ai_usage_daily
      WHERE usage_date >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY feature_name, usage_date
      ORDER BY usage_date DESC, total_calls DESC
    `);
    res.json({ stats: rows });
  } catch {
    res.status(500).json({ error: "Failed to fetch AI usage stats" });
  }
});

export default router;
