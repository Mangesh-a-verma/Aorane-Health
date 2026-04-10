import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, useColorScheme,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { GlassCard } from "@/components/GlassCard";
import { useColors } from "@/hooks/useColors";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function VerifyOtpScreen() {
  const colors = useColors();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const insets = useSafeAreaInsets();
  const { loginWithToken } = useAuth();
  const { phone, lang = "hi" } = useLocalSearchParams<{ phone: string; lang: string }>();

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const inputs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    const interval = setInterval(() => setResendTimer((t) => (t > 0 ? t - 1 : 0)), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleChange = (text: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = text.slice(-1);
    setOtp(newOtp);
    if (text && index < 5) inputs.current[index + 1]?.focus();
    if (newOtp.every((d) => d !== "")) handleVerify(newOtp.join(""));
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === "Backspace" && !otp[index] && index > 0) inputs.current[index - 1]?.focus();
  };

  const handleVerify = async (otpValue: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    try {
      const res = await api.verifyOtp(phone || "", otpValue, lang as string);
      await loginWithToken(res.accessToken, res.refreshToken, res.user, res.isNewUser);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid OTP";
      Alert.alert("Error", msg);
      setOtp(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    try {
      await api.sendOtp(phone || "");
      setResendTimer(30);
    } catch { }
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={isDark ? ["#040D1C", "#062040", "#063330"] : ["#E0F2FE", "#F0FDF9"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.orb1, { backgroundColor: isDark ? "#0369A1" : "#BAE6FD" }]} />

      <View style={[styles.content, { paddingTop: insets.top + 20 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <View style={[styles.backCircle, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,119,182,0.1)", borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,119,182,0.2)" }]}>
            <Ionicons name="arrow-back" size={20} color={isDark ? "#F0F8FF" : "#0077B6"} />
          </View>
        </TouchableOpacity>

        <View style={styles.center}>
          <View style={styles.iconCircleWrap}>
            <LinearGradient colors={["#0077B6", "#1B998B"]} style={styles.iconCircle}>
              <Ionicons name="chatbubble-ellipses" size={30} color="#FFF" />
            </LinearGradient>
          </View>

          <Text style={[styles.title, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>
            OTP Enter Karein
          </Text>
          <Text style={[styles.subtitle, { color: isDark ? "rgba(255,255,255,0.5)" : "rgba(10,22,40,0.55)", fontFamily: "Inter_400Regular" }]}>
            +91 {phone} pe bheja gaya hai
          </Text>

          <GlassCard style={styles.otpCard}>
            <View style={styles.otpRow}>
              {otp.map((digit, i) => (
                <TextInput
                  key={i}
                  ref={(r) => { inputs.current[i] = r; }}
                  style={[
                    styles.otpBox,
                    {
                      backgroundColor: digit ? (isDark ? "rgba(56,189,248,0.15)" : "rgba(0,119,182,0.08)") : (isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.6)"),
                      borderColor: digit ? (isDark ? "#38BDF8" : "#0077B6") : (isDark ? "rgba(255,255,255,0.15)" : "rgba(0,119,182,0.2)"),
                      color: isDark ? "#F0F8FF" : "#0A1628",
                      fontFamily: "Inter_700Bold",
                    },
                  ]}
                  keyboardType="numeric"
                  maxLength={1}
                  value={digit}
                  onChangeText={(t) => handleChange(t, i)}
                  onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
                  autoFocus={i === 0}
                  selectTextOnFocus
                />
              ))}
            </View>
          </GlassCard>

          {isLoading && (
            <ActivityIndicator color={isDark ? "#38BDF8" : "#0077B6"} size="large" style={{ marginTop: 20 }} />
          )}

          <TouchableOpacity onPress={handleResend} disabled={resendTimer > 0} style={{ marginTop: 24 }}>
            <Text style={[styles.resend, { color: resendTimer > 0 ? (isDark ? "rgba(255,255,255,0.3)" : "rgba(10,22,40,0.35)") : (isDark ? "#38BDF8" : "#0077B6"), fontFamily: "Inter_500Medium" }]}>
              {resendTimer > 0 ? `Resend in ${resendTimer}s` : "OTP Dobara Bhejein"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  orb1: { position: "absolute", width: 300, height: 300, borderRadius: 150, top: -80, right: -80, opacity: 0.3 },
  content: { flex: 1, paddingHorizontal: 24 },
  backBtn: { marginBottom: 32 },
  backCircle: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  center: { alignItems: "center" },
  iconCircleWrap: { marginBottom: 20 },
  iconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 26, marginBottom: 8 },
  subtitle: { fontSize: 15, marginBottom: 32, textAlign: "center" },
  otpCard: { padding: 20, marginBottom: 0 },
  otpRow: { flexDirection: "row", gap: 10 },
  otpBox: { width: 46, height: 56, borderRadius: 14, borderWidth: 2, textAlign: "center", fontSize: 22 },
  resend: { fontSize: 15 },
});
