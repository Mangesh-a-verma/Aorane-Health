import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
  Alert, Animated, Dimensions,
} from "react-native";
import AoraneLogo from "@/components/AoraneLogo";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "@/lib/api";
import { storage } from "@/lib/storage";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } from "@react-native-google-signin/google-signin";

// Web Client ID from Google Cloud Console (OAuth 2.0 Client IDs → "Aorane Health", Web application type).
// This is the audience the backend's /auth/google route verifies against — not the Android client.
// Public identifier, safe to embed (same as any OAuth client ID shipped in an app).
const GOOGLE_WEB_CLIENT_ID = "145783039315-m1vgfekobq5nkkf90rns4nb9khh6amcv.apps.googleusercontent.com";

const { width: W, height: H } = Dimensions.get("window");

const PRIMARY = "#0B84D6";

const SKY = "#38B6FF";
const ACCENT = "#27AE60";

// ─── FEATURE FLAGS ───────────────────────────────────────────────────────────
// WhatsApp OTP: enable karein jab DLT registration + WhatsApp Business API approve ho
const WHATSAPP_OTP_ENABLED = false;
// WhatsApp tab UI mein bhi dikhao ya nahi — false = tab completely hidden
// Jab DLT ready ho: dono true karo, WhatsApp kaam karna shuru ho jaayega
const WHATSAPP_TAB_VISIBLE = false;
// ─────────────────────────────────────────────────────────────────────────────

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
  const [email, setEmail] = useState("");
  const [emailFocused, setEmailFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [whatsappLoading, setWhatsappLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [loginMode, setLoginMode] = useState<"otp" | "email" | "pin">(WHATSAPP_OTP_ENABLED ? "otp" : "email");
  const [pin, setPin] = useState("");
  const [pinFocused, setPinFocused] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);


  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const orb1Anim = useRef(new Animated.Value(0)).current;
  const orb2Anim = useRef(new Animated.Value(0)).current;

  const ND = Platform.OS !== "web";
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: ND }),
      Animated.spring(slideAnim, { toValue: 0, friction: 7, tension: 50, useNativeDriver: ND }),
      Animated.spring(logoScale, { toValue: 1, friction: 6, tension: 40, useNativeDriver: ND }),
    ]).start();
    Animated.loop(Animated.sequence([
      Animated.timing(orb1Anim, { toValue: 1, duration: 4000, useNativeDriver: ND }),
      Animated.timing(orb1Anim, { toValue: 0, duration: 4000, useNativeDriver: ND }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(orb2Anim, { toValue: 1, duration: 5500, useNativeDriver: ND }),
      Animated.timing(orb2Anim, { toValue: 0, duration: 5500, useNativeDriver: ND }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 2200, useNativeDriver: ND }),
      Animated.timing(glowAnim, { toValue: 0.5, duration: 2200, useNativeDriver: ND }),
    ])).start();
  }, []);

  const goToOtpScreen = (otp?: string) => {
    if (otp) setDevOtp(otp);
    else router.push({ pathname: "/(auth)/verify-otp", params: { phone, lang } });
  };

  const handleSendEmailOtp = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert("Invalid Email", "Please enter a valid email address."); return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    try {
      const res = await api.sendEmailOtp(email);
      if (res?.devOtp) {
        setDevOtp(res.devOtp);
      } else {
        router.push({ pathname: "/(auth)/verify-otp", params: { email, lang, mode: "email" } });
      }
    } catch (err: unknown) {
      Alert.alert("Email Error", err instanceof Error ? err.message : "Failed to send OTP. Please try again.");
    } finally { setIsLoading(false); }
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

  useEffect(() => {
    GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
  }, []);

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

  const handleGoogleLogin = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setGoogleLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) return; // user cancelled the picker — no error to show

      const idToken = response.data.idToken;
      if (!idToken) {
        Alert.alert(t("loginFailed"), "Could not get Google credentials. Please try again.");
        return;
      }

      const result = await api.googleLogin(idToken);
      await loginWithToken(
        result.accessToken,
        result.refreshToken,
        { id: result.user.id, email: response.data.user.email, plan: result.user.plan || "free", languageCode: result.user.languageCode || lang },
        result.isNewUser,
        result.onboardingStep
      );

      // Same post-login routing as verify-otp.tsx (email/phone/firebase flows) —
      // new or incomplete-onboarding users go to onboarding, otherwise PIN
      // setup (first login) or straight to the dashboard.
      const onboardingDone = !result.isNewUser && (result.onboardingStep ?? 0) >= 5;
      if (!onboardingDone) {
        router.replace("/(onboarding)/" as never);
      } else {
        const pinSetAlready = await storage.isPinSet();
        router.replace(pinSetAlready ? "/(tabs)/dashboard" : "/(auth)/setup-pin");
      }
    } catch (err: unknown) {
      if (isErrorWithCode(err)) {
        if (err.code === statusCodes.SIGN_IN_CANCELLED) return;
        if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          Alert.alert(t("loginFailed"), "Google Play Services is not available on this device.");
          return;
        }
      }
      Alert.alert(t("loginFailed"), err instanceof Error ? err.message : t("loginFailed"));
    } finally { setGoogleLoading(false); }
  };

  const isPhoneActive = phone.length === 10;
  const isEmailActive = email.length > 5 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isActive = loginMode === "email" ? isEmailActive : isPhoneActive;
  const anyLoading = isLoading || whatsappLoading || googleLoading;

  const orb1Y = orb1Anim.interpolate({ inputRange: [0, 1], outputRange: [0, -24] });
  const orb2Y = orb2Anim.interpolate({ inputRange: [0, 1], outputRange: [0, 20] });
  const glowScale = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  return (
    <View style={s.root}>
      {/* Cool blue-white background */}
      <LinearGradient
        colors={["#F0F8FF", "#F4FAFF", "#F5F9FF", "#F9FCFF", "#FFFFFF"]}
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
                <Text style={s.devOtpTitle}>Dev Mode — Your OTP</Text>
                <TouchableOpacity onPress={() => setDevOtp(null)} style={s.devOtpClose}>
                  <Ionicons name="close" size={16} color="#92400E" />
                </TouchableOpacity>
              </View>
              <Text style={s.devOtpCode}>{devOtp}</Text>
              <Text style={s.devOtpHint}>{loginMode === "email" ? "OTP also available here for testing." : "SMS delivery unavailable."} Enter this code on the OTP screen.</Text>
              <TouchableOpacity
                onPress={() => {
                  setDevOtp(null);
                  if (loginMode === "email") {
                    router.push({ pathname: "/(auth)/verify-otp", params: { email, lang, mode: "email" } });
                  } else {
                    router.push({ pathname: "/(auth)/verify-otp", params: { phone, lang } });
                  }
                }}
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
            <AoraneLogo width={240} />

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

              {/* Login Mode Toggle — Email OTP | PIN
                  WhatsApp tab hidden until DLT registration approved.
                  To re-enable: set WHATSAPP_TAB_VISIBLE = true above. */}
              <View style={s.toggle}>
                {(["email", "pin"] as readonly ("email" | "pin" | "otp")[])
                  // When DLT ready: change above array to ["otp", "email", "pin"]
                  // and set WHATSAPP_TAB_VISIBLE = true, WHATSAPP_OTP_ENABLED = true
                  // (type widened to include "otp" so this stays valid TS both
                  // before and after that switch — no behavior change today)
                  .filter((mode) => {
                    if (mode === "otp") return WHATSAPP_TAB_VISIBLE;
                    return true;
                  })
                  .map(mode => {
                  const isWhatsApp = mode === "otp";
                  const isDisabled = isWhatsApp && !WHATSAPP_OTP_ENABLED;
                  return (
                    <TouchableOpacity
                      key={mode}
                      onPress={() => {
                        if (isDisabled) return;
                        setLoginMode(mode); setPin(""); Haptics.selectionAsync();
                      }}
                      style={[s.toggleBtn, loginMode === mode && s.toggleBtnActive]}
                    >
                      {loginMode === mode && (
                        <LinearGradient colors={[PRIMARY, SKY]} style={StyleSheet.absoluteFill} />
                      )}
                      <Text style={[s.toggleText, loginMode === mode && s.toggleTextActive]}>
                        {mode === "email" ? `📧 Email OTP` : `🔒 PIN`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Phone Input — shown for OTP & PIN modes */}
              {loginMode !== "email" && (
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
                  {isPhoneActive && (
                    <View style={s.checkBadge}>
                      <Ionicons name="checkmark" size={14} color="#FFF" />
                    </View>
                  )}
                </View>
              )}

              {/* Email Input — shown only for email mode */}
              {loginMode === "email" && (
                <View style={[s.inputRow, emailFocused && s.inputFocused]}>
                  <View style={s.ccBox}>
                    <Ionicons name="mail-outline" size={20} color={emailFocused ? PRIMARY : "#9CB8C8"} />
                  </View>
                  <TextInput
                    style={s.input}
                    placeholder="your@email.com"
                    placeholderTextColor="#9CB8C8"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    autoFocus
                  />
                  {isEmailActive && (
                    <View style={s.checkBadge}>
                      <Ionicons name="checkmark" size={14} color="#FFF" />
                    </View>
                  )}
                </View>
              )}

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
                onPress={loginMode === "pin" ? handlePinLogin : loginMode === "email" ? handleSendEmailOtp : handleWhatsappOtp}
                disabled={anyLoading || !isActive || (loginMode === "pin" && pin.length < 4)}
                accessibilityState={{ disabled: anyLoading || !isActive || (loginMode === "pin" && pin.length < 4) }}
                accessibilityRole="button"
                accessibilityLabel={loginMode === "pin" ? "Login with PIN" : loginMode === "email" ? "Send Email OTP" : "Send OTP on WhatsApp"}
                activeOpacity={0.88}
                style={s.ctaWrap}
              >
                {isActive && (loginMode === "otp" || loginMode === "email" || pin.length >= 4) ? (
                  <LinearGradient
                    colors={loginMode === "pin" ? ["#5B21B6", "#7C3AED", PRIMARY] : [PRIMARY, SKY, ACCENT]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={s.ctaBtn}
                  >
                    {anyLoading
                      ? <View style={{ alignItems: "center", gap: 4 }}>
                          <ActivityIndicator color="#FFF" />
                          <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 11, fontFamily: "Inter_400Regular" }}>
                            Connecting... (may take ~30 sec)
                          </Text>
                        </View>
                      : <>
                          <Text style={s.ctaText}>
                            {loginMode === "pin" ? t("pinLogin") : loginMode === "email" ? "📧 Send Email OTP" : "💬 Send OTP on WhatsApp"}
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
                      {loginMode === "pin" ? t("pinLogin") : loginMode === "email" ? "📧 Send Email OTP" : "💬 Send OTP on WhatsApp"}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Divider + Google Sign-In */}
              <View style={s.dividerRow}>
                <View style={s.dividerLine} />
                <Text style={s.dividerText}>OR</Text>
                <View style={s.dividerLine} />
              </View>

              <TouchableOpacity
                onPress={handleGoogleLogin}
                disabled={anyLoading}
                accessibilityRole="button"
                accessibilityLabel="Continue with Google"
                activeOpacity={0.88}
                style={s.googleBtn}
              >
                {googleLoading ? (
                  <ActivityIndicator color={PRIMARY} />
                ) : (
                  <>
                    <View style={s.googleIcon}>
                      <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 15 }}>G</Text>
                    </View>
                    <Text style={s.googleText}>Continue with Google</Text>
                  </>
                )}
              </TouchableOpacity>

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
  root: { flex: 1, backgroundColor: "#F5F9FF" },
  scroll: { paddingHorizontal: 18 },

  orb1: { position: "absolute", width: 380, height: 380, borderRadius: 190, backgroundColor: "#90BFF0", opacity: 0.22, top: -140, right: -120 },
  orb2: { position: "absolute", width: 300, height: 300, borderRadius: 150, backgroundColor: "#B8D4F0", opacity: 0.20, bottom: 60, left: -100 },
  orb3: { position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: "#D0E6FA", opacity: 0.18, top: H * 0.35, left: W * 0.25 },

  hero: { alignItems: "center", paddingTop: 16, marginBottom: 22 },
  glowRing: { position: "absolute", top: -20 },
  glowGrad: { width: W * 0.9, height: 240, borderRadius: 120 },

  logo: {
    width: Math.min(W * 0.80, 280), height: 180,
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
    backgroundColor: "rgba(11,132,214,0.07)",
    borderWidth: 1, borderColor: "rgba(11,132,214,0.10)",
  },
  toggleBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 13,
    alignItems: "center", overflow: "hidden",
  },
  toggleBtnActive: {},
  toggleBtnDisabled: { backgroundColor: "rgba(200,215,225,0.35)", opacity: 0.7 },
  toggleText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#7A90A4", zIndex: 1 },
  toggleTextActive: { color: "#FFFFFF" },
  toggleTextMuted: { color: "#B0C4D0", fontSize: 12 },
  comingSoonBadge: {
    position: "absolute", top: 3, right: 4,
    backgroundColor: "#F59E0B", borderRadius: 6,
    paddingHorizontal: 5, paddingVertical: 1.5,
  },
  comingSoonText: { fontSize: 8, fontFamily: "Inter_700Bold", color: "#FFF" },

  inputRow: {
    flexDirection: "row", alignItems: "center", borderRadius: 16,
    height: 58, marginBottom: 12,
    backgroundColor: "rgba(240,247,255,0.9)",
    borderWidth: 1.5, borderColor: "rgba(11,132,214,0.12)",
    overflow: "hidden",
  },
  inputFocused: { borderColor: PRIMARY, borderWidth: 2, backgroundColor: "rgba(235,243,252,0.95)" },
  inputFocusPurple: { borderColor: "#8E44AD", borderWidth: 2 },
  ccBox: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 13, height: "100%",
    borderRightWidth: 1, borderRightColor: "rgba(11,132,214,0.12)",
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

  dividerRow: { flexDirection: "row", alignItems: "center", marginVertical: 14, gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "rgba(200,215,230,0.7)" },
  dividerText: { fontSize: 12, color: "#9CB8C8", fontFamily: "Inter_500Medium" },

  googleBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    height: 52, borderRadius: 16, gap: 10, marginBottom: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5, borderColor: "rgba(66,133,244,0.35)",
    shadowColor: "#4285F4", shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 3,
  },
  googleIcon: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "#4285F4", alignItems: "center", justifyContent: "center",
  },
  googleText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#1A1A1A" },
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