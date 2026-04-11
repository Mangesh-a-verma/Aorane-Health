import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, Switch, TouchableOpacity,
  StyleSheet, Platform, ActivityIndicator, Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { api } from "@/lib/api";

const C = {
  bg: "#F0FAFB", card: "#FFFFFF", primary: "#0077B6", accent: "#00B896",
  text: "#0D1F33", muted: "#7A90A4", border: "#E2EFF5",
  red: "#EF4444", green: "#10B981",
};

type Settings = {
  notificationsEnabled: boolean;
  medicineReminders: boolean;
  waterReminders: boolean;
  foodReminders: boolean;
  periodReminders: boolean;
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
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.getNotificationSettings();
      setSettings({ ...DEFAULT_SETTINGS, ...res.settings } as Settings);
    } catch { }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = (key: keyof Settings, val: unknown) => {
    setSettings((prev) => ({ ...prev, [key]: val }));
    setIsDirty(true);
  };

  const save = async () => {
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await api.updateNotificationSettings(settings as unknown as Record<string, unknown>);
      setIsDirty(false);
      Alert.alert("Saved! ✅", "Notification settings saved successfully!");
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
      <LinearGradient colors={["#0077B6", "#0099CC"]} style={{ paddingTop: topPad + 10, paddingHorizontal: 18, paddingBottom: 20 }}>
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

        {/* Health Reminders */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>💊 Health Reminders</Text>
          <SettingRow
            icon="💊" iconBg="#FEF3F2"
            title="Medicine Reminders"
            subtitle="Dawai lene ki yaad dilaata hai"
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
            subtitle="Khaana khane ki reminder"
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
          <View style={styles.divider} />
          <SettingRow
            icon="🤖" iconBg="#F5F3FF"
            title="AI Suggestions"
            subtitle="Daily AI health coach suggestions"
            value={settings.suggestionNotifications}
            onToggle={(v) => update("suggestionNotifications", v)}
            disabled={!settings.notificationsEnabled}
          />
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
            subtitle="Har hafte health summary email pe"
            value={settings.weeklyReportEmail}
            onToggle={(v) => update("weeklyReportEmail", v)}
          />
        </View>

        {/* Info Banner */}
        <View style={{ backgroundColor: "#EFF9FF", borderRadius: 14, borderWidth: 1, borderColor: "#BAE6FD", padding: 14, flexDirection: "row", gap: 10 }}>
          <Ionicons name="information-circle-outline" size={20} color={C.primary} />
          <Text style={{ color: C.primary, fontFamily: "Inter_400Regular", fontSize: 12, flex: 1, lineHeight: 18 }}>
            AORANE ki notifications aapko healthy habits maintain karne mein help karti hain. In-app notifications abhi available hain. Push notifications jald aayenge!
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
                <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 16 }}>✅ Settings Save Karo</Text>
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
