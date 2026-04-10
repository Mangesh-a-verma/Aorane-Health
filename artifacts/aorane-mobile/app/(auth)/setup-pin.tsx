import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  useColorScheme, Animated, Dimensions, Platform,
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

export default function SetupPinScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const insets = useSafeAreaInsets();
  const { setPinComplete } = useAuth();

  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [phase, setPhase] = useState<"set" | "confirm">("set");

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
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

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
      Animated.timing(phaseAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
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
        setTimeout(() => { setPhase("confirm"); switchPhase(); }, 320);
      } else {
        if (next === pin) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await storage.setPin(pin);
          await setPinComplete();
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          triggerShake();
          setTimeout(() => {
            Alert.alert("PIN mismatch", "PINs match nahi kiye. Phir se try karein.");
            setPin(""); setConfirmPin(""); setPhase("set"); switchPhase();
          }, 400);
        }
      }
    }
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
      <View style={[styles.orb3, { backgroundColor: isDark ? "#1E3A5F" : "#BAE6FD" }]} />

      <Animated.View style={[styles.container, {
        paddingTop: insets.top + 40,
        paddingBottom: insets.bottom + 20,
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }]}>
        {/* Pulsing Lock Icon */}
        <Animated.View style={[styles.iconWrap, { transform: [{ scale: pulseAnim }] }]}>
          <LinearGradient colors={["#0077B6", "#0EA5E9", "#1B998B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.iconGrad}>
            <Ionicons name={phase === "confirm" ? "checkmark-circle" : "lock-closed"} size={32} color="#FFF" />
          </LinearGradient>
          <View style={[styles.iconRing, { borderColor: isDark ? "rgba(56,189,248,0.35)" : "rgba(0,119,182,0.25)" }]} />
        </Animated.View>

        {/* Title — fades on phase change */}
        <Animated.View style={{ opacity: phaseAnim, alignItems: "center" }}>
          <Text style={[styles.title, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>
            {phase === "set" ? "App PIN Set Karein" : "PIN Confirm Karein"}
          </Text>
          <Text style={[styles.subtitle, { color: isDark ? "rgba(255,255,255,0.48)" : "rgba(10,22,40,0.52)", fontFamily: "Inter_400Regular" }]}>
            {phase === "set" ? "4-digit secure PIN choose karein" : "Same PIN dobara enter karein"}
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
                {filled && (
                  <LinearGradient colors={["#0077B6", "#1B998B"]} style={styles.dotFilled} />
                )}
              </View>
            );
          })}
        </Animated.View>

        {/* Glass Keypad Card */}
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
                      borderColor: isDark ? "rgba(239,68,68,0.25)" : "rgba(239,68,68,0.2)",
                    }]}>
                      <Ionicons name="backspace-outline" size={22} color={isDark ? "#F87171" : "#EF4444"} />
                    </View>
                  ) : (
                    <LinearGradient
                      colors={isDark
                        ? ["rgba(255,255,255,0.1)", "rgba(255,255,255,0.06)"]
                        : ["rgba(255,255,255,0.9)", "rgba(255,255,255,0.7)"]}
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

        {/* Security note */}
        <View style={[styles.secNote, {
          backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.6)",
          borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.88)",
        }]}>
          <Ionicons name="shield-checkmark" size={13} color={isDark ? "#38BDF8" : "#0077B6"} />
          <Text style={[styles.secText, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.48)", fontFamily: "Inter_400Regular" }]}>
            PIN locally stored hai • Kisi ke saath share mat karein
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  orb1: { position: "absolute", width: 320, height: 320, borderRadius: 160, bottom: 40, left: -100, opacity: 0.5 },
  orb2: { position: "absolute", width: 380, height: 380, borderRadius: 190, top: -140, right: -120, opacity: 0.5 },
  orb3: { position: "absolute", width: 180, height: 180, borderRadius: 90, top: H * 0.35, right: -50, opacity: 0.4 },

  container: { flex: 1, alignItems: "center", paddingHorizontal: 28 },

  iconWrap: { marginBottom: 22, position: "relative" },
  iconGrad: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  iconRing: { position: "absolute", top: -7, left: -7, right: -7, bottom: -7, borderRadius: 47, borderWidth: 2 },

  title: { fontSize: 24, marginBottom: 6, textAlign: "center" },
  subtitle: { fontSize: 14, marginBottom: 32, textAlign: "center" },

  dotsRow: { flexDirection: "row", gap: 20, marginBottom: 28 },
  dotOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  dotFilled: { width: 12, height: 12, borderRadius: 6 },

  cardBorder: { width: W - 40, borderRadius: 28, padding: 1.5, marginBottom: 22 },
  cardInner: { borderRadius: 27, overflow: "hidden", padding: 20 },
  topShimmer: { position: "absolute", top: 0, left: 0, right: 0, height: 50 },

  keypad: { flexDirection: "row", flexWrap: "wrap", gap: 14, justifyContent: "center" },
  keyWrap: { width: 80, height: 80, borderRadius: 40, overflow: "hidden" },
  key: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  keyText: { fontSize: 26 },

  secNote: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, borderWidth: 1 },
  secText: { fontSize: 12, flex: 1 },
});
