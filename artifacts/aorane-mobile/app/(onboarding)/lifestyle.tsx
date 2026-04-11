import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, useColorScheme } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { GlassCard } from "@/components/GlassCard";
import { GradientBackground } from "@/components/GradientBackground";
import { api } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";

const WORK_PROFILES = [
  { value: "Office/Desk Job",     icon: "💼", activityHint: "sedentary", label: "Office/Desk Job" },
  { value: "IT/Software",         icon: "💻", activityHint: "sedentary", label: "IT / Software" },
  { value: "Call Center/BPO",     icon: "📞", activityHint: "sedentary", label: "Call Center / BPO" },
  { value: "Freelancer/WFH",      icon: "🏡", activityHint: "sedentary", label: "Freelancer / WFH" },
  { value: "Teacher/Professor",   icon: "📚", activityHint: "light",     label: "Teacher / Professor" },
  { value: "Doctor/Healthcare",   icon: "🏥", activityHint: "light",     label: "Doctor / Healthcare" },
  { value: "Business Owner",      icon: "🏢", activityHint: "light",     label: "Business Owner" },
  { value: "Housewife",           icon: "🏠", activityHint: "light",     label: "Housewife" },
  { value: "House Husband",       icon: "🏠", activityHint: "light",     label: "House Husband" },
  { value: "Retired",             icon: "🌅", activityHint: "light",     label: "Retired" },
  { value: "Artist/Creative",     icon: "🎨", activityHint: "light",     label: "Artist / Creative" },
  { value: "Field/Sales",         icon: "🚗", activityHint: "moderate",  label: "Field / Sales" },
  { value: "Driver/Delivery",     icon: "🚚", activityHint: "moderate",  label: "Driver / Delivery" },
  { value: "Factory Worker",      icon: "🔧", activityHint: "moderate",  label: "Factory Worker" },
  { value: "ASHA/ANM Worker",     icon: "👩‍⚕️", activityHint: "moderate", label: "ASHA / ANM Worker" },
  { value: "Student (College)",   icon: "🎓", activityHint: "moderate",  label: "Student (College)" },
  { value: "Student (School)",    icon: "🎒", activityHint: "light",     label: "Student (School)" },
  { value: "Police/CRPF",         icon: "👮", activityHint: "very",      label: "Police / CRPF" },
  { value: "Army/Defence",        icon: "🪖", activityHint: "very",      label: "Army / Defence" },
  { value: "Farmer/Agriculture",  icon: "🌾", activityHint: "very",      label: "Farmer / Agriculture" },
  { value: "Construction Worker", icon: "🏗️", activityHint: "very",      label: "Construction Worker" },
  { value: "Athlete/Sports",      icon: "🏃", activityHint: "athlete",   label: "Athlete / Sports" },
  { value: "Other",               icon: "✨", activityHint: "moderate",  label: "Other" },
];

const ACTIVITY_LEVELS = [
  { value: "sedentary", label: "Sedentary",    desc: "Little or no exercise",  icon: "🛋️", color: "#EF4444" },
  { value: "light",     label: "Light Active", desc: "1–3 days/week",          icon: "🚶", color: "#F59E0B" },
  { value: "moderate",  label: "Moderate",     desc: "3–5 days/week",          icon: "🏃", color: "#10B981" },
  { value: "very",      label: "Very Active",  desc: "6–7 days/week",          icon: "⚡", color: "#0077B6" },
  { value: "athlete",   label: "Athlete",      desc: "Twice daily training",   icon: "🏆", color: "#7C3AED" },
];

function StepBar({ current }: { current: number }) {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  return (
    <View style={sb.row}>
      {[1, 2, 3, 4, 5].map((s) => (
        <LinearGradient
          key={s}
          colors={s <= current ? ["#0077B6", "#1B998B"] : (isDark ? ["rgba(255,255,255,0.1)", "rgba(255,255,255,0.1)"] : ["rgba(0,119,182,0.15)", "rgba(0,119,182,0.15)"])}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={[sb.step, { flex: 1 }]}
        />
      ))}
    </View>
  );
}
const sb = StyleSheet.create({ row: { flexDirection: "row", gap: 6 }, step: { height: 4, borderRadius: 2 } });

export default function OnboardingLifestyle() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const [workProfile, setWorkProfile] = useState("");
  const [activityLevel, setActivityLevel] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleNext = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    try {
      await api.updateProfile({ workProfile, activityLevel });
      await api.updateOnboardingStep(4);
      router.push("/(onboarding)/goals");
    } catch {
      Alert.alert(t("error"), "Failed to save.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <GradientBackground>
      <View style={[styles.root, { paddingTop: insets.top + 16 }]}>
        <View style={styles.header}>
          <StepBar current={4} />
          <View style={styles.headerRow}>
            <Text style={[styles.stepLabel, { color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,119,182,0.6)", fontFamily: "Inter_500Medium" }]}>{t("step4of5")}</Text>
            <TouchableOpacity onPress={() => router.push("/(onboarding)/goals")} style={styles.skipBtn}>
              <Text style={[styles.skipText, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,119,182,0.5)", fontFamily: "Inter_400Regular" }]}>{t("skip")}</Text>
              <Ionicons name="chevron-forward" size={14} color={isDark ? "rgba(255,255,255,0.4)" : "rgba(0,119,182,0.5)"} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <Text style={styles.emoji}>🌿</Text>
            <Text style={[styles.title, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>{t("lifestyleTitle")}</Text>
            <Text style={[styles.subtitle, { color: isDark ? "rgba(255,255,255,0.5)" : "rgba(10,22,40,0.5)", fontFamily: "Inter_400Regular" }]}>
              {t("lifestyleSubtitle")}
            </Text>

            {/* Work Profile */}
            <GlassCard style={styles.card}>
              <Text style={[styles.sectionTitle, { color: isDark ? "rgba(255,255,255,0.85)" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>{t("workProfileLabel")}</Text>
              <View style={styles.chipGrid}>
                {WORK_PROFILES.map((w) => {
                  const sel = workProfile === w.value;
                  return (
                    <TouchableOpacity
                      key={w.value}
                      onPress={() => {
                        setWorkProfile(w.value);
                        if (!activityLevel) setActivityLevel(w.activityHint);
                        Haptics.selectionAsync();
                      }}
                      activeOpacity={0.8}
                    >
                      {sel ? (
                        <LinearGradient colors={["#0077B6", "#1B998B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.chipActive}>
                          <Text style={styles.chipActiveText}>{w.icon} {w.label}</Text>
                        </LinearGradient>
                      ) : (
                        <View style={[styles.chip, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,119,182,0.05)", borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,119,182,0.15)" }]}>
                          <Text style={[styles.chipText, { color: isDark ? "rgba(255,255,255,0.7)" : "#0A1628", fontFamily: "Inter_500Medium" }]}>{w.icon} {w.label}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </GlassCard>

            {/* Activity Level */}
            <GlassCard style={{ ...styles.card, marginTop: 14 }}>
              <Text style={[styles.sectionTitle, { color: isDark ? "rgba(255,255,255,0.85)" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>{t("activityLevelLabel")}</Text>
              <View style={styles.activityList}>
                {ACTIVITY_LEVELS.map((a) => {
                  const sel = activityLevel === a.value;
                  return (
                    <TouchableOpacity
                      key={a.value}
                      onPress={() => { setActivityLevel(a.value); Haptics.selectionAsync(); }}
                      activeOpacity={0.8}
                      style={[
                        styles.activityItem,
                        {
                          backgroundColor: sel ? (isDark ? `${a.color}20` : `${a.color}12`) : (isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)"),
                          borderColor: sel ? a.color : (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,119,182,0.12)"),
                        },
                      ]}
                    >
                      <Text style={styles.actIcon}>{a.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.actLabel, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>{a.label}</Text>
                        <Text style={[styles.actDesc, { color: isDark ? "rgba(255,255,255,0.45)" : "rgba(10,22,40,0.5)", fontFamily: "Inter_400Regular" }]}>{a.desc}</Text>
                      </View>
                      {sel && (
                        <View style={[styles.actCheck, { backgroundColor: a.color }]}>
                          <Ionicons name="checkmark" size={12} color="#FFF" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </GlassCard>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity onPress={handleNext} disabled={isLoading} activeOpacity={0.88}>
            <LinearGradient colors={["#0077B6", "#1B998B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaBtn}>
              {isLoading
                ? <ActivityIndicator color="#FFF" />
                : <><Text style={[styles.ctaText, { fontFamily: "Inter_700Bold" }]}>{t("continueBtn")}</Text><Ionicons name="arrow-forward" size={18} color="#FFF" /></>
              }
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 24, marginBottom: 16, gap: 10 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  stepLabel: { fontSize: 13 },
  skipBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
  skipText: { fontSize: 13 },
  content: { paddingHorizontal: 20, paddingBottom: 16 },
  emoji: { fontSize: 36, marginBottom: 8, textAlign: "center" },
  title: { fontSize: 26, marginBottom: 6, textAlign: "center" },
  subtitle: { fontSize: 14, marginBottom: 20, lineHeight: 20, textAlign: "center" },
  card: { padding: 20 },
  sectionTitle: { fontSize: 15, marginBottom: 14 },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5 },
  chipActive: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  chipText: { fontSize: 12 },
  chipActiveText: { color: "#FFF", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  activityList: { gap: 8 },
  activityItem: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1.5 },
  actIcon: { fontSize: 22 },
  actLabel: { fontSize: 15 },
  actDesc: { fontSize: 12, marginTop: 2 },
  actCheck: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  footer: { paddingHorizontal: 20, paddingTop: 12 },
  ctaBtn: { height: 54, borderRadius: 16, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 },
  ctaText: { color: "#FFF", fontSize: 17 },
});
