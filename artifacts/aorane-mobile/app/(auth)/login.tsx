import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
  Alert, Image, Animated, useColorScheme, Dimensions,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const { width: W, height: H } = Dimensions.get("window");

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

function FloatingOrb({ size, color, top, left, right, bottom, delay }: {
  size: number; color: string; top?: number; left?: number; right?: number; bottom?: number; delay: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 5000, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 5000, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -18] });
  const opacity = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.15, 0.4, 0.15] });
  return (
    <Animated.View style={{
      position: "absolute", top, left, right, bottom,
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color, transform: [{ translateY }], opacity,
    }} />
  );
}

export default function LoginScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const insets = useSafeAreaInsets();
  const { loginWithToken } = useAuth();

  const [phone, setPhone] = useState("");
  const [selectedLang, setSelectedLang] = useState("hi");
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const logoAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoAnim, { toValue: 1, friction: 7, tension: 50, useNativeDriver: true }),
      Animated.timing(cardAnim, { toValue: 1, duration: 600, delay: 300, useNativeDriver: false }),
    ]).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2500, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2500, useNativeDriver: false }),
      ])
    ).start();
  }, []);

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.55] });
  const glowScale = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });

  const handleSendOtp = async () => {
    if (phone.length !== 10) { Alert.alert("Invalid Number", "Please enter a valid 10-digit mobile number"); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    try {
      await api.sendOtp(phone);
      router.push({ pathname: "/(auth)/verify-otp", params: { phone, lang: selectedLang } });
    } catch (err: unknown) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to send OTP");
    } finally { setIsLoading(false); }
  };

  const isActive = phone.length === 10;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={isDark ? ["#010610", "#03101E", "#041420", "#031520"] : ["#E0F2FE", "#EFF9FF", "#ECFDF5", "#F0FDF4"]}
        locations={[0, 0.3, 0.65, 1]}
        style={StyleSheet.absoluteFill}
      />

      <FloatingOrb size={400} color={isDark ? "#0369A1" : "#BAE6FD"} top={-160} right={-140} delay={0} />
      <FloatingOrb size={320} color={isDark ? "#065F46" : "#A7F3D0"} bottom={60} left={-110} delay={2500} />
      <FloatingOrb size={200} color={isDark ? "#0C4A6E" : "#7DD3FC"} top={H * 0.4} right={-70} delay={1200} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 28 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── LOGO HERO ── */}
          <Animated.View style={[styles.logoHero, {
            opacity: logoAnim,
            transform: [{ scale: logoAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
                        { translateY: logoAnim.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }) }],
          }]}>
            {/* Pulsing glow behind logo */}
            <Animated.View style={[styles.glowBehind, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}>
              <LinearGradient
                colors={["rgba(0,119,182,0.6)", "rgba(27,153,139,0.4)", "transparent"]}
                style={styles.glowCircle}
              />
            </Animated.View>

            {/* BIG LOGO — 5× */}
            <Image
              source={require("../../assets/images/aorane-logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />

            {/* Tagline */}
            <View style={[styles.taglinePill, {
              backgroundColor: isDark ? "rgba(56,189,248,0.1)" : "rgba(0,119,182,0.08)",
              borderColor: isDark ? "rgba(56,189,248,0.22)" : "rgba(0,119,182,0.18)",
            }]}>
              <View style={[styles.taglineDot, { backgroundColor: isDark ? "#38BDF8" : "#0077B6" }]} />
              <Text style={[styles.taglineText, { color: isDark ? "rgba(255,255,255,0.7)" : "rgba(10,22,40,0.65)", fontFamily: "Inter_500Medium" }]}>
                Aapki health, aapke haath mein 🇮🇳
              </Text>
            </View>
          </Animated.View>

          {/* ── LANGUAGE PILLS ── */}
          <View style={styles.langSection}>
            <Text style={[styles.langLabel, { color: isDark ? "rgba(255,255,255,0.3)" : "rgba(10,22,40,0.38)", fontFamily: "Inter_500Medium" }]}>
              APNI BHASHA CHUNEIN
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
              {LANGUAGES.map((l) => (
                <TouchableOpacity key={l.code} onPress={() => { Haptics.selectionAsync(); setSelectedLang(l.code); }} activeOpacity={0.75}>
                  {selectedLang === l.code ? (
                    <LinearGradient colors={["#0077B6", "#0EA5E9", "#1B998B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.langChipActive}>
                      <Text style={[styles.langChipText, { color: "#FFF", fontFamily: "Inter_600SemiBold" }]}>{l.label}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={[styles.langChip, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.75)", borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,119,182,0.15)" }]}>
                      <Text style={[styles.langChipText, { color: isDark ? "rgba(255,255,255,0.55)" : "rgba(10,22,40,0.6)", fontFamily: "Inter_500Medium" }]}>{l.label}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* ── MAIN LOGIN CARD ── */}
          <Animated.View style={[styles.cardWrap, {
            opacity: cardAnim,
            transform: [{ translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
          }]}>
            <LinearGradient
              colors={isDark ? ["rgba(56,189,248,0.22)", "rgba(45,212,191,0.14)", "rgba(255,255,255,0.04)"] : ["rgba(0,119,182,0.22)", "rgba(27,153,139,0.18)", "rgba(255,255,255,0.6)"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.cardBorder}
            >
              <View style={[styles.cardInner, { backgroundColor: isDark ? "rgba(3,12,28,0.88)" : "rgba(255,255,255,0.92)" }]}>
                {Platform.OS === "ios" && <BlurView intensity={isDark ? 70 : 50} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />}

                <View style={styles.cardHeader}>
                  <LinearGradient colors={["#0077B6", "#1B998B"]} style={styles.cardIconBox}>
                    <Ionicons name="phone-portrait-outline" size={20} color="#FFF" />
                  </LinearGradient>
                  <View>
                    <Text style={[styles.cardTitle, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>Mobile se Login</Text>
                    <Text style={[styles.cardSub, { color: isDark ? "rgba(255,255,255,0.38)" : "rgba(10,22,40,0.42)", fontFamily: "Inter_400Regular" }]}>OTP aapke number pe aayega</Text>
                  </View>
                </View>

                {/* Phone Input */}
                <View style={[styles.phoneRow, {
                  backgroundColor: isDark ? "rgba(56,189,248,0.05)" : "rgba(0,119,182,0.04)",
                  borderColor: isFocused ? "#0077B6" : (isDark ? "rgba(255,255,255,0.1)" : "rgba(0,119,182,0.2)"),
                  borderWidth: isFocused ? 2 : 1.5,
                }]}>
                  <View style={[styles.ccBox, { borderRightColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,119,182,0.15)" }]}>
                    <Text style={{ fontSize: 18 }}>🇮🇳</Text>
                    <Text style={[styles.ccText, { color: isDark ? "#38BDF8" : "#0077B6", fontFamily: "Inter_700Bold" }]}>+91</Text>
                  </View>
                  <TextInput
                    style={[styles.phoneInput, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_500Medium" }]}
                    placeholder="10-digit mobile number"
                    placeholderTextColor={isDark ? "rgba(255,255,255,0.22)" : "rgba(10,22,40,0.28)"}
                    keyboardType="numeric"
                    maxLength={10}
                    value={phone}
                    onChangeText={setPhone}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    autoFocus
                  />
                  {isActive && (
                    <LinearGradient colors={["#0077B6", "#1B998B"]} style={styles.checkBadge}>
                      <Ionicons name="checkmark" size={14} color="#FFF" />
                    </LinearGradient>
                  )}
                </View>

                {/* OTP Button */}
                <TouchableOpacity onPress={handleSendOtp} disabled={isLoading || !isActive} activeOpacity={0.85} style={{ marginTop: 6 }}>
                  {isActive ? (
                    <LinearGradient colors={["#0077B6", "#0EA5E9", "#1B998B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.otpBtn}>
                      {isLoading ? <ActivityIndicator color="#FFF" /> : (
                        <>
                          <Text style={[styles.otpText, { fontFamily: "Inter_700Bold" }]}>OTP Bhejein</Text>
                          <View style={styles.arrowCircle}>
                            <Ionicons name="arrow-forward" size={18} color="#0077B6" />
                          </View>
                        </>
                      )}
                    </LinearGradient>
                  ) : (
                    <View style={[styles.otpBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }]}>
                      <Text style={[styles.otpText, { color: isDark ? "rgba(255,255,255,0.22)" : "rgba(10,22,40,0.22)", fontFamily: "Inter_700Bold" }]}>OTP Bhejein</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Divider */}
                <View style={styles.divRow}>
                  <View style={[styles.divLine, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)" }]} />
                  <Text style={[styles.divText, { color: isDark ? "rgba(255,255,255,0.28)" : "rgba(10,22,40,0.32)", fontFamily: "Inter_400Regular" }]}>ya</Text>
                  <View style={[styles.divLine, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)" }]} />
                </View>

                {/* Social Login Row */}
                <View style={styles.socialRow}>
                  {/* Google */}
                  <TouchableOpacity
                    onPress={() => Alert.alert("Coming Soon", "Google login jald aayega!")}
                    style={[styles.socialBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#FFF", borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.09)" }]}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.socialIconBox, { backgroundColor: "#FFF", shadowColor: "#4285F4" }]}>
                      <Text style={[styles.socialBtnG, { color: "#4285F4" }]}>G</Text>
                    </View>
                    <Text style={[styles.socialLabel, { color: isDark ? "rgba(255,255,255,0.75)" : "#1A1A1A", fontFamily: "Inter_500Medium" }]}>Google</Text>
                  </TouchableOpacity>

                  {/* Facebook */}
                  <TouchableOpacity
                    onPress={() => Alert.alert("Coming Soon", "Facebook login jald aayega!")}
                    style={[styles.socialBtn, { backgroundColor: isDark ? "rgba(24,119,242,0.12)" : "#EEF4FF", borderColor: isDark ? "rgba(24,119,242,0.25)" : "rgba(24,119,242,0.2)" }]}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.socialIconBox, { backgroundColor: "#1877F2" }]}>
                      <Text style={[styles.socialBtnG, { color: "#FFF", fontSize: 16 }]}>f</Text>
                    </View>
                    <Text style={[styles.socialLabel, { color: isDark ? "rgba(255,255,255,0.75)" : "#1877F2", fontFamily: "Inter_500Medium" }]}>Facebook</Text>
                  </TouchableOpacity>

                  {/* X (Twitter) */}
                  <TouchableOpacity
                    onPress={() => Alert.alert("Coming Soon", "X login jald aayega!")}
                    style={[styles.socialBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#F8F8F8", borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }]}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.socialIconBox, { backgroundColor: isDark ? "#FFF" : "#000" }]}>
                      <Text style={[styles.socialBtnG, { color: isDark ? "#000" : "#FFF", fontSize: 13, fontWeight: "900" }]}>✕</Text>
                    </View>
                    <Text style={[styles.socialLabel, { color: isDark ? "rgba(255,255,255,0.75)" : "#1A1A1A", fontFamily: "Inter_500Medium" }]}>X</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* ── TRUST BADGES ── */}
          <View style={styles.badgeRow}>
            {[
              { icon: "lock-closed", text: "Encrypted", color: "#0077B6" },
              { icon: "shield-checkmark", text: "DPDP Act", color: "#1B998B" },
              { icon: "heart", text: "Made in India", color: "#EF4444" },
            ].map((b) => (
              <View key={b.text} style={[styles.badge, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.75)", borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,119,182,0.12)" }]}>
                <Ionicons name={b.icon as keyof typeof Ionicons.glyphMap} size={12} color={b.color} />
                <Text style={[styles.badgeText, { color: isDark ? "rgba(255,255,255,0.45)" : "rgba(10,22,40,0.5)", fontFamily: "Inter_400Regular" }]}>{b.text}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20 },

  logoHero: { alignItems: "center", marginBottom: 10, paddingTop: 0 },
  glowBehind: { position: "absolute", top: -60, alignSelf: "center" },
  glowCircle: { width: W * 1.1, height: 420, borderRadius: 210 },
  logo: { width: W - 8, height: 260, marginBottom: -45 },
  taglinePill: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 22, borderWidth: 1 },
  taglineDot: { width: 7, height: 7, borderRadius: 3.5 },
  taglineText: { fontSize: 13.5 },

  langSection: { marginBottom: 10 },
  langLabel: { fontSize: 10.5, letterSpacing: 1.4, marginBottom: 10 },
  langChip: { paddingHorizontal: 15, paddingVertical: 9, borderRadius: 22, borderWidth: 1 },
  langChipActive: { paddingHorizontal: 15, paddingVertical: 9, borderRadius: 22 },
  langChipText: { fontSize: 14 },

  cardWrap: { marginBottom: 18 },
  cardBorder: { borderRadius: 28, padding: 1.5 },
  cardInner: { borderRadius: 27, overflow: "hidden", padding: 22 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 20 },
  cardIconBox: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 20, marginBottom: 2 },
  cardSub: { fontSize: 13 },

  phoneRow: { flexDirection: "row", alignItems: "center", borderRadius: 16, height: 60, marginBottom: 14, overflow: "hidden" },
  ccBox: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, height: "100%", borderRightWidth: 1 },
  ccText: { fontSize: 16 },
  phoneInput: { flex: 1, paddingHorizontal: 14, fontSize: 17, height: "100%" },
  checkBadge: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", marginRight: 14 },

  otpBtn: { height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 },
  otpText: { color: "#FFF", fontSize: 17 },
  arrowCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.9)", alignItems: "center", justifyContent: "center" },

  divRow: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 14 },
  divLine: { flex: 1, height: 1 },
  divText: { fontSize: 13 },

  socialRow: { flexDirection: "row", gap: 10 },
  socialBtn: { flex: 1, flexDirection: "column", alignItems: "center", gap: 7, paddingVertical: 14, borderRadius: 16, borderWidth: 1 },
  socialIconBox: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 3 },
  socialBtnG: { fontSize: 17, fontWeight: "bold" },
  socialLabel: { fontSize: 12 },

  badgeRow: { flexDirection: "row", gap: 8, justifyContent: "center" },
  badge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 12, borderWidth: 1 },
  badgeText: { fontSize: 11 },
});
