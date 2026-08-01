import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, Alert, Dimensions, ActivityIndicator, Modal,
  TextInput, RefreshControl, Linking, AppState,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "@/lib/api";
import { logSilentError } from "@/lib/silentCatch";
import { checkConnectionStatus, connectAndSync, forceSync } from "@/lib/health/syncManager";

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
  recordCount: number;
};
type Connection = {
  id: string; provider: string; isActive: boolean; lastSyncedAt: string | null;
};
type ProviderConfig = {
  id: string; name: string; description: string; supported: boolean;
  available: boolean; requiresCredentials: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function openHCOrStore(): void {
  Linking.openURL("healthconnect://").catch(() =>
    Linking.openURL("https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata")
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────
const { width: W } = Dimensions.get("window");

const PROVIDER_META: Record<string, { emoji: string; name: string; color: string; grad: [string, string]; }> = {
  health_connect:  { emoji: "🤖", name: "Health Connect",        color: "#0B6E4F", grad: ["#0B6E4F", "#1B998B"] },
  apple_healthkit: { emoji: "🍎", name: "Apple HealthKit (iOS)", color: "#FF3B30", grad: ["#FF3B30", "#FF6B6B"] },
  samsung_health:  { emoji: "💙", name: "Samsung Health",        color: "#1428A0", grad: ["#1428A0", "#00A8E0"] },
};

// ─── Provider visibility control ─────────────────────────────────────────────
// Platform-aware: Android users dekhein sirf kaam karne wale providers.
// Apple HealthKit iOS-only hai — Android pe dikhana confusing + Play Store issue.
// Samsung Health + Fitbit: implementation pending, hidden until ready.
//
// Future mein provider add karna ho:
//   Android: ["health_connect", "samsung_health"] — jab Samsung SDK integrate ho
//   iOS:     ["apple_healthkit"] — jab HealthKit package install ho
const ALLOWED_PROVIDERS: string[] = Platform.select({
  android: ["health_connect"],     // ✅ Working
  ios:     ["apple_healthkit"],    // 🔜 Ready karna hai — HealthKit package pending
  default: ["health_connect"],
}) ?? ["health_connect"];

// ─── UI Components ────────────────────────────────────────────────────────────
function MetricCard({ icon, label, value, unit, color }: {
  icon: string; label: string; value: string | number | null; unit?: string; color: string;
}) {
  const hasData = value !== null && value !== undefined;
  return (
    <View style={styles.metricRow}>
      <View style={[styles.metricRowIcon, { backgroundColor: color + "18" }]}>
        <Text style={{ fontSize: 18 }}>{icon}</Text>
      </View>
      <Text style={styles.metricRowLabel}>{label}</Text>
      <Text style={[styles.metricRowValue, { color: hasData ? color : "#CBD5E1" }]}>
        {hasData ? `${value}${unit ? ` ${unit}` : ""}` : "—"}
      </Text>
    </View>
  );
}

function DeviceCard({ conn, onSync, onDisconnect, syncing }: {
  conn: Connection; onSync: () => void; onDisconnect: () => void; syncing: boolean;
}) {
  const meta = PROVIDER_META[conn.provider] ?? {
    emoji: "📱", name: conn.provider, color: "#0077B6",
    grad: ["#0077B6", "#1B998B"] as [string, string],
  };
  const lastSync = conn.lastSyncedAt
    ? new Date(conn.lastSyncedAt).toLocaleString(undefined, {
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
      })
    : "Never synced";

  return (
    <View style={styles.deviceCard}>
      <LinearGradient colors={[`${meta.color}15`, `${meta.color}08`]} style={styles.deviceCardGrad}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={[styles.deviceIcon, { backgroundColor: `${meta.color}20` }]}>
            <Text style={{ fontSize: 22 }}>{meta.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.deviceName}>{meta.name}</Text>
            <Text style={styles.deviceSync}>Last sync: {lastSync}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity onPress={onSync} disabled={syncing}
              style={[styles.deviceBtn, { backgroundColor: `${meta.color}20` }]}>
              {syncing
                ? <ActivityIndicator size="small" color={meta.color} />
                : <Ionicons name="refresh" size={14} color={meta.color} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={onDisconnect}
              style={[styles.deviceBtn, { backgroundColor: "rgba(239,68,68,0.1)" }]}>
              <Ionicons name="close" size={14} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

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
    { key: "distanceKm",     label: "Distance",            unit: "km",    icon: "🛤️", keyboard: "decimal-pad" as const },
  ];

  const handleSave = () => {
    onSave(fields);
    setFields({ steps: "", heartRateAvg: "", heartRateMin: "", heartRateMax: "",
      caloriesBurned: "", sleepHours: "", bloodOxygen: "", activeMinutes: "", distanceKm: "" });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: "#FFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "90%", paddingBottom: 24 }}>
          <View style={{ padding: 20, borderBottomWidth: 1, borderColor: "#E5EFF7", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 18, color: "#0D1F33" }}>Manual Data Entry</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color="#7A90A4" /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
            <Text style={{ color: "#7A90A4", fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 4 }}>
              Enter data from your smartwatch or smart band. Leave blank to skip.
            </Text>
            {fieldDefs.map((f) => (
              <View key={f.key}>
                <Text style={{ fontSize: 12, color: "#374151", fontFamily: "Inter_500Medium", marginBottom: 6 }}>
                  {f.icon} {f.label} ({f.unit})
                </Text>
                <TextInput
                  value={fields[f.key as keyof typeof fields]}
                  onChangeText={(v) => setFields((s) => ({ ...s, [f.key]: v }))}
                  keyboardType={f.keyboard}
                  placeholder={`Enter ${f.label.toLowerCase()}`}
                  style={{ backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E5EFF7", borderRadius: 10, padding: 12, fontSize: 15, color: "#0D1F33", fontFamily: "Inter_400Regular" }}
                />
              </View>
            ))}
            <TouchableOpacity onPress={handleSave}
              style={{ backgroundColor: "#0077B6", borderRadius: 14, padding: 16, alignItems: "center", marginTop: 8 }}>
              <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 16 }}>Save Data</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function WearableScreen() {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<{
    latest: WearableData | null; summary: Summary | null; history: WearableData[];
  }>({ latest: null, summary: null, history: [] });
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

    const subscription = AppState.addEventListener(
      "change",
      (nextAppState) => {
        if (
          appState.current.match(/inactive|background/) &&
          nextAppState === "active" &&
          !isLoadingRef.current
        ) {
          loadAll();
        }
        appState.current = nextAppState;
      }
    );

    return () => {
      isMounted.current = false;
      subscription.remove();
    };
  }, [loadAll]);

  const onRefresh = useCallback(async () => {
    if (isLoadingRef.current) return;
    setRefreshing(true);
    try {
      await loadAll();
    } finally {
      if (isMounted.current) {
        setRefreshing(false);
      }
    }
  }, [loadAll]);

  // ─── Connection Flow ────────────────────────────────────────────────────────
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
        Alert.alert("Notice", `${PROVIDER_META[provider]?.name || provider} synchronization is currently unavailable.`);
      }
    } catch (err: any) {
      if (!isMounted.current) return;
      logSilentError("health-connect-manual-sync", err);
      Alert.alert("Synchronization Failed", `Unable to sync data to the server.\n\nError: ${err?.message || "Unknown API error"}`);
    } finally {
      if (isMounted.current) setSyncingProvider(null);
    }
  };

  const disconnectProvider = (provider: string) => {
    Alert.alert(
      "Confirm Disconnect",
      `Are you sure you want to disconnect ${PROVIDER_META[provider]?.name || provider}? Historical data will be preserved.`,
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
    if (fields.steps)          payload.steps          = parseInt(fields.steps);
    if (fields.heartRateAvg)   payload.heartRateAvg   = parseInt(fields.heartRateAvg);
    if (fields.heartRateMin)   payload.heartRateMin   = parseInt(fields.heartRateMin);
    if (fields.heartRateMax)   payload.heartRateMax   = parseInt(fields.heartRateMax);
    if (fields.caloriesBurned) payload.caloriesBurned = parseFloat(fields.caloriesBurned);
    if (fields.sleepHours)     payload.sleepHours     = parseFloat(fields.sleepHours);
    if (fields.bloodOxygen)    payload.bloodOxygen    = parseFloat(fields.bloodOxygen);
    if (fields.activeMinutes)  payload.activeMinutes  = parseInt(fields.activeMinutes);
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

  const { latest, summary } = data;
  const activeConnections    = connections.filter((c) => c.isActive);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: "#F0F9FF" }}>
      <LinearGradient colors={["#E0F2FE", "#BAE6FD", "#EFF6FF"]} style={StyleSheet.absoluteFill} />

      <ScrollView
        contentContainerStyle={{ paddingTop: topPad + 12, paddingBottom: 100, paddingHorizontal: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#0077B6"]} tintColor="#0077B6" />}
      >
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#0077B6" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.pageTitle}>Smart Wearables</Text>
            <Text style={styles.pageSub}>Health Connect & Wearable Trackers</Text>
          </View>
          <TouchableOpacity onPress={() => setShowManual(true)} style={styles.addBtn}>
            <Ionicons name="add" size={16} color="#FFF" />
            <Text style={styles.addBtnText}>Log Data</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <ActivityIndicator size="large" color="#0077B6" />
            <Text style={{ color: "#7A90A4", marginTop: 12, fontFamily: "Inter_400Regular" }}>
              Loading health synchronization data...
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <Text style={styles.sectionTitle}>Connected Devices</Text>
                <TouchableOpacity onPress={() => setShowConnect(true)} style={styles.connectSmallBtn}>
                  <Ionicons name="add" size={14} color="#0077B6" />
                  <Text style={{ color: "#0077B6", fontSize: 12, fontFamily: "Inter_600SemiBold" }}>Connect</Text>
                </TouchableOpacity>
              </View>

              {activeConnections.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={{ fontSize: 40, marginBottom: 12 }}>⌚</Text>
                  <Text style={{ fontFamily: "Inter_700Bold", fontSize: 16, color: "#0D1F33", textAlign: "center" }}>
                    No Device Connected
                  </Text>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#7A90A4", textAlign: "center", marginTop: 6, lineHeight: 20 }}>
                    Link Health Connect (Android), Apple HealthKit (iOS), or Samsung Health.
                  </Text>
                  <TouchableOpacity onPress={() => setShowConnect(true)} style={styles.connectBigBtn}>
                    <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 14 }}>+ Connect Device</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  {activeConnections.map((conn) => (
                    <DeviceCard
                      key={conn.id} conn={conn}
                      onSync={() => syncProvider(conn.provider)}
                      onDisconnect={() => disconnectProvider(conn.provider)}
                      syncing={syncingProvider === conn.provider}
                    />
                  ))}
                </View>
              )}
            </View>

            {latest && (
              <View style={styles.section}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <Text style={styles.sectionTitle}>Latest Reading</Text>
                  <Text style={{ color: "#7A90A4", fontSize: 11, fontFamily: "Inter_400Regular" }}>
                    {PROVIDER_META[latest.provider]?.emoji} {PROVIDER_META[latest.provider]?.name || latest.provider}
                  </Text>
                </View>
                <MetricCard icon="👟" label="Steps"       value={latest.steps?.toLocaleString() ?? null}                               color="#0077B6" />
                <MetricCard icon="❤️" label="Heart Rate"  value={latest.heartRateAvg}                    unit="bpm"                    color="#EF4444" />
                <MetricCard icon="🔥" label="Calories"    value={latest.caloriesBurned ? Math.round(parseFloat(latest.caloriesBurned)) : null} unit="kcal" color="#F97316" />
                <MetricCard icon="😴" label="Sleep"       value={latest.sleepHours ? parseFloat(latest.sleepHours).toFixed(1) : null} unit="hrs"   color="#8B5CF6" />
                <MetricCard icon="🩸" label="SpO2"        value={latest.bloodOxygen ? parseFloat(latest.bloodOxygen).toFixed(1) : null} unit="%"   color="#EC4899" />
                <MetricCard icon="⚡" label="Active Min"  value={latest.activeMinutes}                   unit="min"                    color="#10B981" />
                <MetricCard icon="🛤️" label="Distance"   value={latest.distanceKm ? parseFloat(latest.distanceKm).toFixed(2) : null} unit="km"   color="#06B6D4" />
              </View>
            )}

            {summary && summary.recordCount > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { marginBottom: 14 }]}>7-Day Summary</Text>
                <View style={styles.summaryGrid}>
                  {[
                    { icon: "👟", label: "Avg Steps/Day",    value: summary.avgSteps?.toLocaleString() ?? "—",       color: "#0077B6" },
                    { icon: "❤️", label: "Avg Heart Rate",   value: summary.avgHr ? `${summary.avgHr} bpm` : "—",    color: "#EF4444" },
                    { icon: "🔥", label: "Total Calories",   value: summary.totalCalories ? `${summary.totalCalories} kcal` : "—", color: "#F97316" },
                    { icon: "⚡", label: "Total Active Min", value: `${summary.totalActiveMin || 0} min`,            color: "#10B981" },
                    { icon: "😴", label: "Avg Sleep",        value: summary.avgSleep ? `${summary.avgSleep} hrs` : "—", color: "#8B5CF6" },
                    { icon: "🩸", label: "Avg SpO2",         value: summary.avgSpo2 ? `${summary.avgSpo2}%` : "—",   color: "#EC4899" },
                  ].map((s) => (
                    <View key={s.label} style={[styles.summaryItem, { borderLeftColor: s.color, borderLeftWidth: 3 }]}>
                      <Text style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</Text>
                      <Text style={{ fontFamily: "Inter_700Bold", fontSize: 16, color: s.color }}>{s.value}</Text>
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#7A90A4", marginTop: 2 }}>{s.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {!latest && (
              <View style={styles.section}>
                <View style={[styles.emptyCard, { paddingVertical: 32 }]}>
                  <Text style={{ fontSize: 48, marginBottom: 12 }}>📊</Text>
                  <Text style={{ fontFamily: "Inter_700Bold", fontSize: 16, color: "#0D1F33", textAlign: "center" }}>
                    {activeConnections.length > 0 ? "Data Pending" : "No Health Data"}
                  </Text>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#7A90A4", textAlign: "center", marginTop: 6, lineHeight: 20 }}>
                    {activeConnections.length > 0
                      ? "Awaiting data synchronization. Ensure your wearable app is correctly pushing data to Health Connect."
                      : "Establish a connection with a device or use manual entry to record your health metrics."}
                  </Text>
                  {activeConnections.length > 0 && (
                    <TouchableOpacity
                      onPress={() => syncProvider(activeConnections[0].provider)}
                      disabled={!!syncingProvider}
                      style={styles.syncBigBtn}
                    >
                      {syncingProvider ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={{ fontSize: 16 }}>🔄</Text>}
                      <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 14 }}>Force Sync</Text>
                    </TouchableOpacity>
                  )}
                  <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                    <TouchableOpacity onPress={() => setShowConnect(true)} style={styles.connectMediumBtn}>
                      <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>Connect Device</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setShowManual(true)} style={styles.logManualBtn}>
                      <Text style={{ color: "#0077B6", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>Manual Log</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { marginBottom: 12 }]}>Health Targets (WHO Guidelines)</Text>
              <View style={{ gap: 8 }}>
                {[
                  { icon: "👟", target: "10,000", label: "Daily Steps",            current: latest?.steps ?? null,                                        unit: "steps", good: (v: number) => v >= 10000 },
                  { icon: "❤️", target: "60–100", label: "Resting Heart Rate",    current: latest?.heartRateAvg ?? null,                                  unit: "bpm",   good: (v: number) => v >= 60 && v <= 100 },
                  { icon: "😴", target: "7–9",    label: "Sleep Duration",        current: latest?.sleepHours ? parseFloat(latest.sleepHours) : null,     unit: "hours", good: (v: number) => v >= 7 && v <= 9 },
                  { icon: "🩸", target: "≥95",    label: "Blood Oxygen (SpO2)",   current: latest?.bloodOxygen ? parseFloat(latest.bloodOxygen) : null, unit: "%",     good: (v: number) => v >= 95 },
                  { icon: "⚡", target: "150+",   label: "Weekly Active Minutes", current: summary?.totalActiveMin ?? null,                               unit: "min",   good: (v: number) => v >= 150 },
                ].map((t) => {
                  const isGood  = t.current !== null && t.good(t.current);
                  const hasData = t.current !== null;
                  return (
                    <View key={t.label}
                      style={[styles.targetRow, {
                        backgroundColor: hasData ? (isGood ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)") : "#F8FAFC",
                      }]}>
                      <Text style={{ fontSize: 18, width: 28 }}>{t.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: "#0D1F33" }}>{t.label}</Text>
                        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#7A90A4" }}>Target: {t.target} {t.unit}</Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ fontFamily: "Inter_700Bold", fontSize: 14, color: hasData ? (isGood ? "#10B981" : "#EF4444") : "#D1D5DB" }}>
                          {hasData ? `${t.current} ${t.unit}` : "No data"}
                        </Text>
                        {hasData && (
                          <Text style={{ fontSize: 10, color: isGood ? "#10B981" : "#EF4444" }}>
                            {isGood ? "✓ Good" : "⚠ Improve"}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <Modal visible={showConnect} transparent animationType="slide" onRequestClose={() => setShowConnect(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#FFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 32 }}>
            <View style={{ padding: 20, borderBottomWidth: 1, borderColor: "#E5EFF7", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 18, color: "#0D1F33" }}>Connect a Device</Text>
              <TouchableOpacity onPress={() => setShowConnect(false)}>
                <Ionicons name="close" size={22} color="#7A90A4" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
              {/* providers list */}

              {providers.filter((p) => ALLOWED_PROVIDERS.includes(p.id)).map((p) => {
                const meta = PROVIDER_META[p.id] ?? {
                  emoji: "📱", name: p.name, color: "#0077B6",
                  grad: ["#0077B6", "#1B998B"] as [string, string],
                };
                const isHC = p.id === "health_connect";

                return (
                  <TouchableOpacity
                    key={p.id}
                    disabled={connectingHC}
                    onPress={() => { if (isHC) connectHealthConnect(); }}
                    style={styles.providerBtn}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={meta.grad}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={styles.providerBtnGrad}
                    >
                      <Text style={{ fontSize: 26 }}>{meta.emoji}</Text>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 15 }}>
                          {meta.name}
                        </Text>
                        <Text style={{ color: "rgba(255,255,255,0.85)", fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2 }}>
                          {connectingHC ? "Connecting..." : "Tap to authorize Health Connect"}
                        </Text>
                      </View>
                      {connectingHC && (
                        <ActivityIndicator size="small" color="#FFF" style={{ marginRight: 10 }} />
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ManualEntryModal visible={showManual} onClose={() => setShowManual(false)} onSave={saveManualData} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  pageTitle:       { color: "#0D1F33", fontFamily: "Inter_700Bold", fontSize: 22 },
  pageSub:         { color: "#7A90A4", fontSize: 12, fontFamily: "Inter_400Regular" },
  section:         { backgroundColor: "rgba(255,255,255,0.75)", borderRadius: 20, padding: 16, marginBottom: 16, shadowColor: "#0077B6", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 },
  sectionTitle:    { fontFamily: "Inter_700Bold", fontSize: 16, color: "#0D1F33" },
  metricRow:       { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F0F4F8" },
  metricRowIcon:   { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginRight: 12 },
  metricRowLabel:  { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: "#374151" },
  metricRowValue:  { fontSize: 15, fontFamily: "Inter_700Bold" },
  deviceCard:      { borderRadius: 14, overflow: "hidden" },
  deviceCardGrad:  { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "rgba(0,119,182,0.1)" },
  deviceIcon:      { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  deviceName:      { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#0D1F33" },
  deviceSync:      { fontFamily: "Inter_400Regular", fontSize: 11, color: "#7A90A4", marginTop: 2 },
  deviceBtn:       { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  emptyCard:       { alignItems: "center", paddingVertical: 24, backgroundColor: "rgba(0,119,182,0.04)", borderRadius: 16, borderWidth: 1.5, borderColor: "rgba(0,119,182,0.1)", borderStyle: "dashed" },
  summaryGrid:     { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  summaryItem:     { width: (W - 32 - 16 * 2 - 10) / 2, backgroundColor: "#F8FAFC", borderRadius: 12, padding: 12, paddingLeft: 14 },
  targetRow:       { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12 },
  providerBtn:     { borderRadius: 14, overflow: "hidden" },
  providerBtnGrad: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 14 },
  backBtn:         { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(0,119,182,0.1)", alignItems: "center", justifyContent: "center", marginRight: 12 },
  addBtn:          { backgroundColor: "#0077B6", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 5 },
  addBtnText:      { color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 12 },
  connectSmallBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,119,182,0.08)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  connectBigBtn:   { backgroundColor: "#0077B6", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, marginTop: 16 },
  syncBigBtn:      { backgroundColor: "#0077B6", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, marginTop: 16, flexDirection: "row", alignItems: "center", gap: 8 },
  connectMediumBtn:{ backgroundColor: "#0077B6", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  logManualBtn:    { backgroundColor: "rgba(0,119,182,0.1)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: "rgba(0,119,182,0.3)" },
});