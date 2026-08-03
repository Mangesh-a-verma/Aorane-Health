import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { storage } from "@/lib/storage";

export default function EnrollmentScreen() {
  const insets = useSafeAreaInsets();
  const { refreshUser } = useAuth() as { refreshUser?: () => void };
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const bg = "#F0F9FF";
  const textColor = "#1a1a2e";
  const subText = "rgba(10,22,40,0.5)";
  const cardBg = "rgba(255,255,255,0.8)";

  const handleSubmit = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) { Alert.alert("Code Required", "Please enter an enrollment or org code."); return; }
    setLoading(true);
    try {
      // Try enrollment code first (from enrollmentCodesTable)
      let result: { planUpgraded: string; org: { name: string }; accessToken?: string; refreshToken?: string } | null = null;
      try {
        const res = await api.useEnrollmentCode(trimmed);
        if (res.success) result = res;
      } catch {
        // Fall through to org code
      }
      // Fallback to org code (from organizationsTable)
      if (!result) {
        const res = await api.enrollWithOrgCode(trimmed);
        if (res.success) result = res;
      }
      if (result) {
        // FIX C3 + B1 — persist fresh tokens with the new plan claim so the
        // very next API call (food scan, smart-scan, etc.) is authorized
        // for the upgraded plan instead of the user's old "free" claim.
        if (result.accessToken) await storage.setToken(result.accessToken);
        if (result.refreshToken) await storage.setRefreshToken(result.refreshToken);
        if (refreshUser) await refreshUser();
        Alert.alert(
          "Enrollment Successful! 🎉",
          `You've joined ${result.org.name}!\n\nYour plan has been upgraded to ${result.planUpgraded.toUpperCase()}.`,
          [{ text: "Go to Dashboard", onPress: () => router.replace("/(tabs)" as never) }]
        );
      }
    } catch (e: unknown) {
      Alert.alert("Enrollment Failed", (e as Error).message || "Invalid code. Please check and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <LinearGradient colors={["#F0F9FF", "#FFF8F3"]} style={StyleSheet.absoluteFill} />
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, flex: 1 }}>

        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 32 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,119,182,0.08)", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="arrow-back" size={20} color={textColor} />
          </TouchableOpacity>
          <Text style={{ color: textColor, fontSize: 20, fontFamily: "Inter_700Bold" }}>Join Organization</Text>
        </View>

        {/* Icon */}
        <LinearGradient colors={["#0077B6", "#023E8A"]} style={{ width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 24 }}>
          <Ionicons name="business" size={40} color="#FFF" />
        </LinearGradient>

        <Text style={{ color: textColor, fontFamily: "Inter_700Bold", fontSize: 22, textAlign: "center", marginBottom: 8 }}>
          Enter Enrollment Code
        </Text>
        <Text style={{ color: subText, fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", marginBottom: 32, lineHeight: 20 }}>
          Enter your company or organization's enrollment code. Your plan will automatically upgrade once verified.
        </Text>

        {/* Code Input */}
        <View style={{ backgroundColor: cardBg, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: "rgba(0,119,182,0.12)", marginBottom: 16 }}>
          <Text style={{ color: subText, fontFamily: "Inter_500Medium", fontSize: 12, marginBottom: 8, letterSpacing: 1 }}>ENROLLMENT CODE / ORG CODE</Text>
          <TextInput
            value={code}
            onChangeText={t => setCode(t)}
            placeholder="e.g. TCS2024 or ENROLL-ABC123"
            placeholderTextColor={subText}
            autoCapitalize="characters"
            autoCorrect={false}
            style={{
              color: textColor, fontFamily: "Inter_700Bold", fontSize: 22,
              letterSpacing: 3, textAlign: "center",
              paddingVertical: 12,
            }}
            onSubmitEditing={handleSubmit}
            returnKeyType="done"
          />
          <View style={{ height: 2, backgroundColor: "rgba(0,119,182,0.2)", borderRadius: 2 }} />
        </View>

        {/* Submit Button */}
        <TouchableOpacity onPress={handleSubmit} disabled={loading || !code.trim()} style={{ borderRadius: 16, overflow: "hidden", opacity: loading || !code.trim() ? 0.6 : 1, marginBottom: 16 }}>
          <LinearGradient colors={["#0077B6", "#023E8A"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ padding: 18, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 10 }}>
            {loading ? <ActivityIndicator color="#FFF" /> : <Ionicons name="enter-outline" size={22} color="#FFF" />}
            <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 16 }}>
              {loading ? "Enrolling..." : "Join Organization"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Info Box */}
        <View style={{ backgroundColor: "rgba(0,119,182,0.06)", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "rgba(0,119,182,0.12)" }}>
          <Text style={{ color: "#0077B6", fontFamily: "Inter_600SemiBold", fontSize: 13, marginBottom: 6 }}>ℹ️ Where do I get the code?</Text>
          <Text style={{ color: subText, fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18 }}>
            Ask your company's HR or admin for the enrollment code. They can generate it from the Aorane Business Portal.{"\n\n"}
            Once the code is entered, your plan will automatically upgrade — no payment needed.
          </Text>
        </View>

      </View>
    </KeyboardAvoidingView>
  );
}
