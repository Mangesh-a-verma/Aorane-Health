import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  StatusBar, ActivityIndicator, Alert, Dimensions,
} from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { router, useFocusEffect } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import { api } from "@/lib/api";
import { smartSync } from "@/lib/health/syncManager";
import { buildHealthReport } from "@/lib/reports/buildHealthReport";
import { ReportData, ReportType } from "@/lib/reports/reportTypes";
import { HealthReportSummary } from "@/components/HealthReportSummary";
// NOTE: Logo is intentionally NOT imported here — logo shows in PDF only, not in screen header

const { height: SCREEN_H } = Dimensions.get("window");

// ─── Date Helpers ─────────────────────────────────────────────────────────────

function getLocalISODate(d: Date): string {
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().split("T")[0];
}

function getSeason(): "summer" | "monsoon" | "winter" | "spring" {
  const m = new Date().getMonth() + 1;
  if (m >= 3 && m <= 5) return "summer";
  if (m >= 6 && m <= 9) return "monsoon";
  if (m >= 10 && m <= 11) return "spring";
  return "winter";
}

/** Stable report ID — same inputs = same ID, so cached report IDs don't change */
function makeReportId(aoraneId: string | undefined, from: Date, to: Date): string {
  const uid = (aoraneId ?? "ANON").slice(-4).toUpperCase();
  const d1  = getLocalISODate(from).replace(/-/g, "");
  const d2  = getLocalISODate(to).replace(/-/g, "");
  const str = `${uid}${d1}${d2}`;
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return `HR-${d2}-${uid}-${Math.abs(h).toString(16).toUpperCase().slice(0, 4).padStart(4, "0")}`;
}

function getDateRange(type: ReportType): { from: Date; to: Date; days: number } {
  const now = new Date();
  const to  = new Date(now);
  if (type === "weekly") {
    const from = new Date(now);
    from.setDate(now.getDate() - 6);  // Last 7 days
    return { from, to, days: 7 };
  }
  // Monthly: 1st of current month → today
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const days = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return { from, to, days };
}

function calcGoalProgress(
  goalType: string,
  currentWeight: number | null,
  targetWeight: number | null,
  startWeight?: number | null
): number {
  if (!currentWeight || !targetWeight) return 0;
  if (goalType === "maintain") return 100;
  const start = startWeight ?? (goalType === "lose_weight" ? targetWeight + 10 : targetWeight - 10);
  const totalChange = Math.abs(start - targetWeight);
  const currentChange = Math.abs(start - currentWeight);
  if (totalChange === 0) return 0;
  return Math.min(100, Math.round((currentChange / totalChange) * 100));
}

// ─── Report Cache Helpers ─────────────────────────────────────────────────────
// Weekly report: cached for 7 days (new one next Monday)
// Monthly report: cached for the entire month
// Users can VIEW cached report unlimited times; generation is limited.

// ─── Report Cache Helpers (SECURE ENCRYPTED) ──────────────────────────────────
// Weekly report: cached for 7 days (new one next Monday)
// Monthly report: cached for the entire month
// FIX CB4 (updated): the encryption key is no longer a hardcoded string baked
// into every install of the app (which meant the same key could decrypt
// every user's cache). It's now a random 32-byte key generated once per
// install and stored in the device's secure keychain/keystore via
// expo-secure-store. SecureStore itself isn't used for the report data
// (its Keychain-backed storage has a practical ~2KB size limit unsuitable
// for a full JSON health report) — only for this small key, which is then
// used to obfuscate the actual report JSON stored in AsyncStorage. This is
// the standard "key-in-secure-storage, bulk-data-elsewhere" mobile pattern.

const CACHE_PREFIX = "health_report_v2_";
const SECURE_KEY_STORAGE_NAME = "aorane_report_cache_key_v1";

let _cachedKey: string | null = null;

/** Get (or lazily create) the per-install random cache key, from SecureStore. */
async function getOrCreateCacheKey(): Promise<string> {
  if (_cachedKey) return _cachedKey;
  try {
    const existing = await SecureStore.getItemAsync(SECURE_KEY_STORAGE_NAME);
    if (existing) {
      _cachedKey = existing;
      return existing;
    }
    const randomBytes = await Crypto.getRandomBytesAsync(32);
    const newKey = Array.from(randomBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    await SecureStore.setItemAsync(SECURE_KEY_STORAGE_NAME, newKey);
    _cachedKey = newKey;
    return newKey;
  } catch {
    // SecureStore unavailable for some reason — fall back to an in-memory-only
    // key for this session. Cache will simply miss on next app launch, which
    // is safe (just triggers a fresh API fetch), never a crash.
    if (!_cachedKey) {
      const randomBytes = await Crypto.getRandomBytesAsync(32);
      _cachedKey = Array.from(randomBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    return _cachedKey;
  }
}

// Obfuscation so large JSON isn't stored as readable plaintext in AsyncStorage.
// Keyed with the random per-install secret above (not a hardcoded string).
async function encryptData(text: string): Promise<string> {
  const key = await getOrCreateCacheKey();
  let result = "";
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result.split('').map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
}

async function decryptData(hexStr: string): Promise<string> {
  const key = await getOrCreateCacheKey();
  let xorStr = "";
  for (let i = 0; i < hexStr.length; i += 2) {
    xorStr += String.fromCharCode(parseInt(hexStr.substring(i, i + 2), 16));
  }
  let result = "";
  for (let i = 0; i < xorStr.length; i++) {
    result += String.fromCharCode(xorStr.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

function getCacheKey(type: ReportType, userId: string): string {
  const now = new Date();
  if (type === "weekly") {
    const day  = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const mon  = new Date(now.getFullYear(), now.getMonth(), diff);
    return `${CACHE_PREFIX}weekly_${userId}_${getLocalISODate(mon)}`;
  }
  return `${CACHE_PREFIX}monthly_${userId}_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// ── Previous-period cache key (for "vs last week / vs last month" % change) ──
// Same key scheme as getCacheKey, but anchored one period earlier. Since each
// week/month already gets its own stable cache key (and that cache persists
// until overwritten by a new period's fresh fetch), reading this key lets us
// compare the current period's score against the previous period's cached
// score WITHOUT needing a new API call or a new storage table.
function getPreviousPeriodCacheKey(type: ReportType, userId: string): string {
  const now = new Date();
  if (type === "weekly") {
    const day  = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const thisMonday = new Date(now.getFullYear(), now.getMonth(), diff);
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);
    return `${CACHE_PREFIX}weekly_${userId}_${getLocalISODate(lastMonday)}`;
  }
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${CACHE_PREFIX}monthly_${userId}_${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}`;
}

async function getCachedReport(key: string): Promise<ReportData | null> {
  try {
    const rawData = await AsyncStorage.getItem(key);
    if (!rawData) return null;
    
    let parsed;
    try {
      // 1. Try decrypting with the current secure key (normal case)
      const decryptedText = await decryptData(rawData);
      parsed = JSON.parse(decryptedText);
    } catch (e) {
      // 2. Falls back to raw JSON.parse — covers both legacy plaintext
      //    caches from before encryption was added, AND caches written
      //    with an old key that this key can no longer decrypt (e.g. right
      //    after this security update ships). Either way, a parse failure
      //    here just means a genuine cache miss, handled below.
      parsed = JSON.parse(rawData);
    }

    // Restore Date objects (JSON.parse loses them)
    parsed.generatedAt = new Date(parsed.generatedAt);
    parsed.dateFrom    = new Date(parsed.dateFrom);
    parsed.dateTo      = new Date(parsed.dateTo);
    return parsed as ReportData;
  } catch {
    return null;
  }
}

async function setCachedReport(key: string, data: ReportData): Promise<void> {
  try {
    const jsonStr = JSON.stringify(data);
    const secureHex = await encryptData(jsonStr); // Encrypt with the per-install secure key before writing to disk
    await AsyncStorage.setItem(key, secureHex);
  } catch { /* storage full — ignore */ }
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HealthReportScreen() {
  const insets     = useSafeAreaInsets();
  const [reportType, setReportType] = useState<ReportType>("weekly");
  const [loading,    setLoading]    = useState(true);
  const [generating, setGenerating] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [previousPeriodScore, setPreviousPeriodScore] = useState<number | null>(null);
  // "summary" = native dashboard-style view (default). "detailed" = full
  // WebView-rendered PDF preview, opened on demand via "View Detailed Report".
  const [viewMode, setViewMode] = useState<"summary" | "detailed">("summary");
  const [isCached,   setIsCached]   = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const webViewRef = useRef<WebView>(null);
  const dateRange  = useMemo(() => getDateRange(reportType), [reportType]);

  // "+8% vs last week" style change. null when there's no previous-period
  // data yet (first report ever, or cache was cleared) — UI hides the chip
  // in that case rather than showing a misleading 0%/—.
  const weeklyChangePercent = useMemo(() => {
    const current = reportData?.scores?.periodAvgScore;
    if (current == null || previousPeriodScore == null || previousPeriodScore === 0) return null;
    return Math.round(((current - previousPeriodScore) / previousPeriodScore) * 100);
  }, [reportData, previousPeriodScore]);

  // ── Load Data ─────────────────────────────────────────────────────────────
  // `forceRefresh`  — skip cache and hit the API (used by the manual refresh button).
  // `silent`        — used for background re-validation: don't flip the
  //                   full-screen `loading` flag (which would hide already-
  //                   visible cached content), just swap in fresh data once
  //                   it arrives. Used by the focus-revalidation effect below
  //                   so reopening the screen after logging new data updates
  //                   the report without a jarring reload flash.
  const loadData = useCallback(async (forceRefresh = false, silent = false) => {
    if (!silent) setLoading(true);
    setError(null);

    try {
      // 1. Try cache first (unless forced refresh)
      const sc0 = await (api.getScorecard() as Promise<any>).catch(() => null);
      const userId = sc0?.aoraneId ?? "user";
      const cacheKey = getCacheKey(reportType, userId);

      // Best-effort: read the previous period's cached report (if any) to compute
      // "vs last week / vs last month" % change. Safe to fail silently — the
      // weekly-change UI simply hides itself if this isn't available yet
      // (e.g. user's very first report, or cache was cleared).
      getCachedReport(getPreviousPeriodCacheKey(reportType, userId))
        .then((prev) => setPreviousPeriodScore(prev?.scores?.periodAvgScore ?? null))
        .catch(() => setPreviousPeriodScore(null));

      if (!forceRefresh) {
        const cached = await getCachedReport(cacheKey);
        if (cached) {
          setReportData(cached);
          setIsCached(true);
          if (!silent) setLoading(false);
          return;
        }
      }

      // 2. Fresh fetch — use period-aware API endpoints
      const startDate = getLocalISODate(dateRange.from);
      const endDate   = getLocalISODate(dateRange.to);
      const numDays   = dateRange.days;

      // Period-aware API calls
      // Weekly: use existing weekly endpoints
      // Monthly: use monthly endpoints if available, else fallback gracefully
      const isMonthly = reportType === "monthly";

      // ✅ FIX: `getWeeklyHealthLogs` / `getMonthlyHealthLogs` referenced below
      // do NOT exist anywhere in lib/api.ts or the backend (verified against
      // the api-server routes) — they were always `undefined`, so `wl` was
      // always `null` and periodAvgScore / pillar %s / dailyLogs were always
      // empty (silently falling back to "today only"). The only endpoint
      // that actually returns a full per-day breakdown is
      // `GET /health/score/:date` (api.getHealthScore), so we fetch it once
      // per day in the period — in small batches rather than all at once,
      // since `computeDailyScore` runs ~16 DB queries server-side per call;
      // firing all 30 days of a monthly report simultaneously would mean
      // ~480 queries in one burst, which can strain the backend and time
      // out on slower mobile connections.
      const periodDates = Array.from({ length: numDays }, (_, i) => {
        const d = new Date(dateRange.from);
        d.setDate(dateRange.from.getDate() + i);
        return getLocalISODate(d);
      });

      const BATCH_SIZE = 6;
      async function fetchScoresBatched(dates: string[]) {
        const results: PromiseSettledResult<any>[] = [];
        for (let i = 0; i < dates.length; i += BATCH_SIZE) {
          const batch = dates.slice(i, i + BATCH_SIZE);
          const batchResults = await Promise.allSettled(batch.map((d) => api.getHealthScore(d)));
          results.push(...batchResults);
        }
        return results;
      }

      const [
        rScorecard, rProfile, rDailyScores, rNut, rStress, rCompany,
      ] = await Promise.allSettled([
        api.getScorecard(),
        api.getProfile(),
        // Real per-day score+breakdown fetch (replaces the non-existent
        // getWeeklyHealthLogs/getMonthlyHealthLogs ghost calls), batched.
        fetchScoresBatched(periodDates),
        // Nutrition: monthly totals vs weekly totals
        isMonthly && (api as any).getMonthlyFoodNutrition
          ? (api as any).getMonthlyFoodNutrition(startDate, endDate)
          : api.getWeeklyFoodNutrition(),
        // Stress: per-day lookup table built from the weekly endpoint.
        // NOTE: there is no monthly stress endpoint on the backend yet, so
        // monthly reports currently only get stress data for the last 7
        // days within the period (see "Known limitation" below this block).
        api.getStressWeekly(),
        api.getCompanySettings(),
      ]);

      const sc  = rScorecard.status === "fulfilled" ? (rScorecard.value as any) : null;
      const pr  = rProfile.status   === "fulfilled" ? ((rProfile.value as any)?.profile ?? null) : null;
      const dailyScoreResults = rDailyScores.status === "fulfilled"
        ? (rDailyScores.value as PromiseSettledResult<any>[])
        : [];
      // Map of date -> score object, only for days that actually returned data
      // with a non-zero confidence (computeDailyScore returns a zeroed
      // placeholder object on error/no-data, not a rejection — see backend
      // health.ts catch block — so we treat dataConfidence === 0 as "no log").
      const scoreByDate = new Map<string, any>();
      dailyScoreResults.forEach((r, i) => {
        if (r.status === "fulfilled") {
          const s = (r.value as any)?.score;
          if (s && (s.dataConfidence ?? 0) > 0) scoreByDate.set(periodDates[i], s);
        }
      });
      const nut = rNut.status       === "fulfilled" ? (rNut.value as any) : null;
      const str = rStress.status    === "fulfilled" ? (rStress.value as any) : null;
      const co  = rCompany.status   === "fulfilled" ? ((rCompany.value as any)?.settings ?? null) : null;
      const stressByDate = new Map<string, number>(
        (str?.days || []).map((d: any) => [d.date, d.avgScore])
      );

      // ── Build dailyLogs array for the period ──────────────────────────
      // ✅ FIX: now sourced from `scoreByDate` (real api.getHealthScore() per
      // day), reading the nested food/exercise/water/medicine/sleep objects
      // that computeDailyScore() on the backend actually returns — these
      // field names match the backend's computeDailyScore() shape exactly
      // (see api-server/src/routes/modules/health.ts), NOT the flat
      // snake_case `daily_health_scores` table columns the old code assumed.
      const dailyLogs = Array.from({ length: numDays }, (_, i) => {
        const d = new Date(dateRange.from);
        d.setDate(dateRange.from.getDate() + i);
        const dateStr  = getLocalISODate(d);
        const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const log = scoreByDate.get(dateStr) ?? null;

        return {
          date:            dateStr,
          dayName:         dayNames[d.getDay()],
          healthScore:     log?.healthScore                 ?? 0,
          stressLevel:     stressByDate.get(dateStr)         ?? 0,
          waterGlasses:    log?.water?.glasses               ?? 0,
          caloriesIn:      Number(log?.food?.calories ?? 0),
          caloriesBurned:  Number(log?.exercise?.caloriesBurned ?? 0),
          exerciseMinutes: log?.exercise?.durationMinutes    ?? 0,
          sleepHours:      log?.sleep?.hoursLogged           ?? 0,
          medicinesTaken:  log?.medicine?.taken              ?? 0,
          medicinesTotal:  log?.medicine?.scheduled          ?? 0,
        };
      });

      // ── Period-aware score calculations ───────────────────────────────
      const validLogs  = dailyLogs.filter(l => l.healthScore > 0);
      const validCount = validLogs.length || 1;

      // FIX: Period average score (7-day or 30-day) — NOT today's score
      const periodAvgScore = validLogs.length
        ? Math.round(validLogs.reduce((s, l) => s + l.healthScore, 0) / validCount)
        : (sc?.healthScore ?? 0);

      // FIX: Period-computed active percentages from actual logs
      const logsWithFood  = dailyLogs.filter(l => l.caloriesIn > 0);
      const logsWithWater = dailyLogs.filter(l => l.waterGlasses > 0);
      const logsWithEx    = dailyLogs.filter(l => l.exerciseMinutes > 0);
      const logsWithSleep = dailyLogs.filter(l => l.sleepHours > 0);
      const logsWithStress = dailyLogs.filter(l => l.stressLevel > 0);

      // Active % = how many days did they log / total days
      const foodPct     = Math.round((logsWithFood.length  / numDays) * 100);
      const waterPct    = Math.round((logsWithWater.length / numDays) * 100);
      const exercisePct = Math.round((logsWithEx.length    / numDays) * 100);
      const sleepPct    = Math.round((logsWithSleep.length / numDays) * 100);
      // Stress %: inverted (lower stress = higher score)
      const avgStressRaw = logsWithStress.length
        ? logsWithStress.reduce((s, l) => s + l.stressLevel, 0) / logsWithStress.length
        : 0;
      const stressPct = logsWithStress.length ? Math.max(0, 100 - Math.round(avgStressRaw)) : 0;

      const activePercent = Math.round((foodPct + waterPct + exercisePct + sleepPct) / 4);

      // Medicine compliance
      const medsTaken = dailyLogs.reduce((s, l) => s + (l.medicinesTaken || 0), 0);
      const medsTotal = dailyLogs.reduce((s, l) => s + (l.medicinesTotal || 0), 0);
      // FIX: medsTotal=0 means no medication scheduled (no data), not perfect compliance
      // Return 0 so the health score is not inflated and the report shows "not tracked"
      const medicinePct = medsTotal > 0 ? Math.round((medsTaken / medsTotal) * 100) : 0;

      // Average calories consumed in the period
      const calLogs = dailyLogs.filter(l => l.caloriesIn > 0);
      const avgCal  = calLogs.length
        ? Math.round(calLogs.reduce((s, l) => s + l.caloriesIn, 0) / calLogs.length)
        : 0;

      // ── Nutrition period-aware targets ────────────────────────────────
      // FIX: Targets scale with period (7 days vs ~30 days)
      const weightKg     = pr?.weight_kg ? Number(pr.weight_kg) : 70;
      const dailyProtein = weightKg * 1.2;
      const targetMultiplier = numDays; // 7 or ~30

      // FIX: Nutrition totals — try monthly fields if available
      const nutTotals = nut?.monthlyTotals ?? nut?.weeklyTotals ?? {};

      // ── Risks — period-aware ──────────────────────────────────────────
      const avgWaterGlasses = logsWithWater.length
        ? logsWithWater.reduce((s, l) => s + l.waterGlasses, 0) / logsWithWater.length
        : 0;

      const hydrationScore  = Math.min(100, Math.round((avgWaterGlasses / 8) * 100));
      const nutritionScore  = foodPct;
      const stressScoreVal  = logsWithStress.length ? Math.round(avgStressRaw) : 0;

      const hydrationRisk: "Low" | "Moderate" | "High" =
        hydrationScore >= 70 ? "Low" : hydrationScore >= 40 ? "Moderate" : "High";
      const nutritionRisk: "Low" | "Moderate" | "High" =
        nutritionScore >= 70 ? "Low" : nutritionScore >= 40 ? "Moderate" : "High";
      const stressRisk: "Low" | "Moderate" | "High" =
        stressScoreVal < 30 ? "Low" : stressScoreVal < 60 ? "Moderate" : "High";

      // ── Goals ────────────────────────────────────────────────────────
      const currentW = pr?.weight_kg    ? Number(pr.weight_kg)    : null;
      const targetW  = pr?.target_weight_kg ? Number(pr.target_weight_kg) : null;
      const goalType = pr?.health_goal ?? "maintain";
      const progressPct = calcGoalProgress(goalType, currentW, targetW);

      const now = new Date();

      // ── Assemble ReportData ───────────────────────────────────────────
      const data: ReportData = {
        generatedAt: now,
        reportId: makeReportId(sc?.aoraneId, dateRange.from, dateRange.to),
        reportType,
        dateFrom: dateRange.from,
        dateTo:   dateRange.to,
        periodDays: numDays,

        profile: {
          name:        sc?.name        ?? pr?.full_name ?? "—",
          aoraneId:    sc?.aoraneId    ?? "—",
          age:         sc?.age         ?? null,
          gender:      sc?.gender      ?? "—",
          height_cm:   pr?.height_cm   ? Number(pr.height_cm) : null,
          weight_kg:   pr?.weight_kg   ? Number(pr.weight_kg) : null,
          bmi:         sc?.bmi         ?? null,
          bmiCategory: sc?.bmiCategory ?? null,
          bloodGroup:  sc?.bloodGroup  ?? "—",
          plan:        sc?.plan        ?? "FREE",
          memberSince: sc?.memberSince ?? "",
          city:        pr?.city        ?? sc?.city  ?? null,
          state:       pr?.state       ?? sc?.state ?? null,
          conditions:  pr?.medical_conditions ?? null,
        },

        scores: {
          // FIX: No todayScore — only period average
          periodAvgScore,
          activePercent,
          foodPct,
          waterPct,
          exercisePct,
          sleepPct,
          stressPct,
          medicinePct,
          streakDays: pr?.streak_days ?? sc?.streakDays ?? 0,
        },

        risks: {
          hydrationRisk, nutritionRisk, stressRisk,
          hydrationScore, nutritionScore,
          stressScore: stressScoreVal,
        },

        dailyLogs,

        nutrition: {
          protein_g:      nutTotals?.totalProteinG     ? Math.round(nutTotals.totalProteinG)     : 0,
          carbs_g:        nutTotals?.totalCarbsG       ? Math.round(nutTotals.totalCarbsG)       : 0,
          fat_g:          nutTotals?.totalFatG         ? Math.round(nutTotals.totalFatG)         : 0,
          fiber_g:        nutTotals?.totalFiberG       ? Math.round(nutTotals.totalFiberG)       : 0,
          calcium_mg:     nutTotals?.totalCalciumMg    ? Math.round(nutTotals.totalCalciumMg)    : 0,
          iron_mg:        nutTotals?.totalIronMg       ? Math.round(nutTotals.totalIronMg * 10) / 10 : 0,
          vitaminC_mg:    nutTotals?.totalVitaminCMg   ? Math.round(nutTotals.totalVitaminCMg)   : 0,
          vitaminB12_mcg: nutTotals?.totalVitaminB12Mcg ? Math.round(nutTotals.totalVitaminB12Mcg * 100) / 100 : 0,
          vitaminD_mcg: 0,
          // FIX: Period-scaled targets
          targets: {
            protein_g:      Math.round(dailyProtein * targetMultiplier),
            carbs_g:        Math.round(300 * targetMultiplier),
            fat_g:          Math.round(70  * targetMultiplier),
            calcium_mg:     Math.round(1000 * targetMultiplier),
            iron_mg:        Math.round(18   * targetMultiplier),
            vitaminC_mg:    Math.round(65   * targetMultiplier),
            vitaminB12_mcg: Math.round(2.4  * targetMultiplier * 100) / 100,
          },
        },

        goals: {
          goalType,
          targetWeight:       targetW,
          currentWeight:      currentW,
          targetCalories:     pr?.target_calories ?? 2000,
          currentAvgCalories: avgCal,
          progressPercent:    progressPct,
          daysToGoal:         null,
          weeklyTrend:        periodAvgScore > 65 ? "improving" : periodAvgScore > 50 ? "stable" : "declining",
        },

        weather: {
          season: getSeason(),
          city: pr?.city ?? sc?.city ?? null,
        },

        companyName:  co?.companyName  ?? "Aorane Health",
        primaryColor: co?.primaryColor ?? "#0077B6",
        accentColor:  co?.accentColor  ?? "#00B896",
      };

      // ── Cache the generated report ────────────────────────────────────
      await setCachedReport(cacheKey, data);
      setReportData(data);
      setIsCached(false);

    } catch (e) {
      console.error("Report load error:", e);
      // Silent background refreshes fail quietly — the user already has
      // cached content visible, so don't replace it with an error screen.
      if (!silent) {
        setError("Unable to load the health report. Please check your connection and try again.");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [dateRange, reportType]);

  // Load on mount and when report type changes
  useEffect(() => { loadData(false); }, [loadData]);

  // ── Background revalidation on screen focus ─────────────────────────────
  // User ne app mein kahin data log kiya aur wapas aaya — cached report stale
  // ho sakta hai. Lekin WEEKLY/MONTHLY report sirf ek baar generate honi chahiye.
  // RULE: Cache check karo — agar cache mein hai toh kuch mat karo (sirf display).
  //       Agar cache empty hai tab hi fresh fetch karo (silent=true, loading flash nahi).
  //       forceRefresh=false — cache ko KABHI bypass mat karo on focus.
  const hasMountedRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!hasMountedRef.current) {
        hasMountedRef.current = true;
        return;
      }
      // Cooldown-respecting sync (no-op if synced within the last 4h) so the
      // report reflects the freshest Health Connect data without the user
      // ever needing a manual sync button. Fire-and-forget — loadData()
      // below reads whatever the backend already has; if this sync lands
      // new data, the next focus/regeneration will pick it up.
      smartSync().catch(() => {});
      // silent revalidation — cache milne par kuch nahi hoga (isCached=true wala branch)
      // Sirf tab fresh fetch hogi jab is week/month ki report cache mein nahi ho
      loadData(false, true); // forceRefresh=false (respect cache), silent=true (no loading flash)
    }, [loadData])
  );

  // ── Refresh (force regenerate) ────────────────────────────────────────────
  // IMPORTANT: Report once per week / once per month policy.
  // Refresh button = "Regenerate" — always ask for confirmation.
  // Normal usage: user downloads/views the cached report as many times as they want.
  const handleRefresh = () => {
    const nextLabel = reportType === "weekly" ? "next Monday" : "next month";
    Alert.alert(
      "Regenerate Report?",
      `Your ${reportType} report has already been generated for this period. A new one auto-generates ${nextLabel}.\n\nForce regenerating now will use an AI call. Continue?`,
      [
        { text: "View Current", style: "cancel" },
        { text: "Regenerate", style: "destructive", onPress: () => loadData(true) },
      ],
    );
  };

  // ── PDF Export ────────────────────────────────────────────────────────────
  // PDF file naam = ReportID (e.g. "HR-20260627-AZ24-47E7.pdf")
  // Agar ReportID nahi hai toh AoraneID use karo, warna default naam.
  const exportPDF = async (action: "download" | "share") => {
    if (!reportData || generating) return;
    setGenerating(true);
    try {
      const html = buildHealthReport(reportData);
      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      });

      // ── PDF ka naam ReportID ya AoraneID se banao ──
      // Priority: reportId > aoraneId > default
      const fileLabel =
        reportData.reportId?.replace(/[^a-zA-Z0-9_\-]/g, "_") ||
        reportData.profile?.aoraneId?.replace(/[^a-zA-Z0-9_\-]/g, "_") ||
        `Aorane_${reportType}_Report`;
      const pdfFileName = `${fileLabel}.pdf`;

      // expo-print saves to a temp path like .../ExpoExperienceData/.../tmp/print-XXXX.pdf
      // We rename/copy it so the Share sheet shows the correct filename.
      const destUri = `${FileSystem.cacheDirectory}${pdfFileName}`;
      await FileSystem.copyAsync({ from: uri, to: destUri });

      const shareOptions = {
        mimeType: "application/pdf" as const,
        dialogTitle: `${reportData.profile.name} — ${reportType === "weekly" ? "Weekly" : "Monthly"} Health Report`,
        UTI: "com.adobe.pdf",
      };
      if (action === "share") {
        await Sharing.shareAsync(destUri, shareOptions);
      } else {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(destUri, { ...shareOptions, dialogTitle: "Save Health Report" });
        } else {
          await Print.printAsync({ uri: destUri });
        }
      }
    } catch {
      Alert.alert("Error", "Failed to generate PDF. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const onWebViewMessage = useCallback((event: any) => {
    const h = parseInt(event.nativeEvent.data, 10);
    if (!isNaN(h) && h > 100) { /* WebView auto-sizes via flex:1 */ }
  }, []);

  const injectedJs = `
    (function() {
      var h = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
      window.ReactNativeWebView.postMessage(String(h));
    })(); true;
  `;

  const P = reportData?.primaryColor ?? "#0077B6";
  const A = reportData?.accentColor  ?? "#00B896";

  const periodLabel = reportType === "weekly" ? "Weekly" : "Monthly";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#EEF4FB" }}>
      <StatusBar barStyle="dark-content" />

      {/* ── Header ── */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => (viewMode === "detailed" ? setViewMode("summary") : router.back())}
          style={s.iconBtn}
        >
          <Ionicons name="arrow-back" size={18} color={P} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title} numberOfLines={1}>
            {viewMode === "detailed" ? "Detailed Report" : "Health Report"}
          </Text>
          <Text style={s.subtitle} numberOfLines={1}>
            {reportData
              ? `${getLocalISODate(dateRange.from)} — ${getLocalISODate(dateRange.to)}${isCached ? " (Saved)" : ""}`
              : "Loading…"}
          </Text>
        </View>
        <TouchableOpacity onPress={handleRefresh} style={s.iconBtn} disabled={loading}>
          {loading
            ? <ActivityIndicator size="small" color={P} />
            : <Ionicons name="refresh" size={16} color={P} />}
        </TouchableOpacity>
      </View>

      {/* ── Weekly / Monthly Toggle (summary view only — detailed view is read-only PDF preview) ── */}
      {viewMode === "summary" && (
      <View style={[s.toggleWrap, { borderColor: P + "25" }]}>
        {(["weekly", "monthly"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setReportType(t)}
            style={[s.toggleBtn, reportType === t && { backgroundColor: P }]}
            disabled={loading}
          >
            <Ionicons
              name={t === "weekly" ? "calendar-outline" : "calendar"}
              size={13}
              color={reportType === t ? "#fff" : "#9CA3AF"}
            />
            <Text style={[s.toggleTxt, reportType === t && { color: "#fff" }]}>
              {t === "weekly" ? "Weekly" : "Monthly"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      )}

      {/* ── Cached Notice Banner (summary view only) ── */}
      {viewMode === "summary" && isCached && !loading && (
        <View style={[s.cachedBanner, { backgroundColor: A + "18", borderColor: A + "40" }]}>
          <Ionicons name="checkmark-circle" size={14} color={A} />
          <Text style={[s.cachedTxt, { color: A }]}>
            {reportType === "weekly"
              ? "Showing your saved weekly report. New one auto-generates next Monday."
              : "Showing your saved monthly report. New one generates next month."}
          </Text>
        </View>
      )}

      {/* ── Main Content ── */}
      {loading ? (
        <View style={s.centerWrap}>
          <ActivityIndicator size="large" color={P} />
          <Text style={[s.loadingTxt, { color: P }]}>Analyzing Your Health Data…</Text>
          <Text style={s.loadingSubTxt}>Building your {periodLabel} Report</Text>
        </View>
      ) : error ? (
        <View style={s.centerWrap}>
          <View style={s.errorBox}>
            <Ionicons name="alert-circle" size={40} color="#DC2626" />
            <Text style={s.errorTitle}>Something went wrong</Text>
            <Text style={s.errorMsg}>{error}</Text>
            <TouchableOpacity style={[s.retryBtn, { backgroundColor: P }]} onPress={() => loadData(false)}>
              <Ionicons name="refresh" size={16} color="#fff" />
              <Text style={s.retryTxt}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : reportData ? (
        viewMode === "summary" ? (
          <HealthReportSummary
            data={reportData}
            weeklyChangePercent={weeklyChangePercent}
            primaryColor={P}
            accentColor={A}
            onViewDetailed={() => setViewMode("detailed")}
            onDownloadPdf={() => exportPDF("download")}
            onSharePdf={() => exportPDF("share")}
            generating={generating}
          />
        ) : (
          <View style={{ flex: 1 }}>
            <WebView
              ref={webViewRef}
              source={{ html: buildHealthReport(reportData) }}
              style={s.webview}
              scalesPageToFit={false}
              originWhitelist={["*"]}
              showsVerticalScrollIndicator={true}
              scrollEnabled={true}
              bounces={true}
              onMessage={onWebViewMessage}
              injectedJavaScript={injectedJs}
              onLoadEnd={() => webViewRef.current?.injectJavaScript(injectedJs)}
            />

            {/* ── Action Buttons ── */}
            <View style={[s.actionBar, { paddingBottom: insets.bottom + 8 }]}>
              <TouchableOpacity
                style={[s.btn, { backgroundColor: P }]}
                onPress={() => exportPDF("download")}
                disabled={generating}
                activeOpacity={0.85}
              >
                {generating
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="download-outline" size={18} color="#fff" />}
                <Text style={s.btnTxt}>{generating ? "Generating…" : "Download PDF"}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.btn, { backgroundColor: A }]}
                onPress={() => exportPDF("share")}
                disabled={generating}
                activeOpacity={0.85}
              >
                {generating
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="share-social-outline" size={18} color="#fff" />}
                <Text style={s.btnTxt}>Share PDF</Text>
              </TouchableOpacity>
            </View>
          </View>
        )
      ) : null}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 14, paddingBottom: 10, backgroundColor: "#EEF4FB",
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5EFF7",
    alignItems: "center", justifyContent: "center",
  },
  title:    { fontSize: 20, fontWeight: "800", color: "#0D1F33" },
  subtitle: { fontSize: 11, color: "#9CA3AF", marginTop: 1 },
  toggleWrap: {
    flexDirection: "row", backgroundColor: "#fff", borderRadius: 14,
    padding: 4, marginHorizontal: 14, marginBottom: 6,
    borderWidth: 1, gap: 4,
  },
  toggleBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 11,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
  },
  toggleTxt: { fontSize: 13, fontWeight: "700", color: "#9CA3AF" },

  cachedBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 14, marginBottom: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1,
  },
  cachedTxt: { flex: 1, fontSize: 11, fontWeight: "600" },

  centerWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 24 },
  loadingTxt:    { fontSize: 14, fontWeight: "700", marginTop: 8 },
  loadingSubTxt: { fontSize: 12, color: "#9CA3AF", textAlign: "center" },
  errorBox: {
    backgroundColor: "#fff", borderRadius: 16, padding: 24,
    alignItems: "center", gap: 10, width: "100%",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 16, elevation: 4,
  },
  errorTitle: { fontSize: 16, fontWeight: "800", color: "#0D1F33" },
  errorMsg:   { fontSize: 13, color: "#6B7280", textAlign: "center", lineHeight: 18 },
  retryBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, marginTop: 4,
  },
  retryTxt: { color: "#fff", fontSize: 14, fontWeight: "700" },
  webview: { flex: 1, backgroundColor: "#EEF4FB" },
  actionBar: {
    flexDirection: "row", gap: 10, paddingHorizontal: 14, paddingTop: 10,
    backgroundColor: "#fff", borderTopWidth: 1, borderColor: "#E5EFF7",
    shadowColor: "#000", shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 8,
  },
  btn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14,
  },
  btnTxt: { color: "#fff", fontWeight: "700", fontSize: 14 },
});