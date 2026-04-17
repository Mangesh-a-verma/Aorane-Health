import { Router } from "express";
import { db, planPricingTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../../middlewares/admin-auth";
import type { AdminRequest } from "../../middlewares/admin-auth";

const router = Router();

// ── Default seed data (used if DB is empty) ────────────────────────────────
const DEFAULT_PLANS = [
  // Individual plans
  {
    planKey: "free", displayName: "Free", type: "individual",
    monthlyPrice: "0", yearlyPrice: null, maxSeats: 1,
    features: ["Basic Health Tracking", "Food Diary (20/day)", "Water Tracker", "Step Counter"],
    badgeText: null, badgeColor: "#4B5563",
    gradientColors: ["#374151", "#1F2937"] as [string, string],
    isActive: true, sortOrder: 0,
  },
  {
    planKey: "max", displayName: "Max", type: "individual",
    monthlyPrice: "199", yearlyPrice: "1990", maxSeats: 1,
    features: ["AI Food Scan", "Personalized Diet Plan", "Health Reports PDF", "Medicine Reminders", "Exercise Tracking", "Water Tracker"],
    badgeText: "Popular", badgeColor: "#0077B6",
    gradientColors: ["#0077B6", "#023E8A"] as [string, string],
    isActive: true, sortOrder: 1,
  },
  {
    planKey: "pro", displayName: "Pro", type: "individual",
    monthlyPrice: "249", yearlyPrice: "2490", maxSeats: 1,
    features: ["Sab Max features +", "Medical Report AI Scanner", "Advanced Gemini AI", "Priority Support", "Family Add-on", "Unlimited History"],
    badgeText: "Best Value", badgeColor: "#8B5CF6",
    gradientColors: ["#8B5CF6", "#6D28D9"] as [string, string],
    isActive: true, sortOrder: 2,
  },
  {
    planKey: "family", displayName: "Family", type: "individual",
    monthlyPrice: "399", yearlyPrice: "3990", maxSeats: 5,
    features: ["5 Family Members", "Sab Max features +", "Family Health Dashboard", "Shared Reports", "Emergency Contacts"],
    badgeText: "Family", badgeColor: "#F59E0B",
    gradientColors: ["#F59E0B", "#D97706"] as [string, string],
    isActive: true, sortOrder: 3,
  },
  // Organization plans
  {
    planKey: "starter", displayName: "Starter", type: "organization",
    monthlyPrice: "999", yearlyPrice: "9990", maxSeats: 50,
    features: ["50 member seats", "Member health dashboard", "Aorane ID search", "Enrollment code management", "Basic analytics"],
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
];

// ── Seed helper ────────────────────────────────────────────────────────────
async function seedIfEmpty() {
  const existing = await db.select().from(planPricingTable).limit(1);
  if (existing.length === 0) {
    await db.insert(planPricingTable).values(DEFAULT_PLANS);
  }
}

// ── PUBLIC: GET /plans ─────────────────────────────────────────────────────
// ?type=individual  or  ?type=organization  (optional filter)
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
    res.json({ plans });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch plans" });
  }
});

// ── ADMIN: GET /admin/plan-pricing ────────────────────────────────────────
router.get("/admin/plan-pricing", requireAdmin, async (_req: AdminRequest, res) => {
  try {
    await seedIfEmpty();
    const plans = await db.select().from(planPricingTable).orderBy(planPricingTable.sortOrder);
    res.json({ plans });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch plan pricing" });
  }
});

// ── ADMIN: PUT /admin/plan-pricing/:planKey ───────────────────────────────
router.put("/admin/plan-pricing/:planKey", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const { planKey } = req.params as { planKey: string };
    const {
      displayName, monthlyPrice, yearlyPrice, maxSeats,
      features, badgeText, badgeColor, gradientColors, isActive, sortOrder,
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

    const [updated] = await db.update(planPricingTable)
      .set(updates as typeof planPricingTable.$inferInsert)
      .where(eq(planPricingTable.planKey, planKey))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Plan not found" });
      return;
    }
    res.json({ success: true, plan: updated });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to update plan pricing" });
  }
});

// ── ADMIN: POST /admin/plan-pricing/reset ────────────────────────────────
router.post("/admin/plan-pricing/reset", requireAdmin, async (_req: AdminRequest, res) => {
  try {
    // Reset each plan to defaults
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
          updatedAt: new Date(),
        })
        .where(eq(planPricingTable.planKey, def.planKey));
    }
    const plans = await db.select().from(planPricingTable).orderBy(planPricingTable.sortOrder);
    res.json({ success: true, plans });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to reset plans" });
  }
});

export default router;
