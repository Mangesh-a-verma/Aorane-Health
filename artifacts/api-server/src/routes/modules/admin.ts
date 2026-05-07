import { Router } from "express";
import pg from "pg";
import { db, pool, adminUsersTable, usersTable, userProfilesTable, organizationsTable, featureFlagsTable, adCampaignsTable, foodItemsTable, foodScanCacheTable, promoCodesTable, announcementsTable, adminAuditLogsTable, bloodEmergencyRequestsTable, languagesTable, subscriptionsTable, paymentsTable, companySettingsTable, aiConfigTable, planPricingTable, orgPaymentsTable } from "@workspace/db";
import { eq, desc, ilike, count, or, sql, and, inArray, isNotNull } from "drizzle-orm";
import { requireAdmin } from "../../middlewares/admin-auth";
import { signAdminToken } from "../../lib/jwt";
import { invalidatePlanCache } from "../../middlewares/plan-check";
import type { AdminRequest } from "../../middlewares/admin-auth";
import { invalidateAICache } from "../../lib/ai";
import { invalidateFeatureCache } from "../../middlewares/feature-check";
import { verifyAndMigratePassword } from "../../lib/auth-utils";
import bcrypt from "bcryptjs";

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

    const valid = await verifyAndMigratePassword(password, admin.passwordHash, async (h) => {
      await db.update(adminUsersTable).set({ passwordHash: h }).where(eq(adminUsersTable.id, admin.id));
    });
    if (!valid) { res.status(401).json({ error: "Invalid credentials" }); return; }

    await db.update(adminUsersTable).set({ lastLoginAt: new Date() }).where(eq(adminUsersTable.id, admin.id));
    const token = signAdminToken({ adminId: admin.id, role: admin.role });
    res.json({ token, admin: { id: admin.id, fullName: admin.fullName, role: admin.role } });
  } catch {
    res.status(500).json({ error: "Admin login failed" });
  }
});

router.get("/admin/overview", requireAdmin, async (_req: AdminRequest, res) => {
  try {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const last30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      [userCount],
      [orgCount],
      [subCount],
      [bloodCount],
    ] = await Promise.all([
      db.select({ count: count() }).from(usersTable),
      db.select({ count: count() }).from(organizationsTable),
      db.select({ count: count() }).from(subscriptionsTable).where(eq(subscriptionsTable.status, "active")),
      db.select({ count: count() }).from(bloodEmergencyRequestsTable),
    ]);

    // Revenue: sum all successful payments
    const [revenueRow] = await db.select({
      total: sql<string>`COALESCE(SUM(CAST(amount AS NUMERIC)), 0)`,
    }).from(paymentsTable).where(eq(paymentsTable.status, "success"));
    const totalRevenue = Math.round(parseFloat(revenueRow?.total || "0"));

    // Plan breakdown from users table
    const planRows = await db.select({
      plan: usersTable.plan,
      cnt: count(),
    }).from(usersTable).groupBy(usersTable.plan);

    const planBreakdown = planRows.map(r => ({
      plan: r.plan || "free",
      count: r.cnt,
    }));

    // New users today and this month
    const [newToday] = await db.select({ count: count() }).from(usersTable)
      .where(sql`created_at >= ${startOfToday.toISOString()}`);
    const [newMonth] = await db.select({ count: count() }).from(usersTable)
      .where(sql`created_at >= ${startOfMonth.toISOString()}`);

    // Monthly revenue (last 30 days)
    const [monthRevRow] = await db.select({
      total: sql<string>`COALESCE(SUM(CAST(amount AS NUMERIC)), 0)`,
    }).from(paymentsTable)
      .where(and(eq(paymentsTable.status, "success"), sql`created_at >= ${last30.toISOString()}`));
    const monthRevenue = Math.round(parseFloat(monthRevRow?.total || "0"));

    res.json({
      stats: {
        totalUsers: Number(userCount.count),
        totalOrganizations: Number(orgCount.count),
        activeSubscriptions: Number(subCount.count),
        totalBloodRequests: Number(bloodCount.count),
        totalRevenue,
        monthRevenue,
        newUsersToday: Number(newToday.count),
        newUsersThisMonth: Number(newMonth.count),
        planBreakdown,
      },
    });
  } catch (e) {
    console.error("Admin overview error:", e);
    res.status(500).json({ error: "Failed to fetch overview" });
  }
});

router.get("/admin/users", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const { search, limit = "100", offset = "0" } = req.query as Record<string, string>;
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 200);
    const offsetNum = Math.max(parseInt(offset, 10) || 0, 0);

    const searchNorm = (search || "").replace(/[\s\-_]/g, "");
    const phoneNorm  = (search || "").replace(/[\s\-\+\(\)]/g, "");
    const whereClause = search ? or(
      ilike(usersTable.phone, `%${phoneNorm}%`),
      ilike(usersTable.email, `%${search}%`),
      sql`${usersTable.id}::text ILIKE ${`%${search}%`}`,
      ilike(userProfilesTable.fullName, `%${search}%`),
      ilike(userProfilesTable.aoraneId, `%${searchNorm}%`),
    ) : undefined;

    const [totalRow, rows] = await Promise.all([
      db.select({ count: count() }).from(usersTable)
        .leftJoin(userProfilesTable, eq(usersTable.id, userProfilesTable.userId))
        .where(whereClause).then((r) => r[0]),
      db.select({
          id: usersTable.id,
          phone: usersTable.phone,
          email: usersTable.email,
          plan: usersTable.plan,
          isActive: usersTable.isActive,
          isBanned: usersTable.isBanned,
          createdAt: usersTable.createdAt,
          lastLoginAt: usersTable.lastLoginAt,
          aoraneId: userProfilesTable.aoraneId,
          fullName: userProfilesTable.fullName,
          customDiscountPct: usersTable.customDiscountPct,
          customDiscountNote: usersTable.customDiscountNote,
          customDiscountValidUntil: usersTable.customDiscountValidUntil,
        })
        .from(usersTable)
        .leftJoin(userProfilesTable, eq(usersTable.id, userProfilesTable.userId))
        .where(whereClause)
        .orderBy(desc(usersTable.createdAt))
        .limit(limitNum)
        .offset(offsetNum),
    ]);

    const usersOut = rows.map((r) => ({ ...r, aoraneId: r.aoraneId ? r.aoraneId.toUpperCase() : null }));
    res.json({ users: usersOut, total: Number(totalRow?.count ?? 0), offset: offsetNum, limit: limitNum });
  } catch {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// ─── Search (Aorane ID / UUID / Name / Phone / Email) ────────────────────────
router.get("/admin/users/search", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const q = ((req.query.q as string) || "").trim();
    if (!q || q.length < 3) { res.status(400).json({ error: "Minimum 3 characters required" }); return; }

    const qClean = q.replace(/[\s\-_]/g, "");
    const isAoraneId = /^\d{12}$/.test(qClean);
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q);
    const isPhone = /^\+?\d{7,15}$/.test(qClean) && !isAoraneId;
    const isPartialUUID = /^[0-9a-f]{8,}/i.test(q) && !isAoraneId && !isPhone;

    let userIds: string[] = [];

    if (isUUID) {
      userIds = [q];
    } else if (isPartialUUID) {
      const rows = await db.select({ id: usersTable.id }).from(usersTable)
        .where(sql`${usersTable.id}::text ILIKE ${`${q}%`}`).limit(10);
      userIds = rows.map(r => r.id);
    } else if (isPhone) {
      const rows = await db.select({ id: usersTable.id }).from(usersTable)
        .where(ilike(usersTable.phone, `%${q}%`)).limit(10);
      userIds = rows.map(r => r.id);
    } else if (isAoraneId) {
      const profiles = await db.select({ userId: userProfilesTable.userId })
        .from(userProfilesTable).where(ilike(userProfilesTable.aoraneId, `%${qClean}%`)).limit(10);
      userIds = profiles.map(p => p.userId);
    } else {
      const rows = await db.select({ userId: userProfilesTable.userId })
        .from(userProfilesTable)
        .leftJoin(usersTable, eq(userProfilesTable.userId, usersTable.id))
        .where(or(
          ilike(userProfilesTable.fullName, `%${q}%`),
          ilike(usersTable.email, `%${q}%`),
          ilike(userProfilesTable.aoraneId, `%${qClean}%`),
        ))
        .limit(10);
      userIds = rows.map(r => r.userId);
    }

    if (userIds.length === 0) { res.json({ results: [], count: 0 }); return; }

    const rows = await db
      .select({
        userId: usersTable.id,
        phone: usersTable.phone,
        email: usersTable.email,
        plan: usersTable.plan,
        isActive: usersTable.isActive,
        isBanned: usersTable.isBanned,
        createdAt: usersTable.createdAt,
        aoraneId: userProfilesTable.aoraneId,
        name: userProfilesTable.fullName,
        bloodGroup: userProfilesTable.bloodGroup,
        gender: userProfilesTable.gender,
        dateOfBirth: userProfilesTable.dateOfBirth,
        city: userProfilesTable.city,
        state: userProfilesTable.state,
        bmi: userProfilesTable.bmi,
      })
      .from(usersTable)
      .leftJoin(userProfilesTable, eq(usersTable.id, userProfilesTable.userId))
      .where(inArray(usersTable.id, userIds));

    const results = rows.map(r => ({
      ...r,
      aoraneId: r.aoraneId ? r.aoraneId.toUpperCase() : null,
      age: r.dateOfBirth ? Math.floor((Date.now() - new Date(r.dateOfBirth).getTime()) / (86400000 * 365.25)) : null,
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

    // When plan changes: cancel active subs + grant new sub
    if (plan !== undefined) {
      await db.update(subscriptionsTable)
        .set({ status: "cancelled", cancelledAt: new Date() })
        .where(and(eq(subscriptionsTable.userId, userId), eq(subscriptionsTable.status, "active")));
      if (plan !== "free") {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        await db.insert(subscriptionsTable).values({ userId, plan: plan as "free" | "pro" | "max" | "family", status: "active", source: "admin_grant", expiresAt });
      }
      invalidatePlanCache(userId);
    }
    await db.insert(adminAuditLogsTable).values({ adminId: req.adminId!, action: "update_user", targetType: "user", targetId: userId, details: updates });
    res.json({ user: updated });
  } catch (e) {
    req.log?.error(e);
    res.status(500).json({ error: "Failed to update user" });
  }
});

router.get("/admin/organizations", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const orgs = await db.select().from(organizationsTable).orderBy(desc(organizationsTable.createdAt));
    const revenues = await db
      .select({
        orgId: orgPaymentsTable.orgId,
        total: sql<string>`COALESCE(SUM(CAST(${orgPaymentsTable.amount} AS NUMERIC)), 0)`,
      })
      .from(orgPaymentsTable)
      .where(eq(orgPaymentsTable.status, "success"))
      .groupBy(orgPaymentsTable.orgId);
    const revenueMap = new Map(revenues.map(r => [r.orgId, Math.round(parseFloat(r.total))]));
    const result = orgs.map(o => ({ ...o, totalRevenue: revenueMap.get(o.id) ?? 0 }));
    res.json({ organizations: result });
  } catch {
    res.status(500).json({ error: "Failed to fetch organizations" });
  }
});

router.post("/admin/organizations", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const { name, contactEmail, city, state, orgType, totalSeats } = req.body as Record<string, unknown>;
    if (!name || !contactEmail || !orgType) {
      res.status(400).json({ error: "Name, contact email, and org type are required" });
      return;
    }
    const prefix = (String(name).trim().slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "") || "ORG").padEnd(3, "X");
    const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
    const orgCode = `${prefix}${rand}`;
    const [org] = await db.insert(organizationsTable).values({
      name: String(name).trim(),
      orgCode,
      contactEmail: String(contactEmail).trim(),
      city: city ? String(city).trim() : null,
      state: state ? String(state).trim() : null,
      orgType: String(orgType) as typeof organizationsTable.$inferSelect.orgType,
      totalSeats: Math.max(1, Number(totalSeats) || 10),
      usedSeats: 0,
      isActive: true,
    }).returning();
    await db.insert(adminAuditLogsTable).values({ adminId: req.adminId!, action: "create_organization", targetType: "organization", targetId: org.id, details: { name: org.name, orgCode } });
    res.status(201).json({ organization: org, success: true });
  } catch (e) {
    req.log?.error(e);
    res.status(500).json({ error: "Failed to create organization" });
  }
});

router.patch("/admin/organizations/:id/toggle-active", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, id));
    if (!org) { res.status(404).json({ error: "Organization not found" }); return; }
    const [updated] = await db.update(organizationsTable)
      .set({ isActive: !org.isActive })
      .where(eq(organizationsTable.id, id))
      .returning();
    res.json({ organization: updated, success: true });
  } catch {
    res.status(500).json({ error: "Failed to toggle organization status" });
  }
});

router.put("/admin/organizations/:id", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;
    const allowed: Record<string, unknown> = {};
    if (body.name)              allowed.name         = String(body.name).trim();
    if (body.contactEmail)      allowed.contactEmail  = String(body.contactEmail).trim();
    if (body.city != null)      allowed.city          = String(body.city).trim();
    if (body.state != null)     allowed.state        = String(body.state).trim();
    if (body.totalSeats)        allowed.totalSeats    = Math.max(1, Number(body.totalSeats));
    if (body.orgType)           allowed.orgType       = String(body.orgType) as typeof organizationsTable.$inferSelect.orgType;
    if (body.b2bPlan != null)   allowed.b2bPlan       = String(body.b2bPlan);
    if (body.crmEnabled != null) allowed.crmEnabled   = Boolean(body.crmEnabled);
    if (body.planStatus != null) allowed.planStatus   = String(body.planStatus);
    if (Object.keys(allowed).length === 0) { res.status(400).json({ error: "No valid fields to update" }); return; }
    // Use raw SQL for new columns since they may not be in Drizzle schema yet
    const setClauses: string[] = ["updated_at = now()"];
    const values: unknown[] = [];
    let idx = 1;
    if (allowed.name)         { setClauses.push(`name = $${idx++}`);          values.push(allowed.name); }
    if (allowed.contactEmail) { setClauses.push(`contact_email = $${idx++}`); values.push(allowed.contactEmail); }
    if (allowed.city != null) { setClauses.push(`city = $${idx++}`);          values.push(allowed.city); }
    if (allowed.state != null){ setClauses.push(`state = $${idx++}`);         values.push(allowed.state); }
    if (allowed.totalSeats)   { setClauses.push(`total_seats = $${idx++}`);   values.push(allowed.totalSeats); }
    if (allowed.orgType)      { setClauses.push(`org_type = $${idx++}`);      values.push(allowed.orgType); }
    if (allowed.b2bPlan != null)   { setClauses.push(`b2b_plan = $${idx++}`);    values.push(allowed.b2bPlan); }
    if (allowed.crmEnabled != null){ setClauses.push(`crm_enabled = $${idx++}`); values.push(allowed.crmEnabled); }
    if (allowed.planStatus != null){ setClauses.push(`plan_status = $${idx++}`); values.push(allowed.planStatus); }
    values.push(id);
    const { rows } = await pool.query(
      `UPDATE organizations SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
      values,
    );
    if (!rows.length) { res.status(404).json({ error: "Organization not found" }); return; }
    await db.insert(adminAuditLogsTable).values({ adminId: req.adminId!, action: "update_org_b2b", targetType: "organization", targetId: id, details: { b2bPlan: allowed.b2bPlan, crmEnabled: allowed.crmEnabled, planStatus: allowed.planStatus } });
    res.json({ organization: rows[0], success: true });
  } catch (e) {
    req.log?.error(e);
    res.status(500).json({ error: "Failed to update organization" });
  }
});

router.delete("/admin/organizations/:id", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const [deleted] = await db.delete(organizationsTable).where(eq(organizationsTable.id, id)).returning();
    if (!deleted) { res.status(404).json({ error: "Organization not found" }); return; }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete organization" });
  }
});

// ─── Custom Deals ─────────────────────────────────────────────────────────────

router.patch("/admin/organizations/:id/custom-pricing", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const { customPricePerSeat, customPriceNote, customPriceValidUntil, remove } = req.body as Record<string, unknown>;
    const updates = remove
      ? { customPricePerSeat: null, customPriceNote: null, customPriceValidUntil: null, customPriceAppliedBy: null, updatedAt: new Date() }
      : {
          customPricePerSeat: customPricePerSeat != null ? String(customPricePerSeat) : null,
          customPriceNote: customPriceNote ? String(customPriceNote) : null,
          customPriceValidUntil: customPriceValidUntil ? new Date(String(customPriceValidUntil)) : null,
          customPriceAppliedBy: req.adminId || "admin",
          updatedAt: new Date(),
        };
    const [updated] = await db.update(organizationsTable)
      .set(updates as Partial<typeof organizationsTable.$inferInsert>)
      .where(eq(organizationsTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Organization not found" }); return; }
    res.json({ organization: updated, success: true });
  } catch (e) {
    req.log?.error(e);
    res.status(500).json({ error: "Failed to update custom pricing" });
  }
});

router.patch("/admin/users/:id/custom-discount", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const { customDiscountPct, customDiscountNote, customDiscountValidUntil, remove } = req.body as Record<string, unknown>;
    const updates = remove
      ? { customDiscountPct: null, customDiscountNote: null, customDiscountValidUntil: null, updatedAt: new Date() }
      : {
          customDiscountPct: customDiscountPct != null ? Number(customDiscountPct) : null,
          customDiscountNote: customDiscountNote ? String(customDiscountNote) : null,
          customDiscountValidUntil: customDiscountValidUntil ? new Date(String(customDiscountValidUntil)) : null,
          updatedAt: new Date(),
        };
    const [updated] = await db.update(usersTable)
      .set(updates as Partial<typeof usersTable.$inferInsert>)
      .where(eq(usersTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "User not found" }); return; }
    res.json({ user: updated, success: true });
  } catch (e) {
    req.log?.error(e);
    res.status(500).json({ error: "Failed to update custom discount" });
  }
});

router.get("/admin/custom-deals", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const orgs = await db.select().from(organizationsTable)
      .where(isNotNull(organizationsTable.customPricePerSeat))
      .orderBy(desc(organizationsTable.updatedAt));
    const users = await db
      .select({
        id: usersTable.id,
        phone: usersTable.phone,
        email: usersTable.email,
        plan: usersTable.plan,
        customDiscountPct: usersTable.customDiscountPct,
        customDiscountNote: usersTable.customDiscountNote,
        customDiscountValidUntil: usersTable.customDiscountValidUntil,
        updatedAt: usersTable.updatedAt,
        fullName: userProfilesTable.fullName,
        aoraneId: userProfilesTable.aoraneId,
      })
      .from(usersTable)
      .leftJoin(userProfilesTable, eq(usersTable.id, userProfilesTable.userId))
      .where(isNotNull(usersTable.customDiscountPct))
      .orderBy(desc(usersTable.updatedAt));
    res.json({ orgs, users });
  } catch (e) {
    req.log?.error(e);
    res.status(500).json({ error: "Failed to fetch custom deals" });
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
    const { search, limit = "200" } = req.query as Record<string, string>;
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 500);
    const where = search ? ilike(foodItemsTable.foodNameEn, `%${search}%`) : undefined;
    const [totalRow] = await db.select({ total: count() }).from(foodItemsTable);
    const items = where
      ? await db.select().from(foodItemsTable).where(where).limit(limitNum)
      : await db.select().from(foodItemsTable).limit(limitNum);
    res.json({ items, total: totalRow?.total ?? 0 });
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

router.patch("/admin/promo-codes/:id", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const { discountPct, applicablePlans, usageLimit, expiresAt, isActive } = req.body as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    if (discountPct !== undefined) updates.discountPct = Number(discountPct);
    if (applicablePlans !== undefined) updates.applicablePlans = applicablePlans;
    if (usageLimit !== undefined) updates.usageLimit = usageLimit ? Number(usageLimit) : null;
    if (expiresAt !== undefined) updates.expiresAt = expiresAt ? new Date(expiresAt as string) : null;
    if (isActive !== undefined) updates.isActive = Boolean(isActive);
    const [updated] = await db.update(promoCodesTable).set(updates as Partial<typeof promoCodesTable.$inferInsert>).where(eq(promoCodesTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Promo code not found" }); return; }
    res.json({ code: updated });
  } catch {
    res.status(500).json({ error: "Failed to update promo code" });
  }
});

router.delete("/admin/promo-codes/:id", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const [deleted] = await db.delete(promoCodesTable).where(eq(promoCodesTable.id, id)).returning();
    if (!deleted) { res.status(404).json({ error: "Promo code not found" }); return; }
    await db.insert(adminAuditLogsTable).values({ adminId: req.adminId!, action: "delete_promo_code", targetType: "promo_code", targetId: id, details: { code: deleted.code } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete promo code" });
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
    const { limit = "100", offset = "0" } = req.query as Record<string, string>;
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 200);
    const offsetNum = Math.max(parseInt(offset, 10) || 0, 0);
    const [totalRow, subs] = await Promise.all([
      db.select({ count: count() }).from(subscriptionsTable).then(r => r[0]),
      db.select().from(subscriptionsTable).orderBy(desc(subscriptionsTable.createdAt)).limit(limitNum).offset(offsetNum),
    ]);
    res.json({ subscriptions: subs, total: Number(totalRow?.count ?? 0), offset: offsetNum, limit: limitNum });
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
    invalidatePlanCache(userId);
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
      invalidatePlanCache(sub.userId);
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

// ══════════════════════════════════════════════════════════════════════════════
// AI Food Discovery / Cache Review Endpoints
// ══════════════════════════════════════════════════════════════════════════════

router.get("/admin/food-cache/stats", requireAdmin, async (_req, res) => {
  try {
    const [total]    = await db.select({ count: count() }).from(foodScanCacheTable);
    const [pending]  = await db.select({ count: count() }).from(foodScanCacheTable)
      .where(and(eq(foodScanCacheTable.isPromoted, false), eq(foodScanCacheTable.isRejected, false)));
    const [promoted] = await db.select({ count: count() }).from(foodScanCacheTable).where(eq(foodScanCacheTable.isPromoted, true));
    const [rejected] = await db.select({ count: count() }).from(foodScanCacheTable).where(eq(foodScanCacheTable.isRejected, true));
    const [autoP]    = await db.select({ count: count() }).from(foodItemsTable).where(eq(foodItemsTable.aiGenerated, true));
    res.json({ total: Number(total?.count ?? 0), pending: Number(pending?.count ?? 0), promoted: Number(promoted?.count ?? 0), rejected: Number(rejected?.count ?? 0), autoPromoted: Number(autoP?.count ?? 0) });
  } catch { res.status(500).json({ error: "Failed to fetch stats" }); }
});

router.get("/admin/food-cache", requireAdmin, async (req, res) => {
  try {
    const { filter = "all", limit = "50", offset = "0", search = "" } = req.query as Record<string, string>;
    const conditions = [];
    if (filter === "pending")  { conditions.push(eq(foodScanCacheTable.isPromoted, false), eq(foodScanCacheTable.isRejected, false)); }
    if (filter === "promoted") { conditions.push(eq(foodScanCacheTable.isPromoted, true)); }
    if (filter === "rejected") { conditions.push(eq(foodScanCacheTable.isRejected, true)); }
    if (search) { conditions.push(ilike(foodScanCacheTable.foodNameEn, `%${search}%`)); }

    const rows = await db.select().from(foodScanCacheTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(foodScanCacheTable.hitCount))
      .limit(Number(limit))
      .offset(Number(offset));

    const [{ count: total }] = await db.select({ count: count() }).from(foodScanCacheTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    res.json({ entries: rows.map((e) => ({
      id: e.id,
      foodNameEn: e.foodNameEn,
      hitCount: e.hitCount,
      sourceAi: e.sourceAi,
      isPromoted: e.isPromoted,
      isRejected: e.isRejected,
      reviewedAt: e.reviewedAt,
      createdAt: e.createdAt,
      lastUsedAt: e.lastUsedAt,
      promotedFoodItemId: e.promotedFoodItemId,
      aiResult: e.aiResult,
    })), total: Number(total) });
  } catch { res.status(500).json({ error: "Failed to fetch food cache" }); }
});

router.post("/admin/food-cache/:id/promote", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const [entry] = await db.select().from(foodScanCacheTable).where(eq(foodScanCacheTable.id, id));
    if (!entry) { res.status(404).json({ error: "Cache entry not found" }); return; }
    if (entry.isPromoted) { res.status(409).json({ error: "Already promoted" }); return; }

    const r = entry.aiResult as Record<string, unknown>;
    const vs = (r.vitamins as Record<string, unknown>) ?? {};
    /** Safely convert value to decimal string — handles 0 correctly */
    const toD = (v: unknown): string | null => {
      if (v === null || v === undefined || v === "") return null;
      const n = Number(v); return isNaN(n) ? null : String(n);
    };
    const [newItem] = await db.insert(foodItemsTable).values({
      foodNameEn:  (r.foodNameEn as string) || entry.foodNameEn,
      category:    (r.category as string)   || "other",
      cuisineType: "indian",
      calories:     toD(r.calories) ?? "0",
      proteinG:     toD(r.proteinG),
      carbsG:       toD(r.carbsG),
      fatG:         toD(r.fatG),
      fiberG:       toD(r.fiberG),
      sugarG:       toD(r.sugarG),
      sodiumMg:     toD(r.sodiumMg),
      potassiumMg:  toD(r.potassiumMg) ?? toD(vs.potassium_mg),
      vitaminCMg:   toD(vs.vitaminC_mg),
      vitaminDMcg:  toD(vs.vitaminD_mcg),
      calciumMg:    toD(vs.calcium_mg),
      ironMg:       toD(vs.iron_mg),
      servingSizeG:       toD(r.servingSizeG) ?? "100",
      servingDescription: (r.servingDescription as string) || null,
      dietaryTags: Array.isArray(r.dietaryTags) ? r.dietaryTags as string[] : [],
      isVerified:    true,
      addedByAdmin:  true,
      aiGenerated:   true,
      aiSourceCacheId: entry.id,
    }).onConflictDoNothing().returning({ id: foodItemsTable.id, foodNameEn: foodItemsTable.foodNameEn });

    await db.update(foodScanCacheTable).set({
      isPromoted: true,
      reviewedAt: new Date(),
      promotedFoodItemId: newItem?.id ?? null,
    }).where(eq(foodScanCacheTable.id, id));

    await db.insert(adminAuditLogsTable).values({
      adminId: req.adminId!,
      action: "promote_ai_food",
      targetType: "food_scan_cache",
      targetId: id,
      details: { foodName: entry.foodNameEn, promotedItemId: newItem?.id },
    }).catch(() => {});

    res.json({ success: true, foodItem: newItem });
  } catch (err) {
    console.error("Promote food error:", err);
    res.status(500).json({ error: "Failed to promote food" });
  }
});

router.post("/admin/food-cache/:id/reject", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const [entry] = await db.select({ id: foodScanCacheTable.id, foodNameEn: foodScanCacheTable.foodNameEn })
      .from(foodScanCacheTable).where(eq(foodScanCacheTable.id, id));
    if (!entry) { res.status(404).json({ error: "Cache entry not found" }); return; }

    await db.update(foodScanCacheTable).set({
      isRejected: true,
      reviewedAt: new Date(),
    }).where(eq(foodScanCacheTable.id, id));

    await db.insert(adminAuditLogsTable).values({
      adminId: req.adminId!,
      action: "reject_ai_food",
      targetType: "food_scan_cache",
      targetId: id,
      details: { foodName: entry.foodNameEn },
    }).catch(() => {});

    res.json({ success: true });
  } catch { res.status(500).json({ error: "Failed to reject food" }); }
});

router.get("/admin/food-cache/export", requireAdmin, async (req, res) => {
  try {
    const { format = "json", filter = "all" } = req.query as Record<string, string>;
    const conditions = [];
    if (filter === "pending")  { conditions.push(eq(foodScanCacheTable.isPromoted, false), eq(foodScanCacheTable.isRejected, false)); }
    if (filter === "promoted") { conditions.push(eq(foodScanCacheTable.isPromoted, true)); }
    if (filter === "rejected") { conditions.push(eq(foodScanCacheTable.isRejected, true)); }

    const rows = await db.select().from(foodScanCacheTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(foodScanCacheTable.hitCount));

    if (format === "csv") {
      const csvHeader = "id,foodNameEn,hitCount,sourceAi,isPromoted,isRejected,createdAt,lastUsedAt,calories,proteinG,carbsG,fatG";
      const csvRows = rows.map((e) => {
        const r = e.aiResult as Record<string, unknown>;
        return [e.id, `"${e.foodNameEn}"`, e.hitCount, e.sourceAi ?? "", e.isPromoted, e.isRejected,
          e.createdAt.toISOString(), e.lastUsedAt.toISOString(),
          r.calories ?? "", r.proteinG ?? "", r.carbsG ?? "", r.fatG ?? ""].join(",");
      });
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="ai-food-discovery-${filter}-${Date.now()}.csv"`);
      res.send([csvHeader, ...csvRows].join("\n"));
    } else {
      res.setHeader("Content-Disposition", `attachment; filename="ai-food-discovery-${filter}-${Date.now()}.json"`);
      res.json({ exportedAt: new Date().toISOString(), filter, count: rows.length, entries: rows });
    }
  } catch { res.status(500).json({ error: "Export failed" }); }
});

// ─── Business Org Invoices ────────────────────────────────────────────────────
router.get("/admin/org-invoices", requireAdmin, async (_req: AdminRequest, res) => {
  try {
    const invoices = await db.select({
      id: orgPaymentsTable.id,
      orgId: orgPaymentsTable.orgId,
      orgName: organizationsTable.name,
      orgEmail: organizationsTable.contactEmail,
      orgPhone: organizationsTable.contactPhone,
      orgCity: organizationsTable.city,
      orgState: organizationsTable.state,
      orgGstin: organizationsTable.gstin,
      plan: orgPaymentsTable.plan,
      seats: orgPaymentsTable.seats,
      amount: orgPaymentsTable.amount,
      currency: orgPaymentsTable.currency,
      status: orgPaymentsTable.status,
      paymentType: orgPaymentsTable.paymentType,
      razorpayPaymentId: orgPaymentsTable.razorpayPaymentId,
      razorpayOrderId: orgPaymentsTable.razorpayOrderId,
      expiresAt: orgPaymentsTable.expiresAt,
      createdAt: orgPaymentsTable.createdAt,
    })
    .from(orgPaymentsTable)
    .innerJoin(organizationsTable, eq(orgPaymentsTable.orgId, organizationsTable.id))
    .orderBy(desc(orgPaymentsTable.createdAt));
    res.json({ invoices });
  } catch { res.status(500).json({ error: "Failed to fetch org invoices" }); }
});

// ─── Plan Features (plan_features table — granular per-plan limits) ──────────
router.get("/admin/plan-features", requireAdmin, async (_req: AdminRequest, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM plan_features ORDER BY feature_name`);
    res.json({ features: rows });
  } catch {
    res.status(500).json({ error: "Failed to fetch plan features" });
  }
});

router.put("/admin/plan-features/:feature_name", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const featureName = String(req.params.feature_name);
    const { freeValue, maxValue, proValue, familyValue, description } = req.body as Record<string, string>;
    const setClauses: string[] = ["updated_at = now()"];
    const values: unknown[] = [];
    let idx = 1;
    if (freeValue !== undefined)   { setClauses.push(`free_value = $${idx++}`);   values.push(freeValue); }
    if (maxValue !== undefined)    { setClauses.push(`max_value = $${idx++}`);    values.push(maxValue); }
    if (proValue !== undefined)    { setClauses.push(`pro_value = $${idx++}`);    values.push(proValue); }
    if (familyValue !== undefined) { setClauses.push(`family_value = $${idx++}`); values.push(familyValue); }
    if (description !== undefined) { setClauses.push(`description = $${idx++}`);  values.push(description); }
    if (values.length === 0) { res.status(400).json({ error: "No fields to update" }); return; }
    values.push(featureName);
    const { rows } = await pool.query(
      `UPDATE plan_features SET ${setClauses.join(", ")} WHERE feature_name = $${idx} RETURNING *`,
      values,
    );
    if (!rows.length) { res.status(404).json({ error: "Feature not found" }); return; }
    const { invalidateAILimiterCache } = await import("../../lib/aiLimiter");
    invalidateAILimiterCache();
    await db.insert(adminAuditLogsTable).values({
      adminId: req.adminId!, action: "update_plan_feature",
      targetType: "plan_feature", targetId: featureName,
      details: { freeValue, maxValue, proValue, familyValue },
    });
    res.json({ feature: rows[0], success: true });
  } catch (e) {
    req.log?.error(e);
    res.status(500).json({ error: "Failed to update plan feature" });
  }
});

// ─── User AI Usage (per-user daily usage stats + reset) ──────────────────────
router.get("/admin/users/:id/ai-usage", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const userId = String(req.params.id);
    const istOffset = 5.5 * 60 * 60 * 1000;
    const today = new Date(Date.now() + istOffset).toISOString().slice(0, 10);
    const [userRow] = await db.select({ plan: usersTable.plan }).from(usersTable).where(eq(usersTable.id, userId));
    const plan = userRow?.plan || "free";
    const [{ rows: usageRows }, { rows: featureRows }] = await Promise.all([
      pool.query(`SELECT feature_name, usage_count FROM ai_usage_daily WHERE user_id = $1 AND usage_date = $2`, [userId, today]),
      pool.query(`SELECT feature_name, free_value, max_value, pro_value, family_value FROM plan_features WHERE feature_name LIKE 'ai_%'`),
    ]);
    const usageMap = new Map((usageRows as Array<{ feature_name: string; usage_count: number }>).map(r => [r.feature_name, r.usage_count]));
    const usage = (featureRows as Array<{ feature_name: string; free_value: string; max_value: string; pro_value: string; family_value: string }>).map(f => {
      const raw = plan === "max" ? f.max_value : plan === "pro" ? f.pro_value : plan === "family" ? f.family_value : f.free_value;
      const limit = raw === "true" ? 999 : raw === "false" ? 0 : (parseInt(raw, 10) || 0);
      return { feature: f.feature_name, used: usageMap.get(f.feature_name) || 0, limit };
    });
    res.json({ usage, date: today, plan });
  } catch (e) {
    req.log?.error(e);
    res.status(500).json({ error: "Failed to fetch AI usage" });
  }
});

router.post("/admin/users/:id/reset-ai-usage", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const userId = String(req.params.id);
    const istOffset = 5.5 * 60 * 60 * 1000;
    const today = new Date(Date.now() + istOffset).toISOString().slice(0, 10);
    const { rowCount } = await pool.query(
      `DELETE FROM ai_usage_daily WHERE user_id = $1 AND usage_date = $2`,
      [userId, today],
    );
    await db.insert(adminAuditLogsTable).values({
      adminId: req.adminId!, action: "reset_ai_usage",
      targetType: "user", targetId: userId,
      details: { date: today, rowsDeleted: rowCount },
    });
    res.json({ success: true, rowsReset: rowCount, date: today });
  } catch (e) {
    req.log?.error(e);
    res.status(500).json({ error: "Failed to reset AI usage" });
  }
});

router.post("/admin/change-password", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
    if (!currentPassword || !newPassword) { res.status(400).json({ error: "Both passwords are required" }); return; }
    if (newPassword.length < 8) { res.status(400).json({ error: "New password must be at least 8 characters" }); return; }
    const [admin] = await db.select().from(adminUsersTable).where(eq(adminUsersTable.id, req.adminId!));
    if (!admin) { res.status(404).json({ error: "Admin not found" }); return; }
    const valid = await verifyAndMigratePassword(currentPassword, admin.passwordHash, async (h) => {
      await db.update(adminUsersTable).set({ passwordHash: h }).where(eq(adminUsersTable.id, admin.id));
    });
    if (!valid) { res.status(401).json({ error: "Current password is incorrect" }); return; }
    const newHash = await bcrypt.hash(newPassword, 12);
    await db.update(adminUsersTable).set({ passwordHash: newHash }).where(eq(adminUsersTable.id, req.adminId!));
    res.json({ success: true, message: "Password changed successfully" });
  } catch { res.status(500).json({ error: "Failed to change password" }); }
});

export default router;
