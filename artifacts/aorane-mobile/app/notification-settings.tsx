import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, Switch, TouchableOpacity,
  StyleSheet, Platform, ActivityIndicator, Alert,
} from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  scheduleWaterReminders, cancelWaterReminders,
  scheduleFoodReminders, cancelFoodReminders,
  schedulePeriodReminders, cancelPeriodReminders,
  scheduleMedicineReminders, cancelMedicineReminders,
  requestNotificationPermissions,
  setupNotificationChannels,
  requestExactAlarmPermission,
  requestIgnoreBatteryOptimizations,
  getNotificationDiagnostics,
  type NotificationDiagnosticEntry,
} from "@/lib/notifications";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { api } from "@/lib/api";
import { logSilentError } from "@/lib/silentCatch";

// Keep in sync with _layout.tsx NOTIF_SETTINGS_KEY
const NOTIF_SETTINGS_CACHE_KEY = "aorane_notif_settings_v1";

const C = {
  bg: "#FFF8F3", card: "#FFFFFF", primary: "#E8622A", accent: "#F5A623",
  text: "#1A1A1A", muted: "#7A7A7A", border: "#F0E6E0",
  red: "#EF4444", green: "#10B981",
};

type Settings = {
  notificationsEnabled: boolean;
  medicineReminders: boolean;
  waterReminders: boolean;
  foodReminders: boolean;
  periodReminders: boolean;
  // NOTE: kept for backend schema compatibility only — there is no working
  // "AI Suggestions" feature behind this yet (no scheduling/push logic
  // anywhere). Intentionally NOT shown in the UI to avoid shipping a
  // placeholder/non-functional toggle to Play Store users. Wire this up
  // properly (or remove from the backend schema too) before re-adding a
  // UI control for it.
  suggestionNotifications: boolean;
  wakeUpTime: string;
  bedTime: string;
  weeklyReportEmail: boolean;
  calorieGoal: number;
  waterGoalGlasses: number;
};

const DEFAULT_SETTINGS: Settings = {
  notificationsEnabled: true,
  medicineReminders: true,
  waterReminders: true,
  foodReminders: true,
  periodReminders: true,
  suggestionNotifications: true,
  wakeUpTime: "07:00",
  bedTime: "22:30",
  weeklyReportEmail: false,
  calorieGoal: 2000,
  waterGoalGlasses: 8,
};

function SettingRow({
  icon, iconBg, title, subtitle, value, onToggle, disabled = false,
}: {
  icon: string; iconBg: string; title: string; subtitle?: string;
  value: boolean; onToggle: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <View style={[styles.row, disabled && { opacity: 0.5 }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
        <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
          <Text style={{ fontSize: 18 }}>{icon}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: C.text, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>{title}</Text>
          {subtitle && <Text style={{ color: C.muted, fontFamily: "Inter_400Regular", fontSize: 12 }}>{subtitle}</Text>}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={(v) => { Haptics.selectionAsync(); onToggle(v); }}
        disabled={disabled}
        trackColor={{ false: "#E2EFF5", true: C.accent + "60" }}
        thumbColor={value ? C.accent : "#BCC8D0"}
        ios_backgroundColor="#E2EFF5"
      />
    </View>
  );
}

function NumberRow({
  icon, iconBg, title, subtitle, value, unit, min, max, onChange,
}: {
  icon: string; iconBg: string; title: string; subtitle?: string;
  value: number; unit: string; min: number; max: number; onChange: (v: number) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
        <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
          <Text style={{ fontSize: 18 }}>{icon}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: C.text, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>{title}</Text>
          {subtitle && <Text style={{ color: C.muted, fontFamily: "Inter_400Regular", fontSize: 12 }}>{subtitle}</Text>}
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <TouchableOpacity onPress={() => { if (value > min) { Haptics.selectionAsync(); onChange(value - 1); } }} style={styles.stepBtn}>
          <Ionicons name="remove" size={16} color={C.primary} />
        </TouchableOpacity>
        <Text style={{ color: C.text, fontFamily: "Inter_700Bold", fontSize: 16, minWidth: 36, textAlign: "center" }}>{value} {unit}</Text>
        <TouchableOpacity onPress={() => { if (value < max) { Haptics.selectionAsync(); onChange(value + 1); } }} style={styles.stepBtn}>
          <Ionicons name="add" size={16} color={C.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const topPad = insets.top;
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // AUDIT FIX (Phase 0 — diagnostics): lets the user (and support/QA) verify
  // that reminders are ACTUALLY scheduled on this device and see exactly
  // when the OS will next fire each one, instead of guessing why a
  // notification "didn't come on time". Uses
  // Notifications.getAllScheduledNotificationsAsync() +
  // Notifications.getNextTriggerDateAsync() directly.
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagOpen, setDiagOpen] = useState(false);
  const [diagPermission, setDiagPermission] = useState<boolean | null>(null);
  const [diagEntries, setDiagEntries] = useState<NotificationDiagnosticEntry[]>([]);

  const runDiagnostics = async () => {
    setDiagLoading(true);
    try {
      const { permissionGranted, entries } = await getNotificationDiagnostics();
      setDiagPermission(permissionGranted);
      setDiagEntries(entries);
      setDiagOpen(true);
    } catch {
      Alert.alert("Diagnostics failed", "Could not read scheduled notifications on this device.");
    }
    setDiagLoading(false);
  };

  const load = useCallback(async () => {
    // ✅ Load from cache first (instant) — screen shows immediately
    try {
      const cached = await AsyncStorage.getItem(NOTIF_SETTINGS_CACHE_KEY);
      if (cached) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(cached) } as Settings);
        setLoading(false); // Show UI with cached values while backend loads
      }
    } catch { }

    // Then fetch fresh from backend
    try {
      const res = await api.getNotificationSettings();
      setSettings({ ...DEFAULT_SETTINGS, ...res.settings } as Settings);
    } catch { }
    setLoading(false);
  }, []);

  useEffect(() => { load();
   setupNotificationChannels(); // ✅ ADD THIS
  }, [load]);

  const update = (key: keyof Settings, val: unknown) => {
    setSettings((prev) => ({ ...prev, [key]: val }));
    setIsDirty(true);
  };

  const save = async () => {
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await api.updateNotificationSettings(settings as unknown as Record<string, unknown>);
      // ✅ Update local cache so restoreAllNotifications uses fresh values
      // even if backend is cold on next app launch
      AsyncStorage.setItem(NOTIF_SETTINGS_CACHE_KEY, JSON.stringify(settings)).catch((e) => logSilentError('storage-write', e));
      setIsDirty(false);

      const notifEnabled = settings.notificationsEnabled;

      // Request permission if needed
      if (notifEnabled) {
        const granted =  await requestNotificationPermissions();
        if (!granted) {
          Alert.alert(
              "Permission Required", 
              "Please enable notifications in your device settings to receive reminders."
            );
          setSaving(false); // stop loading
          return; // ❗ STOP further execution
        }
      }
      // ✅ FIX 2: ALWAYS clear old notifications first (CRITICAL)
      await cancelWaterReminders();
      await cancelFoodReminders();
      await cancelPeriodReminders();

      // ✅ FIX 3: Then schedule fresh ones

      // Water reminders
      if (notifEnabled && settings.waterReminders) {
        await scheduleWaterReminders(
          settings.wakeUpTime,
          settings.bedTime,
          settings.waterGoalGlasses
        );
      }

      // Food / Meal reminders
      if (notifEnabled && settings.foodReminders) {
        await scheduleFoodReminders(
          settings.wakeUpTime,
          settings.bedTime
        );
      }

      // Period reminders — fetch next period date and schedule
      if (notifEnabled && settings.periodReminders) {
        try {
          const periodData = await api.getPeriodLogs() as {
            prediction?: { nextPeriodDate?: string }
          };
          if (periodData?.prediction?.nextPeriodDate) {
            await schedulePeriodReminders(
              periodData.prediction.nextPeriodDate
            );
          }
        } catch { }
      }

      // ✅ BUG FIX: "Medicine Reminders" toggle used to be saved to the
      // backend but never actually enforced on-device — turning it off did
      // nothing, and turning it back on didn't reschedule anything. Now:
      // OFF → cancel all medicine notifications. ON → cancel any stale ones
      // and reschedule fresh reminders for every currently-active medicine.
      if (!notifEnabled || !settings.medicineReminders) {
        await cancelMedicineReminders();
      } else {
        try {
          const medRes = await api.getMedicineSchedules();
          const medicines = (medRes.schedules || []) as Array<{
            id: string; medicineName: string; dosage?: string;
            reminderTimes: string[]; mealTiming?: string; isActive: boolean;
          }>;
          const active = medicines.filter(
            (m) => m.isActive && (m.reminderTimes?.length ?? 0) > 0
          );
          await Promise.allSettled(
            active.map((m) =>
              scheduleMedicineReminders({
                medicineId:   `medicine_${m.id}`,
                medicineName: m.medicineName,
                dosage:       m.dosage,
                times:        m.reminderTimes,
                mealTiming:   m.mealTiming,
              })
            )
          );
        } catch (medErr) {
          logSilentError("medicine-reminder-resave", medErr as Error);
          // Non-fatal — water/food/period settings above already saved fine.
        }
      }

      Alert.alert("Saved! ✅",
        "Notification settings saved. Reminders are now active."
      );
    } catch {
      Alert.alert("Error", "Could not save settings. Please try again.");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <LinearGradient colors={["#E8622A", "#F5A623"]} style={{ paddingTop: topPad + 10, paddingHorizontal: 18, paddingBottom: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#FFF", fontSize: 21, fontFamily: "Inter_700Bold" }}>🔔 Notification Settings</Text>
            <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, fontFamily: "Inter_400Regular" }}>Customise your reminders and alerts</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 80, gap: 14 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Web Notice */}
        {Platform.OS === "web" && (
          <View style={{ backgroundColor: "#FFF3CD", borderRadius: 14, borderWidth: 1, borderColor: "#FBBF24", padding: 14, flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
            <Ionicons name="phone-portrait-outline" size={22} color="#D97706" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#92400E", fontFamily: "Inter_700Bold", fontSize: 13, marginBottom: 4 }}>Native App Required for Notifications</Text>
              <Text style={{ color: "#92400E", fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18 }}>
                Push notifications (medicine, water, period reminders) only work on the Aorane native mobile app. Download our Android/iOS app to receive real-time reminders. You can still configure your preferences here.
              </Text>
            </View>
          </View>
        )}

        {/* Master Toggle */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>🔔 Main Toggle</Text>
          <SettingRow
            icon="🔔" iconBg="#EFF6FF"
            title="All Notifications"
            subtitle="Turn all notifications on or off at once"
            value={settings.notificationsEnabled}
            onToggle={(v) => update("notificationsEnabled", v)}
          />
        </View>

        {/* Android Delivery Reliability — helps on Xiaomi/Vivo/Oppo etc. */}
        {Platform.OS === "android" && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>⚡ Fix Delayed Notifications</Text>
            <Text style={{ color: C.muted, fontFamily: "Inter_400Regular", fontSize: 12, marginBottom: 12, lineHeight: 17 }}>
              Some phones (Xiaomi, Vivo, Oppo, Realme) delay or batch reminders to save battery. Tap below to allow Aorane to send reminders exactly on time.
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); requestExactAlarmPermission(); }}
                style={{ flex: 1, borderRadius: 12, borderWidth: 1.5, borderColor: C.primary, paddingVertical: 10, alignItems: "center" }}
              >
                <Text style={{ color: C.primary, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>Allow Exact Alarms</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); requestIgnoreBatteryOptimizations(); }}
                style={{ flex: 1, borderRadius: 12, borderWidth: 1.5, borderColor: C.primary, paddingVertical: 10, alignItems: "center" }}
              >
                <Text style={{ color: C.primary, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>Disable Battery Optimization</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Health Reminders */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>💊 Health Reminders</Text>
          <SettingRow
            icon="💊" iconBg="#FEF3F2"
            title="Medicine Reminders"
            subtitle="Reminds you to take your medicines on time"
            value={settings.medicineReminders}
            onToggle={(v) => update("medicineReminders", v)}
            disabled={!settings.notificationsEnabled}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="💧" iconBg="#EFF9FF"
            title="Water Reminders"
            subtitle="Reminder to drink water"
            value={settings.waterReminders}
            onToggle={(v) => update("waterReminders", v)}
            disabled={!settings.notificationsEnabled}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="🍽️" iconBg="#F0FFF4"
            title="Food / Meal Reminders"
            subtitle="Meal reminder notification"
            value={settings.foodReminders}
            onToggle={(v) => update("foodReminders", v)}
            disabled={!settings.notificationsEnabled}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="🌸" iconBg="#FDF2F8"
            title="Period Reminders"
            subtitle="Monthly cycle alerts (for women)"
            value={settings.periodReminders}
            onToggle={(v) => update("periodReminders", v)}
            disabled={!settings.notificationsEnabled}
          />
        </View>

        {/* Daily Schedule — drives water reminder spacing */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>⏰ Daily Schedule</Text>
          <Text style={{ color: C.muted, fontFamily: "Inter_400Regular", fontSize: 12, marginBottom: 14, lineHeight: 17 }}>
            Set your daily routine so we can space your water & meal reminders perfectly.
          </Text>

          {/* Wake-Up Time */}
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={[styles.iconBox, { backgroundColor: "#FFF7ED" }]}>
                <Text style={{ fontSize: 18 }}>🌅</Text>
              </View>
              <View>
                <Text style={{ color: C.text, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>Wake-Up Time</Text>
                <Text style={{ color: C.muted, fontFamily: "Inter_400Regular", fontSize: 11 }}>Reminders start from this time</Text>
              </View>
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                <Text style={{ color: C.primary, fontFamily: "Inter_700Bold", fontSize: 18 }}>{settings.wakeUpTime}</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {["05:00","06:00","06:30","07:00","07:30","08:00","08:30","09:00"].map(t => (
                <TouchableOpacity key={t} onPress={() => { Haptics.selectionAsync(); update("wakeUpTime", t); }}
                  style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5,
                    borderColor: settings.wakeUpTime === t ? C.primary : C.border,
                    backgroundColor: settings.wakeUpTime === t ? C.primary + "15" : "#FAFAFA" }}>
                  <Text style={{ fontSize: 12, fontFamily: settings.wakeUpTime === t ? "Inter_700Bold" : "Inter_400Regular", color: settings.wakeUpTime === t ? C.primary : C.muted }}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={[styles.divider, { marginVertical: 14 }]} />

          {/* Bedtime */}
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={[styles.iconBox, { backgroundColor: "#F0F0FF" }]}>
                <Text style={{ fontSize: 18 }}>🌙</Text>
              </View>
              <View>
                <Text style={{ color: C.text, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>Bedtime</Text>
                <Text style={{ color: C.muted, fontFamily: "Inter_400Regular", fontSize: 11 }}>Reminders stop before this time</Text>
              </View>
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                <Text style={{ color: "#7C3AED", fontFamily: "Inter_700Bold", fontSize: 18 }}>{settings.bedTime}</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {["20:00","21:00","21:30","22:00","22:30","23:00","23:30","00:00"].map(t => (
                <TouchableOpacity key={t} onPress={() => { Haptics.selectionAsync(); update("bedTime", t); }}
                  style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5,
                    borderColor: settings.bedTime === t ? "#7C3AED" : C.border,
                    backgroundColor: settings.bedTime === t ? "#7C3AED15" : "#FAFAFA" }}>
                  <Text style={{ fontSize: 12, fontFamily: settings.bedTime === t ? "Inter_700Bold" : "Inter_400Regular", color: settings.bedTime === t ? "#7C3AED" : C.muted }}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={[styles.divider, { marginVertical: 14 }]} />

          {/* Visual Schedule Preview */}
          <Text style={{ color: C.muted, fontFamily: "Inter_700Bold", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Schedule Preview</Text>
          <View style={{ gap: 8 }}>
            {[
              { time: settings.wakeUpTime, icon: "🌅", label: "Wake up & first water", color: "#F5A623" },
              { time: (() => { const [h, m] = settings.wakeUpTime.split(":").map(Number); const t = h * 60 + (m || 0) + 60; return `${String(Math.floor(t/60)).padStart(2,"0")}:${String(t%60).padStart(2,"0")}`; })(), icon: "☀️", label: "Breakfast time", color: "#10B981" },
              { time: "13:00", icon: "🍱", label: "Lunch reminder", color: "#0EA5E9" },
              { time: "16:00", icon: "💧", label: "Afternoon water + snack", color: "#E8622A" },
              { time: "19:30", icon: "🌙", label: "Dinner reminder", color: "#8B5CF6" },
              { time: settings.bedTime, icon: "😴", label: "Bedtime — last reminder", color: "#6B7280" },
            ].map((item, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={{ fontSize: 14, width: 20, textAlign: "center" }}>{item.icon}</Text>
                <View style={{ width: 1, height: 32, backgroundColor: item.color + "40", position: "absolute", left: 29, top: 16 }} />
                <View style={{ backgroundColor: item.color + "15", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: item.color + "30" }}>
                  <Text style={{ color: item.color, fontFamily: "Inter_700Bold", fontSize: 11 }}>{item.time}</Text>
                </View>
                <Text style={{ color: C.text, fontFamily: "Inter_400Regular", fontSize: 12, flex: 1 }}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Daily Goals */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>🎯 Daily Goals</Text>
          <NumberRow
            icon="🔥" iconBg="#FFF7ED"
            title="Calorie Goal"
            subtitle="Daily calorie target"
            value={settings.calorieGoal || 2000}
            unit="kcal"
            min={1000}
            max={5000}
            onChange={(v) => update("calorieGoal", v)}
          />
          <View style={styles.divider} />
          <NumberRow
            icon="💧" iconBg="#EFF9FF"
            title="Water Goal"
            subtitle="Daily glasses target"
            value={settings.waterGoalGlasses || 8}
            unit="glass"
            min={4}
            max={16}
            onChange={(v) => update("waterGoalGlasses", v)}
          />
        </View>

        {/* Reports */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📊 Reports</Text>
          <SettingRow
            icon="📧" iconBg="#EFF6FF"
            title="Weekly Email Report"
            subtitle="Weekly health summary via email"
            value={settings.weeklyReportEmail}
            onToggle={(v) => update("weeklyReportEmail", v)}
          />
        </View>

        {/* AUDIT FIX (Phase 0): Notification Diagnostics — real, on-device
            verification instead of guesswork. Shows what's actually
            scheduled right now and exactly when the OS will next fire each
            one (Notifications.getAllScheduledNotificationsAsync() +
            Notifications.getNextTriggerDateAsync()). */}
        {Platform.OS !== "web" && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>🔍 Notification Diagnostics</Text>
            <Text style={{ color: C.muted, fontFamily: "Inter_400Regular", fontSize: 12, marginBottom: 12, lineHeight: 17 }}>
              Check exactly what's scheduled on this device right now, and when each reminder will actually fire.
            </Text>
            <TouchableOpacity
              onPress={runDiagnostics}
              disabled={diagLoading}
              style={{ borderRadius: 12, borderWidth: 1.5, borderColor: C.primary, paddingVertical: 10, alignItems: "center", opacity: diagLoading ? 0.6 : 1 }}
            >
              {diagLoading ? (
                <ActivityIndicator size="small" color={C.primary} />
              ) : (
                <Text style={{ color: C.primary, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>Run Diagnostics</Text>
              )}
            </TouchableOpacity>

            {diagOpen && (
              <View style={{ marginTop: 14, gap: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons
                    name={diagPermission ? "checkmark-circle" : "close-circle"}
                    size={18}
                    color={diagPermission ? C.green : C.red}
                  />
                  <Text style={{ color: C.text, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                    Notification permission: {diagPermission ? "Granted" : "Not granted"}
                  </Text>
                </View>

                {!diagPermission && (
                  <Text style={{ color: C.red, fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 17 }}>
                    Permission is off, so nothing below will ever be delivered even if it shows as scheduled. Enable notifications for Aorane in your phone's Settings app.
                  </Text>
                )}

                <Text style={{ color: C.text, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                  {diagEntries.length} reminder{diagEntries.length === 1 ? "" : "s"} currently scheduled on this device
                </Text>

                {diagEntries.length === 0 && (
                  <Text style={{ color: C.muted, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                    Nothing is scheduled. Turn on a reminder toggle above and tap Save, or add a medicine, to schedule one.
                  </Text>
                )}

                {diagEntries.map((e) => (
                  <View key={e.id} style={{ borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8 }}>
                    <Text style={{ color: C.text, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>{e.title}</Text>
                    <Text style={{ color: C.muted, fontFamily: "Inter_400Regular", fontSize: 11 }}>Type: {e.type}</Text>
                    <Text style={{ color: e.nextTriggerAt ? C.green : C.red, fontFamily: "Inter_600SemiBold", fontSize: 11 }}>
                      Next fire: {e.nextTriggerAtLabel}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Info Banner */}
        <View style={{ backgroundColor: "#EFF9FF", borderRadius: 14, borderWidth: 1, borderColor: "#BAE6FD", padding: 14, flexDirection: "row", gap: 10 }}>
          <Ionicons name="information-circle-outline" size={20} color={C.primary} />
          <Text style={{ color: C.primary, fontFamily: "Inter_400Regular", fontSize: 12, flex: 1, lineHeight: 18 }}>
            Water reminders are scheduled between your Wake-Up and Bedtime. Period reminders fire 2 days before, 1 day before, and on your predicted cycle date. Medicine reminders are set when you add a medicine schedule.
          </Text>
        </View>
      </ScrollView>

      {/* Save Bar */}
      {isDirty && (
        <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#FFF", borderTopWidth: 1, borderTopColor: C.border, padding: 16, paddingBottom: insets.bottom + 10 }}>
          <TouchableOpacity onPress={save} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.7 }]}>
            <LinearGradient colors={[C.primary, C.accent]} style={styles.saveBtnGrad}>
              {saving ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 16 }}>✅ Save Settings</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backBtn: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20, padding: 8 },
  card: { backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 16, gap: 2 },
  sectionTitle: { color: C.muted, fontFamily: "Inter_700Bold", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 2 },
  stepBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1.5, borderColor: C.primary, alignItems: "center", justifyContent: "center" },
  saveBtn: { borderRadius: 14, overflow: "hidden" },
  saveBtnGrad: { padding: 16, alignItems: "center", justifyContent: "center" },
});