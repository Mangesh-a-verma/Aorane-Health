import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Platform, ActivityIndicator, useColorScheme, Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { GlassCard } from "@/components/GlassCard";
import { GradientBackground } from "@/components/GradientBackground";
import { HealthRing } from "@/components/HealthRing";
import { WaterTracker } from "@/components/WaterTracker";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function DashboardScreen() {
  const colors = useColors();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [healthScore, setHealthScore] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [water, setWater] = useState({ current: 0, goal: 8 });
  const [calories, setCalories] = useState({ eaten: 0, goal: 2000, burned: 0 });
  const [exerciseMin, setExerciseMin] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [greeting, setGreeting] = useState("Namaste");

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) setGreeting("Suprabhat 🌅");
    else if (h < 17) setGreeting("Namaskar ☀️");
    else setGreeting("Shubh Sham 🌙");
    loadData();
  }, []);

  const loadData = useCallback(async () => {
    try {
      const date = todayDate();
      const [scoreRes, waterRes, foodRes, exerciseRes] = await Promise.allSettled([
        api.getHealthScore(date),
        api.getWaterLog(date),
        api.getFoodSummary(date),
        api.getExerciseLogs(date),
      ]);
      if (scoreRes.status === "fulfilled") {
        const s = scoreRes.value.score as Record<string, number>;
        setHealthScore(s.healthScore ?? 0);
        setConfidence(Number(s.dataConfidencePct) ?? 0);
      }
      if (waterRes.status === "fulfilled") {
        setWater({ current: waterRes.value.totalGlasses || 0, goal: waterRes.value.goal || 8 });
      }
      if (foodRes.status === "fulfilled") {
        const summ = foodRes.value.summary as Record<string, number>;
        setCalories({ eaten: Math.round(summ.totalCalories || 0), goal: 2000, burned: 0 });
      }
      if (exerciseRes.status === "fulfilled") {
        const logs = exerciseRes.value.logs as Array<{ durationMinutes: number; caloriesBurned?: string }>;
        const totalMin = logs.reduce((s, l) => s + l.durationMinutes, 0);
        const totalBurned = logs.reduce((s, l) => s + Number(l.caloriesBurned || 0), 0);
        setExerciseMin(totalMin);
        setCalories((c) => ({ ...c, burned: Math.round(totalBurned) }));
      }
    } catch { }
    setIsLoading(false);
    setRefreshing(false);
  }, []);

  const handleAddWater = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await api.logWater(1);
      setWater((w) => ({ ...w, current: w.current + 1 }));
    } catch { }
  };

  const onRefresh = () => { setRefreshing(true); loadData(); };
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const remaining = Math.max(0, calories.goal - calories.eaten + calories.burned);

  if (isLoading) {
    return (
      <GradientBackground>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={isDark ? "#38BDF8" : "#0077B6"} />
        </View>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <ScrollView
        contentContainerStyle={{ paddingTop: topPad + 8, paddingBottom: insets.bottom + 90 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={isDark ? "#38BDF8" : "#0077B6"} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.topBar}>
          <View style={styles.headerLeft}>
            <Image
              source={require("../../assets/images/aorane-logo.png")}
              style={styles.headerLogo}
              resizeMode="contain"
            />
            <Text style={[styles.greeting, { color: isDark ? "rgba(255,255,255,0.5)" : "rgba(10,22,40,0.5)", fontFamily: "Inter_400Regular" }]}>
              {greeting}
            </Text>
          </View>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.75)", borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,119,182,0.15)" }]}>
            <Ionicons name="notifications-outline" size={20} color={isDark ? "#F0F8FF" : "#0077B6"} />
          </TouchableOpacity>
        </View>

        {/* Health Score Hero */}
        <GlassCard style={styles.heroCard}>
          <Text style={[styles.heroTitle, { color: isDark ? "rgba(255,255,255,0.55)" : "rgba(10,22,40,0.55)", fontFamily: "Inter_500Medium" }]}>
            Aaj ka Health Score
          </Text>
          <View style={styles.heroContent}>
            <HealthRing score={healthScore} confidence={confidence} size={160} />
            <View style={styles.heroStats}>
              <MiniStat icon="flame" color="#FCD34D" label="Calories" value={`${calories.eaten} kcal`} isDark={isDark} />
              <MiniStat icon="barbell-outline" color={isDark ? "#2DD4BF" : "#1B998B"} label="Exercise" value={`${exerciseMin} min`} isDark={isDark} />
              <MiniStat icon="water-outline" color={isDark ? "#38BDF8" : "#0077B6"} label="Paani" value={`${water.current}/${water.goal}`} isDark={isDark} />
            </View>
          </View>
        </GlassCard>

        {/* Calorie + Water */}
        <View style={styles.twoCol}>
          <GlassCard style={[styles.halfCard, { flex: 1.1 }]}>
            <Text style={[styles.cardLabel, { color: isDark ? "rgba(255,255,255,0.5)" : "rgba(10,22,40,0.5)", fontFamily: "Inter_500Medium" }]}>Calories</Text>
            <Text style={[styles.bigNum, { color: isDark ? "#FCD34D" : "#D97706", fontFamily: "Inter_700Bold" }]}>{calories.eaten}</Text>
            <Text style={[styles.smallUnit, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.4)", fontFamily: "Inter_400Regular" }]}>kcal eaten</Text>
            <View style={[styles.barBg, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }]}>
              <LinearGradient
                colors={["#F59E0B", "#EF4444"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.barFill, { width: `${Math.min(100, (calories.eaten / calories.goal) * 100)}%` }]}
              />
            </View>
            <Text style={[styles.smallUnit, { color: isDark ? "rgba(255,255,255,0.35)" : "rgba(10,22,40,0.4)", fontFamily: "Inter_400Regular", marginTop: 4 }]}>
              {remaining} kcal left
            </Text>
          </GlassCard>
          <GlassCard style={[styles.halfCard, { flex: 1 }]}>
            <WaterTracker current={water.current} goal={water.goal} onAdd={handleAddWater} minimal />
          </GlassCard>
        </View>

        {/* Tip Banner */}
        <GlassCard style={styles.tipCard}>
          <LinearGradient
            colors={isDark ? ["rgba(56,189,248,0.15)", "rgba(45,212,191,0.1)"] : ["rgba(0,119,182,0.08)", "rgba(27,153,139,0.08)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.tipGrad}
          >
            <Ionicons name="bulb-outline" size={20} color={isDark ? "#38BDF8" : "#0077B6"} />
            <Text style={[styles.tipText, { color: isDark ? "rgba(255,255,255,0.8)" : "#0A1628", fontFamily: "Inter_400Regular" }]}>
              Subah 2 glass paani pine se metabolism 24% badhta hai 💧
            </Text>
          </LinearGradient>
        </GlassCard>

        {/* Today Summary */}
        <GlassCard style={styles.summaryCard}>
          <Text style={[styles.sectionTitle, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>Aaj ka Summary</Text>
          {[
            { icon: "restaurant-outline", iconColor: "#FCD34D", label: "Calories Khaaye", value: `${calories.eaten} kcal` },
            { icon: "water-outline", iconColor: isDark ? "#38BDF8" : "#0077B6", label: "Paani Piya", value: `${water.current}/${water.goal} glass` },
            { icon: "barbell-outline", iconColor: isDark ? "#2DD4BF" : "#1B998B", label: "Exercise", value: `${exerciseMin} min` },
            { icon: "flame-outline", iconColor: "#F87171", label: "Calories Burned", value: `${calories.burned} kcal` },
          ].map((row) => (
            <View key={row.label} style={[styles.summaryRow, { borderBottomColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)" }]}>
              <View style={styles.summaryLeft}>
                <Ionicons name={row.icon as keyof typeof Ionicons.glyphMap} size={17} color={row.iconColor} />
                <Text style={[styles.summaryLabel, { color: isDark ? "rgba(255,255,255,0.65)" : "rgba(10,22,40,0.65)", fontFamily: "Inter_400Regular" }]}>{row.label}</Text>
              </View>
              <Text style={[styles.summaryValue, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>{row.value}</Text>
            </View>
          ))}
        </GlassCard>
      </ScrollView>
    </GradientBackground>
  );
}

function MiniStat({ icon, color, label, value, isDark }: { icon: string; color: string; label: string; value: string; isDark: boolean }) {
  return (
    <View style={miniStyles.row}>
      <View style={[miniStyles.iconBox, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={16} color={color} />
      </View>
      <View>
        <Text style={[miniStyles.value, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>{value}</Text>
        <Text style={[miniStyles.label, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular" }]}>{label}</Text>
      </View>
    </View>
  );
}

const miniStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  iconBox: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  value: { fontSize: 15 },
  label: { fontSize: 12 },
});

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 18, marginBottom: 16 },
  headerLeft: { gap: 2 },
  headerLogo: { width: 120, height: 38 },
  greeting: { fontSize: 12 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  heroCard: { marginHorizontal: 18, marginBottom: 14, padding: 18 },
  heroTitle: { fontSize: 13, marginBottom: 14, letterSpacing: 0.3 },
  heroContent: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroStats: { flex: 1, paddingLeft: 16 },
  twoCol: { flexDirection: "row", gap: 12, paddingHorizontal: 18, marginBottom: 14 },
  halfCard: { padding: 16 },
  cardLabel: { fontSize: 12, marginBottom: 6, letterSpacing: 0.3 },
  bigNum: { fontSize: 28 },
  smallUnit: { fontSize: 12 },
  barBg: { height: 5, borderRadius: 3, marginTop: 10, overflow: "hidden" },
  barFill: { height: 5, borderRadius: 3 },
  tipCard: { marginHorizontal: 18, marginBottom: 14, overflow: "hidden" },
  tipGrad: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  tipText: { flex: 1, fontSize: 13, lineHeight: 18 },
  summaryCard: { marginHorizontal: 18, padding: 18, marginBottom: 8 },
  sectionTitle: { fontSize: 17, marginBottom: 14 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 11, borderBottomWidth: 1 },
  summaryLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  summaryLabel: { fontSize: 14 },
  summaryValue: { fontSize: 14 },
});
