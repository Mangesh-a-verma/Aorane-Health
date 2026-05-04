import { Router } from "express";
import {
  db, wearableConnectionsTable, wearableDataTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../../middlewares/user-auth";
import type { AuthRequest } from "../../middlewares/user-auth";

const router = Router();

// ─── Supported Providers ──────────────────────────────────────────────────────
const PROVIDERS = [
  {
    id: "health_connect",
    name: "Health Connect (Android)",
    description: "Sync steps, heart rate, sleep, SpO2, calories from any Android wearable",
    supported: true,
    requiresCredentials: false,
  },
  {
    id: "apple_healthkit",
    name: "Apple HealthKit (iOS)",
    description: "Sync from Apple Watch & all iOS health apps via HealthKit",
    supported: false,
    requiresCredentials: false,
  },
  {
    id: "samsung_health",
    name: "Samsung Health",
    description: "Sync from Samsung Galaxy Watch/Band (coming soon)",
    supported: false,
    requiresCredentials: false,
  },
];

// ─── Routes ───────────────────────────────────────────────────────────────────

// List available providers
router.get("/wearable/providers", requireAuth, async (_req: AuthRequest, res) => {
  res.json({
    providers: PROVIDERS.map((p) => ({
      ...p,
      available: p.id === "health_connect",
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
    const { limit = "30" } = req.query as Record<string, string>;
    const data = await db.select().from(wearableDataTable)
      .where(eq(wearableDataTable.userId, req.userId!))
      .orderBy(desc(wearableDataTable.recordedAt))
      .limit(parseInt(limit));

    const latest = data[0] || null;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recent = data.filter((d) => d.recordedAt >= sevenDaysAgo);
    const withHr = recent.filter((d) => d.heartRateAvg);
    const withSleep = recent.filter((d) => d.sleepHours);
    const withSpo2 = recent.filter((d) => d.bloodOxygen);

    const avgSteps = recent.length > 0 ? Math.round(recent.reduce((s, d) => s + (d.steps || 0), 0) / recent.length) : null;
    const avgHr = withHr.length > 0 ? Math.round(withHr.reduce((s, d) => s + (d.heartRateAvg || 0), 0) / withHr.length) : null;
    const totalCalories = recent.reduce((s, d) => s + parseFloat(d.caloriesBurned || "0"), 0);
    const totalActiveMin = recent.reduce((s, d) => s + (d.activeMinutes || 0), 0);
    const avgSleep = withSleep.length > 0 ? Math.round(withSleep.reduce((s, d) => s + parseFloat(d.sleepHours || "0"), 0) / withSleep.length * 10) / 10 : null;
    const avgSpo2 = withSpo2.length > 0 ? Math.round(withSpo2.reduce((s, d) => s + parseFloat(d.bloodOxygen || "0"), 0) / withSpo2.length * 10) / 10 : null;

    res.json({
      latest, history: data,
      summary: { avgSteps, avgHr, totalCalories: Math.round(totalCalories), totalActiveMin, avgSleep, avgSpo2, recordCount: data.length },
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
