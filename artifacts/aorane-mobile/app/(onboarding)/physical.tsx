import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { api } from "@/lib/api";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-", "Unknown"];

export default function OnboardingPhysical() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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
      Alert.alert("Error", "Failed to save. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <View style={styles.steps}>
          {[1,2,3,4,5].map((s) => (
            <View key={s} style={[styles.step, { backgroundColor: s <= 2 ? colors.primary : colors.muted }]} />
          ))}
        </View>
        <Text style={[styles.stepLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Step 2 of 5</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Physical Details</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Aapka BMI aur health score calculate karne ke liye</Text>

        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={[styles.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Height (cm)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, fontFamily: "Inter_400Regular" }]}
              placeholder="170"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numeric"
              value={height}
              onChangeText={setHeight}
            />
          </View>
          <View style={styles.half}>
            <Text style={[styles.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Weight (kg)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, fontFamily: "Inter_400Regular" }]}
              placeholder="65"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numeric"
              value={weight}
              onChangeText={setWeight}
            />
          </View>
        </View>

        {height && weight && (
          <View style={[styles.bmiCard, { backgroundColor: colors.tealLight }]}>
            <Text style={[styles.bmiLabel, { color: colors.primary, fontFamily: "Inter_400Regular" }]}>Your BMI</Text>
            <Text style={[styles.bmiValue, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
              {(parseFloat(weight) / Math.pow(parseFloat(height) / 100, 2)).toFixed(1)}
            </Text>
          </View>
        )}

        <Text style={[styles.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Blood Group</Text>
        <View style={styles.bloodGrid}>
          {BLOOD_GROUPS.map((bg) => (
            <TouchableOpacity
              key={bg}
              onPress={() => setBloodGroup(bg)}
              style={[
                styles.bloodChip,
                {
                  backgroundColor: bloodGroup === bg ? colors.destructive : colors.card,
                  borderColor: bloodGroup === bg ? colors.destructive : colors.border,
                },
              ]}
            >
              <Text style={[styles.bloodText, { color: bloodGroup === bg ? "#FFF" : colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                {bg}
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
  row: { flexDirection: "row", gap: 12, marginBottom: 16 },
  half: { flex: 1 },
  label: { fontSize: 15, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, height: 52, paddingHorizontal: 16, fontSize: 16, marginBottom: 20 },
  bmiCard: { borderRadius: 12, padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  bmiLabel: { fontSize: 15 },
  bmiValue: { fontSize: 28 },
  bloodGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  bloodChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  bloodText: { fontSize: 15 },
  footer: { paddingHorizontal: 24, paddingTop: 12 },
  nextBtn: { height: 54, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  nextText: { color: "#FFF", fontSize: 17 },
});
