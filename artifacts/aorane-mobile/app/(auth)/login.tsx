import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
  Alert, Image, Animated, Dimensions,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

const { width: W } = Dimensions.get("window");

const C = {
  bg: "#F0FAFB",
  primary: "#0077B6",
  accent: "#00B896",
  gradient: ["#0077B6", "#00B896"] as [string, string],
  gradientBtn: ["#0077B6", "#00B896"] as [string, string],
  card: "#FFFFFF",
  text: "#0D1F33",
  muted: "#7A90A4",
  border: "#E2EFF5",
  inputBg: "#F5FBFD",
};

const FEATURES = [
  { icon: "nutrition-outline" as const, label: "AI Food Scan", color: "#00B896" },
  { icon: "fitness-outline" as const, label: "Exercise Tracker", color: "#0077B6" },
  { icon: "heart-outline" as const, label: "Health Score", color: "#EF4444" },
  { icon: "medkit-outline" as const, label: "Medicine Remind", color: "#F59E0B" },
];

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { loginWithToken } = useAuth();
  const { lang, t } = useLanguage();

  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [whatsappLoading, setWhatsappLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [loginMode, setLoginMode] = useState<"otp" | "pin">("otp");
  const [pin, setPin] = useState("");
  const [pinFocused, setPinFocused] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
    ]).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 1800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const goToOtpScreen = (otp?: string) => {
    if (otp) {
      setDevOtp(otp);
    } else {
      router.push({ pathname: "/(auth)/verify-otp", params: { phone, lang } });
    }
  };

  const handleSendOtp = async () => {
    if (phone.length !== 10) { Alert.alert(t("invalidNumber"), t("invalidNumberMsg")); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    try {
      const res = await api.sendOtp(phone);
      goToOtpScreen(res?.devOtp);
    } catch (err: unknown) {
      Alert.alert(t("otpError"), err instanceof Error ? err.message : t("otpError"));
    } finally { setIsLoading(false); }
  };

  const handleWhatsappOtp = async () => {
    if (phone.length !== 10) { Alert.alert(t("invalidNumber"), t("invalidNumberMsg")); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setWhatsappLoading(true);
    try {
      const res = await api.sendWhatsappOtp(phone);
      goToOtpScreen(res?.devOtp);
    } catch (err: unknown) {
      Alert.alert(t("otpError"), err instanceof Error ? err.message : t("otpError"));
    } finally { setWhatsappLoading(false); }
  };

  const handlePinLogin = async () => {
    if (phone.length !== 10) { Alert.alert(t("phoneRequired"), t("invalidNumberMsg")); return; }
    if (pin.length < 4) { Alert.alert(t("pinRequired"), t("pinRequiredMsg")); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    try {
      const result = await api.loginWithPIN(phone, pin);
      const userData = result.user as { id: string; phone?: string; plan: string };
      await loginWithToken(result.accessToken, result.refreshToken, { id: userData.id, phone: userData.phone || phone, plan: userData.plan || "free", languageCode: lang }, false);
      router.replace("/(tabs)/" as never);
    } catch (err: unknown) {
      Alert.alert(t("loginFailed"), err instanceof Error ? err.message : t("loginFailed"));
    } finally { setIsLoading(false); }
  };

  const isActive = phone.length === 10;
  const anyLoading = isLoading || whatsappLoading;

  return (
    <View style={s.root}>
      <LinearGradient colors={["#E8F7FB", "#F0FAF6", "#FFFFFF"]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <View style={s.blob1} />
      <View style={s.blob2} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 28 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── DEV OTP BANNER ── */}
          {devOtp && (
            <View style={s.devOtpBanner}>
              <View style={s.devOtpTop}>
                <Text style={s.devOtpIcon}>🔧</Text>
                <Text style={s.devOtpTitle}>Dev Mode — Aapka OTP</Text>
                <TouchableOpacity onPress={() => setDevOtp(null)} style={s.devOtpClose}>
                  <Ionicons name="close" size={16} color="#92400E" />
                </TouchableOpacity>
              </View>
              <Text style={s.devOtpCode}>{devOtp}</Text>
              <Text style={s.devOtpHint}>SMS delivery unavailable (DLT verification pending). Enter this code on the OTP screen.</Text>
              <TouchableOpacity
                onPress={() => { setDevOtp(null); router.push({ pathname: "/(auth)/verify-otp", params: { phone, lang } }); }}
                style={s.devOtpBtn}
              >
                <Text style={s.devOtpBtnText}>OTP Enter Karne Jao →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── HERO ── */}
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <View style={s.heroSection}>
              <Animated.View style={[s.logoRing, { transform: [{ scale: pulseAnim }] }]}>
                <LinearGradient colors={C.gradient} style={s.logoRingInner}>
                  <Image source={require("../../assets/images/aorane-logo.png")} style={s.logo} resizeMode="contain" />
                </LinearGradient>
              </Animated.View>
              <View style={s.taglineRow}>
                <View style={s.taglineDot} />
                <Text style={s.tagline}>{t("loginTagline")}</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.featRow}>
                {FEATURES.map(f => (
                  <View key={f.label} style={s.featChip}>
                    <Ionicons name={f.icon} size={13} color={f.color} />
                    <Text style={[s.featLabel, { color: f.color }]}>{f.label}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          </Animated.View>

          {/* ── LOGIN CARD ── */}
          <Animated.View style={[s.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={s.cardTop}>
              <LinearGradient colors={C.gradient} style={s.cardIcon}>
                <Ionicons name={loginMode === "pin" ? "keypad-outline" : "phone-portrait-outline"} size={18} color="#FFF" />
              </LinearGradient>
              <View>
                <Text style={s.cardTitle}>{t("loginTitle")}</Text>
                <Text style={s.cardSub}>{loginMode === "pin" ? t("loginSubPin") : t("loginSubOtp")}</Text>
              </View>
            </View>

            {/* OTP / PIN Toggle */}
            <View style={s.toggle}>
              {(["otp", "pin"] as const).map(mode => (
                <TouchableOpacity key={mode} onPress={() => { setLoginMode(mode); Haptics.selectionAsync(); }} style={[s.toggleBtn, loginMode === mode && s.toggleBtnActive]}>
                  <Text style={[s.toggleText, loginMode === mode && s.toggleTextActive]}>
                    {mode === "otp" ? t("otpTab") : t("pinTab")}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Phone Input */}
            <View style={[s.inputRow, isFocused && { borderColor: C.primary, borderWidth: 2 }]}>
              <View style={s.ccBox}>
                <Text style={{ fontSize: 16 }}>🇮🇳</Text>
                <Text style={s.ccText}>+91</Text>
              </View>
              <TextInput
                style={s.input}
                placeholder={t("phonePlaceholder")}
                placeholderTextColor={C.muted}
                keyboardType="numeric"
                maxLength={10}
                value={phone}
                onChangeText={setPhone}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                autoFocus
              />
              {isActive && (
                <View style={s.checkBadge}>
                  <Ionicons name="checkmark" size={14} color="#FFF" />
                </View>
              )}
            </View>

            {/* PIN Input */}
            {loginMode === "pin" && (
              <View style={[s.inputRow, { marginTop: 0 }, pinFocused && { borderColor: "#7C3AED", borderWidth: 2 }]}>
                <View style={s.ccBox}>
                  <Ionicons name="keypad-outline" size={18} color="#7C3AED" />
                </View>
                <TextInput
                  style={s.input}
                  placeholder={t("pinPlaceholder")}
                  placeholderTextColor={C.muted}
                  keyboardType="numeric"
                  maxLength={6}
                  value={pin}
                  onChangeText={setPin}
                  secureTextEntry
                  onFocus={() => setPinFocused(true)}
                  onBlur={() => setPinFocused(false)}
                />
              </View>
            )}

            {/* SMS OTP / PIN Button */}
            <TouchableOpacity
              onPress={loginMode === "pin" ? handlePinLogin : handleSendOtp}
              disabled={anyLoading || !isActive || (loginMode === "pin" && pin.length < 4)}
              activeOpacity={0.85}
              style={{ marginTop: 8 }}
            >
              {isActive && (loginMode === "otp" || pin.length >= 4) ? (
                <LinearGradient
                  colors={loginMode === "pin" ? ["#7C3AED", "#0077B6"] : C.gradientBtn}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={s.ctaBtn}
                >
                  {isLoading ? <ActivityIndicator color="#FFF" /> : (
                    <>
                      <Text style={s.ctaText}>{loginMode === "pin" ? t("pinLogin") : t("sendSmsOtp")}</Text>
                      <View style={s.ctaArrow}>
                        <Ionicons name="arrow-forward" size={16} color={loginMode === "pin" ? "#7C3AED" : C.primary} />
                      </View>
                    </>
                  )}
                </LinearGradient>
              ) : (
                <View style={s.ctaBtnDisabled}>
                  <Text style={s.ctaTextDisabled}>{loginMode === "pin" ? t("pinLogin") : t("sendSmsOtp")}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* WhatsApp + X — side by side */}
            {loginMode === "otp" && (
              <View style={s.socialRow}>
                {/* WhatsApp */}
                <TouchableOpacity
                  onPress={handleWhatsappOtp}
                  disabled={anyLoading || !isActive}
                  activeOpacity={0.82}
                  style={[s.socialBtn, s.waSocialBtn, (!isActive || anyLoading) && s.socialBtnDisabled]}
                >
                  {whatsappLoading ? (
                    <ActivityIndicator color="#25D366" size="small" />
                  ) : (
                    <>
                      <View style={s.socialIconCircle}>
                        <Ionicons name="logo-whatsapp" size={18} color="#FFF" />
                      </View>
                      <Text style={[s.socialBtnText, { color: isActive ? "#128C7E" : "#A0B4BF" }]} numberOfLines={1}>
                        WhatsApp
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* X (Twitter) */}
                <TouchableOpacity
                  onPress={() => Alert.alert("🚀", t("comingSoonMsg"))}
                  activeOpacity={0.75}
                  style={[s.socialBtn, s.xSocialBtn]}
                >
                  <View style={s.xSocialIconCircle}>
                    <Ionicons name="logo-x" size={16} color="#FFF" />
                  </View>
                  <Text style={s.socialBtnText} numberOfLines={1}>X (Twitter)</Text>
                  <View style={s.comingSoonBadge}>
                    <Text style={s.comingSoonText}>{t("comingSoon")}</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {loginMode === "pin" && (
              <Text style={s.pinHint}>{t("pinHint")}</Text>
            )}
          </Animated.View>

          {/* Trust Badges */}
          <Animated.View style={[s.badgeRow, { opacity: fadeAnim }]}>
            {[
              { icon: "lock-closed-outline" as const, text: t("encrypted"), color: C.primary },
              { icon: "shield-checkmark-outline" as const, text: t("dpdpCompliant"), color: C.accent },
              { icon: "heart-outline" as const, text: t("madeInIndia"), color: "#EF4444" },
            ].map(b => (
              <View key={b.text} style={s.badge}>
                <Ionicons name={b.icon} size={11} color={b.color} />
                <Text style={s.badgeText}>{b.text}</Text>
              </View>
            ))}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F0FAFB" },
  scroll: { paddingHorizontal: 18 },
  blob1: { position: "absolute", width: 300, height: 300, borderRadius: 150, backgroundColor: "#BAE6FD", opacity: 0.35, top: -100, right: -100 },
  blob2: { position: "absolute", width: 250, height: 250, borderRadius: 125, backgroundColor: "#A7F3D0", opacity: 0.3, bottom: 100, left: -80 },

  heroSection: { alignItems: "center", paddingTop: 10, marginBottom: 20 },
  logoRing: { width: 150, height: 150, borderRadius: 75, padding: 4, marginBottom: 16, shadowColor: "#0077B6", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 12 },
  logoRingInner: { flex: 1, borderRadius: 71, alignItems: "center", justifyContent: "center" },
  logo: { width: 112, height: 112 },
  taglineRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  taglineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#00B896" },
  tagline: { fontSize: 13.5, color: "#3D6070", fontFamily: "Inter_500Medium" },
  featRow: { gap: 8, paddingVertical: 2 },
  featChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2EFF5", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  featLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },

  card: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 20, marginTop: 16, marginBottom: 16, shadowColor: "#0077B6", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 8, borderWidth: 1, borderColor: "#E8F4FF" },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 },
  cardIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 19, fontFamily: "Inter_700Bold", color: "#0D1F33" },
  cardSub: { fontSize: 12.5, color: "#7A90A4", fontFamily: "Inter_400Regular" },

  toggle: { flexDirection: "row", backgroundColor: "#F0F7FF", borderRadius: 14, padding: 4, marginBottom: 16, gap: 4 },
  toggleBtn: { flex: 1, paddingVertical: 9, borderRadius: 11, alignItems: "center" },
  toggleBtnActive: { backgroundColor: "#0077B6" },
  toggleText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#7A90A4" },
  toggleTextActive: { color: "#FFFFFF" },

  inputRow: { flexDirection: "row", alignItems: "center", borderRadius: 14, height: 56, marginBottom: 12, backgroundColor: "#F5FBFD", borderWidth: 1.5, borderColor: "#E2EFF5", overflow: "hidden" },
  ccBox: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, height: "100%", borderRightWidth: 1, borderRightColor: "#E2EFF5" },
  ccText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#0077B6" },
  input: { flex: 1, paddingHorizontal: 13, fontSize: 16, height: "100%", color: "#0D1F33", fontFamily: "Inter_500Medium" },
  checkBadge: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#00B896", alignItems: "center", justifyContent: "center", marginRight: 12 },

  ctaBtn: { height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10, shadowColor: "#0077B6", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  ctaText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_700Bold" },
  ctaArrow: { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.92)", alignItems: "center", justifyContent: "center" },
  ctaBtnDisabled: { height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#E8F0F5", borderWidth: 1, borderColor: "#D5E5EE" },
  ctaTextDisabled: { color: "#A0B4BF", fontSize: 16, fontFamily: "Inter_700Bold" },
  pinHint: { textAlign: "center", color: "#7A90A4", fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 8 },

  socialRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  socialBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, height: 50, borderRadius: 14, paddingHorizontal: 10, borderWidth: 1.5 },
  waSocialBtn: { backgroundColor: "#F0FFF4", borderColor: "#25D366" },
  xSocialBtn: { backgroundColor: "#F8F8F8", borderColor: "#E5E7EB" },
  socialBtnDisabled: { borderColor: "#D1FAE5", backgroundColor: "#F8FFF9" },
  socialIconCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#25D366", alignItems: "center", justifyContent: "center" },
  xSocialIconCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  socialBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#1A1A1A", flexShrink: 1 },

  comingSoonBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#E5E7EB" },
  comingSoonText: { fontSize: 9, fontFamily: "Inter_500Medium", color: "#6B7280" },

  devOtpBanner: { backgroundColor: "#FEF3C7", borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 2, borderColor: "#F59E0B" },
  devOtpTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  devOtpIcon: { fontSize: 18 },
  devOtpTitle: { flex: 1, fontSize: 13, fontFamily: "Inter_700Bold", color: "#92400E" },
  devOtpClose: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#FDE68A", alignItems: "center", justifyContent: "center" },
  devOtpCode: { fontSize: 42, fontFamily: "Inter_700Bold", color: "#B45309", textAlign: "center", letterSpacing: 10, marginVertical: 8 },
  devOtpHint: { fontSize: 11, color: "#92400E", fontFamily: "Inter_400Regular", textAlign: "center", marginBottom: 12, lineHeight: 16 },
  devOtpBtn: { backgroundColor: "#F59E0B", borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  devOtpBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#FFFFFF" },

  badgeRow: { flexDirection: "row", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 10 },
  badge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E8F2F7" },
  badgeText: { fontSize: 10.5, color: "#7A90A4", fontFamily: "Inter_400Regular" },
});
