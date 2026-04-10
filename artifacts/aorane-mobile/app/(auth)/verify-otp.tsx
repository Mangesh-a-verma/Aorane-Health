import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, useColorScheme, Animated, Dimensions, Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const { width: W, height: H } = Dimensions.get("window");

export default function VerifyOtpScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const insets = useSafeAreaInsets();
  const { loginWithToken } = useAuth();
  const { phone, lang = "hi" } = useLocalSearchParams<{ phone: string; lang: string }>();

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const inputs = useRef<Array<TextInput | null>>([]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: false }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
    ]).start();

    // Pulsing icon animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();

    const interval = setInterval(() => setResendTimer((t) => (t > 0 ? t - 1 : 0)), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleChange = (text: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = text.slice(-1);
    setOtp(newOtp);
    Haptics.selectionAsync();
    if (text && index < 5) inputs.current[index + 1]?.focus();
    if (newOtp.every((d) => d !== "")) handleVerify(newOtp.join(""));
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === "Backspace" && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (otpValue: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    try {
      const res = await api.verifyOtp(phone || "", otpValue, lang as string);
      await loginWithToken(res.accessToken, res.refreshToken, res.user, res.isNewUser);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid OTP";
      Alert.alert("Galat OTP", msg);
      setOtp(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally { setIsLoading(false); }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    try {
      await api.sendOtp(phone || "");
      setResendTimer(30);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch { }
  };

  const filled = otp.filter(Boolean).length;
  const progress = filled / 6;

  return (
    <View style={styles.root}>
      {/* Same vivid gradient as login */}
      <LinearGradient
        colors={isDark
          ? ["#010814", "#031628", "#051E30", "#061A2A"]
          : ["#C8E9FA", "#D9F4EE", "#E8F4FF", "#D4F0F7"]}
        locations={[0, 0.3, 0.65, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Background orbs */}
      <View style={[styles.orb1, { backgroundColor: isDark ? "#0055A3" : "#7DD3FC", opacity: 0.55 }]} />
      <View style={[styles.orb2, { backgroundColor: isDark ? "#044A38" : "#6EE7B7", opacity: 0.45 }]} />
      <View style={[styles.orb3, { backgroundColor: isDark ? "#1E3A5F" : "#BAE6FD", opacity: 0.4 }]} />

      <View style={[styles.container, { paddingTop: insets.top + 12 }]}>

        {/* Glass Back Button */}
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8} style={styles.backWrap}>
          <View style={[styles.backBtn, {
            backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.65)",
            borderColor: isDark ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.9)",
          }]}>
            {Platform.OS === "ios" && <BlurView intensity={30} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />}
            <Ionicons name="arrow-back" size={20} color={isDark ? "#F0F8FF" : "#0077B6"} />
          </View>
        </TouchableOpacity>

        <Animated.View style={[styles.body, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

          {/* Animated Icon */}
          <Animated.View style={[styles.iconWrap, { transform: [{ scale: pulseAnim }] }]}>
            <LinearGradient colors={["#0077B6", "#0EA5E9", "#1B998B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.iconGrad}>
              <Ionicons name="chatbubble-ellipses" size={32} color="#FFF" />
            </LinearGradient>
            {/* Glow ring */}
            <View style={[styles.iconGlowRing, { borderColor: isDark ? "rgba(56,189,248,0.35)" : "rgba(0,119,182,0.25)" }]} />
          </Animated.View>

          {/* Title */}
          <Text style={[styles.title, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>
            OTP Enter Karein
          </Text>
          <Text style={[styles.subtitle, { color: isDark ? "rgba(255,255,255,0.5)" : "rgba(10,22,40,0.55)", fontFamily: "Inter_400Regular" }]}>
            +91 {phone} pe 6-digit code bheja gaya
          </Text>

          {/* ── GLASS OTP CARD ── */}
          <LinearGradient
            colors={isDark
              ? ["rgba(56,189,248,0.32)", "rgba(45,212,191,0.2)", "rgba(255,255,255,0.05)"]
              : ["rgba(255,255,255,0.95)", "rgba(186,230,253,0.55)", "rgba(167,243,208,0.4)"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.cardBorder}
          >
            <View style={[styles.cardInner, { backgroundColor: isDark ? "rgba(8,18,40,0.55)" : "rgba(255,255,255,0.55)" }]}>
              {Platform.OS === "ios"
                ? <BlurView intensity={isDark ? 80 : 60} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
                : <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? "rgba(8,16,36,0.4)" : "rgba(255,255,255,0.4)" }]} />
              }
              {/* Inner top shimmer */}
              <LinearGradient
                colors={isDark ? ["rgba(56,189,248,0.15)", "transparent"] : ["rgba(255,255,255,0.9)", "transparent"]}
                style={styles.topShimmer}
              />

              {/* Progress bar */}
              <View style={[styles.progressTrack, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }]}>
                <LinearGradient
                  colors={["#0077B6", "#0EA5E9", "#1B998B"]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={[styles.progressFill, { width: `${progress * 100}%` }]}
                />
              </View>

              {/* OTP Boxes */}
              <View style={styles.otpRow}>
                {otp.map((digit, i) => (
                  <TextInput
                    key={i}
                    ref={(r) => { inputs.current[i] = r; }}
                    style={[styles.otpBox, {
                      backgroundColor: digit
                        ? (isDark ? "rgba(56,189,248,0.18)" : "rgba(0,119,182,0.1)")
                        : (isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.65)"),
                      borderColor: digit
                        ? (isDark ? "#38BDF8" : "#0077B6")
                        : (isDark ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.9)"),
                      color: isDark ? "#F0F8FF" : "#0A1628",
                      fontFamily: "Inter_700Bold",
                      shadowColor: digit ? (isDark ? "#38BDF8" : "#0077B6") : "transparent",
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.45,
                      shadowRadius: 8,
                      elevation: digit ? 4 : 0,
                    }]}
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

              {/* Status text */}
              <Text style={[styles.countText, { color: isDark ? "rgba(255,255,255,0.35)" : "rgba(10,22,40,0.38)", fontFamily: "Inter_400Regular" }]}>
                {filled === 0 ? "6 digits enter karein" : filled < 6 ? `${filled}/6 entered` : "Verifying..."}
              </Text>
            </View>
          </LinearGradient>

          {/* Loading */}
          {isLoading && (
            <View style={styles.loadingWrap}>
              <LinearGradient colors={["rgba(0,119,182,0.15)", "rgba(27,153,139,0.1)"]} style={styles.loadingPill}>
                <ActivityIndicator color={isDark ? "#38BDF8" : "#0077B6"} size="small" />
                <Text style={[styles.loadingText, { color: isDark ? "#38BDF8" : "#0077B6", fontFamily: "Inter_500Medium" }]}>
                  Verify ho raha hai...
                </Text>
              </LinearGradient>
            </View>
          )}

          {/* Resend */}
          <TouchableOpacity onPress={handleResend} disabled={resendTimer > 0} activeOpacity={0.75} style={styles.resendWrap}>
            <View style={[styles.resendPill, {
              backgroundColor: resendTimer === 0
                ? (isDark ? "rgba(56,189,248,0.12)" : "rgba(0,119,182,0.08)")
                : (isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.5)"),
              borderColor: resendTimer === 0
                ? (isDark ? "rgba(56,189,248,0.28)" : "rgba(0,119,182,0.2)")
                : (isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.8)"),
            }]}>
              <Ionicons
                name="refresh-outline"
                size={14}
                color={resendTimer > 0 ? (isDark ? "rgba(255,255,255,0.25)" : "rgba(10,22,40,0.3)") : (isDark ? "#38BDF8" : "#0077B6")}
              />
              <Text style={[styles.resendText, {
                color: resendTimer > 0
                  ? (isDark ? "rgba(255,255,255,0.3)" : "rgba(10,22,40,0.35)")
                  : (isDark ? "#38BDF8" : "#0077B6"),
                fontFamily: "Inter_500Medium",
              }]}>
                {resendTimer > 0 ? `Resend in ${resendTimer}s` : "OTP Dobara Bhejein"}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Security note */}
          <View style={[styles.secNote, {
            backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.55)",
            borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.85)",
          }]}>
            <Ionicons name="lock-closed" size={12} color={isDark ? "rgba(56,189,248,0.7)" : "#0077B6"} />
            <Text style={[styles.secText, { color: isDark ? "rgba(255,255,255,0.38)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular" }]}>
              OTP sirf ek baar kaam karta hai • End-to-end encrypted
            </Text>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  orb1: { position: "absolute", width: 380, height: 380, borderRadius: 190, top: -140, right: -120 },
  orb2: { position: "absolute", width: 300, height: 300, borderRadius: 150, bottom: 60, left: -100 },
  orb3: { position: "absolute", width: 200, height: 200, borderRadius: 100, top: H * 0.4, right: -60 },

  container: { flex: 1, paddingHorizontal: 22 },
  backWrap: { marginBottom: 24 },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1, overflow: "hidden" },

  body: { alignItems: "center" },

  iconWrap: { marginBottom: 22, position: "relative" },
  iconGrad: { width: 78, height: 78, borderRadius: 39, alignItems: "center", justifyContent: "center" },
  iconGlowRing: { position: "absolute", top: -6, left: -6, right: -6, bottom: -6, borderRadius: 45, borderWidth: 2 },

  title: { fontSize: 26, marginBottom: 8, textAlign: "center" },
  subtitle: { fontSize: 14, marginBottom: 28, textAlign: "center", lineHeight: 20 },

  cardBorder: { width: W - 44, borderRadius: 26, padding: 1.5, marginBottom: 20 },
  cardInner: { borderRadius: 25, overflow: "hidden", padding: 22 },
  topShimmer: { position: "absolute", top: 0, left: 0, right: 0, height: 50 },

  progressTrack: { height: 3, borderRadius: 2, marginBottom: 20, overflow: "hidden" },
  progressFill: { height: 3, borderRadius: 2 },

  otpRow: { flexDirection: "row", justifyContent: "center", gap: 10, marginBottom: 16 },
  otpBox: { width: 46, height: 58, borderRadius: 14, borderWidth: 1.5, textAlign: "center", fontSize: 24 },

  countText: { fontSize: 12, textAlign: "center" },

  loadingWrap: { marginBottom: 16 },
  loadingPill: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20 },
  loadingText: { fontSize: 14 },

  resendWrap: { marginBottom: 20 },
  resendPill: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 22, borderWidth: 1 },
  resendText: { fontSize: 14 },

  secNote: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, borderWidth: 1 },
  secText: { fontSize: 11, flex: 1, lineHeight: 16 },
});
