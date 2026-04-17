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
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

const GOALS = [
  { value: "lose_weight",       label: "Lose Weight",           icon: "🔥", color: "#EF4444" },
  { value: "gain_weight",       label: "Gain Muscle",           icon: "💪", color: "#7C3AED" },
  { value: "maintain",          label: "Maintain Weight",       icon: "⚖️", color: "#0077B6" },
  { value: "manage_condition",  label: "Manage Condition",      icon: "❤️", color: "#EC4899" },
  { value: "eat_healthier",     label: "Eat Healthier",         icon: "🥗", color: "#10B981" },
  { value: "better_sleep",      label: "Better Sleep",          icon: "😴", color: "#6366F1" },
  { value: "reduce_stress",     label: "Reduce Stress",         icon: "🧘", color: "#14B8A6" },
  { value: "build_habits",      label: "Build Habits",          icon: "📈", color: "#F59E0B" },
  { value: "post_illness",      label: "Post-illness Recovery", icon: "🏥", color: "#0077B6" },
  { value: "pregnancy",         label: "Pregnancy Health",      icon: "🤰", color: "#EC4899" },
  { value: "aging",             label: "Healthy Aging",         icon: "🌟", color: "#F59E0B" },
  { value: "athletic",          label: "Athletic Performance",  icon: "🏃", color: "#10B981" },
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

export default function OnboardingGoals() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const insets = useSafeAreaInsets();
  const { setOnboardingComplete } = useAuth();
  const { t } = useLanguage();
  const [selectedGoal, setSelectedGoal] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleFinish = async () => {
    if (!selectedGoal) { Alert.alert(t("required"), t("goalRequired")); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsLoading(true);
    try {
      await api.saveHealthGoals({ primaryGoal: selectedGoal });
      await api.updateOnboardingStep(5);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push("/(onboarding)/permissions");
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
          <StepBar current={5} />
          <Text style={[styles.stepLabel, { color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,119,182,0.6)", fontFamily: "Inter_500Medium" }]}>{t("step5of5")}</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <Text style={styles.emoji}>🎯</Text>
            <Text style={[styles.title, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>{t("yourMainGoal")}</Text>
            <Text style={[styles.subtitle, { color: isDark ? "rgba(255,255,255,0.5)" : "rgba(10,22,40,0.5)", fontFamily: "Inter_400Regular" }]}>
              AI will create a personalised plan for you
            </Text>

            <GlassCard style={styles.card}>
              <View style={styles.grid}>
                {GOALS.map((g) => {
                  const sel = selectedGoal === g.value;
                  return (
                    <TouchableOpacity
                      key={g.value}
                      onPress={() => { setSelectedGoal(g.value); Haptics.selectionAsync(); }}
                      activeOpacity={0.8}
                      style={styles.goalWrap}
                    >
                      {sel ? (
                        <LinearGradient
                          colors={[g.color + "CC", g.color]}
                          style={styles.goalCardActive}
                        >
                          <Text style={styles.goalIcon}>{g.icon}</Text>
                          <Text style={[styles.goalLabel, { color: "#FFF", fontFamily: "Inter_600SemiBold" }]}>{g.label}</Text>
                          <View style={styles.goalCheck}>
                            <Ionicons name="checkmark" size={11} color={g.color} />
                          </View>
                        </LinearGradient>
                      ) : (
                        <View style={[styles.goalCard, { backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,119,182,0.04)", borderColor: isDark ? "rgba(255,255,255,0.09)" : "rgba(0,119,182,0.12)" }]}>
                          <Text style={styles.goalIcon}>{g.icon}</Text>
                          <Text style={[styles.goalLabel, { color: isDark ? "rgba(255,255,255,0.75)" : "#0A1628", fontFamily: "Inter_500Medium" }]}>{g.label}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </GlassCard>

            {selectedGoal && (
              <LinearGradient
                colors={["rgba(0,119,182,0.15)", "rgba(27,153,139,0.1)"]}
                style={styles.readyBanner}
              >
                <Ionicons name="sparkles" size={18} color="#0077B6" />
                <Text style={[styles.readyText, { color: isDark ? "#38BDF8" : "#0077B6", fontFamily: "Inter_600SemiBold" }]}>
                  You are ready! Aorane is building your plan...
                </Text>
              </LinearGradient>
            )}
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity onPress={handleFinish} disabled={isLoading || !selectedGoal} activeOpacity={0.88}>
            <LinearGradient
              colors={selectedGoal ? ["#0077B6", "#1B998B"] : ["rgba(150,150,150,0.3)", "rgba(150,150,150,0.3)"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.ctaBtn}
            >
              {isLoading
                ? <ActivityIndicator color="#FFF" />
                : <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Ionicons name="rocket" size={20} color="#FFF" />
                    <Text style={[styles.ctaText, { fontFamily: "Inter_700Bold" }]}>Start Aorane</Text>
                  </View>
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
  stepLabel: { fontSize: 13 },
  content: { paddingHorizontal: 20, paddingBottom: 16 },
  emoji: { fontSize: 40, marginBottom: 8, textAlign: "center" },
  title: { fontSize: 26, marginBottom: 6, textAlign: "center" },
  subtitle: { fontSize: 14, marginBottom: 20, lineHeight: 20, textAlign: "center" },
  card: { padding: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  goalWrap: { width: "47%" },
  goalCard: { padding: 16, borderRadius: 16, borderWidth: 1.5, alignItems: "center", gap: 8, minHeight: 90, justifyContent: "center" },
  goalCardActive: { padding: 16, borderRadius: 16, alignItems: "center", gap: 8, minHeight: 90, justifyContent: "center" },
  goalIcon: { fontSize: 28 },
  goalLabel: { fontSize: 12, textAlign: "center", lineHeight: 17 },
  goalCheck: { position: "absolute", top: 8, right: 8, width: 18, height: 18, borderRadius: 9, backgroundColor: "#FFF", alignItems: "center", justifyContent: "center" },
  readyBanner: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, padding: 14, marginTop: 14 },
  readyText: { flex: 1, fontSize: 14, lineHeight: 20 },
  footer: { paddingHorizontal: 20, paddingTop: 12 },
  ctaBtn: { height: 58, borderRadius: 18, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 },
  ctaText: { color: "#FFF", fontSize: 17 },
});
