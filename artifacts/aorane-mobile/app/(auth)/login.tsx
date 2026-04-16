import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
  Alert, Image, Animated, Dimensions,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

const { width: W, height: H } = Dimensions.get("window");

const PRIMARY = "#E8622A";
const SKY = "#F5A623";
const ACCENT = "#27AE60";

function GlassCard({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View style={[gl.card, style]}>
      {Platform.OS === "ios" && (
        <BlurView intensity={60} tint="extraLight" style={StyleSheet.absoluteFill} />
      )}
      <View style={[StyleSheet.absoluteFill, gl.fill]} />
      <View style={gl.inner}>{children}</View>
    </View>
  );
}
const gl = StyleSheet.create({
  card: {
    borderRadius: 28, overflow: "hidden",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.88)",
    backgroundColor: Platform.OS === "ios" ? "transparent" : "rgba(255,255,255,0.82)",
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14, shadowRadius: 28, elevation: 10,
  },
  fill: { backgroundColor: "rgba(255,255,255,0.82)", borderRadius: 28 },
  inner: { padding: 22 },
});

const FEATURES = [
  { icon: "nutrition-outline" as const, label: "AI Food Scan", color: ACCENT },
  { icon: "fitness-outline" as const, label: "Exercise Tracker", color: PRIMARY },
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
  const slideAnim = useRef(new Animated.Value(40)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const orb1Anim = useRef(new Animated.Value(0)).current;
  const orb2Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 7, tension: 50, useNativeDriver: true }),
      Animated.spring(logoScale, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }),
    ]).start();
    // Floating orb animations
    Animated.loop(Animated.sequence([
      Animated.timing(orb1Anim, { toValue: 1, duration: 4000, useNativeDriver: true }),
      Animated.timing(orb1Anim, { toValue: 0, duration: 4000, useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(orb2Anim, { toValue: 1, duration: 5500, useNativeDriver: true }),
      Animated.timing(orb2Anim, { toValue: 0, duration: 5500, useNativeDriver: true }),
    ])).start();
    // Glow pulse
    Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 2200, useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0.5, duration: 2200, useNativeDriver: true }),
    ])).start();
  }, []);

  const goToOtpScreen = (otp?: string) => {
    if (otp) setDevOtp(otp);
    else router.push({ pathname: "/(auth)/verify-otp", params: { phone, lang } });
  };

  const handleSendOtp = async () => {
    if (phone.length !== 10) { Alert.alert(t("invalidNumber"), t("invalidNumberMsg")); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    try {
      const res = await api.sendOtp(phone);
      if (res?.devOtp) {
        setDevOtp(res.devOtp);
      } else {
        router.push({ pathname: "/(auth)/verify-otp", params: { phone, lang } });
      }
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

  const orb1Y = orb1Anim.interpolate({ inputRange: [0, 1], outputRange: [0, -24] });
  const orb2Y = orb2Anim.interpolate({ inputRange: [0, 1], outputRange: [0, 20] });
  const glowScale = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  return (
    <View style={s.root}>
      {/* Warm gradient background */}
      <LinearGradient
        colors={["#FFF0E6", "#FFE5D0", "#FFF8F3", "#FFFAF7", "#FFFFFF"]}
        locations={[0, 0.2, 0.5, 0.75, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Floating decorative orbs */}
      <Animated.View style={[s.orb1, { transform: [{ translateY: orb1Y }] }]} />
      <Animated.View style={[s.orb2, { transform: [{ translateY: orb2Y }] }]} />
      <View style={s.orb3} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 28 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Dev OTP Banner */}
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
              <Text style={s.devOtpHint}>SMS delivery unavailable. Enter this code on OTP screen.</Text>
              <TouchableOpacity
                onPress={() => { setDevOtp(null); router.push({ pathname: "/(auth)/verify-otp", params: { phone, lang } }); }}
                style={s.devOtpBtn}
              >
                <Text style={s.devOtpBtnText}>Enter OTP →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── HERO SECTION ── */}
          <Animated.View style={[s.hero, { opacity: fadeAnim, transform: [{ scale: logoScale }] }]}>
            {/* Glow ring behind logo */}
            <Animated.View style={[s.glowRing, { transform: [{ scale: glowScale }], opacity: glowAnim }]}>
              <LinearGradient
                colors={["rgba(0,119,182,0.35)", "rgba(0,184,150,0.2)", "transparent"]}
                style={s.glowGrad}
              />
            </Animated.View>

            {/* Logo */}
            <Image
              source={require("../../assets/images/aorane-logo.png")}
              style={s.logo}
              resizeMode="contain"
            />

            {/* Tagline */}
            <View style={s.taglineRow}>
              <View style={s.taglineDot} />
              <Text style={s.tagline}>{t("loginTagline")}</Text>
            </View>

            {/* Feature chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.featRow}>
              {FEATURES.map(f => (
                <View key={f.label} style={s.featChip}>
                  <Ionicons name={f.icon} size={13} color={f.color} />
                  <Text style={[s.featLabel, { color: f.color }]}>{f.label}</Text>
                </View>
              ))}
            </ScrollView>
          </Animated.View>

          {/* ── GLASS LOGIN CARD ── */}
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <GlassCard>
              {/* Card header */}
              <View style={s.cardTop}>
                <LinearGradient colors={[PRIMARY, ACCENT]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.cardIcon}>
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
                  <TouchableOpacity
                    key={mode}
                    onPress={() => { setLoginMode(mode); setPin(""); Haptics.selectionAsync(); }}
                    style={[s.toggleBtn, loginMode === mode && s.toggleBtnActive]}
                  >
                    {loginMode === mode && (
                      <LinearGradient colors={[PRIMARY, SKY]} style={StyleSheet.absoluteFill} />
                    )}
                    <Text style={[s.toggleText, loginMode === mode && s.toggleTextActive]}>
                      {mode === "otp" ? `📱 ${t("otpTab")}` : `🔒 ${t("pinTab")}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Phone Input */}
              <View style={[s.inputRow, isFocused && s.inputFocused]}>
                <View style={s.ccBox}>
                  <Text style={{ fontSize: 18 }}>🇮🇳</Text>
                  <Text style={s.ccText}>+91</Text>
                </View>
                <TextInput
                  style={s.input}
                  placeholder={t("phonePlaceholder")}
                  placeholderTextColor="#9CB8C8"
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
                <View style={[s.inputRow, pinFocused && s.inputFocusPurple]}>
                  <View style={s.ccBox}>
                    <Ionicons name="keypad-outline" size={20} color="#7C3AED" />
                  </View>
                  <TextInput
                    style={s.input}
                    placeholder={t("pinPlaceholder")}
                    placeholderTextColor="#9CB8C8"
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

              {/* CTA Button */}
              <TouchableOpacity
                onPress={loginMode === "pin" ? handlePinLogin : handleSendOtp}
                disabled={anyLoading || !isActive || (loginMode === "pin" && pin.length < 4)}
                accessibilityState={{ disabled: anyLoading || !isActive || (loginMode === "pin" && pin.length < 4) }}
                accessibilityRole="button"
                accessibilityLabel={loginMode === "pin" ? "Login with PIN" : "Send SMS OTP"}
                activeOpacity={0.88}
                style={s.ctaWrap}
              >
                {isActive && (loginMode === "otp" || pin.length >= 4) ? (
                  <LinearGradient
                    colors={loginMode === "pin" ? ["#5B21B6", "#7C3AED", PRIMARY] : [PRIMARY, SKY, ACCENT]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={s.ctaBtn}
                  >
                    {anyLoading
                      ? <ActivityIndicator color="#FFF" />
                      : <>
                          <Text style={s.ctaText}>
                            {loginMode === "pin" ? t("pinLogin") : t("sendSmsOtp")}
                          </Text>
                          <View style={s.ctaArrow}>
                            <Ionicons name="arrow-forward" size={16} color={loginMode === "pin" ? "#7C3AED" : PRIMARY} />
                          </View>
                        </>
                    }
                  </LinearGradient>
                ) : (
                  <View style={s.ctaBtnDisabled}>
                    <Text style={s.ctaTextDisabled}>
                      {loginMode === "pin" ? t("pinLogin") : t("sendSmsOtp")}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Social Buttons */}
              {loginMode === "otp" && (
                <View style={s.socialRow}>
                  <TouchableOpacity
                    onPress={handleWhatsappOtp}
                    disabled={anyLoading || !isActive}
                    activeOpacity={0.82}
                    style={[s.socialBtn, s.waSocialBtn, (!isActive || anyLoading) && s.socialBtnDisabled]}
                  >
                    {whatsappLoading
                      ? <ActivityIndicator color="#25D366" size="small" />
                      : <>
                          <View style={s.waBadge}>
                            <Ionicons name="logo-whatsapp" size={17} color="#FFF" />
                          </View>
                          <Text style={[s.socialText, { color: isActive ? "#128C7E" : "#9CB8C8" }]}>WhatsApp</Text>
                        </>
                    }
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => Alert.alert("🚀", t("comingSoonMsg"))}
                    activeOpacity={0.75}
                    style={[s.socialBtn, s.xSocialBtn]}
                  >
                    <View style={s.xBadge}>
                      <Ionicons name="logo-x" size={14} color="#FFF" />
                    </View>
                    <Text style={s.socialText}>X (Twitter)</Text>
                    <View style={s.soonBadge}><Text style={s.soonText}>{t("comingSoon")}</Text></View>
                  </TouchableOpacity>
                </View>
              )}

              {loginMode === "pin" && (
                <Text style={s.pinHint}>{t("pinHint")}</Text>
              )}
            </GlassCard>
          </Animated.View>

          {/* Trust Badges */}
          <Animated.View style={[s.badgeRow, { opacity: fadeAnim }]}>
            {[
              { icon: "lock-closed-outline" as const, text: t("encrypted"), color: PRIMARY },
              { icon: "shield-checkmark-outline" as const, text: t("dpdpCompliant"), color: ACCENT },
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
  root: { flex: 1, backgroundColor: "#FFF0E6" },
  scroll: { paddingHorizontal: 18 },

  orb1: { position: "absolute", width: 380, height: 380, borderRadius: 190, backgroundColor: "#FBBF7C", opacity: 0.28, top: -140, right: -120 },
  orb2: { position: "absolute", width: 300, height: 300, borderRadius: 150, backgroundColor: "#F5CBA7", opacity: 0.25, bottom: 60, left: -100 },
  orb3: { position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: "#FAD7A0", opacity: 0.18, top: H * 0.35, left: W * 0.25 },

  hero: { alignItems: "center", paddingTop: 16, marginBottom: 22 },
  glowRing: { position: "absolute", top: -20 },
  glowGrad: { width: W * 0.9, height: 240, borderRadius: 120 },

  logo: {
    width: W * 0.80, height: 200,
    marginBottom: 10,
  },

  taglineRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  taglineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: ACCENT },
  tagline: { fontSize: 13.5, color: "#3D607A", fontFamily: "Inter_500Medium" },

  featRow: { gap: 8, paddingVertical: 2 },
  featChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderWidth: 1.2, borderColor: "rgba(255,255,255,0.95)",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07, shadowRadius: 4, elevation: 2,
  },
  featLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  cardTop: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 },
  cardIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#0D1F33" },
  cardSub: { fontSize: 12.5, color: "#7A90A4", fontFamily: "Inter_400Regular", marginTop: 1 },

  toggle: {
    flexDirection: "row", borderRadius: 16, padding: 4,
    marginBottom: 18, gap: 4, overflow: "hidden",
    backgroundColor: "rgba(232,98,42,0.07)",
    borderWidth: 1, borderColor: "rgba(232,98,42,0.12)",
  },
  toggleBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 13,
    alignItems: "center", overflow: "hidden",
  },
  toggleBtnActive: {},
  toggleText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#7A90A4", zIndex: 1 },
  toggleTextActive: { color: "#FFFFFF" },

  inputRow: {
    flexDirection: "row", alignItems: "center", borderRadius: 16,
    height: 58, marginBottom: 12,
    backgroundColor: "rgba(255,248,243,0.9)",
    borderWidth: 1.5, borderColor: "rgba(232,98,42,0.15)",
    overflow: "hidden",
  },
  inputFocused: { borderColor: PRIMARY, borderWidth: 2, backgroundColor: "rgba(253,238,230,0.95)" },
  inputFocusPurple: { borderColor: "#8E44AD", borderWidth: 2 },
  ccBox: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 13, height: "100%",
    borderRightWidth: 1, borderRightColor: "rgba(232,98,42,0.15)",
  },
  ccText: { fontSize: 15, fontFamily: "Inter_700Bold", color: PRIMARY },
  input: { flex: 1, paddingHorizontal: 14, fontSize: 16, height: "100%", color: "#0D1F33", fontFamily: "Inter_500Medium" },
  checkBadge: { width: 26, height: 26, borderRadius: 13, backgroundColor: ACCENT, alignItems: "center", justifyContent: "center", marginRight: 13 },

  ctaWrap: { marginTop: 6 },
  ctaBtn: {
    height: 54, borderRadius: 16, alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 10,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 14, elevation: 8,
  },
  ctaText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_700Bold" },
  ctaArrow: { width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.9)", alignItems: "center", justifyContent: "center" },
  ctaBtnDisabled: { height: 54, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(200,220,235,0.6)", borderWidth: 1, borderColor: "rgba(200,220,235,0.8)" },
  ctaTextDisabled: { color: "#A0B8C8", fontSize: 16, fontFamily: "Inter_700Bold" },

  socialRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  socialBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 7, height: 50, borderRadius: 14, paddingHorizontal: 10, borderWidth: 1.5,
  },
  waSocialBtn: { backgroundColor: "rgba(240,255,246,0.9)", borderColor: "rgba(37,211,102,0.6)" },
  xSocialBtn: { backgroundColor: "rgba(248,248,248,0.9)", borderColor: "rgba(229,231,235,0.8)" },
  socialBtnDisabled: { opacity: 0.55 },
  waBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#25D366", alignItems: "center", justifyContent: "center" },
  xBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  socialText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#1A1A1A", flexShrink: 1 },
  soonBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#E5E7EB" },
  soonText: { fontSize: 9, fontFamily: "Inter_500Medium", color: "#6B7280" },

  pinHint: { textAlign: "center", color: "#7A90A4", fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 10 },

  devOtpBanner: { backgroundColor: "#FEF3C7", borderRadius: 18, padding: 16, marginBottom: 16, borderWidth: 2, borderColor: "#F59E0B" },
  devOtpTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  devOtpIcon: { fontSize: 18 },
  devOtpTitle: { flex: 1, fontSize: 13, fontFamily: "Inter_700Bold", color: "#92400E" },
  devOtpClose: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#FDE68A", alignItems: "center", justifyContent: "center" },
  devOtpCode: { fontSize: 42, fontFamily: "Inter_700Bold", color: "#B45309", textAlign: "center", letterSpacing: 10, marginVertical: 8 },
  devOtpHint: { fontSize: 11, color: "#92400E", fontFamily: "Inter_400Regular", textAlign: "center", marginBottom: 12, lineHeight: 16 },
  devOtpBtn: { backgroundColor: "#F59E0B", borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  devOtpBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#FFF" },

  badgeRow: { flexDirection: "row", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 8, marginBottom: 10 },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.95)",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  badgeText: { fontSize: 10.5, color: "#7A90A4", fontFamily: "Inter_400Regular" },
});
