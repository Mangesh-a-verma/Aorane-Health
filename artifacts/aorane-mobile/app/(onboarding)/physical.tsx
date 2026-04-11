import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, useColorScheme,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { GlassCard } from "@/components/GlassCard";
import { GradientBackground } from "@/components/GradientBackground";
import { api } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-", "Unknown"];

function StepBar({ current }: { current: number }) {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  return (
    <View style={sb.row}>
      {[1, 2, 3, 4, 5].map((s) => (
        <LinearGradient
          key={s}
          colors={s <= current ? ["#0077B6", "#1B998B"] : (isDark ? ["rgba(255,255,255,0.1)", "rgba(255,255,255,0.1)"] : ["rgba(0,119,182,0.15)", "rgba(0,119,182,0.15)"])}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[sb.step, { flex: 1 }]}
        />
      ))}
    </View>
  );
}

const sb = StyleSheet.create({
  row: { flexDirection: "row", gap: 6 },
  step: { height: 4, borderRadius: 2 },
});

export default function OnboardingPhysical() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const bmi = height && weight
    ? (parseFloat(weight) / Math.pow(parseFloat(height) / 100, 2)).toFixed(1)
    : null;

  const getBMILabel = (b: string) => {
    const v = parseFloat(b);
    if (v < 18.5) return { label: "Underweight", color: "#F59E0B" };
    if (v < 25) return { label: "Normal", color: "#10B981" };
    if (v < 30) return { label: "Overweight", color: "#F59E0B" };
    return { label: "Obese", color: "#EF4444" };
  };

  const handleNext = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    try {
      const data: Record<string, unknown> = {};
      if (height) data.heightCm = parseFloat(height);
      if (weight) data.weightKg = parseFloat(weight);
      if (bloodGroup) data.bloodGroup = bloodGroup;
      await api.updateProfile(data);
      await api.updateOnboardingStep(2);
      router.push("/(onboarding)/health");
    } catch {
      Alert.alert(t("error"), "Failed to save. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <GradientBackground>
      <View style={[styles.root, { paddingTop: insets.top + 16 }]}>
        {/* Header */}
        <View style={styles.header}>
          <StepBar current={2} />
          <View style={styles.headerRow}>
            <Text style={[styles.stepLabel, { color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,119,182,0.6)", fontFamily: "Inter_500Medium" }]}>{t("step2of5")}</Text>
            <TouchableOpacity onPress={() => router.push("/(onboarding)/health")} style={styles.skipBtn}>
              <Text style={[styles.skipText, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,119,182,0.5)", fontFamily: "Inter_400Regular" }]}>{t("skip")}</Text>
              <Ionicons name="chevron-forward" size={14} color={isDark ? "rgba(255,255,255,0.4)" : "rgba(0,119,182,0.5)"} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <Text style={[styles.emoji]}>📏</Text>
            <Text style={[styles.title, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>{t("physicalDetails")}</Text>
            <Text style={[styles.subtitle, { color: isDark ? "rgba(255,255,255,0.5)" : "rgba(10,22,40,0.5)", fontFamily: "Inter_400Regular" }]}>
              {t("physicalSubtitle")}
            </Text>

            <GlassCard style={styles.card}>
              {/* Height & Weight */}
              <View style={styles.row}>
                <View style={styles.half}>
                  <Text style={[styles.label, { color: isDark ? "rgba(255,255,255,0.7)" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>{t("heightLabel")}</Text>
                  <View style={[styles.inputWrap, { borderColor: height ? "#0077B6" : (isDark ? "rgba(255,255,255,0.1)" : "rgba(0,119,182,0.2)"), backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,119,182,0.03)" }]}>
                    <Ionicons name="resize-outline" size={16} color={isDark ? "rgba(255,255,255,0.3)" : "rgba(0,119,182,0.4)"} />
                    <TextInput
                      style={[styles.inputText, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_500Medium" }]}
                      placeholder="170"
                      placeholderTextColor={isDark ? "rgba(255,255,255,0.25)" : "rgba(10,22,40,0.3)"}
                      keyboardType="numeric"
                      value={height}
                      onChangeText={setHeight}
                    />
                  </View>
                </View>
                <View style={styles.half}>
                  <Text style={[styles.label, { color: isDark ? "rgba(255,255,255,0.7)" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>{t("weightLabel")}</Text>
                  <View style={[styles.inputWrap, { borderColor: weight ? "#0077B6" : (isDark ? "rgba(255,255,255,0.1)" : "rgba(0,119,182,0.2)"), backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,119,182,0.03)" }]}>
                    <Ionicons name="scale-outline" size={16} color={isDark ? "rgba(255,255,255,0.3)" : "rgba(0,119,182,0.4)"} />
                    <TextInput
                      style={[styles.inputText, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_500Medium" }]}
                      placeholder="65"
                      placeholderTextColor={isDark ? "rgba(255,255,255,0.25)" : "rgba(10,22,40,0.3)"}
                      keyboardType="numeric"
                      value={weight}
                      onChangeText={setWeight}
                    />
                  </View>
                </View>
              </View>

              {/* BMI Result */}
              {bmi && (() => {
                const { label, color } = getBMILabel(bmi);
                return (
                  <LinearGradient
                    colors={["rgba(0,119,182,0.12)", "rgba(27,153,139,0.08)"]}
                    style={styles.bmiCard}
                  >
                    <View>
                      <Text style={[styles.bmiTitle, { color: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,119,182,0.7)", fontFamily: "Inter_400Regular" }]}>{t("yourBmi")}</Text>
                      <Text style={[styles.bmiStatus, { color, fontFamily: "Inter_600SemiBold" }]}>{label}</Text>
                    </View>
                    <Text style={[styles.bmiValue, { color: isDark ? "#38BDF8" : "#0077B6", fontFamily: "Inter_700Bold" }]}>{bmi}</Text>
                  </LinearGradient>
                );
              })()}

              {/* Blood Group */}
              <Text style={[styles.label, { color: isDark ? "rgba(255,255,255,0.7)" : "#0A1628", fontFamily: "Inter_600SemiBold", marginTop: 8 }]}>{t("bloodGroup")}</Text>
              <View style={styles.bloodGrid}>
                {BLOOD_GROUPS.map((bg) => {
                  const selected = bloodGroup === bg;
                  return (
                    <TouchableOpacity
                      key={bg}
                      onPress={() => { setBloodGroup(bg); Haptics.selectionAsync(); }}
                      activeOpacity={0.8}
                    >
                      {selected ? (
                        <LinearGradient colors={["#EF4444", "#DC2626"]} style={styles.bloodChipActive}>
                          <Text style={[styles.bloodText, { color: "#FFF", fontFamily: "Inter_700Bold" }]}>{bg}</Text>
                        </LinearGradient>
                      ) : (
                        <View style={[styles.bloodChip, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,119,182,0.05)", borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,119,182,0.15)" }]}>
                          <Text style={[styles.bloodText, { color: isDark ? "rgba(255,255,255,0.7)" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>{bg}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </GlassCard>
          </View>
        </ScrollView>

        {/* CTA Footer */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity onPress={handleNext} disabled={isLoading} activeOpacity={0.88}>
            <LinearGradient colors={["#0077B6", "#1B998B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaBtn}>
              {isLoading
                ? <ActivityIndicator color="#FFF" />
                : <>
                    <Text style={[styles.ctaText, { fontFamily: "Inter_700Bold" }]}>{t("continueBtn")}</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFF" />
                  </>
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
  card: { padding: 20, gap: 0 },
  row: { flexDirection: "row", gap: 12, marginBottom: 16 },
  half: { flex: 1 },
  label: { fontSize: 14, marginBottom: 8 },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1.5, borderRadius: 12, height: 48, paddingHorizontal: 12 },
  inputText: { flex: 1, fontSize: 16 },
  bmiCard: { borderRadius: 14, padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  bmiTitle: { fontSize: 13, marginBottom: 2 },
  bmiStatus: { fontSize: 15 },
  bmiValue: { fontSize: 32 },
  bloodGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 4 },
  bloodChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5 },
  bloodChipActive: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  bloodText: { fontSize: 14 },
  footer: { paddingHorizontal: 20, paddingTop: 12 },
  ctaBtn: { height: 54, borderRadius: 16, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 },
  ctaText: { color: "#FFF", fontSize: 17 },
});
