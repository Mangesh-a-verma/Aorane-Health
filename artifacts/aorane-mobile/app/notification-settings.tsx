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
  openNotificationSettings,
  runSchedulingSelfTest,
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
  // "HH:MM,HH:MM,HH:MM" — breakfast, lunch, dinner. Seeded from the user's
  // country at signup and editable through the API. The preview below used to
  // show a hardcoded 13:00 / 19:30 regardless of what was actually scheduled.
  foodReminderTime: string;
  waterReminderTimes: string;
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
  // These must mirror the DB column defaults, not be blank: save() PUTs the
  // whole settings object, and the server rejects an empty time list with a
  // 400 that would fail the entire save.
  foodReminderTime: "07:30,12:30,19:30",
  waterReminderTimes: "09:00,13:00,18:00,21:00",
  weeklyReportEmail: false,
  calorieGoal: 2000,
  waterGoalGlasses: 8,
};

/** Nth entry of a "HH:MM,HH:MM,HH:MM" list, or null if it isn't there. */
function mealTimeAt(list: string, i: number): string | null {
  const parts = (list || "").split(",").map((p) => p.trim()).filter((p) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(p));
  return parts[i] ?? null;
}

/** The scheduler's fallback breakfast: an hour after waking, never past 10:00. */
function plusOneHour(hhmm: string): string {
  const [h, m] = (hhmm || "07:00").split(":").map(Number);
  const t = Math.min((h || 0) * 60 + (m || 0) + 60, 10 * 60);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

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
        <TouchableOpacity activeOpacity={0.8} onPress={() => { if (value > min) { Haptics.selectionAsync(); onChange(value - 1); } }} style={styles.stepBtn}>
          <Ionicons name="remove" size={16} color={C.primary} />
        </TouchableOpacity>
        <Text style={{ color: C.text, fontFamily: "Inter_700Bold", fontSize: 16, minWidth: 36, textAlign: "center" }}>{value} {unit}</Text>
        <TouchableOpacity activeOpacity={0.8} onPress={() => { if (value < max) { Haptics.selectionAsync(); onChange(value + 1); } }} style={styles.stepBtn}>
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

  const [selfTest, setSelfTest] = useState<{ ok: boolean; detail: string } | null>(null);
  const [selfTesting, setSelfTesting] = useState(false);

  // "0 scheduled" has three causes that look identical on screen. This asks the
  // OS directly instead of leaving the user to guess between them.
  const runSelfTest = async () => {
    setSelfTesting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const result = await runSchedulingSelfTest();
      setSelfTest(result);
      const { permissionGranted, entries } = await getNotificationDiagnostics();
      setDiagPermission(permissionGranted);
      setDiagEntries(entries);
      setDiagOpen(true);
    } catch (e) {
      setSelfTest({ ok: false, detail: (e as Error)?.message || "Unknown error" });
      logSilentError("notif-self-test", e);
    }
    setSelfTesting(false);
  };

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

  useEffect(() => {
    load();
    setupNotificationChannels();
    // Check on open, not only when someone happens to find the Diagnostics
    // button. Every way this feature fails — permission off, nothing
    // scheduled — is completely silent otherwise, which is how "no
    // notifications" stayed a mystery through three fix attempts.
    getNotificationDiagnostics()
      .then(({ permissionGranted, entries }) => {
        setDiagPermission(permissionGranted);
        setDiagEntries(entries);
      })
      .catch((e) => logSilentError("notif-diagnostics", e));
  }, [load]);

  const mealAt = (i: number) => mealTimeAt(settings.foodReminderTime, i);

  const update = (key: keyof Settings, val: unknown) => {
    setSettings((prev) => ({ ...prev, [key]: val }));
    setIsDirty(true);
  };

  const save = async () => {
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // ORDER MATTERS. This used to `await api.updateNotificationSettings()`
    // first, inside the same try that does the scheduling — so if that one
    // call failed, every schedule call below it was skipped and the user got
    // "Could not save settings" with nothing queued. The backend runs on
    // Render's free tier, which sleeps and can take longer to wake than the
    // 15s request timeout, so this failed for the most ordinary reason there
    // is. Scheduling a local reminder needs no network at all; it must not
    // sit behind one.
    //
    // Now: cache locally, schedule locally, and sync to the server last.
    let serverSynced = true;
    try {
      // 1. Local cache first — this is what restoreAllNotifications reads on
      //    the next cold start, so the user's choice survives even if
      //    everything else here fails.
      await AsyncStorage.setItem(NOTIF_SETTINGS_CACHE_KEY, JSON.stringify(settings))
        .catch((e) => logSilentError('storage-write', e));
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
          settings.waterGoalGlasses,
          settings.waterReminderTimes,
        );
      }

      // Food / Meal reminders
      if (notifEnabled && settings.foodReminders) {
        // Without the third argument this schedules the DERIVED times and
        // silently ignores the meal times the user set — the exact dead
        // column Phase A existed to bring to life.
        await scheduleFoodReminders(
          settings.wakeUpTime,
          settings.bedTime,
          settings.foodReminderTime,
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

      // 3. Sync to the server LAST. A failure here means the settings did not
      //    reach the account, not that the reminders failed — they are already
      //    scheduled on this device and cached for the next launch.
      try {
        await api.updateNotificationSettings(settings as unknown as Record<string, unknown>);
      } catch (e) {
        serverSynced = false;
        logSilentError("notif-settings-sync", e);
      }

      // Say what actually happened, and prove it with the count.
      const { permissionGranted, entries } = await getNotificationDiagnostics();
      setDiagPermission(permissionGranted);
      setDiagEntries(entries);

      Alert.alert(
        serverSynced ? "Saved! ✅" : "Saved on this device ✅",
        `${entries.length} reminder${entries.length === 1 ? "" : "s"} scheduled.` +
          (serverSynced ? "" : "\n\nCouldn't reach the server, so this hasn't synced to your account yet — it will next time you open the app.")
      );
    } catch (e) {
      logSilentError("notif-settings-save", e);
      Alert.alert("Error", "Could not schedule reminders on this device. Please try again.");
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
          <TouchableOpacity activeOpacity={0.8} onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back" accessibilityRole="button">
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
        {/* ── Health banner — the first thing on the screen when something is
             actually wrong. Permission off means nothing will EVER arrive, no
             matter what the toggles below say; zero scheduled means the
             toggles never took effect. Both used to be completely invisible. */}
        {Platform.OS !== "web" && diagPermission === false && (
          <View style={{ backgroundColor: "#FDEAEA", borderRadius: 14, borderWidth: 1, borderColor: "#F5B5B5", padding: 14, gap: 10 }}>
            <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
              <Ionicons name="notifications-off" size={22} color={C.red} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.red, fontFamily: "Inter_700Bold", fontSize: 13, marginBottom: 3 }}>
                  Notifications are blocked for Aorane
                </Text>
                <Text style={{ color: C.text, fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 17 }}>
                  Nothing below will be delivered until you turn them on. Android stops
                  showing the in-app prompt after it has been declined, so this has to be
                  switched on in your phone&rsquo;s Settings.
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); openNotificationSettings(); }}
              style={{ backgroundColor: C.red, borderRadius: 10, paddingVertical: 10, alignItems: "center" }}
              accessibilityRole="button"
              accessibilityLabel="Open system notification settings for Aorane"
            >
              <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 13 }}>Open Settings</Text>
            </TouchableOpacity>
          </View>
        )}

        {Platform.OS !== "web" && diagPermission === true && diagEntries.length === 0 && (
          <View style={{ backgroundColor: "#FEF3E8", borderRadius: 14, borderWidth: 1, borderColor: "#F0C48A", padding: 14, flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
            <Ionicons name="alert-circle" size={22} color="#B45309" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#B45309", fontFamily: "Inter_700Bold", fontSize: 13, marginBottom: 3 }}>
                No reminders are scheduled yet
              </Text>
              <Text style={{ color: C.text, fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 17 }}>
                Permission is granted, but nothing is queued on this device. Tap Save below
                to schedule them now.
              </Text>
            </View>
          </View>
        )}

        {Platform.OS !== "web" && diagPermission === true && diagEntries.length > 0 && (
          <View style={{ backgroundColor: "#E7F6EE", borderRadius: 14, padding: 12, flexDirection: "row", gap: 10, alignItems: "center" }}>
            <Ionicons name="checkmark-circle" size={20} color={C.green} />
            <Text style={{ color: C.text, fontFamily: "Inter_600SemiBold", fontSize: 12.5, flex: 1 }}>
              {diagEntries.length} reminder{diagEntries.length === 1 ? "" : "s"} scheduled on this device
            </Text>
          </View>
        )}

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
              <TouchableOpacity activeOpacity={0.8}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); requestExactAlarmPermission(); }}
                style={{ flex: 1, borderRadius: 12, borderWidth: 1.5, borderColor: C.primary, paddingVertical: 10, alignItems: "center" }}
              >
                <Text style={{ color: C.primary, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>Allow Exact Alarms</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.8}
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
                <TouchableOpacity activeOpacity={0.8} key={t} onPress={() => { Haptics.selectionAsync(); update("wakeUpTime", t); }}
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
                <TouchableOpacity activeOpacity={0.8} key={t} onPress={() => { Haptics.selectionAsync(); update("bedTime", t); }}
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
              // Real values, not a hardcoded picture of them. Falls back to the
              // same derived breakfast the scheduler uses when nothing is set.
              { time: mealAt(0) ?? plusOneHour(settings.wakeUpTime), icon: "☀️", label: "Breakfast time", color: "#10B981" },
              { time: mealAt(1) ?? "13:00", icon: "🍱", label: "Lunch reminder", color: "#0EA5E9" },
              { time: mealAt(2) ?? "19:30", icon: "🌙", label: "Dinner reminder", color: "#8B5CF6" },
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
            <TouchableOpacity activeOpacity={0.8}
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

            <TouchableOpacity
              onPress={runSelfTest}
              disabled={selfTesting}
              style={{ marginTop: 10, borderWidth: 1.5, borderColor: C.primary, backgroundColor: C.primary, borderRadius: 12, paddingVertical: 13, alignItems: "center", opacity: selfTesting ? 0.6 : 1 }}
              accessibilityRole="button"
              accessibilityLabel="Send a test reminder to check scheduling on this device"
            >
              <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 14 }}>
                {selfTesting ? "Testing…" : "Send Test Reminder (1 min)"}
              </Text>
            </TouchableOpacity>

            {selfTest && (
              <View style={{ marginTop: 10, backgroundColor: selfTest.ok ? "#E7F6EE" : "#FDEAEA", borderRadius: 12, padding: 12, flexDirection: "row", gap: 9, alignItems: "flex-start" }}>
                <Ionicons name={selfTest.ok ? "checkmark-circle" : "close-circle"} size={18} color={selfTest.ok ? C.green : C.red} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: selfTest.ok ? C.green : C.red, fontFamily: "Inter_700Bold", fontSize: 12.5, marginBottom: 2 }}>
                    {selfTest.ok ? "Scheduling works on this device" : "This device refused to schedule"}
                  </Text>
                  {/* The platform's own message, verbatim — this is the line
                      that would have named the real bug months ago. */}
                  <Text style={{ color: C.text, fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 17 }}>
                    {selfTest.detail}
                  </Text>
                </View>
              </View>
            )}

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
                  <Text style={{ color: C.muted, fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 17 }}>
                    Nothing is scheduled. Check that &ldquo;Enable All Notifications&rdquo; is on above and tap Save —
                    or run the test below to see exactly what this device says.
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
          <TouchableOpacity activeOpacity={0.8} onPress={save} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.7 }]}>
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