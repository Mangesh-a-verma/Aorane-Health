import { Router } from "express";
import {
  db, wearableConnectionsTable, wearableDataTable, usersTable,
} from "@workspace/db";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import { requireAuth } from "../../middlewares/user-auth";
import type { AuthRequest } from "../../middlewares/user-auth";

const router = Router();

// ─── Google Fit OAuth Config ──────────────────────────────────────────────────
const GOOGLE_CLIENT_ID     = process.env.GOOGLE_FIT_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_FIT_CLIENT_SECRET || "";
const API_BASE             = process.env.API_BASE_URL || "https://aorane.onrender.com/api";
const GOOGLE_REDIRECT_URI  = `${API_BASE}/wearable/oauth/google-fit/callback`;
// APP_URL is the frontend base — used for post-OAuth redirects back to the mobile deep link / web page
const APP_URL_BASE         = process.env.APP_URL || "https://aorane.onrender.com/api";

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/fitness.activity.read",
  "https://www.googleapis.com/auth/fitness.heart_rate.read",
  "https://www.googleapis.com/auth/fitness.sleep.read",
  "https://www.googleapis.com/auth/fitness.body.read",
].join(" ");

// ─── Supported Providers ──────────────────────────────────────────────────────
const PROVIDERS = [
  {
    id: "google_fit",
    name: "Google Fit",
    icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Google_Fit_logo.svg/120px-Google_Fit_logo.svg.png",
    description: "Sync steps, heart rate, sleep, SpO2, calories from Google Fit",
    supported: true,
    requiresCredentials: true,
  },
  {
    id: "garmin",
    name: "Garmin Connect",
    icon: null,
    description: "Sync from Garmin smartwatches (coming soon)",
    supported: false,
    requiresCredentials: true,
  },
  {
    id: "fitbit",
    name: "Fitbit",
    icon: null,
    description: "Sync from Fitbit devices (coming soon)",
    supported: false,
    requiresCredentials: true,
  },
  {
    id: "samsung_health",
    name: "Samsung Health",
    icon: null,
    description: "Sync from Samsung Galaxy Watch/Band (coming soon)",
    supported: false,
    requiresCredentials: false,
  },
  {
    id: "manual",
    name: "Manual Entry",
    icon: null,
    description: "Manually log health data from any device",
    supported: true,
    requiresCredentials: false,
  },
];

// ─── Utility: Refresh Google Access Token ─────────────────────────────────────
async function refreshGoogleToken(conn: typeof wearableConnectionsTable.$inferSelect): Promise<string | null> {
  if (!conn.refreshToken) return null;
  try {
    const body = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: conn.refreshToken,
      grant_type: "refresh_token",
    });
    const res = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body, headers: { "Content-Type": "application/x-www-form-urlencoded" } });
    if (!res.ok) return null;
    const data = await res.json() as { access_token?: string; expires_in?: number };
    if (data.access_token) {
      const expiresAt = new Date(Date.now() + ((data.expires_in || 3600) * 1000));
      await db.update(wearableConnectionsTable)
        .set({ accessToken: data.access_token, tokenExpiresAt: expiresAt, updatedAt: new Date() })
        .where(eq(wearableConnectionsTable.id, conn.id));
      return data.access_token;
    }
    return null;
  } catch { return null; }
}

// ─── Utility: Get valid Google access token ───────────────────────────────────
async function getGoogleToken(conn: typeof wearableConnectionsTable.$inferSelect): Promise<string | null> {
  if (!conn.accessToken) return null;
  // Refresh if expired or expiring within 5 minutes, or if no expiry set
  const bufferMs = 5 * 60 * 1000;
  const needsRefresh = !conn.tokenExpiresAt || conn.tokenExpiresAt < new Date(Date.now() + bufferMs);
  if (needsRefresh) return await refreshGoogleToken(conn);
  return conn.accessToken;
}

// ─── Utility: Fetch Google Fit aggregate data ─────────────────────────────────
async function fetchGoogleFitData(
  accessToken: string,
  startMs: number,
  endMs: number
): Promise<Record<string, number | null>> {
  const body = {
    aggregateBy: [
      { dataTypeName: "com.google.step_count.delta" },
      { dataTypeName: "com.google.heart_rate.bpm" },
      { dataTypeName: "com.google.calories.expended" },
      { dataTypeName: "com.google.active_minutes" },
      { dataTypeName: "com.google.distance.delta" },
      { dataTypeName: "com.google.oxygen_saturation" },
    ],
    bucketByTime: { durationMillis: endMs - startMs },
    startTimeMillis: startMs.toString(),
    endTimeMillis: endMs.toString(),
  };
  const res = await fetch(
    "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const errBody = await res.text().catch(() => "unknown");
    console.error(`[GFit] API error ${res.status}: ${errBody}`);
    throw new Error(`Google Fit API returned ${res.status}: ${errBody}`);
  }
  const data = await res.json() as { bucket?: Array<{ dataset?: Array<{ dataSourceId?: string; point?: Array<{ value?: Array<{ intVal?: number; fpVal?: number }> }> }> }> };
  const result: Record<string, number | null> = {
    steps: null, heartRateAvg: null, caloriesBurned: null,
    activeMinutes: null, distanceKm: null, bloodOxygen: null,
  };
  for (const bucket of data.bucket || []) {
    for (const ds of bucket.dataset || []) {
      const pts = ds.point || [];
      const vals = pts.flatMap((p) => p.value || []);
      const id = ds.dataSourceId || "";
      if (id.includes("step_count")) {
        result.steps = vals.reduce((s, v) => s + (v.intVal || 0), 0);
      } else if (id.includes("heart_rate")) {
        const hrVals = vals.map((v) => v.fpVal || 0).filter(Boolean);
        if (hrVals.length > 0) result.heartRateAvg = Math.round(hrVals.reduce((a, b) => a + b, 0) / hrVals.length);
      } else if (id.includes("calories")) {
        result.caloriesBurned = Math.round(vals.reduce((s, v) => s + (v.fpVal || 0), 0));
      } else if (id.includes("active_minutes")) {
        result.activeMinutes = vals.reduce((s, v) => s + (v.intVal || 0), 0);
      } else if (id.includes("distance")) {
        result.distanceKm = Math.round((vals.reduce((s, v) => s + (v.fpVal || 0), 0) / 1000) * 100) / 100;
      } else if (id.includes("oxygen_saturation")) {
        const spo2 = vals.map((v) => v.fpVal || 0).filter(Boolean);
        if (spo2.length > 0) result.bloodOxygen = Math.round(spo2.reduce((a, b) => a + b, 0) / spo2.length * 10) / 10;
      }
    }
  }
  return result;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// List available providers
router.get("/wearable/providers", requireAuth, async (_req: AuthRequest, res) => {
  const credentialsConfigured = Boolean(GOOGLE_CLIENT_ID);
  res.json({
    providers: PROVIDERS.map((p) => ({
      ...p,
      available: p.id === "manual" ? true : (p.id === "google_fit" ? credentialsConfigured : false),
    })),
    googleFitConfigured: credentialsConfigured,
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

// Get Google Fit OAuth URL
router.get("/wearable/oauth/google-fit/url", requireAuth, async (req: AuthRequest, res) => {
  if (!GOOGLE_CLIENT_ID) {
    res.status(503).json({ error: "Google Fit not configured. Please set GOOGLE_FIT_CLIENT_ID and GOOGLE_FIT_CLIENT_SECRET in environment." });
    return;
  }
  const { returnUrl } = req.query as { returnUrl?: string };
  const state = Buffer.from(JSON.stringify({ userId: req.userId, ts: Date.now(), returnUrl: returnUrl || null })).toString("base64url");
  // Check if user already has a refresh token — if yes, skip forced consent
  const [existing] = await db.select().from(wearableConnectionsTable)
    .where(and(eq(wearableConnectionsTable.userId, req.userId!), eq(wearableConnectionsTable.provider, "google_fit")));
  const needsConsent = !existing?.refreshToken;

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: GOOGLE_SCOPES,
    access_type: "offline",
    ...(needsConsent ? { prompt: "consent" } : { prompt: "select_account" }),
    state,
  });
  res.json({ authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
});

// Google Fit OAuth callback
router.get("/wearable/oauth/google-fit/callback", async (req, res) => {
  const { code, state, error } = req.query as Record<string, string>;
  if (error) {
    // If returnUrl is in state, redirect back to mobile deep link; else fallback
    let returnUrl: string | null = null;
    try { returnUrl = JSON.parse(Buffer.from(state, "base64url").toString()).returnUrl || null; } catch { /* ignore */ }
    const dest = returnUrl ? `${returnUrl}?error=google_fit_denied` : `${APP_URL_BASE}/wearable?error=google_fit_denied`;
    res.redirect(dest);
    return;
  }
  let userId: string;
  let returnUrl: string | null = null;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
    userId = decoded.userId;
    returnUrl = decoded.returnUrl || null;
  } catch {
    res.redirect(`${APP_URL_BASE}/wearable?error=invalid_state`);
    return;
  }
  // Exchange code for tokens
  try {
    const body = new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    });
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", body,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    const tokens = await tokenRes.json() as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
    if (!tokens.access_token) {
      const errDest = returnUrl ? `${returnUrl}?error=token_failed` : `${webBase}/wearable?error=token_failed`;
      res.redirect(errDest);
      return;
    }
    const expiresAt = new Date(Date.now() + ((tokens.expires_in || 3600) * 1000));
    // Upsert connection
    const [existing] = await db.select().from(wearableConnectionsTable)
      .where(and(eq(wearableConnectionsTable.userId, userId), eq(wearableConnectionsTable.provider, "google_fit")));
    if (existing) {
      await db.update(wearableConnectionsTable).set({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || existing.refreshToken,
        tokenExpiresAt: expiresAt, isActive: true, updatedAt: new Date(),
      }).where(eq(wearableConnectionsTable.id, existing.id));
    } else {
      await db.insert(wearableConnectionsTable).values({
        userId, provider: "google_fit",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || null,
        tokenExpiresAt: expiresAt,
        scopes: GOOGLE_SCOPES.split(" "),
        isActive: true,
      });
    }
    // Trigger initial sync
    const conn = await db.select().from(wearableConnectionsTable)
      .where(and(eq(wearableConnectionsTable.userId, userId), eq(wearableConnectionsTable.provider, "google_fit")))
      .then((r) => r[0]);
    if (conn) {
      const endMs = Date.now();
      const startMs = endMs - 7 * 24 * 60 * 60 * 1000; // 7 days
      const fitData = await fetchGoogleFitData(tokens.access_token, startMs, endMs);
      await db.insert(wearableDataTable).values({
        userId, provider: "google_fit",
        recordedAt: new Date(),
        steps: fitData.steps ?? undefined,
        heartRateAvg: fitData.heartRateAvg ?? undefined,
        caloriesBurned: fitData.caloriesBurned?.toString() ?? undefined,
        activeMinutes: fitData.activeMinutes ?? undefined,
        distanceKm: fitData.distanceKm?.toString() ?? undefined,
        bloodOxygen: fitData.bloodOxygen?.toString() ?? undefined,
      });
      await db.update(wearableConnectionsTable)
        .set({ lastSyncedAt: new Date() }).where(eq(wearableConnectionsTable.id, conn.id));
    }
    const successDest = returnUrl ? `${returnUrl}?connected=google_fit` : `${APP_URL_BASE}/wearable?connected=google_fit`;
    res.redirect(successDest);
  } catch (e) {
    console.error("Google Fit callback error:", e);
    const errDest = returnUrl ? `${returnUrl}?error=callback_failed` : `${APP_URL_BASE}/wearable?error=callback_failed`;
    res.redirect(errDest);
  }
});

// Sync latest data from a provider
router.post("/wearable/sync/:provider", requireAuth, async (req: AuthRequest, res) => {
  const provider = String(req.params.provider);
  try {
    const [conn] = await db.select().from(wearableConnectionsTable)
      .where(and(eq(wearableConnectionsTable.userId, req.userId!), eq(wearableConnectionsTable.provider, provider)));
    if (!conn || !conn.isActive) {
      res.status(404).json({ error: "Device not connected" }); return;
    }
    if (provider === "google_fit") {
      const token = await getGoogleToken(conn);
      if (!token) {
        // Use 403 (not 401) so mobile doesn't treat this as user session expiry
        res.status(403).json({ error: "Google Fit session expired. Please reconnect Google Fit.", code: "REAUTH_REQUIRED" });
        return;
      }
      const endMs = Date.now();
      const startMs = endMs - 24 * 60 * 60 * 1000; // Last 24h
      let fitData: Record<string, number | null>;
      try {
        fitData = await fetchGoogleFitData(token, startMs, endMs);
      } catch (fitErr) {
        const msg = fitErr instanceof Error ? fitErr.message : String(fitErr);
        console.error("[Sync] Google Fit fetch failed:", msg);
        // If it's an auth error, try to refresh and retry once
        if (msg.includes("401") || msg.includes("403")) {
          const newToken = await refreshGoogleToken(conn);
          if (newToken) {
            try { fitData = await fetchGoogleFitData(newToken, startMs, endMs); }
            catch {
              // Use 403 (not 401) to avoid triggering user session logout on mobile
              res.status(403).json({ error: "Google Fit auth failed. Please reconnect Google Fit.", code: "REAUTH_REQUIRED" });
              return;
            }
          } else {
            res.status(403).json({ error: "Google Fit access expired. Please reconnect Google Fit.", code: "REAUTH_REQUIRED" });
            return;
          }
        } else {
          res.status(502).json({ error: "Google Fit API unavailable. Try again later.", detail: msg });
          return;
        }
      }
      // Check if any real data was returned
      const hasData = Object.values(fitData).some((v) => v !== null && v !== undefined);
      const [inserted] = await db.insert(wearableDataTable).values({
        userId: req.userId!, provider: "google_fit",
        recordedAt: new Date(),
        steps: fitData.steps ?? undefined,
        heartRateAvg: fitData.heartRateAvg ?? undefined,
        heartRateMin: undefined, heartRateMax: undefined,
        caloriesBurned: fitData.caloriesBurned?.toString() ?? undefined,
        activeMinutes: fitData.activeMinutes ?? undefined,
        distanceKm: fitData.distanceKm?.toString() ?? undefined,
        bloodOxygen: fitData.bloodOxygen?.toString() ?? undefined,
      }).returning();
      await db.update(wearableConnectionsTable)
        .set({ lastSyncedAt: new Date() }).where(eq(wearableConnectionsTable.id, conn.id));
      res.json({
        success: true,
        hasData,
        message: hasData ? "Data synced successfully" : "Synced but no activity recorded in Google Fit today. Open Google Fit app and record some activity.",
        data: inserted,
      });
    } else {
      res.status(400).json({ error: `${provider} sync not yet supported` });
    }
  } catch (e) {
    console.error("Sync error:", e);
    res.status(500).json({ error: "Sync failed", detail: e instanceof Error ? e.message : String(e) });
  }
});

// Get wearable data (latest or date range)
router.get("/wearable/data", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { provider, from, to, limit = "30" } = req.query as Record<string, string>;
    let query = db.select().from(wearableDataTable)
      .where(eq(wearableDataTable.userId, req.userId!))
      .orderBy(desc(wearableDataTable.recordedAt))
      .limit(parseInt(limit));
    const data = await query;
    // Latest record
    const latest = data[0] || null;
    // 7-day aggregated
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recent = data.filter((d) => d.recordedAt >= sevenDaysAgo);
    const avgSteps = recent.length > 0 ? Math.round(recent.reduce((s, d) => s + (d.steps || 0), 0) / recent.length) : null;
    const avgHr = recent.length > 0 ? Math.round(recent.filter((d) => d.heartRateAvg).reduce((s, d) => s + (d.heartRateAvg || 0), 0) / (recent.filter((d) => d.heartRateAvg).length || 1)) : null;
    const totalCalories = recent.reduce((s, d) => s + parseFloat(d.caloriesBurned || "0"), 0);
    const totalActiveMin = recent.reduce((s, d) => s + (d.activeMinutes || 0), 0);
    const avgSleep = recent.length > 0 ? Math.round((recent.filter((d) => d.sleepHours).reduce((s, d) => s + parseFloat(d.sleepHours || "0"), 0) / (recent.filter((d) => d.sleepHours).length || 1)) * 10) / 10 : null;
    const avgSpo2 = recent.filter((d) => d.bloodOxygen).length > 0
      ? Math.round(recent.filter((d) => d.bloodOxygen).reduce((s, d) => s + parseFloat(d.bloodOxygen || "0"), 0) / recent.filter((d) => d.bloodOxygen).length * 10) / 10 : null;
    res.json({
      latest,
      history: data,
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
