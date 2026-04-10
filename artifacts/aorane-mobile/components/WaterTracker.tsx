import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import * as Haptics from "expo-haptics";

type Props = {
  current: number;
  goal: number;
  onAdd: () => void;
  minimal?: boolean;
};

export function WaterTracker({ current, goal, onAdd, minimal = false }: Props) {
  const colors = useColors();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  const handleAdd = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAdd();
  };

  if (minimal) {
    return (
      <View style={styles.minimalRoot}>
        <View style={styles.minHeader}>
          <View style={styles.minTitle}>
            <Ionicons name="water" size={15} color={isDark ? "#38BDF8" : "#0077B6"} />
            <Text style={[styles.minLabel, { color: isDark ? "rgba(255,255,255,0.5)" : "rgba(10,22,40,0.5)", fontFamily: "Inter_500Medium" }]}>
              Paani
            </Text>
          </View>
          <TouchableOpacity onPress={handleAdd} style={[styles.minAdd, { backgroundColor: isDark ? "rgba(56,189,248,0.15)" : "rgba(0,119,182,0.1)" }]}>
            <Ionicons name="add" size={16} color={isDark ? "#38BDF8" : "#0077B6"} />
          </TouchableOpacity>
        </View>
        <Text style={[styles.minNum, { color: isDark ? "#38BDF8" : "#0077B6", fontFamily: "Inter_700Bold" }]}>{current}</Text>
        <Text style={[styles.minSub, { color: isDark ? "rgba(255,255,255,0.35)" : "rgba(10,22,40,0.4)", fontFamily: "Inter_400Regular" }]}>
          /{goal} glasses
        </Text>
        <View style={[styles.minBar, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }]}>
          <View
            style={[
              styles.minBarFill,
              {
                width: `${Math.min(100, (current / goal) * 100)}%`,
                backgroundColor: isDark ? "#38BDF8" : "#0077B6",
              },
            ]}
          />
        </View>
        <Text style={[styles.minSub, { color: isDark ? "rgba(255,255,255,0.3)" : "rgba(10,22,40,0.35)", fontFamily: "Inter_400Regular", marginTop: 4 }]}>
          {current * 250}ml
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="water" size={17} color={isDark ? "#38BDF8" : "#0077B6"} />
          <Text style={[styles.title, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>
            Paani
          </Text>
        </View>
        <TouchableOpacity onPress={handleAdd} style={[styles.addBtn, { backgroundColor: isDark ? "rgba(56,189,248,0.15)" : "rgba(0,119,182,0.1)" }]}>
          <Ionicons name="add" size={18} color={isDark ? "#38BDF8" : "#0077B6"} />
        </TouchableOpacity>
      </View>
      <View style={styles.glassRow}>
        {Array.from({ length: goal }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.glass,
              {
                backgroundColor: i < current ? (isDark ? "#38BDF8" : "#0077B6") : (isDark ? "rgba(255,255,255,0.1)" : "rgba(0,119,182,0.1)"),
                opacity: i < current ? 1 : 0.4,
              },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.count, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular" }]}>
        {current} / {goal} · {current * 250}ml
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { fontSize: 14 },
  addBtn: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  glassRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 8 },
  glass: { width: 15, height: 19, borderRadius: 4 },
  count: { fontSize: 12 },
  minimalRoot: { flex: 1 },
  minHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  minTitle: { flexDirection: "row", alignItems: "center", gap: 5 },
  minLabel: { fontSize: 12, letterSpacing: 0.3 },
  minAdd: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  minNum: { fontSize: 28 },
  minSub: { fontSize: 12, marginBottom: 8 },
  minBar: { height: 4, borderRadius: 2, overflow: "hidden" },
  minBarFill: { height: 4, borderRadius: 2 },
});
