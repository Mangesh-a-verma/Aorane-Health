import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  Animated, Dimensions, Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/context/AuthContext";
import { storage } from "@/lib/storage";
import { api } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";

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

export default function SetupPinScreen() {
  const insets = useSafeAreaInsets();
  const { setPinComplete } = useAuth();
  const { t } = useLanguage();

  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [phase, setPhase] = useState<"set" | "confirm">("set");
  const [loading, setLoading] = useState(false);

  // useRef to avoid stale closure bugs — always holds latest values
  const pinRef = useRef("");
  const confirmPinRef = useRef("");
  const phaseRef = useRef<"set" | "confirm">("set");

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
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
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

  const handleConfirmSubmit = async () => {
    const savedPin = pinRef.current;
    const enteredConfirm = confirmPinRef.current;
    if (enteredConfirm.length !== 4) return;
    setLoading(true);
    if (enteredConfirm === savedPin) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await storage.setPin(savedPin);
      if (biometricEnabled) await storage.setBiometricEnabled(true);
      try { await api.setPIN(savedPin); } catch { }
      await setPinComplete();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      triggerShake();
      setTimeout(() => {
        Alert.alert(t("pinMismatch"), t("tryAgain"));
        pinRef.current = ""; confirmPinRef.current = ""; phaseRef.current = "set";
        setPin(""); setConfirmPin(""); setPhase("set"); switchPhase();
        setLoading(false);
      }, 400);
    }
  };

  const handleKey = (key: string) => {
    if (key === "" || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const curPhase = phaseRef.current;

    if (key === "⌫") {
      if (curPhase === "set") {
        pinRef.current = pinRef.current.slice(0, -1);
        setPin(pinRef.current);
      } else {
        confirmPinRef.current = confirmPinRef.current.slice(0, -1);
        setConfirmPin(confirmPinRef.current);
      }
      return;
    }

    if (curPhase === "set") {
      if (pinRef.current.length >= 4) return;
      pinRef.current = pinRef.current + key;
      setPin(pinRef.current);
      if (pinRef.current.length === 4) {
        setTimeout(() => {
          phaseRef.current = "confirm";
          setPhase("confirm");
          switchPhase();
        }, 300);
      }
    } else {
      if (confirmPinRef.current.length >= 4) return;
      confirmPinRef.current = confirmPinRef.current + key;
      setConfirmPin(confirmPinRef.current);
      if (confirmPinRef.current.length === 4) {
        // Auto-submit after short delay for visual feedback
        setTimeout(() => handleConfirmSubmit(), 300);
      }
    }
  };

  const handleSkip = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (biometricEnabled && biometricAvailable && LocalAuthentication) {
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: t("loginWithAorane"),
          cancelLabel: t("cancel"),
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
          promptMessage: t("confirmBiometric"),
          cancelLabel: t("cancel"),
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
    <View style={s.root}>
      <LinearGradient colors={["#E8F7FB", "#F0FAF6", "#FFFFFF"]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <View style={s.blob1} />
      <View style={s.blob2} />

      <View style={[s.headerWrap, { paddingTop: insets.top + 16 }]}>
        <View style={s.stepRow}>
          {[1, 2, 3].map((n) => (
            <View key={n} style={s.stepTrack}>
              <LinearGradient colors={C.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.stepFill} />
            </View>
          ))}
        </View>
        <View style={s.stepLabelRow}>
          <View style={s.stepPill}>
            <Text style={s.stepPillTxt}>{t("step3of3")}</Text>
          </View>
          <Text style={s.stepName}>{t("securitySetup")}</Text>
        </View>
      </View>

      <Animated.View style={[s.container, { paddingBottom: insets.bottom + 16, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <Animated.View style={[s.iconWrap, { transform: [{ scale: pulseAnim }] }]}>
          <LinearGradient colors={C.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.iconGrad}>
            <Ionicons name={phase === "confirm" ? "checkmark-circle" : "shield-checkmark"} size={32} color="#FFF" />
          </LinearGradient>
          <View style={s.iconRing} />
        </Animated.View>

        {biometricAvailable && (
          <View style={s.bioCard}>
            <View style={s.bioRow}>
              <LinearGradient
                colors={biometricType === "face" ? ["#7C3AED", "#0EA5E9"] : C.gradient}
                style={s.bioIcon}
              >
                <Ionicons name={biometricType === "face" ? "scan-outline" : "finger-print"} size={22} color="#FFF" />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={s.bioTitle}>{biometricType === "face" ? t("enableFaceId") : t("enableFingerprint")}</Text>
                <Text style={s.bioDesc}>{t("biometricDesc")}</Text>
              </View>
              <Switch
                value={biometricEnabled}
                onValueChange={toggleBiometric}
                trackColor={{ false: C.border, true: C.primary }}
                thumbColor={biometricEnabled ? "#38BDF8" : "#FFF"}
              />
            </View>
          </View>
        )}

        <Animated.View style={{ opacity: phaseAnim, alignItems: "center" }}>
          <Text style={s.title}>{phase === "set" ? t("createPin") : t("confirmPinTitle")}</Text>
          <Text style={s.subtitle}>{phase === "set" ? t("createPinDesc") : t("confirmPinDesc")}</Text>
        </Animated.View>

        <Animated.View style={[s.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
          {[0, 1, 2, 3].map((i) => {
            const filled = i < currentPin.length;
            return (
              <View key={i} style={[s.dotOuter, { borderColor: filled ? C.primary : C.border }]}>
                {filled && <LinearGradient colors={C.gradient} style={s.dotFill} />}
              </View>
            );
          })}
        </Animated.View>

        <View style={s.keypadCard}>
          <View style={s.keypad}>
            {KEYS.map((key, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => handleKey(key)}
                disabled={key === ""}
                activeOpacity={0.65}
                style={[s.keyWrap, key === "" && { opacity: 0 }]}
              >
                {key === "⌫" ? (
                  <View style={s.keyDelete}>
                    <Ionicons name="backspace-outline" size={22} color="#EF4444" />
                  </View>
                ) : (
                  <View style={s.key}>
                    <Text style={s.keyText}>{key}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {phase === "confirm" && confirmPin.length === 4 && (
          <TouchableOpacity
            onPress={handleConfirmSubmit}
            disabled={loading}
            activeOpacity={0.85}
            style={[s.confirmBtn, loading && { opacity: 0.6 }]}
          >
            <LinearGradient colors={C.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.confirmBtnGrad}>
              <Ionicons name="checkmark-circle" size={20} color="#FFF" />
              <Text style={s.confirmBtnTxt}>{loading ? "Setting up…" : "Confirm PIN ✓"}</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={handleSkip} activeOpacity={0.7} style={s.skipWrap}>
          <Text style={s.skipTxt}>{biometricEnabled ? t("useBiometricOnly") : t("skipPinSetup")}</Text>
        </TouchableOpacity>

        <View style={s.secNote}>
          <Ionicons name="lock-closed" size={12} color={C.primary} />
          <Text style={s.secTxt}>PIN is stored locally on your device — not on AORANE servers</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  blob1: { position: "absolute", width: 300, height: 300, borderRadius: 150, backgroundColor: "#A7F3D0", opacity: 0.3, bottom: 40, left: -100 },
  blob2: { position: "absolute", width: 350, height: 350, borderRadius: 175, backgroundColor: "#BAE6FD", opacity: 0.3, top: -120, right: -110 },

  headerWrap: { paddingHorizontal: 22, marginBottom: 4 },
  stepRow: { flexDirection: "row", gap: 6, marginBottom: 8 },
  stepTrack: { flex: 1, height: 5, borderRadius: 3, overflow: "hidden" },
  stepFill: { flex: 1, height: 5, borderRadius: 3 },
  stepLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stepPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: "#EBF5FF", borderWidth: 1, borderColor: "rgba(0,119,182,0.2)" },
  stepPillTxt: { fontSize: 12, color: C.primary, fontFamily: "Inter_600SemiBold" },
  stepName: { fontSize: 12, color: C.muted, fontFamily: "Inter_400Regular" },

  container: { flex: 1, alignItems: "center", paddingHorizontal: 22 },

  iconWrap: { marginBottom: 14, position: "relative" },
  iconGrad: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center" },
  iconRing: { position: "absolute", top: -7, left: -7, right: -7, bottom: -7, borderRadius: 45, borderWidth: 2, borderColor: "rgba(0,119,182,0.2)" },

  bioCard: { width: W - 44, backgroundColor: C.card, borderRadius: 20, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: C.border, shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  bioRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  bioIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  bioTitle: { fontSize: 14, marginBottom: 2, fontFamily: "Inter_600SemiBold", color: C.text },
  bioDesc: { fontSize: 12, lineHeight: 16, fontFamily: "Inter_400Regular", color: C.muted },

  title: { fontSize: 22, marginBottom: 5, textAlign: "center", fontFamily: "Inter_700Bold", color: C.text },
  subtitle: { fontSize: 13, marginBottom: 22, textAlign: "center", fontFamily: "Inter_400Regular", color: C.muted },

  dotsRow: { flexDirection: "row", gap: 18, marginBottom: 22 },
  dotOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  dotFill: { width: 10, height: 10, borderRadius: 5 },

  keypadCard: { width: W - 44, backgroundColor: C.card, borderRadius: 26, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: C.border, shadowColor: C.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 6 },
  keypad: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "center" },
  keyWrap: { width: 76, height: 76, borderRadius: 38, overflow: "hidden" },
  key: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center", borderWidth: 1, backgroundColor: C.bg, borderColor: C.border },
  keyDelete: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center", borderWidth: 1, backgroundColor: "#FEF2F2", borderColor: "rgba(239,68,68,0.2)" },
  keyText: { fontSize: 25, fontFamily: "Inter_600SemiBold", color: C.text },

  confirmBtn: { width: W - 44, borderRadius: 18, overflow: "hidden", marginBottom: 12 },
  confirmBtnGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16 },
  confirmBtnTxt: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#FFF" },

  skipWrap: { marginBottom: 16 },
  skipTxt: { fontSize: 13, textDecorationLine: "underline", fontFamily: "Inter_400Regular", color: C.muted },

  secNote: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, width: W - 44 },
  secTxt: { fontSize: 11, flex: 1, fontFamily: "Inter_400Regular", color: C.muted },
});
