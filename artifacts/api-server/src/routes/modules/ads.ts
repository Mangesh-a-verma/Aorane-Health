/**
 * Ads Module — Admin control + Mobile slider API
 * GET  /ads/active        — mobile app ke liye active ads (slider mein dikhne wale)
 * GET  /admin/ads         — admin: all ads
 * POST /admin/ads         — admin: create ad
 * PUT  /admin/ads/:id     — admin: update ad
 * DELETE /admin/ads/:id   — admin: delete ad
 * POST /ads/:id/impression — track impression
 * POST /ads/:id/click      — track click
 */

import { Router } from "express";
import { db, adCampaignsTable, adImpressionsTable, adClicksTable } from "@workspace/db";
import { eq, and, lte, gte, or, isNull, asc } from "drizzle-orm";
import { requireAuth } from "../../middlewares/user-auth";
import { requireAdmin } from "../../middlewares/admin-auth";
import type { AuthRequest } from "../../middlewares/user-auth";
import type { AdminRequest } from "../../middlewares/admin-auth";
import { isBooleanFeatureEnabled } from "../../middlewares/plan-limits";

const router = Router();

// ── Mobile: Active ads for slider ─────────────────────────────────────────────

router.get("/ads/active", requireAuth, async (req: AuthRequest, res) => {
  try {
    const screen = (req.query.screen as string) || "dashboard";
    const planType = req.userPlan || "free";
    const now = new Date();

    const adsEnabled = await isBooleanFeatureEnabled("ads_shown", planType);
    if (!adsEnabled) {
      res.json({ ads: [], adsEnabled: false });
      return;
    }

    const ads = await db.select().from(adCampaignsTable)
      .where(
        and(
          eq(adCampaignsTable.status, "active"),
          or(
            eq(adCampaignsTable.targetScreen, screen),
            eq(adCampaignsTable.targetScreen, "all"),
          ),
          or(isNull(adCampaignsTable.startsAt), lte(adCampaignsTable.startsAt, now)),
          or(isNull(adCampaignsTable.endsAt), gte(adCampaignsTable.endsAt, now)),
        )
      )
      .orderBy(asc(adCampaignsTable.slidePosition), asc(adCampaignsTable.priority))
      .limit(10);

    // Filter by targetPlans in JS — Drizzle has no native array-contains operator
    // Ad shows if: targetPlans is null/empty (show to all), OR user's plan is in the list
    const filteredAds = ads.filter(ad =>
      !ad.targetPlans || ad.targetPlans.length === 0 || ad.targetPlans.includes(planType)
    ).slice(0, 5);

    res.json({ ads: filteredAds, adsEnabled: true });
  } catch {
    res.status(500).json({ error: "Failed to fetch ads" });
  }
});

// ── Impression tracking (mobile calls this when slider shows an ad) ────────────

router.post("/ads/:id/impression", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { platform } = req.body as { platform?: string };
    const adId = String(req.params.id);
    await Promise.all([
      db.insert(adImpressionsTable).values({
        campaignId: adId,
        userId: req.userId,
        platform: platform || "mobile",
      }),
      db.update(adCampaignsTable)
        .set({ impressionCount: db.$count(adImpressionsTable, eq(adImpressionsTable.campaignId, adId)) as unknown as number })
        .where(eq(adCampaignsTable.id, adId)),
    ]);
    res.json({ success: true });
  } catch {
    res.json({ success: false });
  }
});

// ── Click tracking ─────────────────────────────────────────────────────────────

router.post("/ads/:id/click", requireAuth, async (req: AuthRequest, res) => {
  try {
    const clickAdId = String(req.params.id);
    await db.insert(adClicksTable).values({
      campaignId: clickAdId,
      userId: req.userId,
    });
    const ad = await db.select({ linkUrl: adCampaignsTable.linkUrl })
      .from(adCampaignsTable).where(eq(adCampaignsTable.id, clickAdId)).limit(1);
    res.json({ success: true, linkUrl: ad[0]?.linkUrl || null });
  } catch {
    res.json({ success: false, linkUrl: null });
  }
});

// ── Admin: List all ads ────────────────────────────────────────────────────────

router.get("/admin/ads", requireAdmin, async (_req: AdminRequest, res) => {
  try {
    const ads = await db.select().from(adCampaignsTable)
      .orderBy(asc(adCampaignsTable.slidePosition), asc(adCampaignsTable.priority));
    res.json({ ads });
  } catch {
    res.status(500).json({ error: "Failed to fetch ads" });
  }
});

// ── Admin: Create ad ──────────────────────────────────────────────────────────

router.post("/admin/ads", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const {
      adType, title, advertiserName, bannerUrl, linkUrl,
      targetPlans, targetCities, targetAgeMin, targetAgeMax,
      status, priority, dealAmount, startsAt, endsAt,
      slidePosition, targetScreen, googleAdCode,
    } = req.body as Record<string, unknown>;

    if (!adType || !title) {
      res.status(400).json({ error: "adType and title are required." });
      return;
    }

    const [ad] = await db.insert(adCampaignsTable).values({
      adType: (adType as "google" | "direct"),
      title: String(title),
      advertiserName: advertiserName ? String(advertiserName) : undefined,
      bannerUrl: bannerUrl ? String(bannerUrl) : undefined,
      linkUrl: linkUrl ? String(linkUrl) : undefined,
      targetPlans: Array.isArray(targetPlans) ? targetPlans as string[] : undefined,
      targetCities: Array.isArray(targetCities) ? targetCities as string[] : undefined,
      targetAgeMin: targetAgeMin ? Number(targetAgeMin) : undefined,
      targetAgeMax: targetAgeMax ? Number(targetAgeMax) : undefined,
      status: (status as "active" | "paused" | "expired" | "pending") || "active",
      priority: priority ? Number(priority) : 1,
      dealAmount: dealAmount ? String(dealAmount) : undefined,
      startsAt: startsAt ? new Date(String(startsAt)) : undefined,
      endsAt: endsAt ? new Date(String(endsAt)) : undefined,
      slidePosition: slidePosition ? Number(slidePosition) : 1,
      targetScreen: targetScreen ? String(targetScreen) : "dashboard",
      googleAdCode: googleAdCode ? String(googleAdCode) : undefined,
    }).returning();

    res.status(201).json({ ad });
  } catch (e) {
    req.log.error({ err: e }, "Failed to create ad");
    res.status(500).json({ error: "Failed to create ad" });
  }
});

// ── Admin: Update ad ──────────────────────────────────────────────────────────

router.put("/admin/ads/:id", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const {
      adType, title, advertiserName, bannerUrl, linkUrl,
      targetPlans, targetCities, targetAgeMin, targetAgeMax,
      status, priority, dealAmount, startsAt, endsAt,
      slidePosition, targetScreen, googleAdCode,
    } = req.body as Record<string, unknown>;

    const [ad] = await db.update(adCampaignsTable).set({
      ...(adType ? { adType: adType as "google" | "direct" } : {}),
      ...(title ? { title: String(title) } : {}),
      ...(advertiserName !== undefined ? { advertiserName: advertiserName ? String(advertiserName) : null } : {}),
      ...(bannerUrl !== undefined ? { bannerUrl: bannerUrl ? String(bannerUrl) : null } : {}),
      ...(linkUrl !== undefined ? { linkUrl: linkUrl ? String(linkUrl) : null } : {}),
      ...(targetPlans !== undefined ? { targetPlans: Array.isArray(targetPlans) ? targetPlans as string[] : null } : {}),
      ...(targetCities !== undefined ? { targetCities: Array.isArray(targetCities) ? targetCities as string[] : null } : {}),
      ...(targetAgeMin !== undefined ? { targetAgeMin: targetAgeMin ? Number(targetAgeMin) : null } : {}),
      ...(targetAgeMax !== undefined ? { targetAgeMax: targetAgeMax ? Number(targetAgeMax) : null } : {}),
      ...(status ? { status: status as "active" | "paused" | "expired" | "pending" } : {}),
      ...(priority !== undefined ? { priority: Number(priority) } : {}),
      ...(dealAmount !== undefined ? { dealAmount: dealAmount ? String(dealAmount) : null } : {}),
      ...(startsAt !== undefined ? { startsAt: startsAt ? new Date(String(startsAt)) : null } : {}),
      ...(endsAt !== undefined ? { endsAt: endsAt ? new Date(String(endsAt)) : null } : {}),
      ...(slidePosition !== undefined ? { slidePosition: Number(slidePosition) } : {}),
      ...(targetScreen !== undefined ? { targetScreen: String(targetScreen) } : {}),
      ...(googleAdCode !== undefined ? { googleAdCode: googleAdCode ? String(googleAdCode) : null } : {}),
    }).where(eq(adCampaignsTable.id, String(req.params.id))).returning();

    res.json({ ad });
  } catch (e) {
    req.log.error({ err: e }, "Failed to update ad");
    res.status(500).json({ error: "Failed to update ad" });
  }
});

// ── Admin: Delete ad ──────────────────────────────────────────────────────────

router.delete("/admin/ads/:id", requireAdmin, async (req: AdminRequest, res) => {
  try {
    await db.delete(adCampaignsTable).where(eq(adCampaignsTable.id, String(req.params.id)));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete ad" });
  }
});

// ── Admin: Toggle status ──────────────────────────────────────────────────────

router.patch("/admin/ads/:id/toggle", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const adId = String(req.params.id);
    const current = await db.select({ status: adCampaignsTable.status })
      .from(adCampaignsTable).where(eq(adCampaignsTable.id, adId)).limit(1);
    const newStatus = current[0]?.status === "active" ? "paused" : "active";
    await db.update(adCampaignsTable).set({ status: newStatus }).where(eq(adCampaignsTable.id, adId));
    res.json({ status: newStatus });
  } catch {
    res.status(500).json({ error: "Toggle failed" });
  }
});

export default router;
