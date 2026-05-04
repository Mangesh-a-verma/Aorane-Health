import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, Alert, Dimensions, ActivityIndicator, Modal,
  TextInput, RefreshControl, Linking,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "@/lib/api";
// HC loaded lazily so a missing/unlinked native module does NOT crash the app
type HCModule = {
  initialize: () => Promise<boolean>;
  requestPermission: (perms: Array<{ accessType: string; recordType: string }>) => Promise<Array<unknown>>;
  readRecords: (type: string, opts: unknown) => Promise<unknown>;
  getSdkStatus: () => Promise<number>;
  SdkAvailabilityStatus: { SDK_UNAVAILABLE: number; SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED: number; SDK_AVAILABLE: number };
};
let _hc: HCModule | null = null;
function getHC(): HCModule | null {
  if (_hc) return _hc;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _hc = require("react-native-health-connect") as HCModule;
    return _hc;
  } catch {
    return null;
  }
}

const { width: W } = Dimensions.get("window");

// ─── Provider config ──────────────────────────────────────────────────────────
const PROVIDER_META: Record<string, { emoji: string; name: string; color: string; grad: [string, string] }> = {
  health_connect:  { emoji: "🤖", name: "Health Connect",        color: "#0B6E4F", grad: ["#0B6E4F","#1B998B"] },
  apple_healthkit: { emoji: "🍎", name: "Apple HealthKit (iOS)", color: "#FF3B30", grad: ["#FF3B30","#FF6B6B"] },
  samsung_health:  { emoji: "💙", name: "Samsung Health",        color: "#1428A0", grad: ["#1428A0","#00A8E0"] },
};

const ALLOWED_PROVIDERS = ["health_connect", "apple_healthkit", "samsung_health"];

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

// ─── Metric Row ───────────────────────────────────────────────────────────────
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

// ─── Connected Device Card ────────────────────────────────────────────────────
function DeviceCard({ conn, onSync, onDisconnect, syncing }: {
  conn: Connection; onSync: () => void; onDisconnect: () => void; syncing: boolean;
}) {
  const meta = PROVIDER_META[conn.provider] ?? { emoji: "📱", name: conn.provider, color: "#0077B6", grad: ["#0077B6", "#1B998B"] as [string, string] };
  const lastSync = conn.lastSyncedAt
    ? new Date(conn.lastSyncedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
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
              {syncing ? <ActivityIndicator size="small" color={meta.color} /> : <Ionicons name="refresh" size={14} color={meta.color} />}
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

// ─── Manual Entry Modal ───────────────────────────────────────────────────────
function ManualEntryModal({ visible, onClose, onSave }: {
  visible: boolean; onClose: () => void; onSave: (data: Record<string, string>) => void;
}) {
  const [fields, setFields] = useState({
    steps: "", heartRateAvg: "", heartRateMin: "", heartRateMax: "",
    caloriesBurned: "", sleepHours: "", bloodOxygen: "", activeMinutes: "", distanceKm: "",
  });
  const fieldDefs = [
    { key: "steps",          label: "Steps",               unit: "steps",   icon: "👟", keyboard: "numeric" as const },
    { key: "heartRateAvg",   label: "Heart Rate (Avg)",    unit: "bpm",     icon: "❤️", keyboard: "numeric" as const },
    { key: "heartRateMin",   label: "Heart Rate (Min)",    unit: "bpm",     icon: "💙", keyboard: "numeric" as const },
    { key: "heartRateMax",   label: "Heart Rate (Max)",    unit: "bpm",     icon: "❤️‍🔥", keyboard: "numeric" as const },
    { key: "caloriesBurned", label: "Calories Burned",     unit: "kcal",    icon: "🔥", keyboard: "numeric" as const },
    { key: "sleepHours",     label: "Sleep",               unit: "hrs",     icon: "😴", keyboard: "decimal-pad" as const },
    { key: "bloodOxygen",    label: "Blood Oxygen (SpO2)", unit: "%",       icon: "🩸", keyboard: "decimal-pad" as const },
    { key: "activeMinutes",  label: "Active Minutes",      unit: "min",     icon: "⚡", keyboard: "numeric" as const },
    { key: "distanceKm",     label: "Distance",            unit: "km",      icon: "🛤️", keyboard: "decimal-pad" as const },
  ];
  return (
    <Modal visible={visible} transparent animationType="slide">
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
            <TouchableOpacity onPress={() => { onSave(fields); setFields({ steps: "", heartRateAvg: "", heartRateMin: "", heartRateMax: "", caloriesBurned: "", sleepHours: "", bloodOxygen: "", activeMinutes: "", distanceKm: "" }); }}
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
  const [data, setData] = useState<{ latest: WearableData | null; summary: Summary | null; history: WearableData[] }>({ latest: null, summary: null, history: [] });
  const [connections, setConnections] = useState<Connection[]>([]);
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingProvider, setSyncingProvider] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [connectingHC, setConnectingHC] = useState(false);
  const topPad = insets.top;

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    const [wearableResult, connectionsResult, providersResult] = await Promise.allSettled([
      api.getWearableData(),
      api.getWearableConnections(),
      api.getWearableProviders(),
    ]);
    if (wearableResult.status === "fulfilled") setData(wearableResult.value as typeof data);
    if (connectionsResult.status === "fulfilled") setConnections((connectionsResult.value as { connections: Connection[] }).connections);
    if (providersResult.status === "fulfilled") setProviders((providersResult.value as { providers: ProviderConfig[] }).providers);
    setLoading(false);
    setRefreshing(false);
  };

  const onRefresh = useCallback(() => { setRefreshing(true); loadAll(); }, []);

  // ─── Health Connect: read native SDK data and send to server ─────────────────
  const syncHealthConnectNative = async (): Promise<boolean> => {
    const hc = getHC();
    if (!hc) throw new Error("Health Connect module not available in this build.");
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const timeRangeFilter = { operator: "between" as const, startTime: yesterday.toISOString(), endTime: now.toISOString() };

    const [stepsRes, hrRes, calRes, sleepRes, spo2Res, distRes, activeRes] = await Promise.allSettled([
      hc.readRecords("Steps", { timeRangeFilter }),
      hc.readRecords("HeartRate", { timeRangeFilter }),
      hc.readRecords("TotalCaloriesBurned", { timeRangeFilter }),
      hc.readRecords("SleepSession", { timeRangeFilter }),
      hc.readRecords("OxygenSaturation", { timeRangeFilter }),
      hc.readRecords("Distance", { timeRangeFilter }),
      hc.readRecords("ActiveCaloriesBurned", { timeRangeFilter }),
    ]);

    let steps: number | null = null;
    let heartRateAvg: number | null = null;
    let caloriesBurned: number | null = null;
    let sleepHours: number | null = null;
    let bloodOxygen: number | null = null;
    let distanceKm: number | null = null;
    let activeMinutes: number | null = null;

    if (stepsRes.status === "fulfilled") {
      const recs = (stepsRes.value as { records: Array<{ count: number }> }).records;
      steps = recs.reduce((s, r) => s + (r.count || 0), 0);
    }
    if (hrRes.status === "fulfilled") {
      const recs = (hrRes.value as { records: Array<{ samples: Array<{ beatsPerMinute: number }> }> }).records;
      const all = recs.flatMap((r) => r.samples || []);
      if (all.length > 0) heartRateAvg = Math.round(all.reduce((s, r) => s + r.beatsPerMinute, 0) / all.length);
    }
    if (calRes.status === "fulfilled") {
      const recs = (calRes.value as { records: Array<{ energy: { inKilocalories: number } }> }).records;
      caloriesBurned = Math.round(recs.reduce((s, r) => s + (r.energy?.inKilocalories || 0), 0));
    }
    if (sleepRes.status === "fulfilled") {
      const recs = (sleepRes.value as { records: Array<{ startTime: string; endTime: string }> }).records;
      if (recs.length > 0) {
        const ms = recs.reduce((s, r) => s + (new Date(r.endTime).getTime() - new Date(r.startTime).getTime()), 0);
        sleepHours = Math.round((ms / 3_600_000) * 10) / 10;
      }
    }
    if (spo2Res.status === "fulfilled") {
      const recs = (spo2Res.value as { records: Array<{ percentage: number }> }).records;
      if (recs.length > 0) bloodOxygen = Math.round(recs.reduce((s, r) => s + r.percentage, 0) / recs.length * 10) / 10;
    }
    if (distRes.status === "fulfilled") {
      const recs = (distRes.value as { records: Array<{ distance: { inMeters: number } }> }).records;
      distanceKm = Math.round(recs.reduce((s, r) => s + (r.distance?.inMeters || 0), 0) / 1000 * 100) / 100;
    }
    if (activeRes.status === "fulfilled") {
      const recs = (activeRes.value as { records: Array<{ energy: { inKilocalories: number } }> }).records;
      // Estimate: 4 kcal/min average
      const totalKcal = recs.reduce((s, r) => s + (r.energy?.inKilocalories || 0), 0);
      if (totalKcal > 0) activeMinutes = Math.round(totalKcal / 4);
    }

    const result = await api.syncHealthConnect({ steps, heartRateAvg, caloriesBurned, sleepHours, bloodOxygen, distanceKm, activeMinutes });
    return (result as { hasData: boolean }).hasData;
  };

  // ─── Connect Health Connect (native Android permission flow) ─────────────────
  const connectHealthConnect = async () => {
    if (Platform.OS !== "android") {
      Alert.alert("Android Only", "Health Connect is only available on Android devices.");
      return;
    }
    setConnectingHC(true);
    try {
      // Load HC module — if null, the native module wasn't linked in this build
      const hc = getHC();
      if (!hc) {
        Alert.alert(
          "Update Required",
          "Health Connect is not yet linked in this build. A new build is in progress — please update the app from the latest APK.",
          [{ text: "OK" }]
        );
        setConnectingHC(false);
        return;
      }

      // Step 1: Check SDK availability
      const status = await hc.getSdkStatus();
      console.log("[HC] getSdkStatus →", status);

      if (status === hc.SdkAvailabilityStatus.SDK_UNAVAILABLE) {
        Alert.alert(
          "Health Connect Not Installed",
          "Please install Health Connect from the Play Store.",
          [
            {
              text: "Install from Play Store",
              onPress: () => Linking.openURL("https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata"),
            },
            { text: "Cancel", style: "cancel" },
          ]
        );
        setConnectingHC(false);
        return;
      }

      if (status === hc.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
        Alert.alert(
          "Update Required",
          "Please update Health Connect from the Play Store.",
          [
            {
              text: "Update",
              onPress: () => Linking.openURL("https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata"),
            },
            { text: "Cancel", style: "cancel" },
          ]
        );
        setConnectingHC(false);
        return;
      }

      // Step 2: Initialize SDK
      const initialized = await hc.initialize();
      console.log("[HC] initialize →", initialized);
      if (!initialized) {
        Alert.alert("Init Failed", "Health Connect could not be initialized. Please restart the app and try again.");
        setConnectingHC(false);
        return;
      }

      // Step 3: Request permissions — opens HC permission dialog
      const granted = await hc.requestPermission([
        { accessType: "read", recordType: "Steps" },
        { accessType: "read", recordType: "HeartRate" },
        { accessType: "read", recordType: "TotalCaloriesBurned" },
        { accessType: "read", recordType: "ActiveCaloriesBurned" },
        { accessType: "read", recordType: "SleepSession" },
        { accessType: "read", recordType: "OxygenSaturation" },
        { accessType: "read", recordType: "Distance" },
      ]);
      console.log("[HC] requestPermission → granted count:", granted?.length);

      if (!granted || granted.length === 0) {
        Alert.alert(
          "Permission Denied",
          "Allow AORANE to access Health Connect data.\n\nGo to: Health Connect → App Permissions → AORANE → Allow All.",
          [{ text: "OK" }]
        );
        setConnectingHC(false);
        return;
      }

      // Step 4: Initial data sync
      const hasData = await syncHealthConnectNative();
      await loadAll();
      setShowConnect(false);
      Alert.alert(
        "✅ Connected!",
        hasData
          ? "Health Connect connected and data synced!"
          : "Health Connect connected! No activity today yet — open your wearable app, sync it, then tap Refresh here."
      );
    } catch (e: unknown) {
      const msg = (e as Error)?.message ?? String(e) ?? "Unknown error";
      const name = (e as Error)?.name ?? "";
      console.error("[HC] connectHealthConnect error:", name, msg);

      if (msg.toLowerCase().includes("permission")) {
        Alert.alert(
          "Permission Error",
          "Go to Settings → Apps → AORANE → Permissions and allow Health Connect access."
        );
      } else if (msg.toLowerCase().includes("not available") || msg.toLowerCase().includes("unavailable")) {
        Alert.alert(
          "Not Available",
          "Health Connect is not available on this device. Please install it from the Play Store.",
          [
            {
              text: "Install",
              onPress: () => Linking.openURL("https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata"),
            },
            { text: "Cancel", style: "cancel" },
          ]
        );
      } else {
        Alert.alert(
          "Connection Error",
          `Could not connect to Health Connect.\n\nError: ${msg}\n\nMake sure Health Connect is installed, updated, and your wearable app has synced data to it.`
        );
      }
    }
    setConnectingHC(false);
  };

  // ─── Sync provider (called from device card Refresh button) ─────────────────
  const syncProvider = async (provider: string) => {
    setSyncingProvider(provider);
    try {
      if (provider === "health_connect") {
        if (Platform.OS !== "android") {
          Alert.alert("Android Only", "Health Connect sync is only available on Android.");
          setSyncingProvider(null);
          return;
        }
        const hc = getHC();
        if (!hc) throw new Error("Health Connect module not available in this build. Please update the app.");
        const initialized = await hc.initialize();
        if (!initialized) throw new Error("Health Connect init failed");
        const hasData = await syncHealthConnectNative();
        await loadAll();
        if (hasData) {
          Alert.alert("✅ Synced!", "Health Connect data updated successfully!");
        } else {
          Alert.alert("Sync Complete", "No activity data found for today. Make sure your wearable is syncing to Health Connect, then try again.");
        }
      } else {
        Alert.alert("Not Supported", `${PROVIDER_META[provider]?.name || provider} sync is not yet available.`);
      }
    } catch (err: unknown) {
      Alert.alert("Sync Failed", (err as Error)?.message || "Could not sync data. Please try again.");
    }
    setSyncingProvider(null);
  };

  const disconnectProvider = (provider: string) => {
    Alert.alert(
      "Disconnect Device",
      `Disconnect ${PROVIDER_META[provider]?.name || provider}? Your existing data won't be deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Disconnect", style: "destructive", onPress: async () => {
          try { await api.disconnectWearable(provider); await loadAll(); } catch { Alert.alert("Error", "Failed to disconnect."); }
        }},
      ]
    );
  };

  const saveManualData = async (fields: Record<string, string>) => {
    const payload: Record<string, number | undefined> = {};
    if (fields.steps) payload.steps = parseInt(fields.steps);
    if (fields.heartRateAvg) payload.heartRateAvg = parseInt(fields.heartRateAvg);
    if (fields.heartRateMin) payload.heartRateMin = parseInt(fields.heartRateMin);
    if (fields.heartRateMax) payload.heartRateMax = parseInt(fields.heartRateMax);
    if (fields.caloriesBurned) payload.caloriesBurned = parseFloat(fields.caloriesBurned);
    if (fields.sleepHours) payload.sleepHours = parseFloat(fields.sleepHours);
    if (fields.bloodOxygen) payload.bloodOxygen = parseFloat(fields.bloodOxygen);
    if (fields.activeMinutes) payload.activeMinutes = parseInt(fields.activeMinutes);
    if (fields.distanceKm) payload.distanceKm = parseFloat(fields.distanceKm);
    try {
      await api.addManualWearableData(payload);
      await loadAll();
      setShowManual(false);
      Alert.alert("✅ Saved!", "Health data logged successfully.");
    } catch {
      Alert.alert("Error", "Failed to save data. Please try again.");
    }
  };

  const { latest, summary } = data;
  const activeConnections = connections.filter((c) => c.isActive);

  return (
    <View style={{ flex: 1, backgroundColor: "#F0F9FF" }}>
      <LinearGradient colors={["#E0F2FE", "#BAE6FD", "#EFF6FF"]} style={StyleSheet.absoluteFill} />

      <ScrollView
        contentContainerStyle={{ paddingTop: topPad + 12, paddingBottom: 100, paddingHorizontal: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#0077B6"]} tintColor="#0077B6" />}
      >
        {/* ─── Header ─── */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
          <TouchableOpacity onPress={() => router.back()}
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(0,119,182,0.1)", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
            <Ionicons name="arrow-back" size={20} color="#0077B6" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.pageTitle}>Smart Wearables</Text>
            <Text style={styles.pageSub}>Health Connect & Wearable Trackers</Text>
          </View>
          <TouchableOpacity onPress={() => setShowManual(true)}
            style={{ backgroundColor: "#0077B6", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Ionicons name="add" size={16} color="#FFF" />
            <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 12 }}>Log Data</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <ActivityIndicator size="large" color="#0077B6" />
            <Text style={{ color: "#7A90A4", marginTop: 12, fontFamily: "Inter_400Regular" }}>Loading health data...</Text>
          </View>
        ) : (
          <>
            {/* ─── CONNECTED DEVICES ─── */}
            <View style={styles.section}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <Text style={styles.sectionTitle}>Connected Devices</Text>
                <TouchableOpacity onPress={() => setShowConnect(true)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,119,182,0.08)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
                  <Ionicons name="add" size={14} color="#0077B6" />
                  <Text style={{ color: "#0077B6", fontSize: 12, fontFamily: "Inter_600SemiBold" }}>Connect</Text>
                </TouchableOpacity>
              </View>

              {activeConnections.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={{ fontSize: 40, marginBottom: 12 }}>⌚</Text>
                  <Text style={{ fontFamily: "Inter_700Bold", fontSize: 16, color: "#0D1F33", textAlign: "center" }}>No Device Connected</Text>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#7A90A4", textAlign: "center", marginTop: 6, lineHeight: 20 }}>
                    Connect Health Connect (Android), Apple HealthKit (iOS), or Samsung Health.
                  </Text>
                  <TouchableOpacity onPress={() => setShowConnect(true)}
                    style={{ backgroundColor: "#0077B6", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, marginTop: 16 }}>
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

            {/* ─── TODAY'S METRICS ─── */}
            {latest && (
              <View style={styles.section}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <Text style={styles.sectionTitle}>Latest Reading</Text>
                  <Text style={{ color: "#7A90A4", fontSize: 11, fontFamily: "Inter_400Regular" }}>
                    {PROVIDER_META[latest.provider]?.emoji} {PROVIDER_META[latest.provider]?.name || latest.provider}
                  </Text>
                </View>
                <MetricCard icon="👟" label="Steps"      value={latest.steps?.toLocaleString() ?? null} color="#0077B6" />
                <MetricCard icon="❤️" label="Heart Rate"  value={latest.heartRateAvg}                   unit="bpm"  color="#EF4444" />
                <MetricCard icon="🔥" label="Calories"    value={latest.caloriesBurned ? Math.round(parseFloat(latest.caloriesBurned)) : null} unit="kcal" color="#F97316" />
                <MetricCard icon="😴" label="Sleep"       value={latest.sleepHours ? parseFloat(latest.sleepHours).toFixed(1) : null} unit="hrs" color="#8B5CF6" />
                <MetricCard icon="🩸" label="SpO2"        value={latest.bloodOxygen ? parseFloat(latest.bloodOxygen).toFixed(1) : null} unit="%" color="#EC4899" />
                <MetricCard icon="⚡" label="Active Min"  value={latest.activeMinutes} unit="min" color="#10B981" />
                <MetricCard icon="🛤️" label="Distance"   value={latest.distanceKm ? parseFloat(latest.distanceKm).toFixed(2) : null} unit="km" color="#06B6D4" />
              </View>
            )}

            {/* ─── 7-DAY SUMMARY ─── */}
            {summary && summary.recordCount > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { marginBottom: 14 }]}>7-Day Summary</Text>
                <View style={styles.summaryGrid}>
                  {[
                    { icon: "👟", label: "Avg Steps/Day", value: summary.avgSteps?.toLocaleString() ?? "—", color: "#0077B6" },
                    { icon: "❤️", label: "Avg Heart Rate", value: summary.avgHr ? `${summary.avgHr} bpm` : "—", color: "#EF4444" },
                    { icon: "🔥", label: "Total Calories", value: summary.totalCalories ? `${summary.totalCalories} kcal` : "—", color: "#F97316" },
                    { icon: "⚡", label: "Total Active Min", value: `${summary.totalActiveMin || 0} min`, color: "#10B981" },
                    { icon: "😴", label: "Avg Sleep", value: summary.avgSleep ? `${summary.avgSleep} hrs` : "—", color: "#8B5CF6" },
                    { icon: "🩸", label: "Avg SpO2", value: summary.avgSpo2 ? `${summary.avgSpo2}%` : "—", color: "#EC4899" },
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

            {/* ─── NO DATA YET ─── */}
            {!latest && (
              <View style={styles.section}>
                <View style={[styles.emptyCard, { paddingVertical: 32 }]}>
                  <Text style={{ fontSize: 48, marginBottom: 12 }}>📊</Text>
                  <Text style={{ fontFamily: "Inter_700Bold", fontSize: 16, color: "#0D1F33", textAlign: "center" }}>
                    {activeConnections.length > 0 ? "No Data Synced Yet" : "No Health Data Yet"}
                  </Text>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#7A90A4", textAlign: "center", marginTop: 6, lineHeight: 20 }}>
                    {activeConnections.length > 0
                      ? "No activity data found for today. Open your wearable app, sync it to Health Connect, then tap Sync."
                      : "Connect a device or manually log your health data to see metrics here."}
                  </Text>
                  {activeConnections.length > 0 && (
                    <TouchableOpacity
                      onPress={() => syncProvider(activeConnections[0].provider)}
                      disabled={!!syncingProvider}
                      style={{ backgroundColor: "#0077B6", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, marginTop: 16, flexDirection: "row", alignItems: "center", gap: 8 }}>
                      {syncingProvider ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={{ fontSize: 16 }}>🔄</Text>}
                      <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 14 }}>Sync Now</Text>
                    </TouchableOpacity>
                  )}
                  <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                    <TouchableOpacity onPress={() => setShowConnect(true)}
                      style={{ backgroundColor: "#0077B6", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 }}>
                      <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>Connect Device</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setShowManual(true)}
                      style={{ backgroundColor: "rgba(0,119,182,0.1)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: "rgba(0,119,182,0.3)" }}>
                      <Text style={{ color: "#0077B6", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>Log Manually</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* ─── HEALTH TARGETS ─── */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { marginBottom: 12 }]}>Health Targets (WHO Guidelines)</Text>
              <View style={{ gap: 8 }}>
                {[
                  { icon: "👟", target: "10,000", label: "Daily Steps", current: latest?.steps ?? null, unit: "steps", good: (v: number) => v >= 10000 },
                  { icon: "❤️", target: "60–100", label: "Resting Heart Rate", current: latest?.heartRateAvg ?? null, unit: "bpm", good: (v: number) => v >= 60 && v <= 100 },
                  { icon: "😴", target: "7–9", label: "Sleep Duration", current: latest?.sleepHours ? parseFloat(latest.sleepHours) : null, unit: "hours", good: (v: number) => v >= 7 && v <= 9 },
                  { icon: "🩸", target: "≥95", label: "Blood Oxygen (SpO2)", current: latest?.bloodOxygen ? parseFloat(latest.bloodOxygen) : null, unit: "%", good: (v: number) => v >= 95 },
                  { icon: "⚡", target: "150+", label: "Weekly Active Minutes", current: summary?.totalActiveMin ?? null, unit: "min", good: (v: number) => v >= 150 },
                ].map((t) => {
                  const isGood = t.current !== null && t.good(t.current);
                  const hasData = t.current !== null;
                  return (
                    <View key={t.label} style={[styles.targetRow, { backgroundColor: hasData ? (isGood ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)") : "#F8FAFC" }]}>
                      <Text style={{ fontSize: 18, width: 28 }}>{t.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: "#0D1F33" }}>{t.label}</Text>
                        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#7A90A4" }}>Target: {t.target} {t.unit}</Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ fontFamily: "Inter_700Bold", fontSize: 14, color: hasData ? (isGood ? "#10B981" : "#EF4444") : "#D1D5DB" }}>
                          {hasData ? `${t.current} ${t.unit}` : "No data"}
                        </Text>
                        {hasData && <Text style={{ fontSize: 10, color: isGood ? "#10B981" : "#EF4444" }}>{isGood ? "✓ Good" : "⚠ Improve"}</Text>}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* ─── CONNECT DEVICE MODAL ─── */}
      <Modal visible={showConnect} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#FFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 32 }}>
            <View style={{ padding: 20, borderBottomWidth: 1, borderColor: "#E5EFF7", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 18, color: "#0D1F33" }}>Connect a Device</Text>
              <TouchableOpacity onPress={() => setShowConnect(false)}><Ionicons name="close" size={22} color="#7A90A4" /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
              {providers.filter((p) => ALLOWED_PROVIDERS.includes(p.id)).map((p) => {
                const meta = PROVIDER_META[p.id] ?? { emoji: "📱", name: p.name, color: "#0077B6", grad: ["#0077B6", "#1B998B"] as [string, string] };
                const alreadyConnected = activeConnections.some((c) => c.provider === p.id);
                const isHC = p.id === "health_connect";
                return (
                  <TouchableOpacity key={p.id}
                    disabled={!p.available || alreadyConnected || (isHC && connectingHC)}
                    onPress={() => { if (isHC) connectHealthConnect(); }}
                    style={[styles.providerBtn, { opacity: !p.available ? 0.45 : 1 }]}
                  >
                    <LinearGradient
                      colors={alreadyConnected ? ["#10B981", "#059669"] : (p.available ? meta.grad : ["#D1D5DB", "#9CA3AF"])}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={styles.providerBtnGrad}>
                      <Text style={{ fontSize: 26 }}>{meta.emoji}</Text>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 15 }}>{p.name}</Text>
                        <Text style={{ color: "rgba(255,255,255,0.75)", fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2 }}>
                          {alreadyConnected ? "✓ Already Connected" : (!p.available ? "Coming Soon" : p.description)}
                        </Text>
                      </View>
                      {p.available && !alreadyConnected && (
                        isHC && connectingHC
                          ? <ActivityIndicator size="small" color="#FFF" />
                          : <Ionicons name="arrow-forward" size={18} color="rgba(255,255,255,0.8)" />
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── MANUAL ENTRY MODAL ─── */}
      <ManualEntryModal visible={showManual} onClose={() => setShowManual(false)} onSave={saveManualData} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  pageTitle: { color: "#0D1F33", fontFamily: "Inter_700Bold", fontSize: 22 },
  pageSub: { color: "#7A90A4", fontSize: 12, fontFamily: "Inter_400Regular" },
  section: {
    backgroundColor: "rgba(255,255,255,0.75)",
    borderRadius: 20, padding: 16, marginBottom: 16,
    shadowColor: "#0077B6", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#0D1F33" },
  metricRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F0F4F8",
  },
  metricRowIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: "center", justifyContent: "center", marginRight: 12,
  },
  metricRowLabel: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: "#374151" },
  metricRowValue: { fontSize: 15, fontFamily: "Inter_700Bold" },
  deviceCard: { borderRadius: 14, overflow: "hidden" },
  deviceCardGrad: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "rgba(0,119,182,0.1)" },
  deviceIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  deviceName: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#0D1F33" },
  deviceSync: { fontFamily: "Inter_400Regular", fontSize: 11, color: "#7A90A4", marginTop: 2 },
  deviceBtn: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  emptyCard: {
    alignItems: "center", paddingVertical: 24,
    backgroundColor: "rgba(0,119,182,0.04)",
    borderRadius: 16, borderWidth: 1.5, borderColor: "rgba(0,119,182,0.1)",
    borderStyle: "dashed",
  },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  summaryItem: {
    width: (W - 32 - 16 * 2 - 10) / 2,
    backgroundColor: "#F8FAFC", borderRadius: 12, padding: 12, paddingLeft: 14,
  },
  targetRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 12, borderRadius: 12,
  },
  providerBtn: { borderRadius: 14, overflow: "hidden" },
  providerBtnGrad: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 14 },
});
