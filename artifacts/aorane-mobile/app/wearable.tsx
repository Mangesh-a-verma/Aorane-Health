import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, Alert, ActivityIndicator, Modal,
  TextInput, RefreshControl, Linking, AppState,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Polyline } from "react-native-svg";
import { api } from "@/lib/api";
import { DS } from "@/lib/theme";
import { logSilentError } from "@/lib/silentCatch";
import { checkConnectionStatus, connectAndSync, forceSync } from "@/lib/health/syncManager";
import { providerMeta, visibleProviders } from "@/lib/wearableProviders";

// ─── Types ────────────────────────────────────────────────────────────────────
type WearableData = {
  steps: number | null; heartRateAvg: number | null; heartRateMin: number | null;
  heartRateMax: number | null; caloriesBurned: string | null; sleepHours: string | null;
  bloodOxygen: string | null; activeMinutes: number | null; distanceKm: string | null;
  provider: string; recordedAt: string; syncedAt: string;
};
type Summary = {
  avgSteps: number | null; avgHr: number | null; totalCalories: number;
  totalActiveMin: number; avgSleep: number | null; avgSpo2: number | null;
  recordCount: number; daysWithData?: number; windowDays?: number;
};
/** One entry per calendar day in the window, oldest first. `null` marks a day
 *  with no reading, so a sparkline can leave a real gap. */
type DailyPoint = {
  date: string;
  steps: number | null; heartRateAvg: number | null; caloriesBurned: number | null;
  activeMinutes: number | null; sleepHours: number | null; bloodOxygen: number | null;
};
type Connection = {
  id: string; provider: string; isActive: boolean; lastSyncedAt: string | null;
};
type ProviderConfig = {
  id: string; name: string; description: string; supported: boolean;
  available: boolean; requiresCredentials: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
/** IST calendar day, matching how the backend buckets a sync into a day. */
function istDayKey(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** Whole IST calendar days between a reading and today. Compares day keys
 *  rather than subtracting timestamps, so a reading from 11pm last night is
 *  one day old rather than zero. */
function daysOldIST(iso: string): number {
  const then = Date.parse(`${istDayKey(iso)}T00:00:00Z`);
  const today = Date.parse(`${istDayKey(new Date())}T00:00:00Z`);
  if (!Number.isFinite(then) || !Number.isFinite(today)) return 0;
  return Math.round((today - then) / 86_400_000);
}

/** How old the newest reading is, and whether it is old enough that daily
 *  targets should stop being judged against it. `latest` is the newest row
 *  whatever its age, so without this a sync from ten days ago is presented
 *  as today's activity. */
function readingAge(iso: string): { label: string; stale: boolean; days: number } {
  const days = daysOldIST(iso);
  const time = new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  // days <= 0 also covers a device clock running ahead of the server.
  if (days <= 0) return { label: `Today, ${time}`, stale: false, days: 0 };
  if (days === 1) return { label: `Yesterday, ${time}`, stale: true, days };
  return { label: `${days} days ago`, stale: true, days };
}

function openHCOrStore(): void {
  Linking.openURL("healthconnect://").catch(() =>
    Linking.openURL("https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata")
  );
}

// React Native draws ONE shadow direction per view — there is no dual-tone
// light+dark neumorphic pair — so "raised" here is a single soft drop shadow,
// and the recessed strips are faked with a darker fill (RN has no inset
// shadow either).
const NEU = Platform.select({
  ios:     { shadowColor: "#8CA3C4", shadowOffset: { width: 4, height: 5 }, shadowOpacity: 0.30, shadowRadius: 11 },
  android: { elevation: 4 },
  default: { shadowColor: "#8CA3C4", shadowOffset: { width: 4, height: 5 }, shadowOpacity: 0.30, shadowRadius: 11 },
}) as object;
const NEU_SM = Platform.select({
  ios:     { shadowColor: "#8CA3C4", shadowOffset: { width: 2, height: 3 }, shadowOpacity: 0.26, shadowRadius: 7 },
  android: { elevation: 2 },
  default: { shadowColor: "#8CA3C4", shadowOffset: { width: 2, height: 3 }, shadowOpacity: 0.26, shadowRadius: 7 },
}) as object;

const RECESS = "#E8EEF9";

// ─── Sparkline ────────────────────────────────────────────────────────────────
/** Draws only the days that actually have a reading. A run of readings is one
 *  polyline; a gap starts a new one, so missing days never get bridged into a
 *  straight line that looks like real data. */
function Sparkline({ points, color }: { points: (number | null)[]; color: string }) {
  const W = 74, H = 20, PAD = 1.5;
  const present = points.filter((p): p is number => p !== null);
  if (present.length < 2) return <View style={{ height: H }} />;

  const max = Math.max(...present);
  const min = Math.min(...present);
  const span = max - min || 1;
  const x = (i: number) => (points.length === 1 ? 0 : (i / (points.length - 1)) * W);
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - PAD * 2);

  const runs: string[] = [];
  let run: string[] = [];
  points.forEach((p, i) => {
    if (p === null) { if (run.length > 1) runs.push(run.join(" ")); run = []; return; }
    run.push(`${x(i).toFixed(1)},${y(p).toFixed(1)}`);
  });
  if (run.length > 1) runs.push(run.join(" "));

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {runs.map((pts, i) => (
        <Polyline key={i} points={pts} fill="none" stroke={color} strokeWidth={1.6}
          strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </Svg>
  );
}

// ─── Metric tile ──────────────────────────────────────────────────────────────
function MetricTile({ emoji, label, value, unit, color, soft, source }: {
  emoji: string; label: string; value: string | null; unit: string;
  color: string; soft: string; source: string;
}) {
  return (
    <View style={s.metric}>
      <View style={s.metricTop}>
        <View style={[s.metricIcon, { backgroundColor: soft }]}><Text style={{ fontSize: 15 }}>{emoji}</Text></View>
        <Text style={s.metricLabel} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={[s.metricVal, value ? { color } : s.metricValNone]}>{value ?? "--"}</Text>
      <Text style={s.metricUnit}>{unit}</Text>
      <Text style={s.metricSrc} numberOfLines={1}>{source}</Text>
    </View>
  );
}

// ─── Device card ──────────────────────────────────────────────────────────────
function DeviceCard({ conn, onSync, onDisconnect, syncing, solo }: {
  conn: Connection; onSync: () => void; onDisconnect: () => void; syncing: boolean; solo: boolean;
}) {
  const meta = providerMeta(conn.provider);
  const lastSync = conn.lastSyncedAt
    ? new Date(conn.lastSyncedAt).toLocaleString(undefined, {
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
      })
    : "Never synced";

  const buttons = (
    <View style={s.devBtns}>
      <TouchableOpacity onPress={onSync} disabled={syncing} style={s.devBtn} accessibilityLabel={`Sync ${meta.shortName}`} accessibilityRole="button">
        {syncing ? <ActivityIndicator size="small" color={meta.color} /> : <Ionicons name="refresh" size={13} color={meta.color} />}
      </TouchableOpacity>
      <TouchableOpacity onPress={onDisconnect} style={s.devBtn} accessibilityLabel={`Disconnect ${meta.shortName}`} accessibilityRole="button">
        <Ionicons name="close" size={13} color={DS.color.muted} />
      </TouchableOpacity>
    </View>
  );

  const status = (
    <View style={s.devStat}>
      <View style={s.devDot} />
      <Text style={s.devStatTxt}>Connected</Text>
    </View>
  );

  // One connected device gets the full row, so stacking it as a narrow column
  // would leave most of that width empty — lay it out horizontally instead.
  if (solo) {
    return (
      <View style={[s.dev, s.devSolo]}>
        <View style={[s.devIcon, { backgroundColor: meta.soft }]}><Text style={{ fontSize: 19 }}>{meta.emoji}</Text></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          {status}
          <Text style={s.devNameSolo} numberOfLines={1}>{meta.shortName}</Text>
          <Text style={s.devSync} numberOfLines={1}>Last sync: {lastSync}</Text>
        </View>
        {buttons}
      </View>
    );
  }

  return (
    <View style={[s.dev, { flex: 1 }]}>
      <View style={[s.devIcon, { backgroundColor: meta.soft }]}><Text style={{ fontSize: 18 }}>{meta.emoji}</Text></View>
      {status}
      <Text style={s.devName} numberOfLines={2}>{meta.shortName}</Text>
      <Text style={s.devSync} numberOfLines={2}>{lastSync}</Text>
      {buttons}
    </View>
  );
}

// ─── Manual entry ─────────────────────────────────────────────────────────────
function ManualEntryModal({ visible, onClose, onSave }: {
  visible: boolean; onClose: () => void; onSave: (data: Record<string, string>) => void;
}) {
  const [fields, setFields] = useState({
    steps: "", heartRateAvg: "", heartRateMin: "", heartRateMax: "",
    caloriesBurned: "", sleepHours: "", bloodOxygen: "", activeMinutes: "", distanceKm: "",
  });

  const fieldDefs = [
    { key: "steps",          label: "Steps",               unit: "steps", icon: "👟", keyboard: "numeric" as const },
    { key: "heartRateAvg",   label: "Heart Rate (Avg)",    unit: "bpm",   icon: "❤️", keyboard: "numeric" as const },
    { key: "heartRateMin",   label: "Heart Rate (Min)",    unit: "bpm",   icon: "💙", keyboard: "numeric" as const },
    { key: "heartRateMax",   label: "Heart Rate (Max)",    unit: "bpm",   icon: "❤️‍🔥", keyboard: "numeric" as const },
    { key: "caloriesBurned", label: "Calories Burned",     unit: "kcal",  icon: "🔥", keyboard: "numeric" as const },
    { key: "sleepHours",     label: "Sleep",               unit: "hrs",   icon: "😴", keyboard: "decimal-pad" as const },
    { key: "bloodOxygen",    label: "Blood Oxygen (SpO2)", unit: "%",     icon: "🩸", keyboard: "decimal-pad" as const },
    { key: "activeMinutes",  label: "Active Minutes",      unit: "min",   icon: "⚡", keyboard: "numeric" as const },
    { key: "distanceKm",     label: "Distance",            unit: "km",    icon: "📍", keyboard: "decimal-pad" as const },
  ];

  const handleSave = () => {
    onSave(fields);
    setFields({ steps: "", heartRateAvg: "", heartRateMin: "", heartRateMax: "",
      caloriesBurned: "", sleepHours: "", bloodOxygen: "", activeMinutes: "", distanceKm: "" });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.sheetBackdrop}>
        <View style={s.sheet}>
          <View style={s.sheetHead}>
            <Text style={s.sheetTitle}>Log Data</Text>
            <TouchableOpacity onPress={onClose} style={s.sheetClose} accessibilityLabel="Close" accessibilityRole="button">
              <Ionicons name="close" size={19} color={DS.color.textSub} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 11 }} keyboardShouldPersistTaps="handled">
            <Text style={s.sheetHint}>Enter readings from your watch or band. Leave a field blank to skip it.</Text>
            {fieldDefs.map((f) => (
              <View key={f.key}>
                <Text style={s.fieldLabel}>{f.icon}  {f.label} ({f.unit})</Text>
                <TextInput
                  value={fields[f.key as keyof typeof fields]}
                  onChangeText={(v) => setFields((st) => ({ ...st, [f.key]: v }))}
                  keyboardType={f.keyboard}
                  placeholder={`Enter ${f.label.toLowerCase()}`}
                  placeholderTextColor={DS.color.muted}
                  style={s.field}
                />
              </View>
            ))}
            <TouchableOpacity onPress={handleSave} activeOpacity={0.85} style={{ marginTop: 6 }}>
              <LinearGradient colors={["#0B84D6", "#1749FF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.sheetCta}>
                <Text style={s.sheetCtaTxt}>Save Data</Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function WearableScreen() {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<{
    latest: WearableData | null; summary: Summary | null; history: WearableData[]; dailySeries: DailyPoint[];
  }>({ latest: null, summary: null, history: [], dailySeries: [] });
  const [connections, setConnections] = useState<Connection[]>([]);
  const [providers, setProviders]     = useState<ProviderConfig[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [syncingProvider, setSyncingProvider] = useState<string | null>(null);
  const [showManual, setShowManual]   = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [connectingHC, setConnectingHC] = useState(false);

  const isMounted = useRef(true);
  const appState = useRef(AppState.currentState);
  const isLoadingRef = useRef(false);
  const topPad = insets.top;

  const loadAll = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    try {
      const [wearableResult, connectionsResult, providersResult] =
        await Promise.allSettled([
          api.getWearableData(),
          api.getWearableConnections(),
          api.getWearableProviders(),
        ]);

      if (!isMounted.current) return;

      if (wearableResult.status === "fulfilled") {
        setData(wearableResult.value as typeof data);
      }
      if (connectionsResult.status === "fulfilled") {
        setConnections((connectionsResult.value as { connections: Connection[] }).connections);
      }
      if (providersResult.status === "fulfilled") {
        setProviders((providersResult.value as { providers: ProviderConfig[] }).providers);
      }
    } catch (err) {
      console.warn("Error loading wearable data:", err);
    } finally {
      isLoadingRef.current = false;
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    loadAll();

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === "active" &&
        !isLoadingRef.current
      ) {
        loadAll();
      }
      appState.current = nextAppState;
    });

    return () => {
      isMounted.current = false;
      subscription.remove();
    };
  }, [loadAll]);

  const onRefresh = useCallback(async () => {
    if (isLoadingRef.current) return;
    setRefreshing(true);
    try { await loadAll(); }
    finally { if (isMounted.current) setRefreshing(false); }
  }, [loadAll]);

  // ─── Connection flow ────────────────────────────────────────────────────────
  // All native module handling, permission requests, record reading and
  // aggregation live in lib/health/* — this screen only orchestrates the UI.
  const connectHealthConnect = async () => {
    if (Platform.OS !== "android") {
      Alert.alert("Android Only", "Health Connect integration is strictly available on Android devices.");
      return;
    }
    setConnectingHC(true);
    try {
      const status = await checkConnectionStatus();

      if (status === "not_supported") {
        Alert.alert("Not Supported", "Health Connect requires Android 9 (API 28) or higher.");
        return;
      }
      if (status === "needs_update") {
        Alert.alert(
          "Update Required",
          "The Health Connect app needs to be updated from the Google Play Store.",
          [
            { text: "Update Now", onPress: () => Linking.openURL("https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata") },
            { text: "Cancel", style: "cancel" },
          ]
        );
        return;
      }
      if (status === "not_installed" || status === "error") {
        Alert.alert(
          "Configuration Required",
          "Please open the Health Connect app to complete initial setup, then try connecting again.",
          [
            { text: "Open App", onPress: openHCOrStore },
            { text: "Cancel", style: "cancel" },
          ]
        );
        return;
      }

      const { granted, sync } = await connectAndSync();
      if (!isMounted.current) return;

      if (!granted) {
        Alert.alert("Action Required", "At least one Health Connect permission must be granted to synchronize data.");
        return;
      }
      if (sync.outcome === "error") {
        Alert.alert("Server Sync Error", `Failed to save Health Connect data to the server.\n\nDetails: ${sync.message}`);
        return;
      }

      await loadAll();
      if (!isMounted.current) return;
      setShowConnect(false);
      Alert.alert(
        "Connection Established",
        sync.outcome === "synced" && sync.hasData
          ? "Health Connect is successfully linked and recent data has been synchronized."
          : "Health Connect is linked, but no activity data was found for today."
      );
    } catch (e: unknown) {
      if (!isMounted.current) return;
      logSilentError("health-connect-ui", e);
      Alert.alert("Error", "An unexpected error occurred during connection.");
    } finally {
      if (isMounted.current) setConnectingHC(false);
    }
  };

  const syncProvider = async (provider: string) => {
    setSyncingProvider(provider);
    try {
      if (provider === "health_connect") {
        if (Platform.OS !== "android") return;

        const result = await forceSync();
        if (!isMounted.current) return;

        if (result.outcome === "error") {
          Alert.alert("Synchronization Failed", `Unable to sync data to the server.\n\nError: ${result.message}`);
          return;
        }
        if (result.outcome === "not_connected") {
          Alert.alert("Not Connected", "Please connect Health Connect first.");
          return;
        }

        await loadAll();
        const hasData = result.outcome === "synced" && result.hasData;
        Alert.alert(
          hasData ? "Synchronization Complete" : "No New Data",
          hasData
            ? "Your Health Connect data has been successfully updated."
            : "Synchronization finished, but no recent data was located."
        );
      } else {
        Alert.alert("Notice", `${providerMeta(provider).shortName} synchronization is currently unavailable.`);
      }
    } catch (err: unknown) {
      if (!isMounted.current) return;
      logSilentError("health-connect-manual-sync", err);
      Alert.alert("Synchronization Failed", `Unable to sync data to the server.\n\nError: ${(err as Error)?.message || "Unknown API error"}`);
    } finally {
      if (isMounted.current) setSyncingProvider(null);
    }
  };

  const disconnectProvider = (provider: string) => {
    Alert.alert(
      "Confirm Disconnect",
      `Are you sure you want to disconnect ${providerMeta(provider).shortName}? Historical data will be preserved.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect", style: "destructive",
          onPress: async () => {
            try { await api.disconnectWearable(provider); await loadAll(); }
            catch { Alert.alert("Error", "Disconnection failed. Please try again."); }
          },
        },
      ]
    );
  };

  const saveManualData = async (fields: Record<string, string>) => {
    const payload: Record<string, number | undefined> = {};
    if (fields.steps)          payload.steps          = parseInt(fields.steps, 10);
    if (fields.heartRateAvg)   payload.heartRateAvg   = parseInt(fields.heartRateAvg, 10);
    if (fields.heartRateMin)   payload.heartRateMin   = parseInt(fields.heartRateMin, 10);
    if (fields.heartRateMax)   payload.heartRateMax   = parseInt(fields.heartRateMax, 10);
    if (fields.caloriesBurned) payload.caloriesBurned = parseFloat(fields.caloriesBurned);
    if (fields.sleepHours)     payload.sleepHours     = parseFloat(fields.sleepHours);
    if (fields.bloodOxygen)    payload.bloodOxygen    = parseFloat(fields.bloodOxygen);
    if (fields.activeMinutes)  payload.activeMinutes  = parseInt(fields.activeMinutes, 10);
    if (fields.distanceKm)     payload.distanceKm     = parseFloat(fields.distanceKm);
    try {
      await api.addManualWearableData(payload);
      await loadAll();
      setShowManual(false);
      Alert.alert("Success", "Manual data entry has been securely recorded.");
    } catch {
      Alert.alert("Error", "Failed to process manual entry.");
    }
  };

  const { latest, summary, dailySeries } = data;
  const activeConnections = connections.filter((c) => c.isActive);
  const series = dailySeries ?? [];
  const sourceLabel = latest ? providerMeta(latest.provider).shortName : "";

  const metrics = latest ? [
    { emoji: "👟", label: "Steps",      value: latest.steps?.toLocaleString() ?? null,                                      unit: "steps", color: "#0B84D6", soft: "#E2EFFD" },
    { emoji: "❤️", label: "Heart Rate", value: latest.heartRateAvg != null ? String(latest.heartRateAvg) : null,            unit: "bpm",   color: "#EF4444", soft: "#FDE8E8" },
    { emoji: "🔥", label: "Calories",   value: latest.caloriesBurned ? Math.round(parseFloat(latest.caloriesBurned)).toLocaleString() : null, unit: "kcal", color: "#F97316", soft: "#FEEEE2" },
    { emoji: "😴", label: "Sleep",      value: latest.sleepHours ? parseFloat(latest.sleepHours).toFixed(1) : null,         unit: "hrs",   color: "#8B5CF6", soft: "#EFE9FC" },
    { emoji: "🩸", label: "SpO2",       value: latest.bloodOxygen ? parseFloat(latest.bloodOxygen).toFixed(1) : null,       unit: "%",     color: "#EC4899", soft: "#FCE7F1" },
    { emoji: "⚡", label: "Active Min", value: latest.activeMinutes != null ? String(latest.activeMinutes) : null,          unit: "min",   color: "#F59E0B", soft: "#FEF3E0" },
    { emoji: "📍", label: "Distance",   value: latest.distanceKm ? parseFloat(latest.distanceKm).toFixed(2) : null,         unit: "km",    color: "#06B6D4", soft: "#DFF5F9" },
  ] : [];

  const summaryTiles = summary ? [
    { emoji: "👟", label: "Avg Steps/Day",  value: summary.avgSteps?.toLocaleString() ?? null,                     color: "#0B84D6", pts: series.map((d) => d.steps) },
    { emoji: "❤️", label: "Avg Heart Rate", value: summary.avgHr ? String(summary.avgHr) : null,                   color: "#EF4444", pts: series.map((d) => d.heartRateAvg) },
    { emoji: "🔥", label: "Total Calories", value: summary.totalCalories ? summary.totalCalories.toLocaleString() : null, color: "#F97316", pts: series.map((d) => d.caloriesBurned) },
    { emoji: "⚡", label: "Total Active",   value: `${summary.totalActiveMin || 0} min`,                           color: "#10B981", pts: series.map((d) => d.activeMinutes) },
    { emoji: "😴", label: "Avg Sleep",      value: summary.avgSleep ? `${summary.avgSleep}` : null,                color: "#8B5CF6", pts: series.map((d) => d.sleepHours) },
    { emoji: "🩸", label: "Avg SpO2",       value: summary.avgSpo2 ? `${summary.avgSpo2}` : null,                  color: "#EC4899", pts: series.map((d) => d.bloodOxygen) },
  ] : [];

  const age = latest ? readingAge(latest.recordedAt) : null;
  // A DAILY target judged against a reading from days ago is a wrong verdict,
  // not a stale one — "Daily Steps 3,207 △ Improve" reads as today's shortfall
  // when it is really last week's. Withhold the value instead; the row then
  // says "No data today". The weekly row is window-based, so it is unaffected.
  const forToday = <T,>(v: T | null | undefined): T | null =>
    age && !age.stale ? (v ?? null) : null;

  // The bar shows where the value sits against the upper bound; the verdict
  // comes from its own predicate. Deriving both from one ratio would mark a
  // perfectly healthy 74 bpm (band 60–100) as "Improve" at 74%.
  const targets = [
    { emoji: "👟", color: "#0B84D6", soft: "#E2EFFD", name: "Daily Steps",         target: "10,000 steps", unit: "steps", bound: 10000, daily: true,  value: forToday(latest?.steps),                                       good: (v: number) => v >= 10000 },
    { emoji: "❤️", color: "#EF4444", soft: "#FDE8E8", name: "Resting Heart Rate",  target: "60–100 bpm",   unit: "bpm",   bound: 100,   daily: true,  value: forToday(latest?.heartRateAvg),                                good: (v: number) => v >= 60 && v <= 100 },
    { emoji: "😴", color: "#8B5CF6", soft: "#EFE9FC", name: "Sleep Duration",      target: "7–9 hours",    unit: "hrs",   bound: 9,     daily: true,  value: forToday(latest?.sleepHours ? parseFloat(latest.sleepHours) : null), good: (v: number) => v >= 7 && v <= 9 },
    { emoji: "🩸", color: "#EC4899", soft: "#FCE7F1", name: "Blood Oxygen",        target: "≥95 %",        unit: "%",     bound: 100,   daily: true,  value: forToday(latest?.bloodOxygen ? parseFloat(latest.bloodOxygen) : null), good: (v: number) => v >= 95 },
    { emoji: "⚡", color: "#F59E0B", soft: "#FEF3E0", name: "Weekly Active Min",   target: "150+ min",     unit: "min",   bound: 150,   daily: false, value: summary?.totalActiveMin ?? null,                               good: (v: number) => v >= 150 },
  ];

  const windowDays = summary?.windowDays ?? 7;
  const daysWithData = summary?.daysWithData;

  return (
    <View style={s.root}>
      <ScrollView
        contentContainerStyle={{ paddingTop: topPad + 6, paddingBottom: insets.bottom + 28, paddingHorizontal: 13, gap: 10 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[DS.color.primary]} tintColor={DS.color.primary} />}
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.headerBtn} accessibilityLabel="Go back" accessibilityRole="button">
            <Ionicons name="arrow-back" size={18} color={DS.color.primary} />
          </TouchableOpacity>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.title}>Smart Wearables</Text>
            <Text style={s.subtitle} numberOfLines={1}>Health Connect &amp; Wearable Trackers</Text>
          </View>
          <TouchableOpacity onPress={() => setShowManual(true)} activeOpacity={0.85} accessibilityRole="button">
            <LinearGradient colors={["#0B84D6", "#1749FF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.logBtn}>
              <Ionicons name="add" size={14} color="#FFF" />
              <Text style={s.logBtnTxt}>Log Data</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <ActivityIndicator size="large" color={DS.color.primary} />
            <Text style={s.loadingTxt}>Loading your synced health data…</Text>
          </View>
        ) : (
          <>
            {/* ── Connected devices ── */}
            <View style={s.card}>
              <View style={s.cardHead}>
                <Text style={s.cardTitle}>Connected Devices</Text>
                <TouchableOpacity onPress={() => setShowConnect(true)} style={s.pill} accessibilityRole="button">
                  <Ionicons name="add" size={11} color={DS.color.primary} />
                  <Text style={s.pillTxt}>Connect</Text>
                </TouchableOpacity>
              </View>

              {activeConnections.length === 0 ? (
                <View style={s.empty}>
                  <Text style={{ fontSize: 34 }}>⌚</Text>
                  <Text style={s.emptyTitle}>No device connected</Text>
                  <Text style={s.emptyBody}>Link Health Connect to pull steps, heart rate, sleep and SpO2 from your watch or band automatically.</Text>
                  <TouchableOpacity onPress={() => setShowConnect(true)} activeOpacity={0.85} style={{ marginTop: 12 }}>
                    <LinearGradient colors={["#0B84D6", "#1749FF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.emptyCta}>
                      <Text style={s.emptyCtaTxt}>Connect Device</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <View style={s.devRow}>
                    {activeConnections.map((conn) => (
                      <DeviceCard
                        key={conn.id} conn={conn}
                        onSync={() => syncProvider(conn.provider)}
                        onDisconnect={() => disconnectProvider(conn.provider)}
                        syncing={syncingProvider === conn.provider}
                        solo={activeConnections.length === 1}
                      />
                    ))}
                  </View>
                  <View style={s.statusStrip}>
                    <View style={[s.stripIcon, { backgroundColor: "#E4F6EC" }]}><Text style={{ fontSize: 12 }}>🛡️</Text></View>
                    <Text style={s.statusTxt} numberOfLines={2}>
                      {activeConnections.length === 1
                        ? `${providerMeta(activeConnections[0].provider).shortName} is connected and syncing`
                        : `All ${activeConnections.length} providers connected and syncing`}
                    </Text>
                    <TouchableOpacity onPress={() => setShowConnect(true)} style={s.pillMuted} accessibilityRole="button">
                      <Text style={s.pillMutedTxt}>Manage</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>

            {/* ── Latest reading ── */}
            {latest ? (
              <View style={s.card}>
                <View style={s.cardHead}>
                  {/* Titled by the window it actually covers. Every sync reads
                      Health Connect for the ROLLING 24 hours ending at the
                      sync (lib/health/syncManager.ts), so at 11am these
                      numbers run from 11am yesterday — they are not a
                      midnight-to-now calendar day. Under a heading that read
                      "Latest Reading", beside daily targets, that looked like
                      today's totals with older activity folded in. */}
                  <Text style={s.cardTitle}>Last 24 Hours</Text>
                  <View style={[s.pillMuted, age?.stale && s.pillWarn]}>
                    <Text style={[s.pillMutedTxt, age?.stale && s.pillWarnTxt]}>{age?.label}</Text>
                  </View>
                </View>

                {!age?.stale && (
                  <Text style={s.windowNote}>
                    The 24 hours up to your last sync — so it can include some of yesterday.
                  </Text>
                )}

                {age?.stale && (
                  <View style={s.staleStrip}>
                    <Text style={{ fontSize: 12 }}>⏳</Text>
                    <Text style={s.staleTxt} numberOfLines={2}>
                      Your most recent readings — the 24 hours up to a sync {age.days === 1 ? "yesterday" : `${age.days} days ago`}, not recent activity.
                    </Text>
                    {activeConnections.length > 0 && (
                      <TouchableOpacity
                        onPress={() => syncProvider(activeConnections[0].provider)}
                        disabled={!!syncingProvider}
                        style={s.stalePill}
                        accessibilityRole="button"
                      >
                        {syncingProvider
                          ? <ActivityIndicator size="small" color="#B45309" />
                          : <Text style={s.stalePillTxt}>Sync</Text>}
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                <View style={s.metricGrid}>
                  {metrics.map((m) => (
                    <View key={m.label} style={s.metricCell}>
                      <MetricTile {...m} source={sourceLabel} />
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <View style={s.card}>
                <View style={s.empty}>
                  <Text style={{ fontSize: 34 }}>📊</Text>
                  <Text style={s.emptyTitle}>{activeConnections.length > 0 ? "No readings yet" : "No health data"}</Text>
                  <Text style={s.emptyBody}>
                    {activeConnections.length > 0
                      ? "Your device is linked but hasn't pushed anything yet. Make sure your watch app is writing to Health Connect, then sync."
                      : "Connect a device, or use Log Data to record readings by hand."}
                  </Text>
                  {activeConnections.length > 0 && (
                    <TouchableOpacity
                      onPress={() => syncProvider(activeConnections[0].provider)}
                      disabled={!!syncingProvider}
                      activeOpacity={0.85} style={{ marginTop: 12 }}
                    >
                      <LinearGradient colors={["#0B84D6", "#1749FF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.emptyCta}>
                        {syncingProvider ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={s.emptyCtaTxt}>Sync Now</Text>}
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* ── Window summary ── */}
            {summary && summary.recordCount > 0 && (
              <View style={s.card}>
                <View style={s.cardHead}>
                  <Text style={s.cardTitle}>{windowDays}-Day Summary</Text>
                  {daysWithData != null && (
                    <View style={s.pillMuted}>
                      {/* Says what the averages are actually divided by, so a
                          partial week never reads as a full one. */}
                      <Text style={s.pillMutedTxt}>{daysWithData} of {windowDays} days</Text>
                    </View>
                  )}
                </View>
                <View style={s.sumGrid}>
                  {summaryTiles.map((t) => (
                    <View key={t.label} style={s.sumCell}>
                      <View style={s.sum}>
                        <Text style={{ fontSize: 14 }}>{t.emoji}</Text>
                        <Text style={[s.sumVal, t.value ? { color: t.color } : s.sumValNone]} numberOfLines={1}>{t.value ?? "--"}</Text>
                        <Text style={s.sumLbl} numberOfLines={1}>{t.label}</Text>
                        <View style={{ marginTop: 4 }}>
                          <Sparkline points={t.pts} color={t.color} />
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ── WHO targets ── */}
            <View style={s.card}>
              <View style={s.cardHead}>
                <Text style={s.cardTitle}>Health Targets <Text style={s.cardTitleSub}>· WHO</Text></Text>
              </View>
              {targets.map((t) => {
                const has = t.value !== null && t.value !== undefined;
                const good = has && t.good(t.value as number);
                const pct = has ? Math.max(0, Math.min(100, Math.round(((t.value as number) / t.bound) * 100))) : 0;
                return (
                  <View key={t.name} style={[s.targetRow, good && { backgroundColor: "#EAF7F0" }]}>
                    <View style={[s.targetIcon, { backgroundColor: t.soft }]}><Text style={{ fontSize: 14 }}>{t.emoji}</Text></View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.targetName} numberOfLines={1}>{t.name}</Text>
                      <Text style={s.targetTarget} numberOfLines={1}>Target: {t.target}</Text>
                      <View style={s.targetBar}>
                        <View style={[s.targetFill, { width: `${pct}%` as `${number}%`, backgroundColor: has ? (good ? "#14915C" : t.color) : "#D9E1EE" }]} />
                      </View>
                    </View>
                    <View style={s.targetRight}>
                      <Text style={[s.targetVal, { color: has ? (good ? "#14915C" : t.color) : "#B6C2D2" }]} numberOfLines={1}>
                        {has ? `${(t.value as number).toLocaleString()} ${t.unit}` : (t.daily && age?.stale ? "No data today" : "No data")}
                      </Text>
                      {has && (
                        <Text style={[s.targetFlag, { color: good ? "#14915C" : "#C2792B" }]}>
                          {good ? "✓ On target" : "△ Improve"}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* ── Trust strip ── */}
            <View style={[s.card, s.trust]}>
              {[
                { emoji: "🛡️", bg: "#E4F6EC", head: "Secure Sync",   sub: "Your data is safe" },
                { emoji: "☁️", bg: "#E2EFFD", head: "Auto Tracking", sub: "Every 4 hours" },
                { emoji: "📊", bg: "#F0EAFB", head: "Insights",      sub: "Feeds your score" },
              ].map((t, i, arr) => (
                <React.Fragment key={t.head}>
                  <View style={s.trustItem}>
                    <View style={[s.stripIcon, { backgroundColor: t.bg }]}><Text style={{ fontSize: 11 }}>{t.emoji}</Text></View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.trustHead} numberOfLines={1}>{t.head}</Text>
                      <Text style={s.trustSub} numberOfLines={1}>{t.sub}</Text>
                    </View>
                  </View>
                  {i < arr.length - 1 && <View style={s.trustSep} />}
                </React.Fragment>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* ── Connect sheet ── */}
      <Modal visible={showConnect} transparent animationType="slide" onRequestClose={() => setShowConnect(false)}>
        <View style={s.sheetBackdrop}>
          <View style={s.sheet}>
            <View style={s.sheetHead}>
              <Text style={s.sheetTitle}>Connect a Device</Text>
              <TouchableOpacity onPress={() => setShowConnect(false)} style={s.sheetClose} accessibilityLabel="Close" accessibilityRole="button">
                <Ionicons name="close" size={19} color={DS.color.textSub} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
              {providers.filter((p) => visibleProviders().some((v) => v.id === p.id)).map((p) => {
                const meta = providerMeta(p.id);
                const isHC = p.id === "health_connect";
                return (
                  <TouchableOpacity
                    key={p.id}
                    disabled={connectingHC}
                    onPress={() => {
                      // Never a silent no-op: a provider that isn't wired yet
                      // says so rather than looking like a dead button.
                      if (isHC) connectHealthConnect();
                      else Alert.alert("Coming Soon", `${meta.name} integration is not available yet.`);
                    }}
                    activeOpacity={0.85}
                  >
                    <LinearGradient colors={meta.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.providerCard}>
                      <Text style={{ fontSize: 24 }}>{meta.emoji}</Text>
                      <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
                        <Text style={s.providerName}>{meta.name}</Text>
                        <Text style={s.providerSub} numberOfLines={2}>
                          {isHC ? (connectingHC ? "Connecting…" : meta.description) : "Coming soon"}
                        </Text>
                      </View>
                      {connectingHC && isHC && <ActivityIndicator size="small" color="#FFF" style={{ marginLeft: 8 }} />}
                    </LinearGradient>
                  </TouchableOpacity>
                );
              })}
              {providers.filter((p) => visibleProviders().some((v) => v.id === p.id)).length === 0 && (
                <Text style={s.sheetHint}>
                  No wearable provider is available on this platform yet. Use Log Data to record readings by hand.
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ManualEntryModal visible={showManual} onClose={() => setShowManual(false)} onSave={saveManualData} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: DS.color.bgSoft },

  header:    { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 2, paddingBottom: 2 },
  headerBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: DS.color.bg, alignItems: "center", justifyContent: "center", ...NEU_SM },
  title:     { fontSize: 17, fontFamily: "Inter_700Bold", color: DS.color.text },
  subtitle:  { fontSize: 10.5, fontFamily: "Inter_400Regular", color: DS.color.muted, marginTop: 1 },
  logBtn:    { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 16 },
  logBtnTxt: { color: "#FFF", fontSize: 12, fontFamily: "Inter_700Bold" },

  loadingTxt: { color: DS.color.muted, marginTop: 12, fontFamily: "Inter_400Regular", fontSize: 12.5 },

  card:         { backgroundColor: DS.color.bg, borderRadius: 18, padding: 12, ...NEU },
  cardHead:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 },
  cardTitle:    { fontSize: 13.5, fontFamily: "Inter_700Bold", color: DS.color.text },
  cardTitleSub: { fontSize: 10, fontFamily: "Inter_500Medium", color: DS.color.muted },

  pill:        { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 13, backgroundColor: DS.color.bgSoft, ...NEU_SM },
  pillTxt:     { fontSize: 10.5, fontFamily: "Inter_600SemiBold", color: DS.color.primary },
  pillMuted:   { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 13, backgroundColor: DS.color.bgSoft, ...NEU_SM },
  pillMutedTxt:{ fontSize: 10.5, fontFamily: "Inter_600SemiBold", color: DS.color.textSub },

  // devices
  devRow:      { flexDirection: "row", gap: 8 },
  dev:         { backgroundColor: DS.color.bgCard, borderRadius: 14, padding: 10, gap: 5, minWidth: 0, ...NEU_SM },
  devSolo:     { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 11, flex: 1 },
  devIcon:     { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  devStat:     { flexDirection: "row", alignItems: "center", gap: 4 },
  devDot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: "#14915C" },
  devStatTxt:  { fontSize: 9.5, fontFamily: "Inter_600SemiBold", color: "#14915C" },
  devName:     { fontSize: 10.5, fontFamily: "Inter_700Bold", color: DS.color.text, lineHeight: 13, minHeight: 26 },
  devNameSolo: { fontSize: 12.5, fontFamily: "Inter_700Bold", color: DS.color.text },
  devSync:     { fontSize: 8.5, fontFamily: "Inter_400Regular", color: DS.color.muted, lineHeight: 11 },
  devBtns:     { flexDirection: "row", gap: 6, marginTop: 2 },
  devBtn:      { width: 27, height: 27, borderRadius: 9, backgroundColor: DS.color.bg, alignItems: "center", justifyContent: "center", ...NEU_SM },

  pillWarn:    { backgroundColor: "#FDF3E3" },
  pillWarnTxt: { color: "#B45309" },
  staleStrip:  { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FDF3E3", borderRadius: 12, padding: 9, marginBottom: 10 },
  staleTxt:    { flex: 1, fontSize: 10.5, fontFamily: "Inter_400Regular", color: "#8A5A18", lineHeight: 14 },
  windowNote:  { fontSize: 10, fontFamily: "Inter_400Regular", color: DS.color.muted, marginBottom: 9, lineHeight: 13 },
  stalePill:   { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 12, backgroundColor: "#FAE6C6" },
  stalePillTxt:{ fontSize: 10.5, fontFamily: "Inter_700Bold", color: "#B45309" },

  statusStrip: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: RECESS, borderRadius: 12, padding: 9, marginTop: 9 },
  stripIcon:   { width: 26, height: 26, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  statusTxt:   { flex: 1, fontSize: 10.5, fontFamily: "Inter_400Regular", color: DS.color.textSub },

  // latest reading
  metricGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  metricCell: { width: "50%", paddingHorizontal: 4, paddingBottom: 8 },
  metric:     { backgroundColor: DS.color.bgCard, borderRadius: 14, padding: 10, ...NEU_SM },
  metricTop:  { flexDirection: "row", alignItems: "center", gap: 7 },
  metricIcon: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  metricLabel:{ flex: 1, fontSize: 10.5, fontFamily: "Inter_600SemiBold", color: DS.color.textSub },
  metricVal:  { fontSize: 21, fontFamily: "Inter_800ExtraBold", marginTop: 5, lineHeight: 24 },
  metricValNone: { color: "#B6C2D2" },
  metricUnit: { fontSize: 9.5, fontFamily: "Inter_400Regular", color: DS.color.muted },
  metricSrc:  { fontSize: 8.5, fontFamily: "Inter_400Regular", color: DS.color.muted, marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: DS.color.divider },

  // summary
  sumGrid:    { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  sumCell:    { width: "33.33%", paddingHorizontal: 4, paddingBottom: 8 },
  sum:        { backgroundColor: DS.color.bgCard, borderRadius: 14, padding: 9, ...NEU_SM },
  sumVal:     { fontSize: 15, fontFamily: "Inter_800ExtraBold", lineHeight: 18 },
  sumValNone: { color: "#B6C2D2" },
  sumLbl:     { fontSize: 8.5, fontFamily: "Inter_400Regular", color: DS.color.muted },

  // targets
  targetRow:    { flexDirection: "row", alignItems: "center", gap: 8, padding: 8, borderRadius: 12, marginBottom: 6, backgroundColor: DS.color.bgSoft },
  targetIcon:   { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  targetName:   { fontSize: 11, fontFamily: "Inter_600SemiBold", color: DS.color.text },
  targetTarget: { fontSize: 9, fontFamily: "Inter_400Regular", color: DS.color.muted },
  targetBar:    { height: 5, borderRadius: 3, backgroundColor: "#E4EAF6", marginTop: 5, overflow: "hidden" },
  targetFill:   { height: 5, borderRadius: 3 },
  targetRight:  { alignItems: "flex-end", minWidth: 66 },
  targetVal:    { fontSize: 11.5, fontFamily: "Inter_700Bold" },
  targetFlag:   { fontSize: 8.5, fontFamily: "Inter_600SemiBold", marginTop: 1 },

  // trust strip
  trust:     { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 8 },
  trustItem: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, minWidth: 0 },
  trustSep:  { width: 1, alignSelf: "stretch", backgroundColor: DS.color.divider, marginHorizontal: 6 },
  trustHead: { fontSize: 9.5, fontFamily: "Inter_700Bold", color: DS.color.text },
  trustSub:  { fontSize: 8, fontFamily: "Inter_400Regular", color: DS.color.muted },

  // empty states
  empty:      { alignItems: "center", paddingVertical: 22, paddingHorizontal: 16 },
  emptyTitle: { fontSize: 14.5, fontFamily: "Inter_700Bold", color: DS.color.text, textAlign: "center", marginTop: 8 },
  emptyBody:  { fontSize: 11.5, fontFamily: "Inter_400Regular", color: DS.color.muted, textAlign: "center", marginTop: 5, lineHeight: 17 },
  emptyCta:   { paddingHorizontal: 22, paddingVertical: 12, borderRadius: 14, alignItems: "center" },
  emptyCtaTxt:{ color: "#FFF", fontSize: 13, fontFamily: "Inter_700Bold" },

  // sheets
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(13,20,33,0.45)", justifyContent: "flex-end" },
  sheet:         { backgroundColor: DS.color.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "90%", paddingBottom: 20 },
  sheetHead:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: DS.color.divider },
  sheetTitle:    { fontSize: 16, fontFamily: "Inter_700Bold", color: DS.color.text },
  sheetClose:    { width: 30, height: 30, borderRadius: 15, backgroundColor: DS.color.bgSoft, alignItems: "center", justifyContent: "center" },
  sheetHint:     { fontSize: 11.5, fontFamily: "Inter_400Regular", color: DS.color.muted, lineHeight: 17 },
  sheetCta:      { paddingVertical: 15, borderRadius: 16, alignItems: "center" },
  sheetCtaTxt:   { color: "#FFF", fontSize: 15, fontFamily: "Inter_700Bold" },

  fieldLabel: { fontSize: 11.5, fontFamily: "Inter_500Medium", color: DS.color.textSub, marginBottom: 6 },
  field:      { backgroundColor: RECESS, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, fontFamily: "Inter_400Regular", color: DS.color.text },

  providerCard: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 16 },
  providerName: { color: "#FFF", fontSize: 14.5, fontFamily: "Inter_700Bold" },
  providerSub:  { color: "rgba(255,255,255,0.88)", fontSize: 10.5, fontFamily: "Inter_400Regular", marginTop: 2, lineHeight: 14 },
});
