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
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -22] });
  const opacity = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.35, 0.65, 0.35] });
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
      Animated.timing(cardAnim, { toValue: 1, duration: 600, delay: 250, useNativeDriver: false }),
    ]).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 3000, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 3000, useNativeDriver: false }),
      ])
    ).start();
  }, []);

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.65] });
  const glowScale = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });

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

  const glassCardBg = isDark ? "rgba(12,20,44,0.55)" : "rgba(255,255,255,0.55)";
  const glassBorder = isDark ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.85)";
  const glassInputBg = isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.6)";

  return (
    <View style={styles.root}>
      {/* Deep vivid gradient background */}
      <LinearGradient
        colors={isDark
          ? ["#010814", "#031628", "#051E30", "#061A2A"]
          : ["#C8E9FA", "#D9F4EE", "#E8F4FF", "#D4F0F7"]}
        locations={[0, 0.3, 0.65, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Large vivid orbs — more opaque for glassmorph depth */}
      <FloatingOrb size={420} color={isDark ? "#0055A3" : "#7DD3FC"} top={-180} right={-140} delay={0} />
      <FloatingOrb size={360} color={isDark ? "#044A38" : "#6EE7B7"} bottom={40} left={-130} delay={2500} />
      <FloatingOrb size={240} color={isDark ? "#1E3A5F" : "#BAE6FD"} top={H * 0.38} right={-80} delay={1200} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 28 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── LOGO HERO ── */}
          <Animated.View style={[styles.logoHero, {
            opacity: logoAnim,
            transform: [{ scale: logoAnim.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) }],
          }]}>
            <Animated.View style={[styles.glowBehind, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}>
              <LinearGradient
                colors={["rgba(0,119,182,0.7)", "rgba(27,153,139,0.45)", "transparent"]}
                style={styles.glowCircle}
              />
            </Animated.View>
            <Image
              source={require("../../assets/images/aorane-logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            {/* Glass tagline pill */}
            <View style={[styles.taglinePill, {
              backgroundColor: isDark ? "rgba(56,189,248,0.12)" : "rgba(255,255,255,0.55)",
              borderColor: isDark ? "rgba(56,189,248,0.28)" : "rgba(255,255,255,0.9)",
              shadowColor: isDark ? "#38BDF8" : "#0077B6",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 4,
            }]}>
              {Platform.OS === "ios" && <BlurView intensity={30} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />}
              <View style={[styles.taglineDot, { backgroundColor: isDark ? "#38BDF8" : "#0077B6" }]} />
              <Text style={[styles.taglineText, { color: isDark ? "rgba(255,255,255,0.82)" : "rgba(10,22,40,0.72)", fontFamily: "Inter_500Medium" }]}>
                Aapki health, aapke haath mein 🇮🇳
              </Text>
            </View>
          </Animated.View>

          {/* ── LANGUAGE PILLS — glass chips ── */}
          <View style={styles.langSection}>
            <Text style={[styles.langLabel, { color: isDark ? "rgba(255,255,255,0.32)" : "rgba(10,22,40,0.4)", fontFamily: "Inter_500Medium" }]}>
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
                    <View style={[styles.langChip, {
                      backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.6)",
                      borderColor: isDark ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.95)",
                    }]}>
                      {Platform.OS === "ios" && <BlurView intensity={20} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />}
                      <Text style={[styles.langChipText, { color: isDark ? "rgba(255,255,255,0.6)" : "rgba(10,22,40,0.62)", fontFamily: "Inter_500Medium" }]}>{l.label}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* ── MAIN GLASS CARD ── */}
          <Animated.View style={[styles.cardWrap, { opacity: cardAnim }]}>
            {/* Outer glowing border */}
            <LinearGradient
              colors={isDark
                ? ["rgba(56,189,248,0.35)", "rgba(45,212,191,0.22)", "rgba(255,255,255,0.06)"]
                : ["rgba(255,255,255,0.95)", "rgba(186,230,253,0.6)", "rgba(167,243,208,0.45)"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.cardBorder}
            >
              <View style={[styles.cardInner, { backgroundColor: glassCardBg }]}>
                {/* Blur layer */}
                {Platform.OS === "ios"
                  ? <BlurView intensity={isDark ? 85 : 65} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
                  : <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? "rgba(8,16,36,0.42)" : "rgba(255,255,255,0.42)" }]} />
                }

                {/* Inner top glow line */}
                <LinearGradient
                  colors={isDark
                    ? ["rgba(56,189,248,0.18)", "transparent"]
                    : ["rgba(255,255,255,0.9)", "transparent"]}
                  style={styles.innerTopGlow}
                />

                <View style={styles.cardHeader}>
                  <LinearGradient colors={["#0077B6", "#1B998B"]} style={styles.cardIconBox}>
                    <Ionicons name="phone-portrait-outline" size={20} color="#FFF" />
                  </LinearGradient>
                  <View>
                    <Text style={[styles.cardTitle, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>Mobile se Login</Text>
                    <Text style={[styles.cardSub, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular" }]}>OTP aapke number pe aayega</Text>
                  </View>
                </View>

                {/* Glass Phone Input */}
                <View style={[styles.phoneRow, {
                  backgroundColor: glassInputBg,
                  borderColor: isFocused ? "#0EA5E9" : (isDark ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.9)"),
                  borderWidth: isFocused ? 2 : 1.5,
                  shadowColor: isFocused ? "#0077B6" : "transparent",
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 1,
                  shadowRadius: 10,
                  elevation: isFocused ? 6 : 0,
                }]}>
                  <View style={[styles.ccBox, { borderRightColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,119,182,0.18)" }]}>
                    <Text style={{ fontSize: 17 }}>🇮🇳</Text>
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
                    <View style={[styles.otpBtn, {
                      backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.5)",
                      borderWidth: 1,
                      borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.8)",
                    }]}>
                      <Text style={[styles.otpText, { color: isDark ? "rgba(255,255,255,0.22)" : "rgba(10,22,40,0.22)", fontFamily: "Inter_700Bold" }]}>OTP Bhejein</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Divider */}
                <View style={styles.divRow}>
                  <View style={[styles.divLine, { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)" }]} />
                  <Text style={[styles.divText, { color: isDark ? "rgba(255,255,255,0.28)" : "rgba(10,22,40,0.35)", fontFamily: "Inter_400Regular" }]}>ya</Text>
                  <View style={[styles.divLine, { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)" }]} />
                </View>

                {/* Glass Social Row */}
                <View style={styles.socialRow}>
                  {/* Google */}
                  <TouchableOpacity
                    onPress={() => Alert.alert("Coming Soon", "Google login jald aayega!")}
                    style={[styles.socialBtn, {
                      backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.65)",
                      borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.95)",
                    }]}
                    activeOpacity={0.8}
                  >
                    {Platform.OS === "ios" && <BlurView intensity={25} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />}
                    <View style={[styles.socialIconBox, { backgroundColor: "#FFF" }]}>
                      <Text style={[styles.socialBtnG, { color: "#4285F4", fontSize: 13 }]}>G</Text>
                    </View>
                    <Text style={[styles.socialLabel, { color: isDark ? "rgba(255,255,255,0.78)" : "#1A1A1A", fontFamily: "Inter_500Medium" }]}>Google</Text>
                  </TouchableOpacity>

                  {/* Facebook */}
                  <TouchableOpacity
                    onPress={() => Alert.alert("Coming Soon", "Facebook login jald aayega!")}
                    style={[styles.socialBtn, {
                      backgroundColor: isDark ? "rgba(24,119,242,0.14)" : "rgba(238,244,255,0.8)",
                      borderColor: isDark ? "rgba(24,119,242,0.3)" : "rgba(255,255,255,0.95)",
                    }]}
                    activeOpacity={0.8}
                  >
                    {Platform.OS === "ios" && <BlurView intensity={25} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />}
                    <View style={[styles.socialIconBox, { backgroundColor: "#1877F2" }]}>
                      <Text style={[styles.socialBtnG, { color: "#FFF", fontSize: 12 }]}>f</Text>
                    </View>
                    <Text style={[styles.socialLabel, { color: isDark ? "rgba(255,255,255,0.78)" : "#1877F2", fontFamily: "Inter_500Medium" }]}>Facebook</Text>
                  </TouchableOpacity>

                  {/* X */}
                  <TouchableOpacity
                    onPress={() => Alert.alert("Coming Soon", "X login jald aayega!")}
                    style={[styles.socialBtn, {
                      backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(248,248,248,0.75)",
                      borderColor: isDark ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.95)",
                    }]}
                    activeOpacity={0.8}
                  >
                    {Platform.OS === "ios" && <BlurView intensity={25} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />}
                    <View style={[styles.socialIconBox, { backgroundColor: isDark ? "#FFF" : "#000" }]}>
                      <Text style={[styles.socialBtnG, { color: isDark ? "#000" : "#FFF", fontSize: 10, fontWeight: "900" }]}>✕</Text>
                    </View>
                    <Text style={[styles.socialLabel, { color: isDark ? "rgba(255,255,255,0.78)" : "#1A1A1A", fontFamily: "Inter_500Medium" }]}>X</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* Glass Trust Badges */}
          <View style={styles.badgeRow}>
            {[
              { icon: "lock-closed", text: "Encrypted", color: "#0077B6" },
              { icon: "shield-checkmark", text: "DPDP Act", color: "#1B998B" },
              { icon: "heart", text: "Made in India", color: "#EF4444" },
            ].map((b) => (
              <View key={b.text} style={[styles.badge, {
                backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.65)",
                borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.9)",
                shadowColor: b.color,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
                elevation: 2,
              }]}>
                <Ionicons name={b.icon as keyof typeof Ionicons.glyphMap} size={11} color={b.color} />
                <Text style={[styles.badgeText, { color: isDark ? "rgba(255,255,255,0.5)" : "rgba(10,22,40,0.55)", fontFamily: "Inter_400Regular" }]}>{b.text}</Text>
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
  scroll: { paddingHorizontal: 18 },

  logoHero: { alignItems: "center", marginBottom: 10, paddingTop: 0 },
  glowBehind: { position: "absolute", top: -60, alignSelf: "center" },
  glowCircle: { width: W * 1.1, height: 420, borderRadius: 210 },
  logo: { width: W - 8, height: 260, marginBottom: -45 },
  taglinePill: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 24, borderWidth: 1, overflow: "hidden" },
  taglineDot: { width: 7, height: 7, borderRadius: 3.5 },
  taglineText: { fontSize: 13.5 },

  langSection: { marginBottom: 10 },
  langLabel: { fontSize: 10.5, letterSpacing: 1.4, marginBottom: 10 },
  langChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 22, borderWidth: 1, overflow: "hidden" },
  langChipActive: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 22 },
  langChipText: { fontSize: 14 },

  cardWrap: { marginBottom: 14 },
  cardBorder: { borderRadius: 28, padding: 1.5 },
  cardInner: { borderRadius: 27, overflow: "hidden", padding: 20 },
  innerTopGlow: { position: "absolute", top: 0, left: 0, right: 0, height: 60 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 13, marginBottom: 18 },
  cardIconBox: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 20, marginBottom: 2 },
  cardSub: { fontSize: 13 },

  phoneRow: { flexDirection: "row", alignItems: "center", borderRadius: 16, height: 58, marginBottom: 12, overflow: "hidden" },
  ccBox: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 13, height: "100%", borderRightWidth: 1 },
  ccText: { fontSize: 15 },
  phoneInput: { flex: 1, paddingHorizontal: 13, fontSize: 17, height: "100%" },
  checkBadge: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", marginRight: 12 },

  otpBtn: { height: 54, borderRadius: 15, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 },
  otpText: { color: "#FFF", fontSize: 17 },
  arrowCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.9)", alignItems: "center", justifyContent: "center" },

  divRow: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 14 },
  divLine: { flex: 1, height: 1 },
  divText: { fontSize: 13 },

  socialRow: { flexDirection: "row", gap: 10 },
  socialBtn: { flex: 1, flexDirection: "column", alignItems: "center", gap: 7, paddingVertical: 13, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  socialIconBox: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 },
  socialBtnG: { fontWeight: "bold" },
  socialLabel: { fontSize: 12 },

  badgeRow: { flexDirection: "row", gap: 8, justifyContent: "center" },
  badge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  badgeText: { fontSize: 11 },
});
