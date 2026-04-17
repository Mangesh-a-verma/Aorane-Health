import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Animated, Dimensions,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { storage } from "@/lib/storage";
import { getConfirmationResult, clearConfirmationResult } from "@/lib/firebase";
import type { LangCode } from "@/lib/translations";

const { width: W } = Dimensions.get("window");

const C = {
  bg: "#F0FAFB",
  primary: "#0077B6",
  accent: "#00B896",
  gradient: ["#0077B6", "#00B896"] as [string, string],
  card: "#FFFFFF",
  text: "#0D1F33",
  muted: "#7A90A4",
  border: "#E2EFF5",
  inputBg: "#F5FBFD",
};

export default function VerifyOtpScreen() {
  const insets = useSafeAreaInsets();
  const { loginWithToken } = useAuth();
  const { t } = useLanguage();
  const { phone, email, lang: langParam = "en", mode } = useLocalSearchParams<{ phone: string; email?: string; lang: string; mode?: string }>();
  const isEmailMode = mode === "email";

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputs = useRef<Array<TextInput | null>>([]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
    ]).start();
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
    setErrorMsg(null);
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
      let accessToken: string;
      let refreshToken: string;
      let user: { id: string; phone?: string; email?: string; plan: string; languageCode: string };
      let isNewUser: boolean;

      if (mode === "email") {
        const res = await api.verifyEmailOtp(email || "", otpValue, langParam as string);
        accessToken = res.accessToken;
        refreshToken = res.refreshToken;
        user = res.user;
        isNewUser = res.isNewUser;
      } else if (mode === "firebase") {
        const confirmation = getConfirmationResult();
        if (!confirmation) throw new Error("Session expired — please request OTP again");
        const credential = await confirmation.confirm(otpValue);
        clearConfirmationResult();
        const idToken = await credential.user.getIdToken();
        const res = await api.firebaseLogin(idToken, phone || "", langParam as string);
        accessToken = res.accessToken;
        refreshToken = res.refreshToken;
        user = res.user;
        isNewUser = res.isNewUser;
      } else {
        const res = await api.verifyOtp(phone || "", otpValue, langParam as string);
        accessToken = res.accessToken;
        refreshToken = res.refreshToken;
        user = res.user;
        isNewUser = res.isNewUser;
      }

      await loginWithToken(accessToken, refreshToken, user, isNewUser);

      if (isNewUser) {
        router.replace("/(onboarding)/" as never);
      } else {
        const pinSetAlready = await storage.isPinSet();
        if (pinSetAlready) {
          router.replace("/(tabs)/dashboard");
        } else {
          router.replace("/(auth)/setup-pin");
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("wrongOtp");
      setErrorMsg(msg);
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
      if (isEmailMode) {
        await api.sendEmailOtp(email || "");
      } else {
        await api.sendOtp(phone || "");
      }
      setResendTimer(30);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch { }
  };

  const filled = otp.filter(Boolean).length;
  const progress = filled / 6;

  return (
    <View style={s.root}>
      <LinearGradient colors={["#E8F7FB", "#F0FAF6", "#FFFFFF"]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <View style={s.blob1} />
      <View style={s.blob2} />

      <View style={[s.container, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8} style={s.backWrap}>
          <View style={s.backBtn}>
            <Ionicons name="arrow-back" size={20} color={C.primary} />
          </View>
        </TouchableOpacity>

        <Animated.View style={[s.body, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Animated.View style={[s.iconWrap, { transform: [{ scale: pulseAnim }] }]}>
            <LinearGradient colors={C.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.iconGrad}>
              <Ionicons name={isEmailMode ? "mail" : "chatbubble-ellipses"} size={32} color="#FFF" />
            </LinearGradient>
            <View style={s.iconGlowRing} />
          </Animated.View>

          <Text style={s.title}>{t("enterOtp")}</Text>
          <Text style={s.subtitle}>
            {isEmailMode ? `OTP sent to: ${email}` : `${t("otpSentTo")} ${phone}`}
          </Text>

          <View style={s.card}>
            <View style={s.progressTrack}>
              <LinearGradient
                colors={C.gradient}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[s.progressFill, { width: `${progress * 100}%` as any }]}
              />
            </View>

            <View style={s.otpRow}>
              {otp.map((digit, i) => (
                <TextInput
                  key={i}
                  ref={(r) => { inputs.current[i] = r; }}
                  style={[s.otpBox, digit && { borderColor: C.primary, backgroundColor: "#EBF5FF" }]}
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

            <Text style={s.countText}>
              {filled === 0 ? t("enterOtp") : filled < 6 ? `${filled}/6` : t("verifying")}
            </Text>
          </View>

          {errorMsg && (
            <View style={s.errorWrap}>
              <Ionicons name="alert-circle" size={16} color="#DC2626" />
              <Text style={s.errorText}>{errorMsg}</Text>
            </View>
          )}

          {isLoading ? (
            <View style={s.loadingWrap}>
              <ActivityIndicator color={C.primary} size="small" />
              <Text style={s.loadingText}>{t("verifying")}</Text>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => { if (filled === 6) handleVerify(otp.join("")); }}
              activeOpacity={filled === 6 ? 0.8 : 1}
              style={[s.verifyBtn, filled < 6 && s.verifyBtnDisabled]}
              accessibilityLabel="Verify OTP"
              accessibilityRole="button"
            >
              <LinearGradient
                colors={filled === 6 ? C.gradient : ["#C0D8E8", "#B0D4C8"] as [string, string]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.verifyBtnGrad}
              >
                <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                <Text style={s.verifyBtnText}>
                  {filled < 6 ? `${filled}/6 digits` : "Verify OTP"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={handleResend} disabled={resendTimer > 0} activeOpacity={0.75} style={s.resendWrap}>
            <View style={[s.resendPill, resendTimer === 0 && { borderColor: C.primary, backgroundColor: "#EBF5FF" }]}>
              <Ionicons name="refresh-outline" size={14} color={resendTimer > 0 ? C.muted : C.primary} />
              <Text style={[s.resendText, { color: resendTimer > 0 ? C.muted : C.primary }]}>
                {resendTimer > 0 ? `${t("resendIn")} ${resendTimer}s` : t("resendOtp")}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={s.secNote}>
            <Ionicons name="lock-closed" size={12} color={C.primary} />
            <Text style={s.secText}>{t("secureNote")}</Text>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  blob1: { position: "absolute", width: 300, height: 300, borderRadius: 150, backgroundColor: "#BAE6FD", opacity: 0.35, top: -100, right: -100 },
  blob2: { position: "absolute", width: 250, height: 250, borderRadius: 125, backgroundColor: "#A7F3D0", opacity: 0.3, bottom: 100, left: -80 },

  container: { flex: 1, paddingHorizontal: 22 },
  backWrap: { marginBottom: 24 },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: C.card, borderWidth: 1, borderColor: C.border, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },

  body: { alignItems: "center" },

  iconWrap: { marginBottom: 22, position: "relative" },
  iconGrad: { width: 78, height: 78, borderRadius: 39, alignItems: "center", justifyContent: "center" },
  iconGlowRing: { position: "absolute", top: -6, left: -6, right: -6, bottom: -6, borderRadius: 45, borderWidth: 2, borderColor: "rgba(0,119,182,0.2)" },

  title: { fontSize: 26, marginBottom: 8, textAlign: "center", fontFamily: "Inter_700Bold", color: C.text },
  subtitle: { fontSize: 14, marginBottom: 28, textAlign: "center", lineHeight: 20, fontFamily: "Inter_400Regular", color: C.muted },

  card: { width: W - 44, backgroundColor: C.card, borderRadius: 24, padding: 22, marginBottom: 20, shadowColor: C.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 8, borderWidth: 1, borderColor: C.border },

  progressTrack: { height: 3, borderRadius: 2, marginBottom: 20, overflow: "hidden", backgroundColor: C.border },
  progressFill: { height: 3, borderRadius: 2 },

  otpRow: { flexDirection: "row", justifyContent: "center", gap: 10, marginBottom: 16 },
  otpBox: { width: 46, height: 58, borderRadius: 14, borderWidth: 1.5, textAlign: "center", fontSize: 24, fontFamily: "Inter_700Bold", color: C.text, borderColor: C.border, backgroundColor: C.inputBg },

  countText: { fontSize: 12, textAlign: "center", fontFamily: "Inter_400Regular", color: C.muted },

  errorWrap: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA", borderRadius: 12, padding: 12, marginBottom: 12, width: "100%" as const },
  errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: "#DC2626", lineHeight: 18 },

  loadingWrap: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  loadingText: { fontSize: 14, fontFamily: "Inter_500Medium", color: C.primary },

  verifyBtn: { width: "100%" as const, marginBottom: 14, borderRadius: 16, overflow: "hidden" },
  verifyBtnDisabled: { opacity: 0.65 },
  verifyBtnGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16, paddingHorizontal: 24 },
  verifyBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#FFF" },

  resendWrap: { marginBottom: 20 },
  resendPill: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 22, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  resendText: { fontSize: 14, fontFamily: "Inter_500Medium" },

  secNote: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  secText: { fontSize: 11, flex: 1, lineHeight: 16, fontFamily: "Inter_400Regular", color: C.muted },
});
