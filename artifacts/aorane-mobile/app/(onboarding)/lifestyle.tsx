import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { GlassCard } from "@/components/GlassCard";
import { GradientBackground } from "@/components/GradientBackground";
import { api } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";

const ACTIVITY_LEVELS = [
  { value: "sedentary", label: "Sedentary",    desc: "Little or no exercise",  icon: "🛋️", color: "#EF4444" },
  { value: "light",     label: "Light Active", desc: "1–3 days/week",          icon: "🚶", color: "#F59E0B" },
  { value: "moderate",  label: "Moderate",     desc: "3–5 days/week",          icon: "🏃", color: "#10B981" },
  { value: "very",      label: "Very Active",  desc: "6–7 days/week",          icon: "⚡", color: "#0077B6" },
  { value: "athlete",   label: "Athlete",      desc: "Twice daily training",   icon: "🏆", color: "#7C3AED" },
];

function StepBar({ current }: { current: number }) {
  return (
    <View style={sb.row}>
      {[1, 2, 3, 4, 5].map((s) => (
        <LinearGradient
          key={s}
          colors={s <= current ? ["#0077B6", "#1B998B"] : (["rgba(0,119,182,0.15)", "rgba(0,119,182,0.15)"])}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={[sb.step, { flex: 1 }]}
        />
      ))}
    </View>
  );
}
const sb = StyleSheet.create({ row: { flexDirection: "row", gap: 6 }, step: { height: 4, borderRadius: 2 } });

export default function OnboardingLifestyle() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const [activityLevel, setActivityLevel] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleNext = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    try {
      if (activityLevel) await api.updateProfile({ activityLevel });
      await api.updateOnboardingStep(4);
    } catch {
      /* ignore — navigate anyway */
    } finally {
      setIsLoading(false);
    }
    router.push("/(onboarding)/goals");
  };

  return (
    <GradientBackground>
      <View style={[styles.root, { paddingTop: insets.top + 16 }]}>
        <View style={styles.header}>
          <StepBar current={4} />
          <View style={styles.headerRow}>
            <Text style={[styles.stepLabel, { color: "rgba(0,119,182,0.6)", fontFamily: "Inter_500Medium" }]}>{t("step4of5")}</Text>
            <TouchableOpacity onPress={() => router.push("/(onboarding)/goals")} style={styles.skipBtn}>
              <Text style={[styles.skipText, { color: "rgba(0,119,182,0.5)", fontFamily: "Inter_400Regular" }]}>{t("skip")}</Text>
              <Ionicons name="chevron-forward" size={14} color={"rgba(0,119,182,0.5)"} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <Text style={styles.emoji}>🌿</Text>
            <Text style={[styles.title, { color: "#0A1628", fontFamily: "Inter_700Bold" }]}>{t("lifestyleTitle")}</Text>
            <Text style={[styles.subtitle, { color: "rgba(10,22,40,0.5)", fontFamily: "Inter_400Regular" }]}>
              How active are you in your daily routine?
            </Text>

            <GlassCard style={styles.card}>
              <Text style={[styles.sectionTitle, { color: "#0A1628", fontFamily: "Inter_600SemiBold" }]}>{t("activityLevelLabel")}</Text>
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
                          backgroundColor: sel ? (`${a.color}12`) : ("rgba(0,0,0,0.02)"),
                          borderColor: sel ? a.color : ("rgba(0,119,182,0.12)"),
                        },
                      ]}
                    >
                      <Text style={styles.actIcon}>{a.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.actLabel, { color: "#0A1628", fontFamily: "Inter_600SemiBold" }]}>{a.label}</Text>
                        <Text style={[styles.actDesc, { color: "rgba(10,22,40,0.5)", fontFamily: "Inter_400Regular" }]}>{a.desc}</Text>
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
