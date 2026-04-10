import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Platform, Alert, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { api } from "@/lib/api";

const GENDERS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

export default function OnboardingStep1() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleNext = async () => {
    if (!name.trim()) { Alert.alert("Required", "Please enter your name"); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    try {
      await api.updateProfile({ fullName: name.trim(), dateOfBirth: dob, gender });
      await api.updateOnboardingStep(1);
      router.push("/(onboarding)/physical");
    } catch {
      Alert.alert("Error", "Failed to save. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <View style={styles.steps}>
          {[1,2,3,4,5].map((s) => (
            <View key={s} style={[styles.step, { backgroundColor: s === 1 ? colors.primary : colors.muted }]} />
          ))}
        </View>
        <Text style={[styles.stepLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          Step 1 of 5
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Apna parichay den
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          Aapki information sirf aapke liye use hogi
        </Text>

        <Text style={[styles.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Aapka naam *</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, fontFamily: "Inter_400Regular" }]}
          placeholder="Full name"
          placeholderTextColor={colors.mutedForeground}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />

        <Text style={[styles.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Date of Birth</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, fontFamily: "Inter_400Regular" }]}
          placeholder="DD/MM/YYYY"
          placeholderTextColor={colors.mutedForeground}
          value={dob}
          onChangeText={setDob}
          keyboardType="numeric"
          maxLength={10}
        />

        <Text style={[styles.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Gender</Text>
        <View style={styles.optionRow}>
          {GENDERS.map((g) => (
            <TouchableOpacity
              key={g.value}
              onPress={() => setGender(g.value)}
              style={[
                styles.option,
                {
                  backgroundColor: gender === g.value ? colors.primary : colors.card,
                  borderColor: gender === g.value ? colors.primary : colors.border,
                  flex: 1,
                },
              ]}
            >
              <Text style={[styles.optionText, { color: gender === g.value ? "#FFF" : colors.foreground, fontFamily: "Inter_500Medium" }]}>
                {g.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          onPress={handleNext}
          disabled={isLoading}
          style={[styles.nextBtn, { backgroundColor: colors.primary }]}
          activeOpacity={0.85}
        >
          {isLoading
            ? <ActivityIndicator color="#FFF" />
            : <Text style={[styles.nextText, { fontFamily: "Inter_700Bold" }]}>Aage Barein →</Text>
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
  label: { fontSize: 15, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, height: 52, paddingHorizontal: 16, fontSize: 16, marginBottom: 20 },
  optionRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  option: { borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  optionText: { fontSize: 15 },
  footer: { paddingHorizontal: 24, paddingTop: 12 },
  nextBtn: { height: 54, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  nextText: { color: "#FFF", fontSize: 17 },
});
