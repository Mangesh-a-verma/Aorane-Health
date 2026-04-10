import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Platform, ActivityIndicator, useColorScheme, Image,
  Animated, Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { GlassCard } from "@/components/GlassCard";
import { HealthRing } from "@/components/HealthRing";
import { WaterTracker } from "@/components/WaterTracker";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import * as Haptics from "expo-haptics";

const { width: W } = Dimensions.get("window");

function todayDate() { return new Date().toISOString().slice(0, 10); }

function MetricCard({ icon, label, value, unit, color, bgColors, pct }: { icon: string; label: string; value: string | number; unit: string; color: string; bgColors: string[]; pct?: number }) {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const barAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (pct !== undefined) {
      Animated.timing(barAnim, { toValue: pct / 100, duration: 1000, useNativeDriver: false }).start();
    }
  }, [pct]);
  const barWidth = barAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <View style={[metricStyles.card, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.8)", borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.9)" }]}>
      <LinearGradient colors={bgColors} style={metricStyles.iconBox}>
        <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={18} color="#FFF" />
      </LinearGradient>
      <Text style={[metricStyles.val, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>
        {value}<Text style={[metricStyles.unit, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular" }]}> {unit}</Text>
      </Text>
      <Text style={[metricStyles.label, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular" }]}>{label}</Text>
      {pct !== undefined && (
        <View style={[metricStyles.barTrack, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }]}>
          <Animated.View style={[metricStyles.barFill, { width: barWidth, backgroundColor: color }]} />
        </View>
      )}
    </View>
  );
}

const metricStyles = StyleSheet.create({
  card: { flex: 1, borderRadius: 18, borderWidth: 1, padding: 14, gap: 6, minHeight: 110 },
  iconBox: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  val: { fontSize: 22 },
  unit: { fontSize: 13 },
  label: { fontSize: 12 },
  barTrack: { height: 4, borderRadius: 2, overflow: "hidden", marginTop: 2 },
  barFill: { height: 4, borderRadius: 2 },
});

function StatPill({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  return (
    <View style={[pillStyles.root, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.75)", borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.9)" }]}>
      <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={16} color={color} />
      <View>
        <Text style={[pillStyles.val, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>{value}</Text>
        <Text style={[pillStyles.label, { color: isDark ? "rgba(255,255,255,0.35)" : "rgba(10,22,40,0.4)", fontFamily: "Inter_400Regular" }]}>{label}</Text>
      </View>
    </View>
  );
}

const pillStyles = StyleSheet.create({
  root: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, borderWidth: 1, flex: 1 },
  val: { fontSize: 14 },
  label: { fontSize: 11 },
});

export default function DashboardScreen() {
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

  const scrollY = useRef(new Animated.Value(0)).current;
  const headerOpacity = scrollY.interpolate({ inputRange: [0, 60], outputRange: [0, 1], extrapolate: "clamp" });

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 5) setGreeting("Shubh Ratri 🌙");
    else if (h < 12) setGreeting("Suprabhat 🌅");
    else if (h < 17) setGreeting("Namaskar ☀️");
    else setGreeting("Shubh Sham 🌆");
    loadData();
  }, []);

  const loadData = useCallback(async () => {
    try {
      const date = todayDate();
      const [scoreRes, waterRes, foodRes, exerciseRes] = await Promise.allSettled([
        api.getHealthScore(date), api.getWaterLog(date), api.getFoodSummary(date), api.getExerciseLogs(date),
      ]);
      if (scoreRes.status === "fulfilled") {
        const s = scoreRes.value.score as Record<string, number>;
        setHealthScore(s.healthScore ?? 0);
        setConfidence(Number(s.dataConfidencePct) ?? 0);
      }
      if (waterRes.status === "fulfilled") setWater({ current: waterRes.value.totalGlasses || 0, goal: waterRes.value.goal || 8 });
      if (foodRes.status === "fulfilled") {
        const summ = foodRes.value.summary as Record<string, number>;
        setCalories((c) => ({ ...c, eaten: Math.round(summ.totalCalories || 0) }));
      }
      if (exerciseRes.status === "fulfilled") {
        const logs = exerciseRes.value.logs as Array<{ durationMinutes: number; caloriesBurned?: string }>;
        setExerciseMin(logs.reduce((s, l) => s + l.durationMinutes, 0));
        setCalories((c) => ({ ...c, burned: Math.round(logs.reduce((s, l) => s + Number(l.caloriesBurned || 0), 0)) }));
      }
    } catch { }
    setIsLoading(false); setRefreshing(false);
  }, []);

  const handleAddWater = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try { await api.logWater(1); setWater((w) => ({ ...w, current: w.current + 1 })); } catch { }
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const remaining = Math.max(0, calories.goal - calories.eaten + calories.burned);
  const calPct = Math.min(100, (calories.eaten / calories.goal) * 100);
  const waterPct = Math.min(100, (water.current / water.goal) * 100);

  if (isLoading) {
    return (
      <View style={styles.root}>
        <LinearGradient
          colors={isDark
            ? ["#010814", "#031628", "#051E30", "#061A2A"]
            : ["#C8E9FA", "#D9F4EE", "#E8F4FF", "#D4F0F7"]}
          locations={[0, 0.3, 0.65, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 14 }}>
          <ActivityIndicator size="large" color={isDark ? "#38BDF8" : "#0077B6"} />
          <Text style={[styles.loadText, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.4)", fontFamily: "Inter_400Regular" }]}>
            Aapka health data load ho raha hai...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={isDark
          ? ["#010814", "#031628", "#051E30", "#061A2A"]
          : ["#C8E9FA", "#D9F4EE", "#E8F4FF", "#D4F0F7"]}
        locations={[0, 0.3, 0.65, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Orbs — more vivid */}
      <View style={[styles.orb1, { backgroundColor: isDark ? "#0369A1" : "#7DD3FC" }]} />
      <View style={[styles.orb2, { backgroundColor: isDark ? "#065F46" : "#6EE7B7" }]} />
      <View style={[styles.orb3, { backgroundColor: isDark ? "#1E3A5F" : "#BAE6FD" }]} />

      {/* Sticky header on scroll */}
      <Animated.View style={[styles.stickyHeader, { opacity: headerOpacity, top: topPad, backgroundColor: isDark ? "rgba(4,20,40,0.9)" : "rgba(232,244,253,0.95)" }]}>
        {Platform.OS === "ios" && <BlurView intensity={60} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />}
        <Image source={require("../../assets/images/aorane-logo.png")} style={styles.stickyLogo} resizeMode="contain" />
        <Text style={[styles.stickyScore, { color: isDark ? "#38BDF8" : "#0077B6", fontFamily: "Inter_700Bold" }]}>{healthScore}</Text>
      </Animated.View>

      <Animated.ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: topPad + 8, paddingBottom: insets.bottom + 90, paddingHorizontal: 18 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={isDark ? "#38BDF8" : "#0077B6"} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.topBar}>
          <View>
            <Image source={require("../../assets/images/aorane-logo.png")} style={styles.headerLogo} resizeMode="contain" />
            <Text style={[styles.greeting, { color: isDark ? "rgba(255,255,255,0.45)" : "rgba(10,22,40,0.5)", fontFamily: "Inter_400Regular" }]}>{greeting}</Text>
          </View>
          <TouchableOpacity style={[styles.notifBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.8)", borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,119,182,0.15)" }]}>
            <Ionicons name="notifications-outline" size={19} color={isDark ? "#38BDF8" : "#0077B6"} />
            <View style={styles.notifDot} />
          </TouchableOpacity>
        </View>

        {/* Hero Health Score */}
        <View style={styles.heroWrap}>
          <LinearGradient
            colors={isDark ? ["rgba(3,105,161,0.18)", "rgba(6,95,70,0.12)", "rgba(255,255,255,0.03)"] : ["rgba(186,230,253,0.6)", "rgba(167,243,208,0.4)", "rgba(255,255,255,0.8)"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[styles.heroGradBorder, { padding: 1.5 }]}
          >
            <View style={[styles.heroCard, { backgroundColor: isDark ? "rgba(4,14,30,0.82)" : "rgba(255,255,255,0.88)" }]}>
              {Platform.OS === "ios" && <BlurView intensity={50} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />}
              <View style={styles.heroTop}>
                <View>
                  <Text style={[styles.heroLabel, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular" }]}>Aaj ka Score</Text>
                  <Text style={[styles.heroDate, { color: isDark ? "rgba(255,255,255,0.25)" : "rgba(10,22,40,0.3)", fontFamily: "Inter_400Regular" }]}>
                    {new Date().toLocaleDateString("hi-IN", { weekday: "long", day: "numeric", month: "short" })}
                  </Text>
                </View>
                <View style={[styles.heroBadge, { backgroundColor: healthScore >= 70 ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)" }]}>
                  <Ionicons name={healthScore >= 70 ? "trending-up" : "trending-down"} size={14} color={healthScore >= 70 ? "#10B981" : "#F59E0B"} />
                  <Text style={[styles.heroBadgeText, { color: healthScore >= 70 ? "#10B981" : "#F59E0B", fontFamily: "Inter_600SemiBold" }]}>
                    {healthScore >= 70 ? "Good" : "Improve"}
                  </Text>
                </View>
              </View>
              <View style={styles.heroBody}>
                <HealthRing score={healthScore} confidence={confidence} size={158} />
                <View style={styles.heroSideStats}>
                  <StatPill icon="flame" label="Calories" value={`${calories.eaten}`} color="#F59E0B" />
                  <StatPill icon="barbell-outline" label="Exercise" value={`${exerciseMin}m`} color={isDark ? "#2DD4BF" : "#1B998B"} />
                  <StatPill icon="water-outline" label="Paani" value={`${water.current}/${water.goal}`} color={isDark ? "#38BDF8" : "#0077B6"} />
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* 2x2 Metric Cards */}
        <View style={styles.metricsGrid}>
          <View style={{ flex: 1, gap: 12 }}>
            <MetricCard
              icon="restaurant-outline" label="Calories Eaten" value={calories.eaten} unit="kcal"
              color="#F59E0B" bgColors={["#F59E0B", "#EF4444"]} pct={calPct}
            />
            <MetricCard
              icon="barbell-outline" label="Exercise" value={exerciseMin} unit="min"
              color={isDark ? "#2DD4BF" : "#1B998B"} bgColors={["#0D9488", "#1B998B"]}
            />
          </View>
          <View style={{ flex: 1, gap: 12 }}>
            <MetricCard
              icon="water-outline" label="Paani" value={water.current} unit="glasses"
              color={isDark ? "#38BDF8" : "#0077B6"} bgColors={["#0369A1", "#0EA5E9"]} pct={waterPct}
            />
            <MetricCard
              icon="flame-outline" label="Burned" value={calories.burned} unit="kcal"
              color="#EF4444" bgColors={["#DC2626", "#F87171"]}
            />
          </View>
        </View>

        {/* Water Tracker Card */}
        <View style={styles.waterCardWrap}>
          <LinearGradient
            colors={isDark ? ["rgba(3,105,161,0.2)", "rgba(6,95,70,0.12)"] : ["rgba(186,230,253,0.5)", "rgba(167,243,208,0.4)"]}
            style={[styles.waterGradBorder, { padding: 1.5 }]}
          >
            <View style={[styles.waterCard, { backgroundColor: isDark ? "rgba(4,14,30,0.82)" : "rgba(255,255,255,0.88)" }]}>
              {Platform.OS === "ios" && <BlurView intensity={40} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />}
              <WaterTracker current={water.current} goal={water.goal} onAdd={handleAddWater} />
            </View>
          </LinearGradient>
        </View>

        {/* Daily Tip */}
        <View style={styles.tipWrap}>
          <LinearGradient
            colors={isDark ? ["rgba(56,189,248,0.18)", "rgba(45,212,191,0.1)", "rgba(255,255,255,0)"] : ["rgba(0,119,182,0.1)", "rgba(27,153,139,0.08)", "rgba(255,255,255,0)"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[styles.tipGradBorder, { padding: 1.5 }]}
          >
            <View style={[styles.tipCard, { backgroundColor: isDark ? "rgba(4,14,30,0.7)" : "rgba(255,255,255,0.75)" }]}>
              <LinearGradient colors={["#0077B6", "#1B998B"]} style={styles.tipIconBox}>
                <Ionicons name="bulb" size={16} color="#FFF" />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={[styles.tipLabel, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_500Medium" }]}>AAJ KA TIP</Text>
                <Text style={[styles.tipText, { color: isDark ? "rgba(255,255,255,0.85)" : "#0A1628", fontFamily: "Inter_400Regular" }]}>
                  Subah 2 glass paani pine se metabolism 24% badhta hai. Try karein! 💧
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Summary */}
        <View style={styles.summaryWrap}>
          <LinearGradient
            colors={isDark ? ["rgba(255,255,255,0.07)", "rgba(255,255,255,0.04)"] : ["rgba(255,255,255,0.9)", "rgba(255,255,255,0.7)"]}
            style={[styles.summaryGradBorder, { padding: 1 }]}
          >
            <View style={[styles.summaryCard, { backgroundColor: isDark ? "rgba(4,14,30,0.8)" : "rgba(255,255,255,0.88)" }]}>
              <View style={styles.summaryHeader}>
                <Text style={[styles.summaryTitle, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>Aaj ka Summary</Text>
                <TouchableOpacity style={[styles.detailBtn, { backgroundColor: isDark ? "rgba(56,189,248,0.1)" : "rgba(0,119,182,0.08)" }]}>
                  <Text style={[styles.detailText, { color: isDark ? "#38BDF8" : "#0077B6", fontFamily: "Inter_500Medium" }]}>Details</Text>
                </TouchableOpacity>
              </View>
              {[
                { icon: "restaurant-outline", color: "#F59E0B", label: "Calories Khaaye", value: `${calories.eaten} kcal`, pct: calPct },
                { icon: "water-outline", color: isDark ? "#38BDF8" : "#0077B6", label: "Paani Piya", value: `${water.current}/${water.goal} glass`, pct: waterPct },
                { icon: "barbell-outline", color: isDark ? "#2DD4BF" : "#1B998B", label: "Exercise", value: `${exerciseMin} min`, pct: Math.min(100, (exerciseMin / 30) * 100) },
                { icon: "flame-outline", color: "#F87171", label: "Calories Jalaaye", value: `${calories.burned} kcal`, pct: Math.min(100, (calories.burned / 300) * 100) },
              ].map((row, idx, arr) => (
                <View key={row.label} style={[styles.summRow, { borderBottomColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)", borderBottomWidth: idx < arr.length - 1 ? 1 : 0 }]}>
                  <View style={styles.summLeft}>
                    <View style={[styles.summIcon, { backgroundColor: `${row.color}18` }]}>
                      <Ionicons name={row.icon as keyof typeof Ionicons.glyphMap} size={15} color={row.color} />
                    </View>
                    <View>
                      <Text style={[styles.summLabel, { color: isDark ? "rgba(255,255,255,0.65)" : "rgba(10,22,40,0.65)", fontFamily: "Inter_400Regular" }]}>{row.label}</Text>
                      <View style={[styles.summBar, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }]}>
                        <View style={[styles.summBarFill, { width: `${row.pct}%`, backgroundColor: row.color }]} />
                      </View>
                    </View>
                  </View>
                  <Text style={[styles.summValue, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>{row.value}</Text>
                </View>
              ))}
            </View>
          </LinearGradient>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loadText: { fontSize: 14 },
  orb1: { position: "absolute", width: 380, height: 380, borderRadius: 190, top: -130, right: -110, opacity: 0.52 },
  orb2: { position: "absolute", width: 300, height: 300, borderRadius: 150, bottom: 60, left: -90, opacity: 0.46 },
  orb3: { position: "absolute", width: 180, height: 180, borderRadius: 90, top: "40%", right: -50, opacity: 0.38 },
  stickyHeader: { position: "absolute", left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 18, paddingVertical: 10, zIndex: 100, overflow: "hidden" },
  stickyLogo: { width: 130, height: 42 },
  stickyScore: { fontSize: 22 },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 },
  headerLogo: { width: 180, height: 58 },
  greeting: { fontSize: 12, marginTop: 3 },
  notifBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  notifDot: { position: "absolute", top: 9, right: 9, width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#EF4444" },
  heroWrap: { marginBottom: 14 },
  heroGradBorder: { borderRadius: 26 },
  heroCard: { borderRadius: 25, overflow: "hidden", padding: 18 },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  heroLabel: { fontSize: 13 },
  heroDate: { fontSize: 12, marginTop: 2 },
  heroBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  heroBadgeText: { fontSize: 12 },
  heroBody: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroSideStats: { flex: 1, paddingLeft: 14, gap: 10 },
  metricsGrid: { flexDirection: "row", gap: 12, marginBottom: 14 },
  waterCardWrap: { marginBottom: 14 },
  waterGradBorder: { borderRadius: 22 },
  waterCard: { borderRadius: 21, overflow: "hidden", padding: 18 },
  tipWrap: { marginBottom: 14 },
  tipGradBorder: { borderRadius: 20 },
  tipCard: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 19, padding: 16, overflow: "hidden" },
  tipIconBox: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  tipLabel: { fontSize: 10, letterSpacing: 0.8, marginBottom: 4 },
  tipText: { fontSize: 13, lineHeight: 19 },
  summaryWrap: { marginBottom: 8 },
  summaryGradBorder: { borderRadius: 24 },
  summaryCard: { borderRadius: 23, overflow: "hidden", padding: 18 },
  summaryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  summaryTitle: { fontSize: 17 },
  detailBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10 },
  detailText: { fontSize: 13 },
  summRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12 },
  summLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  summIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  summLabel: { fontSize: 13, marginBottom: 5 },
  summBar: { width: 100, height: 3, borderRadius: 1.5, overflow: "hidden" },
  summBarFill: { height: 3, borderRadius: 1.5 },
  summValue: { fontSize: 14 },
});
