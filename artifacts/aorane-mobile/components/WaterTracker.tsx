import React, { useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

type Props = { current: number; goal: number; onAdd: () => void; minimal?: boolean };

export function WaterTracker({ current, goal, onAdd, minimal = false }: Props) {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const pct = Math.min(1, current / goal);
  const fillAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fillAnim, { toValue: pct, duration: 800, useNativeDriver: false }).start();
  }, [pct]);

  const fillHeight = fillAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  const handleAdd = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onAdd(); };

  if (minimal) {
    return (
      <View style={styles.minRoot}>
        <View style={styles.minHeader}>
          <View style={styles.minLeft}>
            <LinearGradient colors={["#0369A1", "#0EA5E9"]} style={styles.minIcon}>
              <Ionicons name="water" size={14} color="#FFF" />
            </LinearGradient>
            <Text style={[styles.minLabel, { color: isDark ? "rgba(255,255,255,0.5)" : "rgba(10,22,40,0.5)", fontFamily: "Inter_500Medium" }]}>Paani</Text>
          </View>
          <TouchableOpacity onPress={handleAdd} style={[styles.minAddBtn, { backgroundColor: isDark ? "rgba(56,189,248,0.12)" : "rgba(0,119,182,0.1)" }]}>
            <Ionicons name="add" size={16} color={isDark ? "#38BDF8" : "#0077B6"} />
          </TouchableOpacity>
        </View>
        <Text style={[styles.minNum, { color: isDark ? "#38BDF8" : "#0077B6", fontFamily: "Inter_700Bold" }]}>{current}<Text style={[styles.minGoal, { color: isDark ? "rgba(255,255,255,0.3)" : "rgba(10,22,40,0.35)", fontFamily: "Inter_400Regular" }]}>/{goal}</Text></Text>
        <Text style={[styles.minMl, { color: isDark ? "rgba(255,255,255,0.3)" : "rgba(10,22,40,0.35)", fontFamily: "Inter_400Regular" }]}>{current * 250}ml</Text>
        <View style={[styles.minTrack, { backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)" }]}>
          <LinearGradient colors={["#0369A1", "#0EA5E9"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.minFill, { width: `${pct * 100}%` }]} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.topRow}>
        <View style={styles.titleRow}>
          <LinearGradient colors={["#0369A1", "#0EA5E9"]} style={styles.headerIcon}>
            <Ionicons name="water" size={16} color="#FFF" />
          </LinearGradient>
          <View>
            <Text style={[styles.title, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>Paani</Text>
            <Text style={[styles.sub, { color: isDark ? "rgba(255,255,255,0.35)" : "rgba(10,22,40,0.4)", fontFamily: "Inter_400Regular" }]}>{current * 250}ml of {goal * 250}ml</Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleAdd} style={styles.addBtnWrap}>
          <LinearGradient colors={["#0077B6", "#1B998B"]} style={styles.addBtn}>
            <Ionicons name="add" size={20} color="#FFF" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Glass bottle visualization */}
      <View style={styles.bottleRow}>
        <View style={[styles.bottle, { borderColor: isDark ? "rgba(56,189,248,0.3)" : "rgba(0,119,182,0.25)" }]}>
          <Animated.View style={[styles.bottleFill, { height: fillHeight }]}>
            <LinearGradient colors={["#0EA5E9", "#0369A1"]} style={StyleSheet.absoluteFill} />
          </Animated.View>
          <View style={styles.bottleLabel}>
            <Text style={[styles.bottlePct, { color: pct > 0.5 ? "#FFF" : (isDark ? "#38BDF8" : "#0077B6"), fontFamily: "Inter_700Bold" }]}>
              {Math.round(pct * 100)}%
            </Text>
          </View>
        </View>
        <View style={styles.glassGrid}>
          {Array.from({ length: goal }).map((_, i) => (
            <TouchableOpacity key={i} onPress={handleAdd} activeOpacity={0.8}>
              <View style={[
                styles.glassChip,
                {
                  backgroundColor: i < current ? (isDark ? "rgba(56,189,248,0.2)" : "rgba(0,119,182,0.12)") : (isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"),
                  borderColor: i < current ? (isDark ? "#38BDF8" : "#0077B6") : (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"),
                },
              ]}>
                <Ionicons name="water" size={12} color={i < current ? (isDark ? "#38BDF8" : "#0077B6") : (isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)")} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.bottomRow}>
        <Text style={[styles.glassCount, { color: isDark ? "rgba(255,255,255,0.35)" : "rgba(10,22,40,0.4)", fontFamily: "Inter_400Regular" }]}>
          {current} of {goal} glasses · {goal - current > 0 ? `${(goal - current) * 250}ml baki hai` : "Goal complete! 🎉"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {},
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 15 },
  sub: { fontSize: 12, marginTop: 2 },
  addBtnWrap: { borderRadius: 18, overflow: "hidden" },
  addBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  bottleRow: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 12 },
  bottle: { width: 52, height: 100, borderRadius: 14, borderWidth: 2, overflow: "hidden", justifyContent: "flex-end", position: "relative" },
  bottleFill: { position: "absolute", bottom: 0, left: 0, right: 0 },
  bottleLabel: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  bottlePct: { fontSize: 13 },
  glassGrid: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  glassChip: { width: 34, height: 34, borderRadius: 10, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  bottomRow: {},
  glassCount: { fontSize: 12 },
  minRoot: {},
  minHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  minLeft: { flexDirection: "row", alignItems: "center", gap: 7 },
  minIcon: { width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  minLabel: { fontSize: 12, letterSpacing: 0.2 },
  minAddBtn: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  minNum: { fontSize: 26 },
  minGoal: { fontSize: 16 },
  minMl: { fontSize: 12, marginBottom: 8 },
  minTrack: { height: 5, borderRadius: 3, overflow: "hidden" },
  minFill: { height: 5, borderRadius: 3 },
});
