import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, useColorScheme,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { GlassCard } from "@/components/GlassCard";
import { GradientBackground } from "@/components/GradientBackground";
import { useColors } from "@/hooks/useColors";
import { api } from "@/lib/api";

const GENDERS = [{ value: "male", label: "Male" }, { value: "female", label: "Female" }, { value: "other", label: "Other" }];

function StepBar({ current }: { current: number }) {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  return (
    <View style={stepStyles.row}>
      {[1,2,3,4,5].map((s) => (
        <LinearGradient
          key={s}
          colors={s <= current ? ["#0077B6", "#1B998B"] : (isDark ? ["rgba(255,255,255,0.1)", "rgba(255,255,255,0.1)"] : ["rgba(0,0,0,0.1)", "rgba(0,0,0,0.1)"])}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[stepStyles.step, { flex: 1 }]}
        />
      ))}
    </View>
  );
}

const stepStyles = StyleSheet.create({
  row: { flexDirection: "row", gap: 6, marginBottom: 8 },
  step: { height: 4, borderRadius: 2 },
});

export default function OnboardingStep1() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
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
    } catch { Alert.alert("Error", "Failed to save. Please try again."); }
    finally { setIsLoading(false); }
  };

  return (
    <GradientBackground>
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <StepBar current={1} />
        <Text style={[styles.stepLabel, { color: isDark ? "rgba(255,255,255,0.45)" : "rgba(10,22,40,0.5)", fontFamily: "Inter_400Regular" }]}>Step 1 of 5</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>Apna parichay den</Text>
        <Text style={[styles.subtitle, { color: isDark ? "rgba(255,255,255,0.45)" : "rgba(10,22,40,0.5)", fontFamily: "Inter_400Regular" }]}>Aapki information sirf aapke liye use hogi</Text>

        <GlassCard style={styles.formCard}>
          <Text style={[styles.label, { color: isDark ? "rgba(255,255,255,0.7)" : "rgba(10,22,40,0.7)", fontFamily: "Inter_600SemiBold" }]}>Aapka naam *</Text>
          <TextInput style={[styles.input, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.7)", borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,119,182,0.2)", color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_400Regular" }]} placeholder="Full name" placeholderTextColor={isDark ? "rgba(255,255,255,0.3)" : "rgba(10,22,40,0.35)"} value={name} onChangeText={setName} autoCapitalize="words" autoFocus />

          <Text style={[styles.label, { color: isDark ? "rgba(255,255,255,0.7)" : "rgba(10,22,40,0.7)", fontFamily: "Inter_600SemiBold" }]}>Date of Birth</Text>
          <TextInput style={[styles.input, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.7)", borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,119,182,0.2)", color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_400Regular" }]} placeholder="DD/MM/YYYY" placeholderTextColor={isDark ? "rgba(255,255,255,0.3)" : "rgba(10,22,40,0.35)"} value={dob} onChangeText={setDob} keyboardType="numeric" maxLength={10} />

          <Text style={[styles.label, { color: isDark ? "rgba(255,255,255,0.7)" : "rgba(10,22,40,0.7)", fontFamily: "Inter_600SemiBold" }]}>Gender</Text>
          <View style={styles.genderRow}>
            {GENDERS.map((g) => (
              <TouchableOpacity key={g.value} onPress={() => setGender(g.value)} style={styles.genderBtnWrap} activeOpacity={0.8}>
                {gender === g.value
                  ? <LinearGradient colors={["#0077B6", "#1B998B"]} style={styles.genderBtn}><Text style={[styles.genderText, { color: "#FFF", fontFamily: "Inter_600SemiBold" }]}>{g.label}</Text></LinearGradient>
                  : <View style={[styles.genderBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.7)", borderWidth: 1, borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,119,182,0.2)" }]}><Text style={[styles.genderText, { color: isDark ? "rgba(255,255,255,0.7)" : "#0077B6", fontFamily: "Inter_500Medium" }]}>{g.label}</Text></View>
                }
              </TouchableOpacity>
            ))}
          </View>
        </GlassCard>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity onPress={handleNext} disabled={isLoading} style={styles.nextWrap} activeOpacity={0.85}>
          <LinearGradient colors={["#0077B6", "#1B998B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.nextBtn}>
            {isLoading ? <ActivityIndicator color="#FFF" /> : <Text style={[styles.nextText, { fontFamily: "Inter_700Bold" }]}>Aage Barein →</Text>}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, marginBottom: 8 },
  stepLabel: { fontSize: 13 },
  content: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24 },
  title: { fontSize: 26, marginBottom: 8 },
  subtitle: { fontSize: 14, marginBottom: 20, lineHeight: 20 },
  formCard: { padding: 20 },
  label: { fontSize: 14, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 14, height: 52, paddingHorizontal: 16, fontSize: 16, marginBottom: 18 },
  genderRow: { flexDirection: "row", gap: 10 },
  genderBtnWrap: { flex: 1, borderRadius: 14, overflow: "hidden" },
  genderBtn: { paddingVertical: 12, alignItems: "center", borderRadius: 14 },
  genderText: { fontSize: 15 },
  footer: { paddingHorizontal: 24, paddingTop: 12 },
  nextWrap: { borderRadius: 14, overflow: "hidden" },
  nextBtn: { height: 54, alignItems: "center", justifyContent: "center" },
  nextText: { color: "#FFF", fontSize: 17 },
});
