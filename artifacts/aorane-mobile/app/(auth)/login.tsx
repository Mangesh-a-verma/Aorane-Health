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
  { code: "hi", label: "हिंदी", flag: "🇮🇳" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "bn", label: "বাংলা", flag: "🟢" },
  { code: "mr", label: "मराठी", flag: "🟠" },
  { code: "te", label: "తెలుగు", flag: "🔵" },
  { code: "ta", label: "தமிழ்", flag: "🔴" },
  { code: "gu", label: "ગુજરાતી", flag: "🟡" },
  { code: "kn", label: "ಕನ್ನಡ", flag: "🟤" },
  { code: "ml", label: "മലയാളം", flag: "🟣" },
  { code: "pa", label: "ਪੰਜਾਬੀ", flag: "🟢" },
];

function AnimatedOrb({ size, color, top, left, right, bottom, delay }: { size: number; color: string; top?: number; left?: number; right?: number; bottom?: number; delay: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 4000, useNativeDriver: false }),
        Animated.timing(anim, { toValue: 0, duration: 4000, useNativeDriver: false }),
      ])
    ).start();
  }, []);
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] });
  const opacity = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.2, 0.45, 0.2] });
  return (
    <Animated.View style={{ position: "absolute", top, left, right, bottom, width: size, height: size, borderRadius: size / 2, backgroundColor: color, transform: [{ scale }], opacity }} />
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

  const focusAnim = useRef(new Animated.Value(0)).current;
  const logoAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(logoAnim, { toValue: 1, friction: 8, tension: 60, useNativeDriver: true }).start();
  }, []);

  const handleFocus = (focused: boolean) => {
    setIsFocused(focused);
    Animated.timing(focusAnim, { toValue: focused ? 1 : 0, duration: 250, useNativeDriver: false }).start();
  };

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [isDark ? "rgba(255,255,255,0.12)" : "rgba(0,119,182,0.2)", "#0077B6"],
  });

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
      {/* Deep gradient bg */}
      <LinearGradient
        colors={isDark ? ["#020912", "#041428", "#040F22", "#031820"] : ["#E8F4FD", "#F0FBF7", "#EBF8FF", "#F0FDF4"]}
        locations={[0, 0.35, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Animated orbs */}
      <AnimatedOrb size={320} color={isDark ? "#0369A1" : "#BAE6FD"} top={-120} right={-100} delay={0} />
      <AnimatedOrb size={260} color={isDark ? "#065F46" : "#A7F3D0"} bottom={80} left={-90} delay={2000} />
      <AnimatedOrb size={180} color={isDark ? "#0C4A6E" : "#7DD3FC"} top={H * 0.35} right={-60} delay={1000} />

      {/* Mesh grid overlay */}
      <View style={styles.meshOverlay} pointerEvents="none">
        {Array.from({ length: 8 }).map((_, i) => (
          <View key={i} style={[styles.meshLine, { top: (H / 8) * i, opacity: isDark ? 0.04 : 0.06 }]} />
        ))}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo hero */}
          <Animated.View style={[styles.logoHero, { opacity: logoAnim, transform: [{ scale: logoAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }]}>
            {/* Glow ring behind logo */}
            <View style={styles.glowRing}>
              <LinearGradient
                colors={["rgba(0,119,182,0.3)", "rgba(27,153,139,0.25)", "transparent"]}
                style={styles.glowCircle}
              />
            </View>
            <View style={[styles.logoBox, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.8)", borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,119,182,0.18)" }]}>
              <Image
                source={require("../../assets/images/aorane-logo.png")}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <View style={styles.taglineRow}>
              <View style={[styles.taglinePill, { backgroundColor: isDark ? "rgba(56,189,248,0.1)" : "rgba(0,119,182,0.08)", borderColor: isDark ? "rgba(56,189,248,0.2)" : "rgba(0,119,182,0.15)" }]}>
                <View style={[styles.taglineDot, { backgroundColor: isDark ? "#38BDF8" : "#0077B6" }]} />
                <Text style={[styles.taglineText, { color: isDark ? "rgba(255,255,255,0.65)" : "rgba(10,22,40,0.6)", fontFamily: "Inter_500Medium" }]}>
                  Aapki health, aapke haath mein
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* Language Selector */}
          <View style={styles.langSection}>
            <Text style={[styles.langTitle, { color: isDark ? "rgba(255,255,255,0.35)" : "rgba(10,22,40,0.4)", fontFamily: "Inter_500Medium" }]}>
              BHASHA CHUNEIN
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {LANGUAGES.map((l) => (
                <TouchableOpacity
                  key={l.code}
                  onPress={() => { Haptics.selectionAsync(); setSelectedLang(l.code); }}
                  activeOpacity={0.75}
                >
                  {selectedLang === l.code ? (
                    <LinearGradient
                      colors={["#0077B6", "#0EA5E9", "#1B998B"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.langChipActive}
                    >
                      <Text style={[styles.langChipText, { color: "#FFF", fontFamily: "Inter_600SemiBold" }]}>{l.label}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={[styles.langChip, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.7)", borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,119,182,0.14)" }]}>
                      <Text style={[styles.langChipText, { color: isDark ? "rgba(255,255,255,0.6)" : "rgba(10,22,40,0.6)", fontFamily: "Inter_500Medium" }]}>{l.label}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Main Card */}
          <View style={styles.cardOuter}>
            {/* Gradient border */}
            <LinearGradient
              colors={isDark ? ["rgba(56,189,248,0.25)", "rgba(45,212,191,0.15)", "rgba(255,255,255,0.05)"] : ["rgba(0,119,182,0.25)", "rgba(27,153,139,0.2)", "rgba(255,255,255,0.5)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cardBorderGrad}
            >
              <View style={[styles.cardInner, { backgroundColor: isDark ? "rgba(4,14,32,0.85)" : "rgba(255,255,255,0.88)" }]}>
                {Platform.OS === "ios" && (
                  <BlurView intensity={isDark ? 60 : 40} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
                )}

                <Text style={[styles.cardTitle, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>
                  Mobile se Login Karein
                </Text>
                <Text style={[styles.cardSub, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular" }]}>
                  OTP aapke number pe aayega
                </Text>

                {/* Phone Input Row */}
                <View style={styles.phoneRow}>
                  {/* Country Code Pill */}
                  <View style={[styles.ccPill, {
                    backgroundColor: isDark ? "rgba(0,119,182,0.18)" : "rgba(0,119,182,0.1)",
                    borderColor: isFocused ? "#0077B6" : (isDark ? "rgba(255,255,255,0.12)" : "rgba(0,119,182,0.22)"),
                  }]}>
                    <Text style={[styles.ccText, { color: isDark ? "#38BDF8" : "#0077B6", fontFamily: "Inter_700Bold" }]}>+91</Text>
                  </View>
                  {/* Phone number input */}
                  <View style={[styles.phoneWrap, {
                    flex: 1,
                    borderColor: isFocused ? "#0077B6" : (isDark ? "rgba(255,255,255,0.12)" : "rgba(0,119,182,0.22)"),
                    backgroundColor: isDark ? "rgba(56,189,248,0.04)" : "rgba(0,119,182,0.03)",
                  }]}>
                    <TextInput
                      style={[styles.phoneInput, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_500Medium" }]}
                      placeholder="10-digit mobile number"
                      placeholderTextColor={isDark ? "rgba(255,255,255,0.22)" : "rgba(10,22,40,0.3)"}
                      keyboardType="numeric"
                      maxLength={10}
                      value={phone}
                      onChangeText={setPhone}
                      onFocus={() => handleFocus(true)}
                      onBlur={() => handleFocus(false)}
                      autoFocus
                    />
                    {phone.length === 10 && (
                      <View style={styles.checkCircle}>
                        <LinearGradient colors={["#0077B6", "#1B998B"]} style={styles.checkGrad}>
                          <Ionicons name="checkmark" size={13} color="#FFF" />
                        </LinearGradient>
                      </View>
                    )}
                  </View>
                </View>

                {/* OTP CTA */}
                <TouchableOpacity onPress={handleSendOtp} disabled={isLoading || !isActive} activeOpacity={0.85}>
                  {isActive ? (
                    <LinearGradient
                      colors={["#0077B6", "#0EA5E9", "#1B998B"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.ctaBtn, styles.ctaActive]}
                    >
                      {isLoading ? <ActivityIndicator color="#FFF" /> : (
                        <>
                          <Text style={[styles.ctaText, { fontFamily: "Inter_700Bold" }]}>OTP Bhejein</Text>
                          <View style={styles.ctaArrow}>
                            <Ionicons name="arrow-forward" size={17} color="#0077B6" />
                          </View>
                        </>
                      )}
                    </LinearGradient>
                  ) : (
                    <View style={[styles.ctaBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }]}>
                      <Text style={[styles.ctaText, { color: isDark ? "rgba(255,255,255,0.25)" : "rgba(10,22,40,0.25)", fontFamily: "Inter_700Bold" }]}>OTP Bhejein</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Divider */}
                <View style={styles.divRow}>
                  <LinearGradient colors={isDark ? ["transparent", "rgba(255,255,255,0.1)", "transparent"] : ["transparent", "rgba(0,0,0,0.08)", "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.divLine} />
                  <View style={[styles.divBadge, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }]}>
                    <Text style={[styles.divText, { color: isDark ? "rgba(255,255,255,0.3)" : "rgba(10,22,40,0.35)", fontFamily: "Inter_400Regular" }]}>ya</Text>
                  </View>
                  <LinearGradient colors={isDark ? ["transparent", "rgba(255,255,255,0.1)", "transparent"] : ["transparent", "rgba(0,0,0,0.08)", "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.divLine} />
                </View>

                {/* Google */}
                <TouchableOpacity
                  onPress={() => Alert.alert("Coming Soon", "Google login will be available shortly")}
                  style={[styles.googleBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "#FFF", borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }]}
                  activeOpacity={0.8}
                >
                  <View style={styles.googleIconBox}>
                    <Text style={styles.googleG}>G</Text>
                  </View>
                  <Text style={[styles.googleText, { color: isDark ? "rgba(255,255,255,0.8)" : "#1A1A1A", fontFamily: "Inter_500Medium" }]}>
                    Continue with Google
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)"} />
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>

          {/* Security badges */}
          <View style={styles.badgeRow}>
            {["🔒 End-to-end encrypted", "🏥 DPDP compliant", "🇮🇳 Made in India"].map((b) => (
              <View key={b} style={[styles.badge, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.7)", borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,119,182,0.12)" }]}>
                <Text style={[styles.badgeText, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular" }]}>{b}</Text>
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
  meshOverlay: { ...StyleSheet.absoluteFillObject },
  meshLine: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: "#0077B6" },
  logoHero: { alignItems: "center", marginBottom: 28 },
  glowRing: { position: "absolute", top: -20, alignSelf: "center" },
  glowCircle: { width: 180, height: 180, borderRadius: 90 },
  logoBox: { borderRadius: 28, borderWidth: 1, padding: 16, marginBottom: 14 },
  logo: { width: 170, height: 60 },
  taglineRow: { alignItems: "center" },
  taglinePill: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  taglineDot: { width: 6, height: 6, borderRadius: 3 },
  taglineText: { fontSize: 13 },
  langSection: { marginBottom: 18 },
  langTitle: { fontSize: 11, letterSpacing: 1.2, marginBottom: 10 },
  langChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 22, borderWidth: 1 },
  langChipActive: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 22 },
  langChipText: { fontSize: 14 },
  cardOuter: { marginBottom: 18 },
  cardBorderGrad: { borderRadius: 26, padding: 1.5 },
  cardInner: { borderRadius: 25, overflow: "hidden", padding: 22 },
  cardTitle: { fontSize: 21, marginBottom: 5 },
  cardSub: { fontSize: 13, marginBottom: 20 },
  phoneRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  ccPill: { height: 58, width: 72, borderRadius: 14, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  ccText: { fontSize: 17 },
  phoneWrap: { borderRadius: 14, borderWidth: 1.5, flexDirection: "row", alignItems: "center", height: 58 },
  countryCode: { fontSize: 16 },
  countryText: { fontSize: 15 },
  phoneInput: { flex: 1, paddingHorizontal: 16, fontSize: 17, height: "100%" },
  checkCircle: { marginRight: 12 },
  checkGrad: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  ctaBtn: { height: 54, borderRadius: 16, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10, marginBottom: 16 },
  ctaActive: {},
  ctaText: { color: "#FFF", fontSize: 17 },
  ctaArrow: { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.9)", alignItems: "center", justifyContent: "center" },
  divRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  divLine: { flex: 1, height: 1 },
  divBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  divText: { fontSize: 13 },
  googleBtn: { flexDirection: "row", alignItems: "center", gap: 12, height: 52, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16 },
  googleIconBox: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#FFF", alignItems: "center", justifyContent: "center", shadowColor: "#4285F4", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3 },
  googleG: { fontSize: 17, fontWeight: "bold", color: "#4285F4" },
  googleText: { flex: 1, fontSize: 15 },
  badgeRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1 },
  badgeText: { fontSize: 11 },
});
