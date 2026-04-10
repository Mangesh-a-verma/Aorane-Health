import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { api } from "@/lib/api";

const WORK_PROFILES = [
  "Office/Desk", "Field/Sales", "Healthcare", "Teacher", "IT/Engineer",
  "Business Owner", "Driver/Delivery", "Factory Worker", "Housewife",
  "House Husband", "Student (School)", "Student (College)",
  "Retired", "Freelancer/WFH", "Artist/Creative", "Athlete", "Other",
];

const ACTIVITY_LEVELS = [
  { value: "sedentary", label: "Sedentary", desc: "Little/no exercise" },
  { value: "light", label: "Light", desc: "1-3 days/week" },
  { value: "moderate", label: "Moderate", desc: "3-5 days/week" },
  { value: "very", label: "Very Active", desc: "6-7 days/week" },
  { value: "athlete", label: "Athlete", desc: "Twice daily" },
];

export default function OnboardingLifestyle() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
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
            <View key={s} style={[styles.step, { backgroundColor: s <= 4 ? colors.primary : colors.muted }]} />
          ))}
        </View>
        <Text style={[styles.stepLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Step 4 of 5</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Aapki Lifestyle</Text>

        <Text style={[styles.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Work Profile</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll}>
          {WORK_PROFILES.map((w) => (
            <TouchableOpacity
              key={w}
              onPress={() => setWorkProfile(w)}
              style={[
                styles.chip,
                { backgroundColor: workProfile === w ? colors.primary : colors.card, borderColor: workProfile === w ? colors.primary : colors.border },
              ]}
            >
              <Text style={[styles.chipText, { color: workProfile === w ? "#FFF" : colors.foreground, fontFamily: "Inter_500Medium" }]}>{w}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={[styles.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold", marginTop: 20 }]}>Activity Level</Text>
        {ACTIVITY_LEVELS.map((a) => (
          <TouchableOpacity
            key={a.value}
            onPress={() => setActivityLevel(a.value)}
            style={[
              styles.activityItem,
              { backgroundColor: activityLevel === a.value ? colors.tealLight : colors.card, borderColor: activityLevel === a.value ? colors.primary : colors.border },
            ]}
          >
            <View style={[styles.radio, { borderColor: activityLevel === a.value ? colors.primary : colors.border }]}>
              {activityLevel === a.value && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
            </View>
            <View>
              <Text style={[styles.activityLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{a.label}</Text>
              <Text style={[styles.activityDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{a.desc}</Text>
            </View>
          </TouchableOpacity>
        ))}
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
  title: { fontSize: 26, marginBottom: 24 },
  label: { fontSize: 15, marginBottom: 12 },
  hScroll: { marginBottom: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  chipText: { fontSize: 13 },
  activityItem: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 10 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioInner: { width: 12, height: 12, borderRadius: 6 },
  activityLabel: { fontSize: 15 },
  activityDesc: { fontSize: 13, marginTop: 2 },
  footer: { paddingHorizontal: 24, paddingTop: 12 },
  nextBtn: { height: 54, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  nextText: { color: "#FFF", fontSize: 17 },
});
