import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { GlassCard } from "@/components/GlassCard";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { storage } from "@/lib/storage";

const KEYS = ["1","2","3","4","5","6","7","8","9","","0","⌫"];

export default function SetupPinScreen() {
  const colors = useColors();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const insets = useSafeAreaInsets();
  const { setPinComplete } = useAuth();
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [phase, setPhase] = useState<"set" | "confirm">("set");

  const currentPin = phase === "set" ? pin : confirmPin;
  const setCurrentPin = phase === "set" ? setPin : setConfirmPin;

  const handleKey = async (key: string) => {
    if (key === "") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (key === "⌫") { setCurrentPin((p) => p.slice(0, -1)); return; }
    const next = currentPin + key;
    setCurrentPin(next);
    if (next.length === 4) {
      if (phase === "set") {
        setTimeout(() => setPhase("confirm"), 300);
      } else {
        if (next === pin) {
          await storage.setPin(pin);
          await setPinComplete();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert("PIN Mismatch", "PINs did not match. Please try again.");
          setPin(""); setConfirmPin(""); setPhase("set");
        }
      }
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={isDark ? ["#040D1C", "#062040", "#063330"] : ["#E0F2FE", "#F0FDF9"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.orb1, { backgroundColor: isDark ? "#0D9488" : "#99F6E4" }]} />

      <View style={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
        <LinearGradient colors={["#0077B6", "#1B998B"]} style={styles.iconCircle}>
          <Ionicons name="lock-closed" size={30} color="#FFF" />
        </LinearGradient>
        <Text style={[styles.title, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>
          {phase === "set" ? "App PIN Set Karein" : "PIN Confirm Karein"}
        </Text>
        <Text style={[styles.subtitle, { color: isDark ? "rgba(255,255,255,0.45)" : "rgba(10,22,40,0.5)", fontFamily: "Inter_400Regular" }]}>
          {phase === "set" ? "4 digit PIN choose karein" : "Same PIN dobara enter karein"}
        </Text>

        <View style={styles.dots}>
          {[0,1,2,3].map((i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i < currentPin.length
                  ? { backgroundColor: isDark ? "#38BDF8" : "#0077B6", transform: [{ scale: 1.15 }] }
                  : { backgroundColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,119,182,0.18)" },
              ]}
            />
          ))}
        </View>

        <GlassCard style={styles.keypadCard}>
          <View style={styles.keypad}>
            {KEYS.map((key, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => handleKey(key)}
                disabled={key === ""}
                style={[
                  styles.key,
                  key === "" && { opacity: 0 },
                  key !== "" && { backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.75)", borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,119,182,0.12)", borderWidth: 1 },
                ]}
                activeOpacity={0.7}
              >
                <Text style={[styles.keyText, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>
                  {key}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </GlassCard>

        <Text style={[styles.skip, { color: isDark ? "rgba(255,255,255,0.3)" : "rgba(10,22,40,0.4)", fontFamily: "Inter_400Regular" }]}>
          Aap baad mein bhi set kar sakte hain
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  orb1: { position: "absolute", width: 250, height: 250, borderRadius: 125, bottom: 60, left: -60, opacity: 0.25 },
  content: { flex: 1, alignItems: "center", paddingHorizontal: 32 },
  iconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  title: { fontSize: 24, marginBottom: 8 },
  subtitle: { fontSize: 14, marginBottom: 40, textAlign: "center" },
  dots: { flexDirection: "row", gap: 18, marginBottom: 36 },
  dot: { width: 18, height: 18, borderRadius: 9 },
  keypadCard: { padding: 20, width: "100%", maxWidth: 320 },
  keypad: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "center" },
  key: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center" },
  keyText: { fontSize: 24 },
  skip: { fontSize: 13, marginTop: 24 },
});
