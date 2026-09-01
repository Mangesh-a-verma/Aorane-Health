import { Router } from "express";
import {
  db, wearableConnectionsTable, wearableDataTable,
} from "@workspace/db";
import { eq, and, desc, gte } from "drizzle-orm";
import { requireAuth } from "../../middlewares/user-auth";
import type { AuthRequest } from "../../middlewares/user-auth";
import { isBooleanFeatureEnabled } from "../../middlewares/plan-limits";

const router = Router();

// ─── Supported Providers ──────────────────────────────────────────────────────
//
// `status` is the single switch that turns a provider on. Everything else —
// the connect sheet, the device cards, per-metric attribution — reads from
// this list, so shipping Apple Health or Samsung Health later is a one-word
// change here plus its native module, with no other edits to this file.
//
// `wearable_data.provider` is a free-text column, so new providers need no
// migration; rows already written keep working.
type ProviderStatus = "live" | "planned";

const PROVIDERS: Array<{
  id: string;
  name: string;
  shortName: string;
  description: string;
  platform: "android" | "ios";
  status: ProviderStatus;
  requiresCredentials: boolean;
}> = [
  {
    id: "health_connect",
    name: "Health Connect (Android)",
    shortName: "Health Connect",
    description: "Sync steps, heart rate, sleep, SpO2, calories from any Android wearable",
    platform: "android",
    status: "live",
    requiresCredentials: false,
  },
  {
    id: "apple_healthkit",
    name: "Apple Health (iOS)",
    shortName: "Apple Health",
    description: "Sync from Apple Watch & all iOS health apps via HealthKit",
    platform: "ios",
    status: "planned",
    requiresCredentials: false,
  },
  {
    id: "samsung_health",
    name: "Samsung Health",
    shortName: "Samsung Health",
    description: "Sync from Samsung Galaxy Watch & Galaxy Fit",
    platform: "android",
    status: "planned",
    requiresCredentials: false,
  },
];

// ─── Routes ───────────────────────────────────────────────────────────────────

// List available providers
router.get("/wearable/providers", requireAuth, async (_req: AuthRequest, res) => {
  res.json({
    // `supported`/`available` are both kept so existing clients keep working,
    // but they now derive from `status` instead of a hardcoded id comparison
    // that had to be edited in lockstep with the list above.
    providers: PROVIDERS.map((p) => ({
      ...p,
      supported: p.status === "live",
      available: p.status === "live",
    })),
  });
});

// Get user's connected wearables
router.get("/wearable/connections", requireAuth, async (req: AuthRequest, res) => {
  try {
    const connections = await db.select().from(wearableConnectionsTable)
      .where(eq(wearableConnectionsTable.userId, req.userId!)).orderBy(desc(wearableConnectionsTable.createdAt));
    res.json({ connections });
  } catch {
    res.status(500).json({ error: "Failed to fetch connections" });
  }
});

// Health Connect sync — mobile reads data natively, sends to server
router.post("/wearable/sync/health_connect", requireAuth, async (req: AuthRequest, res) => {
  try {
    const planType = req.userPlan || "free";
    const wearableEnabled = await isBooleanFeatureEnabled("wearable_sync", planType);
    if (!wearableEnabled) {
      res.status(403).json({
        error: `Wearable sync is not available on the ${planType.toUpperCase()} plan. Please upgrade to enable Health Connect sync.`,
        feature: "wearable_sync",
        reason: "plan_not_supported",
        currentPlan: planType,
        upgradeSuggested: true,
      });
      return;
    }

    const {
      steps, heartRateAvg, heartRateMin, heartRateMax,
      caloriesBurned, sleepHours, bloodOxygen, activeMinutes, distanceKm,
    } = req.body as Record<string, unknown>;

    // Upsert connection record
    const [existing] = await db.select().from(wearableConnectionsTable)
      .where(and(eq(wearableConnectionsTable.userId, req.userId!), eq(wearableConnectionsTable.provider, "health_connect")));
    if (existing) {
      await db.update(wearableConnectionsTable)
        .set({ isActive: true, lastSyncedAt: new Date(), updatedAt: new Date() })
        .where(eq(wearableConnectionsTable.id, existing.id));
    } else {
      await db.insert(wearableConnectionsTable).values({
        userId: req.userId!,
        provider: "health_connect",
        isActive: true,
        lastSyncedAt: new Date(),
      });
    }

    // Insert data record
    const [inserted] = await db.insert(wearableDataTable).values({
      userId: req.userId!,
      provider: "health_connect",
      recordedAt: new Date(),
      steps: steps != null ? Number(steps) : undefined,
      heartRateAvg: heartRateAvg != null ? Number(heartRateAvg) : undefined,
      heartRateMin: heartRateMin != null ? Number(heartRateMin) : undefined,
      heartRateMax: heartRateMax != null ? Number(heartRateMax) : undefined,
      caloriesBurned: caloriesBurned != null ? String(caloriesBurned) : undefined,
      sleepHours: sleepHours != null ? String(sleepHours) : undefined,
      bloodOxygen: bloodOxygen != null ? String(bloodOxygen) : undefined,
      activeMinutes: activeMinutes != null ? Number(activeMinutes) : undefined,
      distanceKm: distanceKm != null ? String(distanceKm) : undefined,
    }).returning();

    const hasData = [steps, heartRateAvg, caloriesBurned, sleepHours, bloodOxygen, distanceKm, activeMinutes].some((v) => v != null);
    res.json({ success: true, hasData, data: inserted });
  } catch (e) {
    res.status(500).json({ error: "Sync failed", detail: e instanceof Error ? e.message : String(e) });
  }
});

// Get wearable data (latest or date range)
router.get("/wearable/data", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { limit = "30", days = "7", provider } = req.query as Record<string, string>;
    const windowDays = Math.min(90, Math.max(1, parseInt(days, 10) || 7));
    // `limit` arrives straight off the query string — an unparseable value
    // used to reach the driver as `LIMIT NaN` and 500 the request.
    const historyLimit = Math.min(200, Math.max(1, parseInt(limit, 10) || 30));
    const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    // `provider` was accepted by the mobile client's getWearableData() but
    // never read here, so filtering by a single source silently returned
    // every source instead.
    const ownerFilter = provider
      ? and(eq(wearableDataTable.userId, req.userId!), eq(wearableDataTable.provider, provider))
      : eq(wearableDataTable.userId, req.userId!);

    // Two reads on purpose. `history`/`latest` stay "the most recent rows,
    // whatever their age", while the summary is computed over a real date
    // window. Deriving both from ONE row-limited read is what made the
    // 7-day summary silently cover fewer than 7 days: every sync inserts a
    // row and Force Sync ignores the 4h cooldown, so a user who syncs often
    // had more than `limit` rows inside a day or two and the window filter
    // had nothing older left to find.
    const history = await db.select().from(wearableDataTable)
      .where(ownerFilter)
      .orderBy(desc(wearableDataTable.recordedAt))
      .limit(historyLimit);

    const recent = await db.select().from(wearableDataTable)
      .where(and(ownerFilter, gte(wearableDataTable.recordedAt, windowStart)))
      .orderBy(desc(wearableDataTable.recordedAt))
      // Safety bound only. 90 days of even very frequent syncing sits well
      // under this, and the rows collapse to one per day just below.
      .limit(2000);

    const latest = history[0] || null;

    // Each sync row is a ROLLING 24h snapshot (mobile's syncManager.ts reads
    // "last 24 hours" on every sync, not a delta since the previous sync),
    // and syncs can happen several times a day (4h cooldown). Consecutive
    // rows on the same day therefore overlap heavily — summing/averaging
    // them raw would double- or triple-count calories/active-minutes by
    // however many times the user synced that day. Dedupe to the single
    // latest-synced row per IST calendar day first (same "latest row per
    // day" approach scoring.ts already uses for the health score), then
    // aggregate across those day-buckets instead of raw rows. A user with
    // no wearable data at all just yields an empty set here, which already
    // falls through to null/0 below — no fabricated values.
    const byDay = new Map<string, (typeof recent)[number]>();
    for (const d of recent) {
      const dayKey = new Date(d.recordedAt as unknown as string).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      const existing = byDay.get(dayKey);
      if (!existing || new Date(d.recordedAt as unknown as string) > new Date(existing.recordedAt as unknown as string)) {
        byDay.set(dayKey, d);
      }
    }
    const dailySnapshots = Array.from(byDay.values());

    // One entry per calendar day in the window, oldest first, with null on
    // days that have no reading — so a sparkline shows a real gap instead of
    // joining across missing days as if they were continuous. Built from the
    // same deduped day buckets the averages use, so the chart and the number
    // above it can never disagree.
    const dailySeries: Array<{
      date: string;
      steps: number | null; heartRateAvg: number | null; caloriesBurned: number | null;
      activeMinutes: number | null; sleepHours: number | null; bloodOxygen: number | null;
    }> = [];
    for (let i = windowDays - 1; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
        .toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      const d = byDay.get(date);
      dailySeries.push({
        date,
        steps: d?.steps ?? null,
        heartRateAvg: d?.heartRateAvg ?? null,
        caloriesBurned: d?.caloriesBurned ? Math.round(parseFloat(d.caloriesBurned)) : null,
        activeMinutes: d?.activeMinutes ?? null,
        sleepHours: d?.sleepHours ? parseFloat(d.sleepHours) : null,
        bloodOxygen: d?.bloodOxygen ? parseFloat(d.bloodOxygen) : null,
      });
    }

    const withHr = dailySnapshots.filter((d: any) => d.heartRateAvg);
    const withSleep = dailySnapshots.filter((d: any) => d.sleepHours);
    const withSpo2 = dailySnapshots.filter((d: any) => d.bloodOxygen);

    const avgSteps = dailySnapshots.length > 0 ? Math.round(dailySnapshots.reduce((s: any, d: any) => s + (d.steps || 0), 0) / dailySnapshots.length) : null;
    const avgHr = withHr.length > 0 ? Math.round(withHr.reduce((s: any, d: any) => s + (d.heartRateAvg || 0), 0) / withHr.length) : null;
    const totalCalories = dailySnapshots.reduce((s: any, d: any) => s + parseFloat(d.caloriesBurned || "0"), 0);
    const totalActiveMin = dailySnapshots.reduce((s: any, d: any) => s + (d.activeMinutes || 0), 0);
    const avgSleep = withSleep.length > 0 ? Math.round(withSleep.reduce((s: any, d: any) => s + parseFloat(d.sleepHours || "0"), 0) / withSleep.length * 10) / 10 : null;
    const avgSpo2 = withSpo2.length > 0 ? Math.round(withSpo2.reduce((s: any, d: any) => s + parseFloat(d.bloodOxygen || "0"), 0) / withSpo2.length * 10) / 10 : null;

    res.json({
      latest, history, dailySeries,
      summary: {
        avgSteps, avgHr, totalCalories: Math.round(totalCalories), totalActiveMin,
        avgSleep, avgSpo2,
        // Scoped to the window the summary actually describes, so the UI's
        // "show the 7-day summary" check can no longer pass on the strength
        // of rows that fall outside it. `daysWithData` is what the averages
        // are divided by — the UI can say "avg over N days" honestly.
        recordCount: recent.length,
        daysWithData: dailySnapshots.length,
        windowDays,
      },
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch wearable data" });
  }
});

// Manual data entry
router.post("/wearable/data/manual", requireAuth, async (req: AuthRequest, res) => {
  try {
    const {
      steps, heartRateAvg, heartRateMin, heartRateMax,
      caloriesBurned, sleepHours, bloodOxygen, activeMinutes, distanceKm, recordedAt,
    } = req.body as Record<string, unknown>;
    const [inserted] = await db.insert(wearableDataTable).values({
      userId: req.userId!,
      provider: "manual",
      recordedAt: recordedAt ? new Date(recordedAt as string) : new Date(),
      steps: steps as number | undefined,
      heartRateAvg: heartRateAvg as number | undefined,
      heartRateMin: heartRateMin as number | undefined,
      heartRateMax: heartRateMax as number | undefined,
      caloriesBurned: caloriesBurned ? String(caloriesBurned) : undefined,
      sleepHours: sleepHours ? String(sleepHours) : undefined,
      bloodOxygen: bloodOxygen ? String(bloodOxygen) : undefined,
      activeMinutes: activeMinutes as number | undefined,
      distanceKm: distanceKm ? String(distanceKm) : undefined,
    }).returning();
    res.json({ success: true, data: inserted });
  } catch {
    res.status(500).json({ error: "Failed to save manual data" });
  }
});

// Disconnect a wearable
router.delete("/wearable/connections/:provider", requireAuth, async (req: AuthRequest, res) => {
  try {
    const provider = String(req.params.provider);
    await db.update(wearableConnectionsTable)
      .set({ isActive: false, accessToken: null, refreshToken: null, updatedAt: new Date() })
      .where(and(eq(wearableConnectionsTable.userId, req.userId!), eq(wearableConnectionsTable.provider, provider)));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to disconnect" });
  }
});

export default router;
