import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  Animated, Dimensions, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/context/AuthContext";
import { storage } from "@/lib/storage";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const { width: W } = Dimensions.get("window");
const KEYS = ["1","2","3","4","5","6","7","8","9","","0","⌫"];

const C = {
  bg: "#F0FAFB",
  primary: "#0077B6",
  accent: "#00B896",
  gradient: ["#0077B6", "#00B896"] as [string, string],
  card: "#FFFFFF",
  text: "#0D1F33",
  muted: "#7A90A4",
  border: "#E2EFF5",
};

let LocalAuthentication: typeof import("expo-local-authentication") | null = null;
try { LocalAuthentication = require("expo-local-authentication"); } catch { }

// Escalating lockout after repeated wrong PIN guesses — a 4-digit PIN only
// has 10,000 combinations, so without this an attacker with a few unattended
// minutes with the unlocked device could brute-force it. Index 0 applies at
// the 5th wrong attempt; each further wrong attempt advances one step,
// capped at the last entry.
const LOCKOUT_SCHEDULE_SECONDS = [30, 60, 120, 300, 900] as const; // 30s..15min
const ATTEMPTS_BEFORE_LOCKOUT = 5;

function lockoutSecondsFor(attempts: number): number {
  if (attempts < ATTEMPTS_BEFORE_LOCKOUT) return 0;
  const idx = Math.min(attempts - ATTEMPTS_BEFORE_LOCKOUT, LOCKOUT_SCHEDULE_SECONDS.length - 1);
  return LOCKOUT_SCHEDULE_SECONDS[idx];
}

function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function VerifyPinScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout, clearPinVerification } = useAuth();

  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState(0); // seconds; 0 = not locked

  const pinRef = useRef("");
  const biometricAvailableRef = useRef(false);
  const lockoutIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const startLockoutCountdown = (until: number) => {
    if (lockoutIntervalRef.current) clearInterval(lockoutIntervalRef.current);
    const tick = () => {
      const remaining = Math.ceil((until - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockoutRemaining(0);
        if (lockoutIntervalRef.current) clearInterval(lockoutIntervalRef.current);
        return;
      }
      setLockoutRemaining(remaining);
    };
    tick();
    lockoutIntervalRef.current = setInterval(tick, 1000);
  };

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: Platform.OS !== "web" }).start();
    checkBiometric();
    (async () => {
      const until = await storage.getPinLockoutUntil();
      if (until && until > Date.now()) startLockoutCountdown(until);
    })();
    return () => { if (lockoutIntervalRef.current) clearInterval(lockoutIntervalRef.current); };
  }, []);

  const checkBiometric = async () => {
    if (!LocalAuthentication) return;
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const userEnabled = await storage.isBiometricEnabled();
      if (compatible && enrolled && userEnabled) {
        biometricAvailableRef.current = true;
        setBiometricAvailable(true);
        setTimeout(() => tryBiometric(), 600);
      }
    } catch { }
  };

  const tryBiometric = async () => {
    if (!LocalAuthentication || !biometricAvailableRef.current) return;
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Verify your identity to open Aorane",
        cancelLabel: "Use PIN",
        disableDeviceFallback: true,
      });
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // A real biometric success is a stronger factor than the PIN itself
        // guessing wrong a few times — forgive prior attempts rather than
        // leaving the user locked out of PIN entry after they've already
        // proven who they are.
        await storage.resetPinLockout();
        clearPinVerification();
        router.replace("/(tabs)/dashboard");
      }
    } catch { }
  };

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: Platform.OS !== "web" }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: Platform.OS !== "web" }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: Platform.OS !== "web" }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: Platform.OS !== "web" }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: Platform.OS !== "web" }),
    ]).start();
  };

  const handleVerify = async (enteredPin: string) => {
    if (enteredPin.length !== 4) return;
    setLoading(true);
    try {
      const storedPin = await storage.getPin();
      if (!storedPin) {
        Alert.alert("Session Error", "Could not verify your session. Please sign in again.", [
          { text: "Sign In", onPress: () => logout() },
        ]);
        setLoading(false);
        return;
      }
      if (storedPin !== enteredPin) throw new Error("wrong_pin");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await storage.resetPinLockout();
      clearPinVerification();
      router.replace("/(tabs)/dashboard");
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      triggerShake();

      const attempts = (await storage.getPinAttempts()) + 1;
      await storage.setPinAttempts(attempts);
      const lockSeconds = lockoutSecondsFor(attempts);
      if (lockSeconds > 0) {
        const until = Date.now() + lockSeconds * 1000;
        await storage.setPinLockoutUntil(until);
        startLockoutCountdown(until);
      }

      setTimeout(() => {
        if (lockSeconds > 0) {
          Alert.alert("Too Many Attempts", `For your security, PIN entry is locked for ${formatCountdown(lockSeconds)}. You can still use biometric unlock if enabled.`);
        } else {
          Alert.alert("Incorrect PIN", "Please try again.");
        }
        pinRef.current = "";
        setPin("");
        setLoading(false);
      }, 400);
    }
  };

  const handleKey = (key: string) => {
    if (key === "" || loading || lockoutRemaining > 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (key === "⌫") {
      pinRef.current = pinRef.current.slice(0, -1);
      setPin(pinRef.current);
      return;
    }
    if (pinRef.current.length >= 4) return;
    pinRef.current = pinRef.current + key;
    setPin(pinRef.current);
    if (pinRef.current.length === 4) {
      setTimeout(() => handleVerify(pinRef.current), 200);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out? You will need to log in again.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Sign Out", style: "destructive", onPress: () => { logout(); } },
      ]
    );
  };

  return (
    <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <LinearGradient colors={["#E8F4FC", "#F0FAFB", "#E6F9F4"]} style={StyleSheet.absoluteFill} />

      <Animated.View style={[s.container, { opacity: fadeAnim }]}>
        <View style={s.logoBox}>
          <LinearGradient colors={C.gradient} style={s.logoCircle}>
            <Text style={s.logoLetter}>A</Text>
          </LinearGradient>
          <Text style={s.appName}>Aorane Health</Text>
          <Text style={s.welcomeBack}>Welcome back 👋</Text>
          <Text style={s.subtitle}>Enter your PIN to continue</Text>
        </View>

        <Animated.View style={[s.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
          {[0,1,2,3].map(i => (
            <View key={i} style={[s.dot, pin.length > i && s.dotFilled]} />
          ))}
        </Animated.View>

        {biometricAvailable && (
          <TouchableOpacity onPress={tryBiometric} style={s.biometricBtn} activeOpacity={0.75}>
            <Ionicons name="finger-print-outline" size={22} color={C.primary} />
            <Text style={s.biometricTxt}>Use Biometric</Text>
          </TouchableOpacity>
        )}

        {lockoutRemaining > 0 && (
          <View style={s.lockoutBox}>
            <Ionicons name="lock-closed" size={18} color="#DC2626" />
            <Text style={s.lockoutTxt}>Too many attempts. Try again in {formatCountdown(lockoutRemaining)}</Text>
          </View>
        )}

        <View style={[s.keypad, lockoutRemaining > 0 && s.keypadLocked]} pointerEvents={lockoutRemaining > 0 ? "none" : "auto"}>
          {KEYS.map((key, i) => (
            <TouchableOpacity
              key={i}
              style={[s.key, key === "" && s.keyHidden]}
              activeOpacity={key === "" ? 1 : 0.7}
              onPress={() => key !== "" && handleKey(key)}
              disabled={loading || lockoutRemaining > 0}
            >
              {key === "⌫" ? (
                <Ionicons name="backspace-outline" size={22} color={C.text} />
              ) : key !== "" ? (
                <Text style={s.keyTxt}>{key}</Text>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>

      {/* Forgot PIN — fixed at bottom, always tappable */}
      <TouchableOpacity onPress={handleLogout} style={s.logoutBtn} activeOpacity={0.7}>
        <Text style={s.logoutTxt}>Forgot PIN? Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1 },
  container:   { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  logoBox:     { alignItems: "center", marginBottom: 36 },
  logoCircle:  { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  logoLetter:  { color: "#FFF", fontSize: 32, fontFamily: "Inter_700Bold" },
  appName:     { fontSize: 22, fontFamily: "Inter_700Bold", color: "#0D1F33", letterSpacing: 0.3 },
  welcomeBack: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#0D1F33", marginTop: 6 },
  subtitle:    { fontSize: 13, fontFamily: "Inter_400Regular", color: "#7A90A4", marginTop: 4 },
  dotsRow:     { flexDirection: "row", gap: 16, marginBottom: 20 },
  dot:         { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: "#0077B6", backgroundColor: "transparent" },
  dotFilled:   { backgroundColor: "#0077B6" },
  biometricBtn:{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 24, backgroundColor: "rgba(0,119,182,0.08)", marginBottom: 20 },
  biometricTxt:{ color: "#0077B6", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  lockoutBox:  { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 14, backgroundColor: "rgba(220,38,38,0.08)", marginBottom: 20, maxWidth: W - 64 },
  lockoutTxt:  { color: "#DC2626", fontFamily: "Inter_600SemiBold", fontSize: 13, flexShrink: 1 },
  keypad:      { flexDirection: "row", flexWrap: "wrap", width: W - 64, justifyContent: "center", gap: 14 },
  keypadLocked:{ opacity: 0.35 },
  key:         { width: (W - 64 - 28) / 3, height: 64, borderRadius: 18, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", shadowColor: "#0077B6", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3 },
  keyHidden:   { backgroundColor: "transparent", shadowOpacity: 0, elevation: 0 },
  keyTxt:      { fontSize: 22, fontFamily: "Inter_600SemiBold", color: "#0D1F33" },
  logoutBtn:   { alignItems: "center", paddingVertical: 16, paddingHorizontal: 32, marginBottom: 8 },
  logoutTxt:   { fontSize: 13, fontFamily: "Inter_400Regular", color: "#7A90A4", textDecorationLine: "underline" },
});
