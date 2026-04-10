import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
  Alert, Image,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/useColors";
import { GlassCard } from "@/components/GlassCard";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useColorScheme } from "react-native";

const LANGUAGES = [
  { code: "hi", label: "हिंदी" },
  { code: "en", label: "English" },
  { code: "bn", label: "বাংলা" },
  { code: "mr", label: "मराठी" },
  { code: "te", label: "తెలుగు" },
  { code: "ta", label: "தமிழ்" },
  { code: "gu", label: "ગુજરાતી" },
  { code: "kn", label: "ಕನ್ನಡ" },
  { code: "ml", label: "മലയാളം" },
  { code: "pa", label: "ਪੰਜਾਬੀ" },
];

export default function LoginScreen() {
  const colors = useColors();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const insets = useSafeAreaInsets();
  const { loginWithToken } = useAuth();

  const [phone, setPhone] = useState("");
  const [selectedLang, setSelectedLang] = useState("hi");
  const [isLoading, setIsLoading] = useState(false);

  const handleSendOtp = async () => {
    if (phone.length !== 10) {
      Alert.alert("Invalid Number", "Please enter a valid 10-digit mobile number");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    try {
      await api.sendOtp(phone);
      router.push({ pathname: "/(auth)/verify-otp", params: { phone, lang: selectedLang } });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send OTP";
      Alert.alert("Error", msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={isDark ? ["#040D1C", "#062040", "#063330"] : ["#E0F2FE", "#F0FDF9", "#ECFDF5"]}
        locations={[0, 0.55, 1]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Glow orbs */}
      <View style={[styles.orb1, { backgroundColor: isDark ? "#0369A1" : "#BAE6FD" }]} />
      <View style={[styles.orb2, { backgroundColor: isDark ? "#0D9488" : "#99F6E4" }]} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={styles.logoBlock}>
            <Image
              source={require("../../assets/images/aorane-logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={[styles.tagline, { color: isDark ? "rgba(255,255,255,0.55)" : "rgba(10,22,40,0.55)", fontFamily: "Inter_400Regular" }]}>
              Aapki health, aapke haath mein
            </Text>
          </View>

          {/* Language Selector */}
          <GlassCard style={styles.langCard}>
            <Text style={[styles.sectionLabel, { color: isDark ? "rgba(255,255,255,0.55)" : "rgba(10,22,40,0.5)", fontFamily: "Inter_500Medium" }]}>
              Apni bhasha chunein
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.langRow}>
                {LANGUAGES.map((l) => (
                  <TouchableOpacity
                    key={l.code}
                    onPress={() => { Haptics.selectionAsync(); setSelectedLang(l.code); }}
                    style={[
                      styles.langChip,
                      selectedLang === l.code
                        ? { backgroundColor: isDark ? "#38BDF8" : "#0077B6" }
                        : { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,119,182,0.08)", borderWidth: 1, borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,119,182,0.2)" },
                    ]}
                  >
                    <Text style={[
                      styles.langText,
                      { color: selectedLang === l.code ? "#FFF" : (isDark ? "rgba(255,255,255,0.75)" : "#0077B6"), fontFamily: "Inter_500Medium" },
                    ]}>
                      {l.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </GlassCard>

          {/* Phone Input Card */}
          <GlassCard style={styles.formCard}>
            <Text style={[styles.formTitle, { color: isDark ? "#FFF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>
              Mobile se Login Karein
            </Text>

            <View style={[styles.phoneRow, { borderColor: isDark ? "rgba(56,189,248,0.35)" : "rgba(0,119,182,0.3)", backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.6)" }]}>
              <View style={[styles.countryBadge, { borderRightColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,119,182,0.15)" }]}>
                <Text style={[styles.countryText, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>
                  🇮🇳 +91
                </Text>
              </View>
              <TextInput
                style={[styles.phoneInput, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_500Medium" }]}
                placeholder="10-digit number"
                placeholderTextColor={isDark ? "rgba(255,255,255,0.3)" : "rgba(10,22,40,0.35)"}
                keyboardType="numeric"
                maxLength={10}
                value={phone}
                onChangeText={setPhone}
                autoFocus
              />
            </View>

            <TouchableOpacity
              onPress={handleSendOtp}
              disabled={isLoading || phone.length !== 10}
              activeOpacity={0.85}
              style={styles.ctaWrap}
            >
              <LinearGradient
                colors={phone.length === 10 ? ["#0077B6", "#1B998B"] : (isDark ? ["rgba(255,255,255,0.1)", "rgba(255,255,255,0.05)"] : ["rgba(0,0,0,0.08)", "rgba(0,0,0,0.05)"])}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ctaGrad}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={[styles.ctaText, { fontFamily: "Inter_700Bold", color: phone.length === 10 ? "#FFF" : (isDark ? "rgba(255,255,255,0.35)" : "rgba(10,22,40,0.3)") }]}>
                    OTP Bhejein →
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={[styles.divLine, { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)" }]} />
              <Text style={[styles.divText, { color: isDark ? "rgba(255,255,255,0.35)" : "rgba(10,22,40,0.4)", fontFamily: "Inter_400Regular" }]}>ya</Text>
              <View style={[styles.divLine, { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)" }]} />
            </View>

            <TouchableOpacity
              style={[styles.googleBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.8)", borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)" }]}
              onPress={() => Alert.alert("Coming Soon", "Google login will be available shortly")}
              activeOpacity={0.8}
            >
              <Text style={[styles.googleG, { color: "#4285F4" }]}>G</Text>
              <Text style={[styles.googleLabel, { color: isDark ? "rgba(255,255,255,0.85)" : "#0A1628", fontFamily: "Inter_500Medium" }]}>
                Continue with Google
              </Text>
            </TouchableOpacity>
          </GlassCard>

          <Text style={[styles.terms, { color: isDark ? "rgba(255,255,255,0.3)" : "rgba(10,22,40,0.4)", fontFamily: "Inter_400Regular" }]}>
            Login karke aap Terms & Privacy Policy se agree karte hain
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  orb1: { position: "absolute", width: 340, height: 340, borderRadius: 170, top: -100, right: -100, opacity: 0.3 },
  orb2: { position: "absolute", width: 280, height: 280, borderRadius: 140, bottom: 40, left: -80, opacity: 0.22 },
  scroll: { paddingHorizontal: 22 },
  logoBlock: { alignItems: "center", marginBottom: 28 },
  logo: { width: 220, height: 90, marginBottom: 10 },
  tagline: { fontSize: 14 },
  langCard: { padding: 16, marginBottom: 16 },
  sectionLabel: { fontSize: 12, letterSpacing: 0.5, marginBottom: 12, textTransform: "uppercase" },
  langRow: { flexDirection: "row", gap: 8 },
  langChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  langText: { fontSize: 14 },
  formCard: { padding: 20, marginBottom: 16 },
  formTitle: { fontSize: 20, marginBottom: 18 },
  phoneRow: { flexDirection: "row", borderWidth: 1.5, borderRadius: 14, height: 54, overflow: "hidden", marginBottom: 16 },
  countryBadge: { paddingHorizontal: 14, justifyContent: "center", borderRightWidth: 1 },
  countryText: { fontSize: 15 },
  phoneInput: { flex: 1, paddingHorizontal: 14, fontSize: 17 },
  ctaWrap: { borderRadius: 14, overflow: "hidden", marginBottom: 18 },
  ctaGrad: { height: 52, alignItems: "center", justifyContent: "center" },
  ctaText: { fontSize: 17 },
  dividerRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  divLine: { flex: 1, height: 1 },
  divText: { marginHorizontal: 12, fontSize: 13 },
  googleBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, height: 52, borderRadius: 14, borderWidth: 1 },
  googleG: { fontSize: 22, fontWeight: "bold" },
  googleLabel: { fontSize: 16 },
  terms: { fontSize: 12, textAlign: "center", lineHeight: 18 },
});
