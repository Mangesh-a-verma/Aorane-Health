import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

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
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoBlock}>
          <View style={[styles.logoCircle, { backgroundColor: colors.primary }]}>
            <Ionicons name="heart-sharp" size={36} color="#FFF" />
          </View>
          <Text style={[styles.appName, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>AORANE</Text>
          <Text style={[styles.tagline, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Aapki health, aapke haath mein
          </Text>
        </View>

        <View style={styles.langSection}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            Apni bhasha chunein
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.langScroll}>
            {LANGUAGES.map((l) => (
              <TouchableOpacity
                key={l.code}
                onPress={() => setSelectedLang(l.code)}
                style={[
                  styles.langChip,
                  {
                    backgroundColor: selectedLang === l.code ? colors.primary : colors.card,
                    borderColor: selectedLang === l.code ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.langText,
                    {
                      color: selectedLang === l.code ? "#FFF" : colors.foreground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                >
                  {l.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.formSection}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            Mobile Number
          </Text>
          <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.countryCode, { borderRightColor: colors.border }]}>
              <Text style={[styles.countryText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                🇮🇳 +91
              </Text>
            </View>
            <TextInput
              style={[styles.phoneInput, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}
              placeholder="Enter 10-digit number"
              placeholderTextColor={colors.mutedForeground}
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
            style={[
              styles.ctaBtn,
              {
                backgroundColor: phone.length === 10 ? colors.primary : colors.muted,
              },
            ]}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={[styles.ctaText, { fontFamily: "Inter_700Bold" }]}>
                Get OTP →
              </Text>
            )}
          </TouchableOpacity>

          <View style={[styles.divider, { borderColor: colors.border }]}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              ya phir
            </Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          <TouchableOpacity
            style={[styles.googleBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => Alert.alert("Coming Soon", "Google login will be available shortly")}
            activeOpacity={0.85}
          >
            <Text style={[styles.googleText, { color: "#4285F4", fontFamily: "Inter_600SemiBold" }]}>
              G
            </Text>
            <Text style={[styles.googleLabel, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
              Continue with Google
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.terms, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          Login karke aap humare Terms & Privacy Policy se agree karte hain
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 24 },
  logoBlock: { alignItems: "center", marginBottom: 36 },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  appName: { fontSize: 32, letterSpacing: 4 },
  tagline: { fontSize: 14, marginTop: 4 },
  langSection: { marginBottom: 28 },
  sectionTitle: { fontSize: 16, marginBottom: 12 },
  langScroll: { flexDirection: "row" },
  langChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  langText: { fontSize: 14 },
  formSection: { marginBottom: 24 },
  inputRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
    height: 54,
  },
  countryCode: {
    paddingHorizontal: 14,
    justifyContent: "center",
    borderRightWidth: 1,
  },
  countryText: { fontSize: 15 },
  phoneInput: { flex: 1, paddingHorizontal: 14, fontSize: 17 },
  ctaBtn: {
    height: 54,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  ctaText: { color: "#FFF", fontSize: 17 },
  divider: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { marginHorizontal: 12, fontSize: 13 },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
  },
  googleText: { fontSize: 22, fontWeight: "bold" },
  googleLabel: { fontSize: 16 },
  terms: { fontSize: 12, textAlign: "center", lineHeight: 18 },
});
