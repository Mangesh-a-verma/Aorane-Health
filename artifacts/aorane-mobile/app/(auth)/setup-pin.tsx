import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  useColorScheme, Animated, Dimensions, Platform, Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useAuth } from "@/context/AuthContext";
import { storage } from "@/lib/storage";

const { width: W, height: H } = Dimensions.get("window");
const KEYS = ["1","2","3","4","5","6","7","8","9","","0","⌫"];

let LocalAuthentication: typeof import("expo-local-authentication") | null = null;
try { LocalAuthentication = require("expo-local-authentication"); } catch { }

export default function SetupPinScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const insets = useSafeAreaInsets();
  const { setPinComplete } = useAuth();

  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [phase, setPhase] = useState<"set" | "confirm">("set");

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState<"fingerprint" | "face" | "none">("none");

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const phaseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: false }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
    ]).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 1100, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1100, useNativeDriver: true }),
      ])
    ).start();
    checkBiometric();
  }, []);

  const checkBiometric = async () => {
    if (!LocalAuthentication) return;
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (compatible && enrolled) {
        setBiometricAvailable(true);
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType("face");
        } else {
          setBiometricType("fingerprint");
        }
      }
    } catch { }
  };

  const currentPin = phase === "set" ? pin : confirmPin;
  const setCurrentPin = phase === "set" ? setPin : setConfirmPin;

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const switchPhase = () => {
    Animated.sequence([
      Animated.timing(phaseAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(phaseAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const handleKey = async (key: string) => {
    if (key === "") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (key === "⌫") { setCurrentPin((p) => p.slice(0, -1)); return; }
    const next = currentPin + key;
    setCurrentPin(next);
    if (next.length === 4) {
      if (phase === "set") {
        setTimeout(() => { setPhase("confirm"); switchPhase(); }, 300);
      } else {
        if (next === pin) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await storage.setPin(pin);
          if (biometricEnabled) await storage.setBiometricEnabled(true);
          await setPinComplete();
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          triggerShake();
          setTimeout(() => {
            Alert.alert("PIN match nahi hua", "Phir se try karein.");
            setPin(""); setConfirmPin(""); setPhase("set"); switchPhase();
          }, 400);
        }
      }
    }
  };

  const handleSkip = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (biometricEnabled && biometricAvailable && LocalAuthentication) {
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "AORANE mein login karein",
          cancelLabel: "Cancel",
        });
        if (result.success) {
          await storage.setBiometricEnabled(true);
          await setPinComplete();
          return;
        }
      } catch { }
    }
    await setPinComplete();
  };

  const toggleBiometric = async (val: boolean) => {
    Haptics.selectionAsync();
    if (val && biometricAvailable && LocalAuthentication) {
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Biometric confirm karein",
          cancelLabel: "Cancel",
        });
        if (result.success) {
          setBiometricEnabled(true);
          return;
        }
      } catch { }
    }
    setBiometricEnabled(val);
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={isDark
          ? ["#010814", "#031628", "#051E30", "#061A2A"]
          : ["#C8E9FA", "#D9F4EE", "#E8F4FF", "#D4F0F7"]}
        locations={[0, 0.3, 0.65, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.orb1, { backgroundColor: isDark ? "#0D9488" : "#6EE7B7" }]} />
      <View style={[styles.orb2, { backgroundColor: isDark ? "#0055A3" : "#7DD3FC" }]} />

      {/* Header steps */}
      <View style={[styles.headerWrap, { paddingTop: insets.top + 16 }]}>
        <View style={styles.stepRow}>
          {[1, 2, 3].map((s) => (
            <View key={s} style={styles.stepTrack}>
              <LinearGradient colors={["#0077B6", "#1B998B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.stepFill} />
            </View>
          ))}
        </View>
        <View style={styles.stepLabelRow}>
          <View style={[styles.stepPill, { backgroundColor: isDark ? "rgba(56,189,248,0.15)" : "rgba(0,119,182,0.1)", borderColor: isDark ? "rgba(56,189,248,0.3)" : "rgba(0,119,182,0.2)" }]}>
            <Text style={[styles.stepPillTxt, { color: isDark ? "#38BDF8" : "#0077B6", fontFamily: "Inter_600SemiBold" }]}>Step 3 of 3</Text>
          </View>
          <Text style={[styles.stepName, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular" }]}>Security Setup</Text>
        </View>
      </View>

      <Animated.View style={[styles.container, {
        paddingBottom: insets.bottom + 16,
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }]}>
        {/* Pulsing icon */}
        <Animated.View style={[styles.iconWrap, { transform: [{ scale: pulseAnim }] }]}>
          <LinearGradient colors={["#0077B6", "#0EA5E9", "#1B998B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.iconGrad}>
            <Ionicons name={phase === "confirm" ? "checkmark-circle" : "shield-checkmark"} size={32} color="#FFF" />
          </LinearGradient>
          <View style={[styles.iconRing, { borderColor: isDark ? "rgba(56,189,248,0.35)" : "rgba(0,119,182,0.25)" }]} />
        </Animated.View>

        {/* Biometric toggle (if available) */}
        {biometricAvailable && (
          <LinearGradient
            colors={isDark
              ? ["rgba(56,189,248,0.22)", "rgba(45,212,191,0.12)", "rgba(255,255,255,0.04)"]
              : ["rgba(255,255,255,0.95)", "rgba(186,230,253,0.5)"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.bioBorder}
          >
            <View style={[styles.bioCard, { backgroundColor: isDark ? "rgba(8,18,40,0.5)" : "rgba(255,255,255,0.5)" }]}>
              {Platform.OS === "ios" && <BlurView intensity={isDark ? 70 : 50} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />}
              <View style={styles.bioRow}>
                <LinearGradient
                  colors={biometricType === "face" ? ["#7C3AED", "#0EA5E9"] : ["#0D9488", "#1B998B"]}
                  style={styles.bioIcon}
                >
                  <Ionicons
                    name={biometricType === "face" ? "scan-outline" : "finger-print"}
                    size={22} color="#FFF"
                  />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.bioTitle, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>
                    {biometricType === "face" ? "Face ID Enable Karein" : "Fingerprint Enable Karein"}
                  </Text>
                  <Text style={[styles.bioDesc, { color: isDark ? "rgba(255,255,255,0.45)" : "rgba(10,22,40,0.5)", fontFamily: "Inter_400Regular" }]}>
                    Har baar password type karne ki zaroorat nahi
                  </Text>
                </View>
                <Switch
                  value={biometricEnabled}
                  onValueChange={toggleBiometric}
                  trackColor={{ false: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)", true: "#0077B6" }}
                  thumbColor={biometricEnabled ? "#38BDF8" : "#FFF"}
                />
              </View>
            </View>
          </LinearGradient>
        )}

        {/* Title */}
        <Animated.View style={{ opacity: phaseAnim, alignItems: "center" }}>
          <Text style={[styles.title, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>
            {phase === "set" ? "4-Digit PIN Banayein" : "PIN Confirm Karein"}
          </Text>
          <Text style={[styles.subtitle, { color: isDark ? "rgba(255,255,255,0.48)" : "rgba(10,22,40,0.52)", fontFamily: "Inter_400Regular" }]}>
            {phase === "set" ? "Quick login ke liye secure PIN" : "Wahi PIN dobara enter karein"}
          </Text>
        </Animated.View>

        {/* PIN Dots */}
        <Animated.View style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
          {[0,1,2,3].map((i) => {
            const filled = i < currentPin.length;
            return (
              <View key={i} style={[styles.dotOuter, {
                borderColor: filled ? (isDark ? "#38BDF8" : "#0077B6") : (isDark ? "rgba(255,255,255,0.18)" : "rgba(0,119,182,0.2)"),
              }]}>
                {filled && <LinearGradient colors={["#0077B6", "#1B998B"]} style={styles.dotFill} />}
              </View>
            );
          })}
        </Animated.View>

        {/* Glass Keypad */}
        <LinearGradient
          colors={isDark
            ? ["rgba(56,189,248,0.28)", "rgba(45,212,191,0.18)", "rgba(255,255,255,0.05)"]
            : ["rgba(255,255,255,0.95)", "rgba(186,230,253,0.5)", "rgba(167,243,208,0.4)"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.cardBorder}
        >
          <View style={[styles.cardInner, { backgroundColor: isDark ? "rgba(8,18,40,0.55)" : "rgba(255,255,255,0.55)" }]}>
            {Platform.OS === "ios"
              ? <BlurView intensity={isDark ? 80 : 60} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
              : <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? "rgba(8,16,36,0.4)" : "rgba(255,255,255,0.4)" }]} />
            }
            <LinearGradient
              colors={isDark ? ["rgba(56,189,248,0.15)", "transparent"] : ["rgba(255,255,255,0.9)", "transparent"]}
              style={styles.topShimmer}
            />
            <View style={styles.keypad}>
              {KEYS.map((key, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => handleKey(key)}
                  disabled={key === ""}
                  activeOpacity={0.65}
                  style={[styles.keyWrap, key === "" && { opacity: 0 }]}
                >
                  {key === "⌫" ? (
                    <View style={[styles.key, {
                      backgroundColor: isDark ? "rgba(239,68,68,0.12)" : "rgba(239,68,68,0.08)",
                      borderColor: isDark ? "rgba(239,68,68,0.25)" : "rgba(239,68,68,0.18)",
                    }]}>
                      <Ionicons name="backspace-outline" size={22} color={isDark ? "#F87171" : "#EF4444"} />
                    </View>
                  ) : (
                    <LinearGradient
                      colors={isDark
                        ? ["rgba(255,255,255,0.1)", "rgba(255,255,255,0.06)"]
                        : ["rgba(255,255,255,0.92)", "rgba(255,255,255,0.7)"]}
                      style={[styles.key, { borderColor: isDark ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.95)" }]}
                    >
                      <Text style={[styles.keyText, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>{key}</Text>
                    </LinearGradient>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </LinearGradient>

        {/* Skip Button */}
        <TouchableOpacity onPress={handleSkip} activeOpacity={0.7} style={styles.skipWrap}>
          <Text style={[styles.skipTxt, { color: isDark ? "rgba(255,255,255,0.32)" : "rgba(10,22,40,0.38)", fontFamily: "Inter_400Regular" }]}>
            {biometricEnabled ? "Sirf Biometric Use Karein  →" : "PIN Setup Skip Karein  →"}
          </Text>
        </TouchableOpacity>

        {/* Security note */}
        <View style={[styles.secNote, {
          backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.6)",
          borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.88)",
        }]}>
          <Ionicons name="lock-closed" size={12} color={isDark ? "#38BDF8" : "#0077B6"} />
          <Text style={[styles.secTxt, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.48)", fontFamily: "Inter_400Regular" }]}>
            PIN aapke device pe locally store hota hai — AORANE server pe nahi
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  orb1: { position: "absolute", width: 320, height: 320, borderRadius: 160, bottom: 40, left: -100, opacity: 0.48 },
  orb2: { position: "absolute", width: 370, height: 370, borderRadius: 185, top: -140, right: -110, opacity: 0.5 },

  headerWrap: { paddingHorizontal: 22, marginBottom: 4 },
  stepRow: { flexDirection: "row", gap: 6, marginBottom: 8 },
  stepTrack: { flex: 1, height: 5, borderRadius: 3, overflow: "hidden" },
  stepFill: { flex: 1, height: 5, borderRadius: 3 },
  stepLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stepPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  stepPillTxt: { fontSize: 12 },
  stepName: { fontSize: 12 },

  container: { flex: 1, alignItems: "center", paddingHorizontal: 22 },

  iconWrap: { marginBottom: 14, position: "relative" },
  iconGrad: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center" },
  iconRing: { position: "absolute", top: -7, left: -7, right: -7, bottom: -7, borderRadius: 45, borderWidth: 2 },

  bioBorder: { width: W - 44, borderRadius: 20, padding: 1.5, marginBottom: 16 },
  bioCard: { borderRadius: 19, overflow: "hidden", padding: 14 },
  bioRow: { flexDirection: "row", alignItems: "center", gap: 12, zIndex: 1 },
  bioIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  bioTitle: { fontSize: 14, marginBottom: 2 },
  bioDesc: { fontSize: 12, lineHeight: 16 },

  title: { fontSize: 22, marginBottom: 5, textAlign: "center" },
  subtitle: { fontSize: 13, marginBottom: 22, textAlign: "center" },

  dotsRow: { flexDirection: "row", gap: 18, marginBottom: 22 },
  dotOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  dotFill: { width: 10, height: 10, borderRadius: 5 },

  cardBorder: { width: W - 44, borderRadius: 26, padding: 1.5, marginBottom: 14 },
  cardInner: { borderRadius: 25, overflow: "hidden", padding: 18 },
  topShimmer: { position: "absolute", top: 0, left: 0, right: 0, height: 50 },
  keypad: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "center" },
  keyWrap: { width: 76, height: 76, borderRadius: 38, overflow: "hidden" },
  key: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  keyText: { fontSize: 25 },

  skipWrap: { marginBottom: 16 },
  skipTxt: { fontSize: 13, textDecorationLine: "underline" },

  secNote: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, borderWidth: 1, width: W - 44 },
  secTxt: { fontSize: 11, flex: 1 },
});
