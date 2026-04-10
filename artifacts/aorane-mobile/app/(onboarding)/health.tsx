import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { api } from "@/lib/api";

const CONDITIONS = [
  "Diabetes", "High BP", "Thyroid", "Heart", "Asthma",
  "PCOD/PCOS", "Cholesterol", "Kidney", "Liver", "Arthritis",
  "Anemia", "Vit D Deficiency", "Vit B12 Low", "Anxiety/Depression", "None",
];
const FOOD_PREFS = ["veg", "nonveg", "eggetarian", "vegan", "jain"];
const FOOD_PREF_LABELS: Record<string, string> = {
  veg: "Vegetarian", nonveg: "Non-Veg", eggetarian: "Eggetarian", vegan: "Vegan", jain: "Jain"
};
const ALLERGIES = ["Lactose", "Gluten", "Nuts", "Shellfish", "None"];

export default function OnboardingHealth() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [foodPref, setFoodPref] = useState("");
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const toggleCondition = (c: string) => {
    if (c === "None") { setSelectedConditions(["None"]); return; }
    setSelectedConditions((prev) => {
      const without = prev.filter((x) => x !== "None");
      return without.includes(c) ? without.filter((x) => x !== c) : [...without, c];
    });
  };

  const toggleAllergy = (a: string) => {
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
      const [_, __] = await Promise.all([
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
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <View style={styles.steps}>
          {[1,2,3,4,5].map((s) => (
            <View key={s} style={[styles.step, { backgroundColor: s <= 3 ? colors.primary : colors.muted }]} />
          ))}
        </View>
        <Text style={[styles.stepLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Step 3 of 5</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Health Background</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          Ye jankari optional hai — skip kar sakte hain
        </Text>

        <Text style={[styles.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Medical Conditions (optional)</Text>
        <View style={styles.chipGrid}>
          {CONDITIONS.map((c) => (
            <TouchableOpacity
              key={c}
              onPress={() => toggleCondition(c)}
              style={[
                styles.chip,
                {
                  backgroundColor: selectedConditions.includes(c) ? colors.accent : colors.card,
                  borderColor: selectedConditions.includes(c) ? colors.accent : colors.border,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: selectedConditions.includes(c) ? "#FFF" : colors.foreground, fontFamily: "Inter_500Medium" }]}>
                {c}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Food Preference</Text>
        <View style={styles.chipRow}>
          {FOOD_PREFS.map((p) => (
            <TouchableOpacity
              key={p}
              onPress={() => setFoodPref(p)}
              style={[
                styles.chip,
                {
                  backgroundColor: foodPref === p ? colors.primary : colors.card,
                  borderColor: foodPref === p ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: foodPref === p ? "#FFF" : colors.foreground, fontFamily: "Inter_500Medium" }]}>
                {FOOD_PREF_LABELS[p]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Food Allergies</Text>
        <View style={styles.chipRow}>
          {ALLERGIES.map((a) => (
            <TouchableOpacity
              key={a}
              onPress={() => toggleAllergy(a)}
              style={[
                styles.chip,
                {
                  backgroundColor: selectedAllergies.includes(a) ? colors.warning : colors.card,
                  borderColor: selectedAllergies.includes(a) ? colors.warning : colors.border,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: selectedAllergies.includes(a) ? "#FFF" : colors.foreground, fontFamily: "Inter_500Medium" }]}>
                {a}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity onPress={handleNext} disabled={isLoading} style={[styles.nextBtn, { backgroundColor: colors.primary }]} activeOpacity={0.85}>
          {isLoading ? <ActivityIndicator color="#FFF" /> : <Text style={[styles.nextText, { fontFamily: "Inter_700Bold" }]}>Aage Barein →</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 24, marginBottom: 8 },
  steps: { flexDirection: "row", gap: 6, marginBottom: 8 },
  step: { flex: 1, height: 4, borderRadius: 2 },
  stepLabel: { fontSize: 13 },
  content: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },
  title: { fontSize: 26, marginBottom: 8 },
  subtitle: { fontSize: 14, marginBottom: 28, lineHeight: 20 },
  label: { fontSize: 15, marginBottom: 10 },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13 },
  footer: { paddingHorizontal: 24, paddingTop: 12 },
  nextBtn: { height: 54, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  nextText: { color: "#FFF", fontSize: 17 },
});
