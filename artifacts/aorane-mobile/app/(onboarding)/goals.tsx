import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const GOALS = [
  { value: "lose_weight", label: "Lose Weight", icon: "🔥" },
  { value: "gain_weight", label: "Gain Muscle", icon: "💪" },
  { value: "maintain", label: "Maintain Weight", icon: "⚖️" },
  { value: "manage_condition", label: "Manage Condition", icon: "❤️" },
  { value: "eat_healthier", label: "Eat Healthier", icon: "🥗" },
  { value: "better_sleep", label: "Better Sleep", icon: "😴" },
  { value: "reduce_stress", label: "Reduce Stress", icon: "🧘" },
  { value: "build_habits", label: "Build Habits", icon: "📈" },
  { value: "post_illness", label: "Post-illness Recovery", icon: "🏥" },
  { value: "pregnancy", label: "Pregnancy Health", icon: "🤰" },
  { value: "aging", label: "Healthy Aging", icon: "🌟" },
  { value: "athletic", label: "Athletic Performance", icon: "🏃" },
];

export default function OnboardingGoals() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { setOnboardingComplete } = useAuth();
  const [selectedGoal, setSelectedGoal] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleFinish = async () => {
    if (!selectedGoal) { Alert.alert("Required", "Please select your primary goal"); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    try {
      await api.saveHealthGoals({ primaryGoal: selectedGoal });
      await api.updateOnboardingStep(5);
      await setOnboardingComplete();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
            <View key={s} style={[styles.step, { backgroundColor: colors.primary }]} />
          ))}
        </View>
        <Text style={[styles.stepLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Step 5 of 5</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Aapka Main Goal?</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          AI aapke liye personalized plan banayega
        </Text>
        <View style={styles.grid}>
          {GOALS.map((g) => (
            <TouchableOpacity
              key={g.value}
              onPress={() => setSelectedGoal(g.value)}
              style={[
                styles.goalCard,
                {
                  backgroundColor: selectedGoal === g.value ? colors.tealLight : colors.card,
                  borderColor: selectedGoal === g.value ? colors.primary : colors.border,
                },
              ]}
              activeOpacity={0.8}
            >
              <Text style={styles.goalIcon}>{g.icon}</Text>
              <Text style={[styles.goalLabel, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                {g.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity onPress={handleFinish} disabled={isLoading} style={[styles.nextBtn, { backgroundColor: colors.primary }]} activeOpacity={0.85}>
          {isLoading
            ? <ActivityIndicator color="#FFF" />
            : <Text style={[styles.nextText, { fontFamily: "Inter_700Bold" }]}>AORANE Shuru Karein 🚀</Text>
          }
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
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  goalCard: { width: "47%", padding: 16, borderRadius: 16, borderWidth: 1.5, alignItems: "center", gap: 8 },
  goalIcon: { fontSize: 28 },
  goalLabel: { fontSize: 13, textAlign: "center" },
  footer: { paddingHorizontal: 24, paddingTop: 12 },
  nextBtn: { height: 54, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  nextText: { color: "#FFF", fontSize: 17 },
});
