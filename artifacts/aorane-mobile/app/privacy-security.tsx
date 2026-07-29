/**
 * Privacy & Security Screen — Aorane
 *
 * Central hub for:
 *   - Understanding what data is stored
 *   - Managing privacy toggles (reuses existing API)
 *   - Downloading data (coming soon)
 *   - Deleting account
 *   - Contacting support
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Linking,
  Platform,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ChevronLeft,
  Shield,
  ChevronRight,
  Download,
  Trash2,
  LifeBuoy,
  Eye,
  EyeOff,
  Lock,
  Info,
} from "lucide-react-native";
import { Ionicons } from "@expo/vector-icons";
import { DS } from "@/lib/theme";
import { api } from "@/lib/api";
import { logSilentError } from "@/lib/silentCatch";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PrivacySettings {
  shareBasicProfile: boolean;
  shareBmi: boolean;
  shareExerciseData: boolean;
  shareWaterIntake: boolean;
  shareSleepData: boolean;
  shareStressLevel: boolean;
  shareMedicineDetails: boolean;
  shareMedicalConditions: boolean;
  shareFoodData: boolean;
}

interface PrivacyItem {
  key: keyof PrivacySettings;
  label: string;
  desc: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  sensitive: boolean;
}

// ─── Data ────────────────────────────────────────────────────────────────────

const PRIVACY_ITEMS: PrivacyItem[] = [
  {
    key: "shareBasicProfile",
    label: "Basic Profile",
    desc: "Name and photo visible to others",
    icon: "person-outline",
    sensitive: false,
  },
  {
    key: "shareBmi",
    label: "BMI & Weight",
    desc: "Physical measurements",
    icon: "barbell-outline",
    sensitive: false,
  },
  {
    key: "shareExerciseData",
    label: "Exercise Activity",
    desc: "Workout logs and activity",
    icon: "bicycle-outline",
    sensitive: false,
  },
  {
    key: "shareFoodData",
    label: "Food & Nutrition",
    desc: "Diet and meal history",
    icon: "restaurant-outline",
    sensitive: false,
  },
  {
    key: "shareWaterIntake",
    label: "Water Intake",
    desc: "Daily hydration logs",
    icon: "water-outline",
    sensitive: false,
  },
  {
    key: "shareSleepData",
    label: "Sleep Data",
    desc: "Sensitive — hidden by default",
    icon: "moon-outline",
    sensitive: true,
  },
  {
    key: "shareStressLevel",
    label: "Stress Level",
    desc: "Sensitive — hidden by default",
    icon: "pulse-outline",
    sensitive: true,
  },
  {
    key: "shareMedicineDetails",
    label: "Medicine Details",
    desc: "Sensitive — hidden by default",
    icon: "medical-outline",
    sensitive: true,
  },
  {
    key: "shareMedicalConditions",
    label: "Medical Conditions",
    desc: "Sensitive — hidden by default",
    icon: "fitness-outline",
    sensitive: true,
  },
];

const DATA_WE_STORE = [
  { icon: "person-circle-outline" as const, label: "Identity", detail: "Name, phone, email, profile photo" },
  { icon: "heart-outline" as const, label: "Health metrics", detail: "Weight, height, BMI, blood group" },
  { icon: "nutrition-outline" as const, label: "Food logs", detail: "Meals, scans, calorie history" },
  { icon: "medkit-outline" as const, label: "Medical data", detail: "Reports, medicine schedules" },
  { icon: "barbell-outline" as const, label: "Activity", detail: "Exercise, steps, water logs" },
  { icon: "notifications-outline" as const, label: "Preferences", detail: "Reminders, notification settings" },
];

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function PrivacySecurityScreen() {
  const insets = useSafeAreaInsets();
  const [privacy, setPrivacy] = useState<PrivacySettings>({
    shareBasicProfile: true,
    shareBmi: true,
    shareExerciseData: true,
    shareWaterIntake: true,
    shareSleepData: false,
    shareStressLevel: false,
    shareMedicineDetails: false,
    shareMedicalConditions: false,
    shareFoodData: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    api
      .getPrivacy()
      .then((res) => {
        if (res?.privacy) {
          setPrivacy((prev) => ({ ...prev, ...(res.privacy as Partial<PrivacySettings>) }));
        }
      })
      .catch((e) => logSilentError('background-task', e))
      .finally(() => setLoading(false));
  }, []);

  const togglePrivacy = useCallback(async (key: keyof PrivacySettings, value: boolean) => {
    setPrivacy((p) => ({ ...p, [key]: value }));
    setSaving(key);
    try {
      await api.updatePrivacy({ [key]: value });
    } catch {
      // Revert on failure
      setPrivacy((p) => ({ ...p, [key]: !value }));
    } finally {
      setSaving(null);
    }
  }, []);

  const openSupport = useCallback(() => {
    Linking.openURL("mailto:support@aorane.com?subject=Privacy%20Request").catch(() => {
      router.push("/help" as never);
    });
  }, []);

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={12}>
          <ChevronLeft size={22} color={DS.color.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Privacy & Security</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={s.hero}>
          <View style={s.heroIcon}>
            <Shield size={28} color={DS.color.primary} strokeWidth={2} />
          </View>
          <Text style={s.heroTitle}>Your privacy matters</Text>
          <Text style={s.heroSub}>
            Aorane never sells your data. You control what you share and can
            delete everything at any time.
          </Text>
        </View>

        {/* Data stored */}
        <SectionHead title="What we store" />
        <View style={s.card}>
          {DATA_WE_STORE.map((item, idx) => (
            <View key={item.label} style={[s.dataRow, idx > 0 && s.rowBorder]}>
              <View style={[s.dataIcon, { backgroundColor: DS.color.primarySoft }]}>
                <Ionicons name={item.icon} size={16} color={DS.color.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.dataLabel}>{item.label}</Text>
                <Text style={s.dataDetail}>{item.detail}</Text>
              </View>
            </View>
          ))}
          <View style={[s.infoBox, { marginTop: 12 }]}>
            <Info size={14} color={DS.color.primary} strokeWidth={2} />
            <Text style={s.infoText}>
              All data is encrypted in transit and at rest. Medical data is stored
              with extra protection.
            </Text>
          </View>
        </View>

        {/* Sharing toggles */}
        <SectionHead title="Sharing Controls" />
        <View style={s.card}>
          <Text style={s.sectionNote}>
            Control what other users (e.g., doctors, family members) can see on
            your profile.
          </Text>
          {loading ? (
            <ActivityIndicator color={DS.color.primary} style={{ marginVertical: 16 }} />
          ) : (
            PRIVACY_ITEMS.map((item, idx) => (
              <View key={item.key} style={[s.toggleRow, idx > 0 && s.rowBorder]}>
                <View style={[s.toggleIcon, { backgroundColor: item.sensitive ? DS.color.redSoft : DS.color.primarySoft }]}>
                  <Ionicons
                    name={item.icon}
                    size={15}
                    color={item.sensitive ? DS.color.red : DS.color.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.toggleLabel}>{item.label}</Text>
                  <Text style={s.toggleDesc}>{item.desc}</Text>
                </View>
                {saving === item.key ? (
                  <ActivityIndicator size="small" color={DS.color.primary} />
                ) : (
                  <Switch
                    value={privacy[item.key]}
                    onValueChange={(v) => togglePrivacy(item.key, v)}
                    trackColor={{ false: DS.color.divider, true: item.sensitive ? DS.color.red : DS.color.primary }}
                    thumbColor="#fff"
                    ios_backgroundColor={DS.color.divider}
                  />
                )}
              </View>
            ))
          )}
        </View>

        {/* Account actions */}
        <SectionHead title="Account & Data" />
        <View style={s.card}>
          {/* Download data — coming soon */}
          <TouchableOpacity
            style={s.actionRow}
            activeOpacity={0.7}
            disabled
          >
            <View style={[s.actionIcon, { backgroundColor: DS.color.skySoft }]}>
              <Download size={16} color={DS.color.sky} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.actionLabel}>Download My Data</Text>
              <Text style={s.actionDesc}>Export a copy of all your health data</Text>
            </View>
            <View style={s.comingSoon}>
              <Text style={s.comingSoonText}>Soon</Text>
            </View>
          </TouchableOpacity>

          <View style={s.rowBorder} />

          {/* Contact support */}
          <TouchableOpacity
            style={s.actionRow}
            activeOpacity={0.85}
            onPress={openSupport}
          >
            <View style={[s.actionIcon, { backgroundColor: DS.color.greenSoft }]}>
              <LifeBuoy size={16} color={DS.color.green} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.actionLabel}>Contact Support</Text>
              <Text style={s.actionDesc}>Questions about your data? We're here.</Text>
            </View>
            <ChevronRight size={16} color={DS.color.muted} strokeWidth={1.8} />
          </TouchableOpacity>

          <View style={s.rowBorder} />

          {/* Delete account */}
          <TouchableOpacity
            style={s.actionRow}
            activeOpacity={0.85}
            onPress={() => router.push("/delete-account" as never)}
          >
            <View style={[s.actionIcon, { backgroundColor: DS.color.redSoft }]}>
              <Trash2 size={16} color={DS.color.red} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.actionLabel, { color: DS.color.red }]}>Delete My Account</Text>
              <Text style={s.actionDesc}>Permanently remove your account and all data</Text>
            </View>
            <ChevronRight size={16} color={DS.color.red} strokeWidth={1.8} />
          </TouchableOpacity>
        </View>

        {/* Legal note */}
        <View style={s.legalBox}>
          <Lock size={13} color={DS.color.muted} strokeWidth={2} />
          <Text style={s.legalText}>
            Aorane complies with applicable data protection regulations. Account
            deletion requests are processed within 30 days per legal requirements.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function SectionHead({ title }: { title: string }) {
  return (
    <Text style={sh.head}>{title}</Text>
  );
}

const sh = StyleSheet.create({
  head: {
    fontSize: DS.font.sm,
    fontFamily: "Inter_600SemiBold",
    color: DS.color.muted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 24,
    marginBottom: 8,
    marginHorizontal: 4,
  },
});

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: DS.color.bgSoft },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: DS.color.divider,
    backgroundColor: DS.color.bgCard,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: DS.radius.sm,
    backgroundColor: DS.color.bgSoft,
  },
  headerTitle: {
    fontSize: DS.font.md,
    fontFamily: "Inter_600SemiBold",
    color: DS.color.text,
  },

  scroll: { paddingHorizontal: 16, paddingTop: 8 },

  hero: {
    alignItems: "center",
    paddingVertical: 20,
  },
  heroIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: DS.color.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: DS.font.lg,
    fontFamily: "Inter_700Bold",
    color: DS.color.text,
    marginBottom: 6,
  },
  heroSub: {
    fontSize: DS.font.base,
    fontFamily: "Inter_400Regular",
    color: DS.color.textSub,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 8,
  },

  card: {
    backgroundColor: DS.color.bgCard,
    borderRadius: DS.radius.xl,
    borderWidth: 1,
    borderColor: DS.color.divider,
    paddingHorizontal: 16,
    paddingVertical: 8,
    ...Platform.select({
      ios: { shadowColor: "#1A3A5C", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },

  sectionNote: {
    fontSize: DS.font.sm,
    fontFamily: "Inter_400Regular",
    color: DS.color.textSub,
    lineHeight: 18,
    paddingVertical: 10,
  },

  dataRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  dataIcon: {
    width: 34,
    height: 34,
    borderRadius: DS.radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  dataLabel: {
    fontSize: DS.font.base,
    fontFamily: "Inter_500Medium",
    color: DS.color.text,
  },
  dataDetail: {
    fontSize: DS.font.sm,
    fontFamily: "Inter_400Regular",
    color: DS.color.muted,
    marginTop: 1,
  },

  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  toggleIcon: {
    width: 32,
    height: 32,
    borderRadius: DS.radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleLabel: {
    fontSize: DS.font.base,
    fontFamily: "Inter_500Medium",
    color: DS.color.text,
  },
  toggleDesc: {
    fontSize: DS.font.xs,
    fontFamily: "Inter_400Regular",
    color: DS.color.muted,
    marginTop: 1,
  },

  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: DS.radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: DS.font.base,
    fontFamily: "Inter_500Medium",
    color: DS.color.text,
  },
  actionDesc: {
    fontSize: DS.font.xs,
    fontFamily: "Inter_400Regular",
    color: DS.color.muted,
    marginTop: 1,
  },

  comingSoon: {
    backgroundColor: DS.color.bgSoft,
    borderRadius: DS.radius.xs,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: DS.color.divider,
  },
  comingSoonText: {
    fontSize: DS.font.xs,
    fontFamily: "Inter_500Medium",
    color: DS.color.muted,
  },

  rowBorder: {
    borderTopWidth: 1,
    borderColor: DS.color.divider,
  },

  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: DS.color.primarySoft,
    borderRadius: DS.radius.sm,
    padding: 10,
  },
  infoText: {
    flex: 1,
    fontSize: DS.font.xs,
    fontFamily: "Inter_400Regular",
    color: DS.color.primary,
    lineHeight: 17,
  },

  legalBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 20,
    paddingHorizontal: 4,
  },
  legalText: {
    flex: 1,
    fontSize: DS.font.xs,
    fontFamily: "Inter_400Regular",
    color: DS.color.muted,
    lineHeight: 16,
  },
});