import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, useColorScheme,
  Animated, Dimensions, Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";

const { width: W } = Dimensions.get("window");
const GENDERS = [
  { value: "male", label: "Purush", icon: "male" },
  { value: "female", label: "Mahila", icon: "female" },
  { value: "other", label: "Anya", icon: "transgender" },
];

function StepBar({ current }: { current: number }) {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  return (
    <View style={stepStyles.row}>
      {[1,2,3,4,5].map((s) => (
        <View key={s} style={stepStyles.trackOuter}>
          {s <= current ? (
            <LinearGradient colors={["#0077B6", "#0EA5E9", "#1B998B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={stepStyles.step} />
          ) : (
            <View style={[stepStyles.step, { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,119,182,0.12)" }]} />
          )}
        </View>
      ))}
    </View>
  );
}

const stepStyles = StyleSheet.create({
  row: { flexDirection: "row", gap: 6, marginBottom: 6 },
  trackOuter: { flex: 1, height: 5, borderRadius: 3, overflow: "hidden" },
  step: { flex: 1, height: 5, borderRadius: 3 },
});

export default function OnboardingStep1() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: false }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleDobChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, "");
    let formatted = cleaned;
    if (cleaned.length > 2) formatted = cleaned.slice(0,2) + "/" + cleaned.slice(2);
    if (cleaned.length > 4) formatted = cleaned.slice(0,2) + "/" + cleaned.slice(2,4) + "/" + cleaned.slice(4,8);
    setDob(formatted);
  };

  const handleNext = async () => {
    if (!name.trim()) { Alert.alert("Zaroori", "Apna naam zaroor bharein"); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    try {
      await api.updateProfile({ fullName: name.trim(), dateOfBirth: dob, gender });
      await api.updateOnboardingStep(1);
      router.push("/(onboarding)/physical");
    } catch { Alert.alert("Error", "Save nahi hua. Phir try karein."); }
    finally { setIsLoading(false); }
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={isDark
          ? ["#010814", "#031628", "#051E30", "#061A2A"]
          : ["#C8E9FA", "#D9F4EE", "#E8F4FF", "#D4F0F7"]}
        locations={[0, 0.3, 0.65, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.orb1, { backgroundColor: isDark ? "#0055A3" : "#7DD3FC" }]} />
      <View style={[styles.orb2, { backgroundColor: isDark ? "#044A38" : "#6EE7B7" }]} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <StepBar current={1} />
        <View style={styles.stepLabelRow}>
          <View style={[styles.stepPill, { backgroundColor: isDark ? "rgba(56,189,248,0.15)" : "rgba(0,119,182,0.1)", borderColor: isDark ? "rgba(56,189,248,0.3)" : "rgba(0,119,182,0.2)" }]}>
            <Text style={[styles.stepPillText, { color: isDark ? "#38BDF8" : "#0077B6", fontFamily: "Inter_600SemiBold" }]}>Step 1 of 5</Text>
          </View>
          <Text style={[styles.stepName, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular" }]}>Parichay</Text>
        </View>
      </View>

      <Animated.View style={[{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Title section */}
          <View style={styles.titleWrap}>
            <LinearGradient colors={["#0077B6", "#0EA5E9", "#1B998B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.titleIcon}>
              <Ionicons name="person" size={24} color="#FFF" />
            </LinearGradient>
            <Text style={[styles.title, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>Apna parichay den</Text>
            <Text style={[styles.subtitle, { color: isDark ? "rgba(255,255,255,0.48)" : "rgba(10,22,40,0.52)", fontFamily: "Inter_400Regular" }]}>
              Aapki jankari sirf aapke liye — fully private
            </Text>
          </View>

          {/* Glass Form Card */}
          <LinearGradient
            colors={isDark
              ? ["rgba(56,189,248,0.28)", "rgba(45,212,191,0.18)", "rgba(255,255,255,0.05)"]
              : ["rgba(255,255,255,0.95)", "rgba(186,230,253,0.5)", "rgba(167,243,208,0.4)"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.cardBorder}
          >
            <View style={[styles.cardInner, { backgroundColor: isDark ? "rgba(8,18,40,0.55)" : "rgba(255,255,255,0.55)" }]}>
              {Platform.OS === "ios"
                ? <BlurView intensity={isDark ? 80 : 60} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
                : <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? "rgba(8,16,36,0.4)" : "rgba(255,255,255,0.4)" }]} />
              }
              <LinearGradient
                colors={isDark ? ["rgba(56,189,248,0.14)", "transparent"] : ["rgba(255,255,255,0.9)", "transparent"]}
                style={styles.topShimmer}
              />

              {/* Name Field */}
              <View style={styles.fieldWrap}>
                <View style={styles.fieldLabel}>
                  <Ionicons name="person-outline" size={14} color={isDark ? "rgba(56,189,248,0.8)" : "#0077B6"} />
                  <Text style={[styles.label, { color: isDark ? "rgba(255,255,255,0.7)" : "rgba(10,22,40,0.7)", fontFamily: "Inter_600SemiBold" }]}>Aapka naam *</Text>
                </View>
                <TextInput
                  style={[styles.input, {
                    backgroundColor: focusedField === "name"
                      ? (isDark ? "rgba(56,189,248,0.1)" : "rgba(0,119,182,0.06)")
                      : (isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.7)"),
                    borderColor: focusedField === "name"
                      ? (isDark ? "#38BDF8" : "#0077B6")
                      : (isDark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.9)"),
                    color: isDark ? "#F0F8FF" : "#0A1628",
                    fontFamily: "Inter_400Regular",
                  }]}
                  placeholder="Poora naam likhein"
                  placeholderTextColor={isDark ? "rgba(255,255,255,0.28)" : "rgba(10,22,40,0.32)"}
                  value={name}
                  onChangeText={setName}
                  onFocus={() => setFocusedField("name")}
                  onBlur={() => setFocusedField(null)}
                  autoCapitalize="words"
                  autoFocus
                />
              </View>

              {/* DOB Field */}
              <View style={styles.fieldWrap}>
                <View style={styles.fieldLabel}>
                  <Ionicons name="calendar-outline" size={14} color={isDark ? "rgba(56,189,248,0.8)" : "#0077B6"} />
                  <Text style={[styles.label, { color: isDark ? "rgba(255,255,255,0.7)" : "rgba(10,22,40,0.7)", fontFamily: "Inter_600SemiBold" }]}>Janm Tithi</Text>
                </View>
                <TextInput
                  style={[styles.input, {
                    backgroundColor: focusedField === "dob"
                      ? (isDark ? "rgba(56,189,248,0.1)" : "rgba(0,119,182,0.06)")
                      : (isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.7)"),
                    borderColor: focusedField === "dob"
                      ? (isDark ? "#38BDF8" : "#0077B6")
                      : (isDark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.9)"),
                    color: isDark ? "#F0F8FF" : "#0A1628",
                    fontFamily: "Inter_400Regular",
                  }]}
                  placeholder="DD/MM/YYYY"
                  placeholderTextColor={isDark ? "rgba(255,255,255,0.28)" : "rgba(10,22,40,0.32)"}
                  value={dob}
                  onChangeText={handleDobChange}
                  onFocus={() => setFocusedField("dob")}
                  onBlur={() => setFocusedField(null)}
                  keyboardType="numeric"
                  maxLength={10}
                />
              </View>

              {/* Gender */}
              <View style={styles.fieldLabel}>
                <Ionicons name="people-outline" size={14} color={isDark ? "rgba(56,189,248,0.8)" : "#0077B6"} />
                <Text style={[styles.label, { color: isDark ? "rgba(255,255,255,0.7)" : "rgba(10,22,40,0.7)", fontFamily: "Inter_600SemiBold" }]}>Ling (Gender)</Text>
              </View>
              <View style={styles.genderRow}>
                {GENDERS.map((g) => {
                  const sel = gender === g.value;
                  return (
                    <TouchableOpacity key={g.value} onPress={() => { setGender(g.value); Haptics.selectionAsync(); }} activeOpacity={0.8} style={styles.genderBtnWrap}>
                      {sel ? (
                        <LinearGradient colors={["#0077B6", "#1B998B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.genderBtn}>
                          <Ionicons name={g.icon as any} size={16} color="#FFF" />
                          <Text style={[styles.genderText, { color: "#FFF", fontFamily: "Inter_600SemiBold" }]}>{g.label}</Text>
                        </LinearGradient>
                      ) : (
                        <View style={[styles.genderBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.7)", borderWidth: 1, borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.9)" }]}>
                          <Ionicons name={g.icon as any} size={16} color={isDark ? "rgba(255,255,255,0.5)" : "#0077B6"} />
                          <Text style={[styles.genderText, { color: isDark ? "rgba(255,255,255,0.6)" : "#0077B6", fontFamily: "Inter_500Medium" }]}>{g.label}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </LinearGradient>

          {/* Privacy note */}
          <View style={[styles.privNote, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.55)", borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.85)" }]}>
            <Ionicons name="shield-checkmark" size={13} color={isDark ? "#38BDF8" : "#0077B6"} />
            <Text style={[styles.privText, { color: isDark ? "rgba(255,255,255,0.38)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular" }]}>
              Aapka data fully encrypted hai • Kisi ke saath share nahi hoga
            </Text>
          </View>
        </ScrollView>

        {/* Footer CTA */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity onPress={handleNext} disabled={isLoading || !name.trim()} activeOpacity={0.85} style={styles.ctaWrap}>
            <LinearGradient
              colors={name.trim() ? ["#0077B6", "#0EA5E9", "#1B998B"] : (isDark ? ["rgba(255,255,255,0.1)", "rgba(255,255,255,0.06)"] : ["rgba(0,0,0,0.06)", "rgba(0,0,0,0.04)"])}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.ctaBtn}
            >
              {isLoading
                ? <ActivityIndicator color="#FFF" />
                : <>
                    <Text style={[styles.ctaText, { color: name.trim() ? "#FFF" : (isDark ? "rgba(255,255,255,0.3)" : "rgba(10,22,40,0.3)"), fontFamily: "Inter_700Bold" }]}>Aage Barein</Text>
                    <Ionicons name="arrow-forward" size={18} color={name.trim() ? "#FFF" : (isDark ? "rgba(255,255,255,0.3)" : "rgba(10,22,40,0.3)")} />
                  </>
              }
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  orb1: { position: "absolute", width: 350, height: 350, borderRadius: 175, top: -120, right: -110, opacity: 0.48 },
  orb2: { position: "absolute", width: 280, height: 280, borderRadius: 140, bottom: 60, left: -90, opacity: 0.42 },

  header: { paddingHorizontal: 22, marginBottom: 4 },
  stepLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  stepPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  stepPillText: { fontSize: 12 },
  stepName: { fontSize: 12 },

  scroll: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 24 },
  titleWrap: { alignItems: "center", marginBottom: 20 },
  titleIcon: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  title: { fontSize: 24, marginBottom: 6, textAlign: "center" },
  subtitle: { fontSize: 14, textAlign: "center", lineHeight: 20 },

  cardBorder: { borderRadius: 26, padding: 1.5, marginBottom: 14 },
  cardInner: { borderRadius: 25, overflow: "hidden", padding: 20 },
  topShimmer: { position: "absolute", top: 0, left: 0, right: 0, height: 50 },

  fieldWrap: { marginBottom: 16 },
  fieldLabel: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  label: { fontSize: 13 },
  input: { borderWidth: 1.5, borderRadius: 14, height: 52, paddingHorizontal: 16, fontSize: 16 },

  genderRow: { flexDirection: "row", gap: 10, marginTop: 6 },
  genderBtnWrap: { flex: 1, borderRadius: 14, overflow: "hidden" },
  genderBtn: { paddingVertical: 13, alignItems: "center", justifyContent: "center", borderRadius: 14, gap: 5, flexDirection: "row" },
  genderText: { fontSize: 14 },

  privNote: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
  privText: { fontSize: 11, flex: 1, lineHeight: 16 },

  footer: { paddingHorizontal: 22, paddingTop: 8 },
  ctaWrap: { borderRadius: 16, overflow: "hidden" },
  ctaBtn: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  ctaText: { fontSize: 17 },
});
