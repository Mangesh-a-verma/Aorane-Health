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

const CONDITIONS = [
  "Diabetes", "High BP", "Thyroid", "Heart", "Asthma",
  "PCOD/PCOS", "Cholesterol", "Kidney", "Liver", "Arthritis",
  "Anemia", "Vit D ↓", "Vit B12 ↓", "Anxiety/Depression", "None",
];
const FOOD_PREFS = [
  { value: "veg", label: "🥦 Veg" },
  { value: "nonveg", label: "🍗 Non-Veg" },
  { value: "eggetarian", label: "🥚 Eggetarian" },
  { value: "vegan", label: "🌱 Vegan" },
  { value: "jain", label: "🪔 Jain" },
];
const ALLERGIES = ["Lactose", "Gluten", "Nuts", "Shellfish", "None"];

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

export default function OnboardingHealth() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const insets = useSafeAreaInsets();
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [foodPref, setFoodPref] = useState("");
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const toggleCondition = (c: string) => {
    Haptics.selectionAsync();
    if (c === "None") { setSelectedConditions(["None"]); return; }
    setSelectedConditions((prev) => {
      const without = prev.filter((x) => x !== "None");
      return without.includes(c) ? without.filter((x) => x !== c) : [...without, c];
    });
  };
  const toggleAllergy = (a: string) => {
    Haptics.selectionAsync();
    if (a === "None") { setSelectedAllergies(["None"]); return; }
    setSelectedAllergies((prev) => {
      const without = prev.filter((x) => x !== "None");
      return without.includes(a) ? without.filter((x) => x !== a) : [...without, a];
    });
  };

  const handleNext = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    try {
      await Promise.all([
        api.saveMedicalConditions(selectedConditions.map((c) => ({ condition: c }))),
        api.updateProfile({ foodPreference: foodPref, foodAllergies: selectedAllergies }),
      ]);
      await api.updateOnboardingStep(3);
      router.push("/(onboarding)/lifestyle");
    } catch {
      Alert.alert("Error", "Failed to save.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <GradientBackground>
      <View style={[styles.root, { paddingTop: insets.top + 16 }]}>
        <View style={styles.header}>
          <StepBar current={3} />
          <View style={styles.headerRow}>
            <Text style={[styles.stepLabel, { color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,119,182,0.6)", fontFamily: "Inter_500Medium" }]}>Step 3 of 5</Text>
            <TouchableOpacity onPress={() => router.push("/(onboarding)/lifestyle")} style={styles.skipBtn}>
              <Text style={[styles.skipText, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,119,182,0.5)", fontFamily: "Inter_400Regular" }]}>Skip</Text>
              <Ionicons name="chevron-forward" size={14} color={isDark ? "rgba(255,255,255,0.4)" : "rgba(0,119,182,0.5)"} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <Text style={styles.emoji}>🏥</Text>
            <Text style={[styles.title, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>Health Background</Text>
            <Text style={[styles.subtitle, { color: isDark ? "rgba(255,255,255,0.5)" : "rgba(10,22,40,0.5)", fontFamily: "Inter_400Regular" }]}>
              Optional — you can skip this step
            </Text>

            <GlassCard style={styles.card}>
              {/* Medical Conditions */}
              <Text style={[styles.sectionTitle, { color: isDark ? "rgba(255,255,255,0.85)" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>
                Medical Conditions
              </Text>
              <Text style={[styles.sectionSub, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.5)", fontFamily: "Inter_400Regular" }]}>You can select multiple options</Text>
              <View style={styles.chipGrid}>
                {CONDITIONS.map((c) => {
                  const sel = selectedConditions.includes(c);
                  return (
                    <TouchableOpacity key={c} onPress={() => toggleCondition(c)} activeOpacity={0.8}>
                      {sel ? (
                        <LinearGradient colors={["#0077B6", "#1B998B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.chipActive}>
                          <Text style={[styles.chipText, { color: "#FFF", fontFamily: "Inter_600SemiBold" }]}>{c}</Text>
                        </LinearGradient>
                      ) : (
                        <View style={[styles.chip, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,119,182,0.05)", borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,119,182,0.15)" }]}>
                          <Text style={[styles.chipText, { color: isDark ? "rgba(255,255,255,0.7)" : "#0A1628", fontFamily: "Inter_500Medium" }]}>{c}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </GlassCard>

            <GlassCard style={{ ...styles.card, marginTop: 14 }}>
              {/* Food Preference */}
              <Text style={[styles.sectionTitle, { color: isDark ? "rgba(255,255,255,0.85)" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>Food Preference</Text>
              <View style={styles.chipGrid}>
                {FOOD_PREFS.map((p) => {
                  const sel = foodPref === p.value;
                  return (
                    <TouchableOpacity key={p.value} onPress={() => { setFoodPref(p.value); Haptics.selectionAsync(); }} activeOpacity={0.8}>
                      {sel ? (
                        <LinearGradient colors={["#059669", "#10B981"]} style={styles.chipActive}>
                          <Text style={[styles.chipText, { color: "#FFF", fontFamily: "Inter_600SemiBold" }]}>{p.label}</Text>
                        </LinearGradient>
                      ) : (
                        <View style={[styles.chip, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,119,182,0.05)", borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,119,182,0.15)" }]}>
                          <Text style={[styles.chipText, { color: isDark ? "rgba(255,255,255,0.7)" : "#0A1628", fontFamily: "Inter_500Medium" }]}>{p.label}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Allergies */}
              <Text style={[styles.sectionTitle, { color: isDark ? "rgba(255,255,255,0.85)" : "#0A1628", fontFamily: "Inter_600SemiBold", marginTop: 16 }]}>Food Allergies</Text>
              <View style={styles.chipGrid}>
                {ALLERGIES.map((a) => {
                  const sel = selectedAllergies.includes(a);
                  return (
                    <TouchableOpacity key={a} onPress={() => toggleAllergy(a)} activeOpacity={0.8}>
                      {sel ? (
                        <LinearGradient colors={["#F59E0B", "#EF4444"]} style={styles.chipActive}>
                          <Text style={[styles.chipText, { color: "#FFF", fontFamily: "Inter_600SemiBold" }]}>{a}</Text>
                        </LinearGradient>
                      ) : (
                        <View style={[styles.chip, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,119,182,0.05)", borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,119,182,0.15)" }]}>
                          <Text style={[styles.chipText, { color: isDark ? "rgba(255,255,255,0.7)" : "#0A1628", fontFamily: "Inter_500Medium" }]}>{a}</Text>
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
                : <><Text style={[styles.ctaText, { fontFamily: "Inter_700Bold" }]}>Aage Barein</Text><Ionicons name="arrow-forward" size={18} color="#FFF" /></>
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
  sectionTitle: { fontSize: 15, marginBottom: 4 },
  sectionSub: { fontSize: 12, marginBottom: 14 },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5 },
  chipActive: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 10 },
  chipText: { fontSize: 13 },
  footer: { paddingHorizontal: 20, paddingTop: 12 },
  ctaBtn: { height: 54, borderRadius: 16, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 },
  ctaText: { color: "#FFF", fontSize: 17 },
});
