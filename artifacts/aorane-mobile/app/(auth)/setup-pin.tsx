import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { storage } from "@/lib/storage";

const KEYS = ["1","2","3","4","5","6","7","8","9","","0","⌫"];

export default function SetupPinScreen() {
  const colors = useColors();
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

    if (key === "⌫") {
      setCurrentPin((p) => p.slice(0, -1));
      return;
    }

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
          setPin("");
          setConfirmPin("");
          setPhase("set");
        }
      }
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
      <View style={[styles.iconWrap, { backgroundColor: colors.tealLight }]}>
        <Ionicons name="lock-closed" size={32} color={colors.primary} />
      </View>
      <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
        {phase === "set" ? "App PIN Set Karein" : "PIN Confirm Karein"}
      </Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
        {phase === "set" ? "4 digit PIN choose karein" : "Same PIN dobara enter karein"}
      </Text>

      <View style={styles.dots}>
        {[0,1,2,3].map((i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: i < currentPin.length ? colors.primary : colors.muted,
                transform: [{ scale: i < currentPin.length ? 1.2 : 1 }],
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.keypad}>
        {KEYS.map((key, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => handleKey(key)}
            disabled={key === ""}
            style={[
              styles.key,
              {
                backgroundColor: key === "" ? "transparent" : colors.card,
                borderColor: colors.border,
              },
            ]}
            activeOpacity={0.7}
          >
            <Text style={[styles.keyText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              {key}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.skip, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
        Aap baad mein bhi set kar sakte hain
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", paddingHorizontal: 32 },
  iconWrap: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  title: { fontSize: 24, marginBottom: 8 },
  subtitle: { fontSize: 14, marginBottom: 40, textAlign: "center" },
  dots: { flexDirection: "row", gap: 16, marginBottom: 48 },
  dot: { width: 18, height: 18, borderRadius: 9 },
  keypad: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "center", width: "100%" },
  key: { width: 80, height: 80, borderRadius: 40, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  keyText: { fontSize: 24 },
  skip: { fontSize: 13, marginTop: 24 },
});
