import React, { useState, useRef, useEffect, useMemo } from "react";
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
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import * as Crypto from "expo-crypto";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

WebBrowser.maybeCompleteAuthSession();

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
  green: "#00B896",
  orange: "#FF7F00",
};

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

const FEATURES = [
  { icon: "nutrition-outline", label: "AI Food Scan", color: "#00B896" },
  { icon: "fitness-outline", label: "Exercise Tracker", color: "#0077B6" },
  { icon: "heart-outline", label: "Health Score", color: "#EF4444" },
  { icon: "medkit-outline", label: "Medicine Remind", color: "#F59E0B" },
];

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || "";

const discovery = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
};

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { loginWithToken } = useAuth();

  const [phone, setPhone] = useState("");
  const [selectedLang, setSelectedLang] = useState("hi");
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [loginMode, setLoginMode] = useState<"otp" | "pin">("otp");
  const [pin, setPin] = useState("");
  const [pinFocused, setPinFocused] = useState(false);

  // Web: fixed redirect URI (Google requires https://) — Google Console mein yahi add karo
  // Native: deep link scheme
  const redirectUri = useMemo(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      return `${window.location.origin}/aorane-mobile/`;
    }
    return AuthSession.makeRedirectUri({ scheme: "aorane" });
  }, []);

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID,
      redirectUri,
      scopes: ["openid", "profile", "email"],
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
    },
    discovery
  );

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

  // Handle Google OAuth response
  useEffect(() => {
    if (response?.type === "success") {
      handleGoogleSuccess(response.params.code, request?.codeVerifier);
    } else if (response?.type === "error") {
      setGoogleLoading(false);
      Alert.alert("Google Login Failed", response.error?.message || "Google se login nahi ho saka");
    } else if (response?.type === "dismiss") {
      setGoogleLoading(false);
    }
  }, [response]);

  const handleGoogleSuccess = async (code: string, codeVerifier?: string) => {
    try {
      // Exchange code for tokens using Google's token endpoint
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
          ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
        }).toString(),
      });
      const tokenData = await tokenRes.json() as { id_token?: string; access_token?: string; error?: string };

      if (!tokenData.id_token) {
        throw new Error(tokenData.error || "ID token nahi mila");
      }

      // Send id_token to our backend
      const res = await api.googleLogin(tokenData.id_token);
      await loginWithToken(
        res.accessToken,
        res.refreshToken,
        { id: res.user.id, plan: res.user.plan, languageCode: selectedLang },
        res.isNewUser
      );

      if (res.isNewUser) {
        router.replace("/(onboarding)/" as never);
      } else {
        router.replace("/(tabs)/dashboard");
      }
    } catch (err: unknown) {
      Alert.alert("Login Error", err instanceof Error ? err.message : "Google login mein kuch gadbad hui");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!GOOGLE_CLIENT_ID) {
      Alert.alert("Setup Incomplete", "Google login abhi configure nahi hua hai");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setGoogleLoading(true);
    const result = await promptAsync();
    if (!result || result.type === "dismiss") {
      setGoogleLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (phone.length !== 10) { Alert.alert("Invalid Number", "10-digit mobile number daalo"); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    try {
      await api.sendOtp(phone);
      router.push({ pathname: "/(auth)/verify-otp", params: { phone, lang: selectedLang } });
    } catch (err: unknown) {
      Alert.alert("Error", err instanceof Error ? err.message : "OTP bhejne mein error");
    } finally { setIsLoading(false); }
  };

  const handleWhatsappOtp = async () => {
    if (phone.length !== 10) { Alert.alert("Invalid Number", "10-digit mobile number daalo"); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    try {
      const res = await api.sendWhatsappOtp(phone);
      const channelMsg = res.channel === "whatsapp"
        ? "OTP aapke WhatsApp pe bheja gaya ✅"
        : "OTP SMS pe bheja gaya (WhatsApp unavailable)";
      Alert.alert("OTP Bheja!", channelMsg, [{ text: "OK" }]);
      router.push({ pathname: "/(auth)/verify-otp", params: { phone, lang: selectedLang } });
    } catch (err: unknown) {
      Alert.alert("Error", err instanceof Error ? err.message : "WhatsApp OTP bhejne mein error");
    } finally { setIsLoading(false); }
  };

  const handlePinLogin = async () => {
    if (phone.length !== 10) { Alert.alert("Phone Chahiye", "10-digit phone number daalo"); return; }
    if (pin.length < 4) { Alert.alert("PIN Chahiye", "4-6 digit PIN daalo"); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    try {
      const result = await api.loginWithPIN(phone, pin);
      const userData = result.user as { id: string; phone?: string; plan: string };
      await loginWithToken(result.accessToken, result.refreshToken, { id: userData.id, phone: userData.phone || phone, plan: userData.plan || "free", languageCode: selectedLang }, false);
      router.replace("/(tabs)/" as never);
    } catch (err: unknown) {
      Alert.alert("Login Failed", err instanceof Error ? err.message : "Galat phone ya PIN");
    } finally { setIsLoading(false); }
  };

  const isActive = phone.length === 10;

  return (
    <View style={s.root}>
      <LinearGradient colors={["#E8F7FB", "#F0FAF6", "#FFFFFF"]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />

      {/* Decorative blobs */}
      <View style={[s.blob1]} />
      <View style={[s.blob2]} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 28 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── HERO ── */}
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <View style={s.heroSection}>
              <Animated.View style={[s.logoRing, { transform: [{ scale: pulseAnim }] }]}>
                <LinearGradient colors={C.gradient} style={s.logoRingInner}>
                  <Image
                    source={require("../../assets/images/aorane-logo.png")}
                    style={s.logo}
                    resizeMode="contain"
                  />
                </LinearGradient>
              </Animated.View>

              <View style={s.taglineRow}>
                <View style={s.taglineDot} />
                <Text style={s.tagline}>Aapki health, aapke haath mein 🇮🇳</Text>
              </View>

              {/* Feature chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.featRow}>
                {FEATURES.map(f => (
                  <View key={f.label} style={s.featChip}>
                    <Ionicons name={f.icon as keyof typeof Ionicons.glyphMap} size={13} color={f.color} />
                    <Text style={[s.featLabel, { color: f.color }]}>{f.label}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          </Animated.View>

          {/* ── LANGUAGE PICKER ── */}
          <Animated.View style={{ opacity: fadeAnim }}>
            <Text style={s.langHeading}>APNI BHASHA CHUNEIN</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {LANGUAGES.map(l => (
                <TouchableOpacity
                  key={l.code}
                  onPress={() => { Haptics.selectionAsync(); setSelectedLang(l.code); }}
                  activeOpacity={0.7}
                >
                  {selectedLang === l.code ? (
                    <LinearGradient colors={C.gradient} style={s.langActive}>
                      <Text style={[s.langText, { color: "#FFF" }]}>{l.label}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={s.langInactive}>
                      <Text style={[s.langText, { color: C.muted }]}>{l.label}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>

          {/* ── LOGIN CARD ── */}
          <Animated.View style={[s.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            {/* Card Header */}
            <View style={s.cardTop}>
              <LinearGradient colors={C.gradient} style={s.cardIcon}>
                <Ionicons name={loginMode === "pin" ? "keypad-outline" : "phone-portrait-outline"} size={18} color="#FFF" />
              </LinearGradient>
              <View>
                <Text style={s.cardTitle}>Login Karo</Text>
                <Text style={s.cardSub}>{loginMode === "pin" ? "PIN se quick login" : "OTP aapke number pe aayega"}</Text>
              </View>
            </View>

            {/* OTP / PIN Toggle */}
            <View style={s.toggle}>
              {(["otp", "pin"] as const).map(mode => (
                <TouchableOpacity
                  key={mode}
                  onPress={() => { setLoginMode(mode); Haptics.selectionAsync(); }}
                  style={[s.toggleBtn, loginMode === mode && s.toggleBtnActive]}
                >
                  <Text style={[s.toggleText, loginMode === mode && s.toggleTextActive]}>
                    {mode === "otp" ? "📱 OTP" : "🔐 PIN"}
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
                placeholder="10-digit mobile number"
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
                  <Text style={{ fontSize: 16 }}>🔐</Text>
                </View>
                <TextInput
                  style={s.input}
                  placeholder="4-6 digit PIN"
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

            {/* CTA Button */}
            <TouchableOpacity
              onPress={loginMode === "pin" ? handlePinLogin : handleSendOtp}
              disabled={isLoading || !isActive || (loginMode === "pin" && pin.length < 4)}
              activeOpacity={0.85}
              style={{ marginTop: 8 }}
            >
              {(isActive && (loginMode === "otp" || pin.length >= 4)) ? (
                <LinearGradient
                  colors={loginMode === "pin" ? ["#7C3AED", "#0077B6"] : C.gradientBtn}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={s.ctaBtn}
                >
                  {isLoading ? <ActivityIndicator color="#FFF" /> : (
                    <>
                      <Text style={s.ctaText}>{loginMode === "pin" ? "PIN se Login" : "OTP Bhejein"}</Text>
                      <View style={s.ctaArrow}>
                        <Ionicons name="arrow-forward" size={16} color={loginMode === "pin" ? "#7C3AED" : C.primary} />
                      </View>
                    </>
                  )}
                </LinearGradient>
              ) : (
                <View style={s.ctaBtnDisabled}>
                  <Text style={s.ctaTextDisabled}>{loginMode === "pin" ? "PIN se Login" : "OTP Bhejein"}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* WhatsApp OTP button — only for OTP mode */}
            {loginMode === "otp" && (
              <TouchableOpacity
                onPress={handleWhatsappOtp}
                disabled={isLoading || !isActive}
                activeOpacity={0.82}
                style={[s.waBtn, (!isActive || isLoading) && s.waBtnDisabled]}
              >
                {isLoading ? (
                  <ActivityIndicator color="#25D366" size="small" />
                ) : (
                  <>
                    <View style={s.waIconWrap}>
                      <Text style={{ fontSize: 16 }}>💬</Text>
                    </View>
                    <Text style={[s.waBtnText, (!isActive) && { color: "#A0B4BF" }]}>WhatsApp pe OTP Mangaayein</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {loginMode === "pin" && (
              <Text style={s.pinHint}>PIN set karne ke liye OTP se login karein → Profile → Set PIN</Text>
            )}

            {/* Divider */}
            <View style={s.divRow}>
              <View style={s.divLine} />
              <Text style={s.divText}>ya</Text>
              <View style={s.divLine} />
            </View>

            {/* Google Sign-In Button */}
            <TouchableOpacity
              onPress={handleGoogleLogin}
              disabled={googleLoading || !request}
              activeOpacity={0.82}
              style={s.googleBtn}
            >
              {googleLoading ? (
                <ActivityIndicator color="#4285F4" size="small" />
              ) : (
                <>
                  <View style={s.googleIconWrap}>
                    <Text style={s.googleIconText}>G</Text>
                  </View>
                  <Text style={s.googleBtnText}>Google se Continue Karein</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Other social buttons (coming soon) */}
            <View style={s.socialRow}>
              {[
                { label: "Facebook", icon: "f", bg: "#EEF4FF", border: "#DBEAFE", iconBg: "#1877F2", iconColor: "#FFF", textColor: "#1877F2" },
                { label: "X (Twitter)", icon: "✕", bg: "#F8F8F8", border: "#E5E7EB", iconBg: "#000", iconColor: "#FFF", textColor: "#1A1A1A" },
              ].map(btn => (
                <TouchableOpacity
                  key={btn.label}
                  onPress={() => Alert.alert("Jald Aayega", `${btn.label} login jald aayega!`)}
                  style={[s.socialBtn, { backgroundColor: btn.bg, borderColor: btn.border }]}
                  activeOpacity={0.75}
                >
                  <View style={[s.socialIcon, { backgroundColor: btn.iconBg }]}>
                    <Text style={{ color: btn.iconColor, fontWeight: "bold", fontSize: 11 }}>{btn.icon}</Text>
                  </View>
                  <Text style={[s.socialLabel, { color: btn.textColor }]}>{btn.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>

          {/* Trust Badges */}
          <Animated.View style={[s.badgeRow, { opacity: fadeAnim }]}>
            {[
              { icon: "lock-closed-outline", text: "256-bit Encrypted", color: C.primary },
              { icon: "shield-checkmark-outline", text: "DPDP Compliant", color: C.accent },
              { icon: "heart-outline", text: "Made in India", color: "#EF4444" },
            ].map(b => (
              <View key={b.text} style={s.badge}>
                <Ionicons name={b.icon as keyof typeof Ionicons.glyphMap} size={11} color={b.color} />
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
  logoRing: { width: 110, height: 110, borderRadius: 55, padding: 3, marginBottom: 14, shadowColor: "#0077B6", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 10 },
  logoRingInner: { flex: 1, borderRadius: 52, alignItems: "center", justifyContent: "center" },
  logo: { width: 80, height: 80 },
  taglineRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  taglineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#00B896" },
  tagline: { fontSize: 13.5, color: "#3D6070", fontFamily: "Inter_500Medium" },
  featRow: { gap: 8, paddingVertical: 2 },
  featChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2EFF5", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  featLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },

  langHeading: { fontSize: 10, letterSpacing: 1.5, color: "#7A90A4", fontFamily: "Inter_500Medium", marginBottom: 10 },
  langActive: { paddingHorizontal: 15, paddingVertical: 9, borderRadius: 22 },
  langInactive: { paddingHorizontal: 15, paddingVertical: 9, borderRadius: 22, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2EFF5" },
  langText: { fontSize: 14, fontFamily: "Inter_500Medium" },

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

  divRow: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 16 },
  divLine: { flex: 1, height: 1, backgroundColor: "#EDF2F7" },
  divText: { fontSize: 13, color: "#A0B4BF", fontFamily: "Inter_400Regular" },

  waBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, height: 48, borderRadius: 14, backgroundColor: "#F0FFF4", borderWidth: 1.5, borderColor: "#25D366", marginTop: 10 },
  waBtnDisabled: { borderColor: "#D1FAE5", backgroundColor: "#F8FFF9" },
  waIconWrap: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#25D366", alignItems: "center", justifyContent: "center" },
  waBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#128C7E" },

  googleBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, height: 52, borderRadius: 14, backgroundColor: "#FFF", borderWidth: 1.5, borderColor: "#E5E7EB", marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 },
  googleIconWrap: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#4285F4", alignItems: "center", justifyContent: "center" },
  googleIconText: { color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 16 },
  googleBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#1A1A1A" },

  socialRow: { flexDirection: "row", gap: 10 },
  socialBtn: { flex: 1, flexDirection: "column", alignItems: "center", gap: 6, paddingVertical: 12, borderRadius: 14, borderWidth: 1 },
  socialIcon: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  socialLabel: { fontSize: 11.5, fontFamily: "Inter_500Medium" },

  badgeRow: { flexDirection: "row", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 10 },
  badge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E8F2F7" },
  badgeText: { fontSize: 10.5, color: "#7A90A4", fontFamily: "Inter_400Regular" },
});
