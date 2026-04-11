import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Platform, ActivityIndicator, Image,
  Animated, Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { HealthRing } from "@/components/HealthRing";
import { WaterTracker } from "@/components/WaterTracker";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import * as Haptics from "expo-haptics";

const { width: W } = Dimensions.get("window");

const C = {
  bg: "#F0FAFB",
  primary: "#0077B6",
  accent: "#00B896",
  card: "#FFFFFF",
  text: "#0D1F33",
  muted: "#7A90A4",
  border: "#E2EFF5",
  orange: "#FF8C00",
  red: "#EF4444",
  yellow: "#F59E0B",
};

function todayDate() { return new Date().toISOString().slice(0, 10); }

function MetricCard({ icon, label, value, unit, color, bgColors, pct }: {
  icon: string; label: string; value: string | number; unit: string;
  color: string; bgColors: [string, string]; pct?: number;
}) {
  const barAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (pct !== undefined) {
      Animated.timing(barAnim, { toValue: pct / 100, duration: 1000, useNativeDriver: false }).start();
    }
  }, [pct]);
  const barWidth = barAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <View style={mc.card}>
      <LinearGradient colors={bgColors} style={mc.iconBox}>
        <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={17} color="#FFF" />
      </LinearGradient>
      <Text style={mc.val}>
        {value}<Text style={mc.unit}> {unit}</Text>
      </Text>
      <Text style={mc.label}>{label}</Text>
      {pct !== undefined && (
        <View style={mc.barTrack}>
          <Animated.View style={[mc.barFill, { width: barWidth, backgroundColor: color }]} />
        </View>
      )}
    </View>
  );
}

const mc = StyleSheet.create({
  card: { flex: 1, borderRadius: 18, padding: 14, gap: 6, minHeight: 110, backgroundColor: C.card, shadowColor: C.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 4, borderWidth: 1, borderColor: C.border },
  iconBox: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  val: { fontSize: 22, fontFamily: "Inter_700Bold", color: C.text },
  unit: { fontSize: 13, fontFamily: "Inter_400Regular", color: C.muted },
  label: { fontSize: 12, fontFamily: "Inter_400Regular", color: C.muted },
  barTrack: { height: 4, borderRadius: 2, overflow: "hidden", marginTop: 2, backgroundColor: "#EEF3F7" },
  barFill: { height: 4, borderRadius: 2 },
});

function StatRow({ icon, label, value, color, pct }: {
  icon: string; label: string; value: string; color: string; pct: number;
}) {
  return (
    <View style={sr.row}>
      <View style={[sr.iconBox, { backgroundColor: color + "18" }]}>
        <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={15} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={sr.labelRow}>
          <Text style={sr.label}>{label}</Text>
          <Text style={[sr.val, { color }]}>{value}</Text>
        </View>
        <View style={sr.barTrack}>
          <View style={[sr.barFill, { width: `${Math.min(100, pct)}%`, backgroundColor: color }]} />
        </View>
      </View>
    </View>
  );
}

const sr = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F0F5F8" },
  iconBox: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  labelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  label: { fontSize: 13, color: C.muted, fontFamily: "Inter_400Regular" },
  val: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  barTrack: { height: 4, backgroundColor: "#EEF3F7", borderRadius: 2, overflow: "hidden" },
  barFill: { height: 4, borderRadius: 2 },
});

export default function DashboardScreen() {
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
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 5) setGreeting("Shubh Ratri 🌙");
    else if (h < 12) setGreeting("Suprabhat ☀️");
    else if (h < 17) setGreeting("Namaskar 🌤️");
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
    setIsLoading(false);
    setRefreshing(false);
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const handleAddWater = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try { await api.logWater({ glassesCount: 1 }); setWater((w) => ({ ...w, current: w.current + 1 })); } catch { }
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const remaining = Math.max(0, calories.goal - calories.eaten + calories.burned);
  const calPct = Math.min(100, (calories.eaten / calories.goal) * 100);
  const waterPct = Math.min(100, (water.current / water.goal) * 100);
  const exPct = Math.min(100, (exerciseMin / 30) * 100);

  if (isLoading) {
    return (
      <View style={[s.root, { alignItems: "center", justifyContent: "center", gap: 14 }]}>
        <LinearGradient colors={["#E8F7FB", "#F0FAF6", "#FFFFFF"]} style={StyleSheet.absoluteFill} />
        <View style={s.loadingRing}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
        <Text style={s.loadText}>Aapka health data load ho raha hai...</Text>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <LinearGradient colors={["#E8F7FB", "#F0FAF6", "#FFFFFF"]} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
      <View style={s.blob1} />
      <View style={s.blob2} />

      {/* Sticky header */}
      <Animated.View style={[s.stickyHeader, { opacity: headerOpacity, top: topPad }]}>
        <Image source={require("../../assets/images/aorane-logo.png")} style={s.stickyLogo} resizeMode="contain" />
        <View style={s.stickyScoreBadge}>
          <Ionicons name="heart" size={13} color={C.accent} />
          <Text style={s.stickyScoreText}>{healthScore}</Text>
        </View>
      </Animated.View>

      <Animated.ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: topPad + 8, paddingBottom: insets.bottom + 90, paddingHorizontal: 18 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={C.primary} colors={[C.primary]} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── TOP BAR ── */}
        <Animated.View style={[s.topBar, { opacity: fadeAnim }]}>
          <View>
            <Image source={require("../../assets/images/aorane-logo.png")} style={s.headerLogo} resizeMode="contain" />
            <Text style={s.greeting}>{greeting}</Text>
          </View>
          <TouchableOpacity style={s.notifBtn}>
            <Ionicons name="notifications-outline" size={18} color={C.primary} />
            <View style={s.notifDot} />
          </TouchableOpacity>
        </Animated.View>

        {/* ── HERO HEALTH SCORE CARD ── */}
        <Animated.View style={[s.heroCard, { opacity: fadeAnim }]}>
          <LinearGradient colors={["#0077B6", "#00B896"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.heroGrad}>
            <View style={s.heroTop}>
              <View>
                <Text style={s.heroSup}>Aaj ka Health Score</Text>
                <Text style={s.heroDate}>
                  {new Date().toLocaleDateString("hi-IN", { weekday: "long", day: "numeric", month: "short" })}
                </Text>
              </View>
              <View style={[s.heroBadge, { backgroundColor: healthScore >= 70 ? "rgba(255,255,255,0.25)" : "rgba(255,200,0,0.3)" }]}>
                <Ionicons name={healthScore >= 70 ? "trending-up" : "trending-down"} size={13} color="#FFF" />
                <Text style={s.heroBadgeText}>{healthScore >= 70 ? "Good" : "Improve"}</Text>
              </View>
            </View>

            <View style={s.heroBody}>
              <HealthRing score={healthScore} confidence={confidence} size={148} />
              <View style={s.heroStats}>
                {[
                  { icon: "flame", label: "Calories", val: `${calories.eaten}`, color: "#FFD166" },
                  { icon: "barbell-outline", label: "Exercise", val: `${exerciseMin}m`, color: "#A0F0E0" },
                  { icon: "water-outline", label: "Paani", val: `${water.current}/${water.goal}`, color: "#BAE6FD" },
                ].map(st => (
                  <View key={st.label} style={s.heroStatRow}>
                    <View style={[s.heroStatIcon, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
                      <Ionicons name={st.icon as keyof typeof Ionicons.glyphMap} size={14} color={st.color} />
                    </View>
                    <View>
                      <Text style={s.heroStatVal}>{st.val}</Text>
                      <Text style={s.heroStatLabel}>{st.label}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ── REMAINING CALORIES BANNER ── */}
        <Animated.View style={[s.remainCard, { opacity: fadeAnim }]}>
          <LinearGradient colors={["#FFF7ED", "#FFF"]} style={s.remainInner}>
            <View style={s.remainLeft}>
              <View style={[s.remainIcon, { backgroundColor: "#FF8C0018" }]}>
                <Ionicons name="flame" size={18} color={C.orange} />
              </View>
              <View>
                <Text style={s.remainLabel}>Baaki Calories</Text>
                <Text style={[s.remainVal, { color: C.orange }]}>{remaining} kcal</Text>
              </View>
            </View>
            <View style={s.remainDivider} />
            <View style={s.remainRight}>
              <Text style={s.remainSmall}>Goal: {calories.goal}</Text>
              <Text style={s.remainSmall}>Khaaye: {calories.eaten}</Text>
              <Text style={s.remainSmall}>Jalaaye: {calories.burned}</Text>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ── 2x2 METRIC CARDS ── */}
        <Animated.View style={[s.metricsGrid, { opacity: fadeAnim }]}>
          <View style={{ flex: 1, gap: 12 }}>
            <MetricCard icon="restaurant-outline" label="Calories Khaaye" value={calories.eaten} unit="kcal" color={C.yellow} bgColors={["#F59E0B", "#EF4444"]} pct={calPct} />
            <MetricCard icon="barbell-outline" label="Exercise" value={exerciseMin} unit="min" color={C.accent} bgColors={["#0D9488", "#00B896"]} pct={exPct} />
          </View>
          <View style={{ flex: 1, gap: 12 }}>
            <MetricCard icon="water-outline" label="Paani" value={water.current} unit="glass" color={C.primary} bgColors={["#0369A1", "#0077B6"]} pct={waterPct} />
            <MetricCard icon="flame-outline" label="Calories Jalaaye" value={calories.burned} unit="kcal" color={C.red} bgColors={["#DC2626", "#F87171"]} />
          </View>
        </Animated.View>

        {/* ── WATER TRACKER ── */}
        <Animated.View style={[s.sectionCard, { opacity: fadeAnim }]}>
          <WaterTracker current={water.current} goal={water.goal} onAdd={handleAddWater} />
        </Animated.View>

        {/* ── DAILY TIP ── */}
        <Animated.View style={[s.tipCard, { opacity: fadeAnim }]}>
          <LinearGradient colors={["#E8F7FB", "#F0FAF2"]} style={s.tipInner}>
            <LinearGradient colors={["#0077B6", "#00B896"]} style={s.tipIcon}>
              <Ionicons name="bulb" size={15} color="#FFF" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={s.tipHeading}>AAJ KA TIP</Text>
              <Text style={s.tipText}>Subah 2 glass paani pine se metabolism 24% badhta hai. Try karein! 💧</Text>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ── SUMMARY CARD ── */}
        <Animated.View style={[s.sectionCard, { opacity: fadeAnim }]}>
          <View style={s.summHeader}>
            <Text style={s.summTitle}>Aaj ka Summary</Text>
            <View style={s.summBadge}>
              <Ionicons name="bar-chart-outline" size={12} color={C.primary} />
              <Text style={s.summBadgeText}>Aaj</Text>
            </View>
          </View>
          <StatRow icon="restaurant-outline" label="Calories Khaaye" value={`${calories.eaten} kcal`} color={C.yellow} pct={calPct} />
          <StatRow icon="water-outline" label="Paani Piya" value={`${water.current}/${water.goal} glass`} color={C.primary} pct={waterPct} />
          <StatRow icon="barbell-outline" label="Exercise" value={`${exerciseMin} min`} color={C.accent} pct={exPct} />
          <View style={[sr.row, { borderBottomWidth: 0 }]}>
            <View style={[sr.iconBox, { backgroundColor: C.red + "18" }]}>
              <Ionicons name="flame-outline" size={15} color={C.red} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={sr.labelRow}>
                <Text style={sr.label}>Calories Jalaaye</Text>
                <Text style={[sr.val, { color: C.red }]}>{calories.burned} kcal</Text>
              </View>
              <View style={sr.barTrack}>
                <View style={[sr.barFill, { width: `${Math.min(100, (calories.burned / 300) * 100)}%`, backgroundColor: C.red }]} />
              </View>
            </View>
          </View>
        </Animated.View>
      </Animated.ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F0FAFB" },
  loadText: { fontSize: 14, color: C.muted, fontFamily: "Inter_400Regular" },
  loadingRing: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#FFF", alignItems: "center", justifyContent: "center", shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 6 },

  blob1: { position: "absolute", width: 300, height: 300, borderRadius: 150, backgroundColor: "#BAE6FD", opacity: 0.25, top: -80, right: -100 },
  blob2: { position: "absolute", width: 250, height: 250, borderRadius: 125, backgroundColor: "#A7F3D0", opacity: 0.2, bottom: 200, left: -80 },

  stickyHeader: { position: "absolute", left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 18, paddingVertical: 8, zIndex: 100, backgroundColor: "rgba(240,250,251,0.96)", borderBottomWidth: 1, borderBottomColor: "#E2EFF5" },
  stickyLogo: { width: 120, height: 36 },
  stickyScoreBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: "#E8F7F4", borderWidth: 1, borderColor: "#C0EDE5" },
  stickyScoreText: { fontSize: 14, fontFamily: "Inter_700Bold", color: C.accent },

  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  headerLogo: { width: 160, height: 50 },
  greeting: { fontSize: 12, color: C.muted, fontFamily: "Inter_400Regular", marginTop: 2 },
  notifBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#FFF", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border, shadowColor: C.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 },
  notifDot: { position: "absolute", top: 9, right: 9, width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.red },

  heroCard: { borderRadius: 24, marginBottom: 14, shadowColor: C.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 8 },
  heroGrad: { borderRadius: 24, padding: 18 },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  heroSup: { fontSize: 13, color: "rgba(255,255,255,0.8)", fontFamily: "Inter_500Medium" },
  heroDate: { fontSize: 11, color: "rgba(255,255,255,0.6)", fontFamily: "Inter_400Regular", marginTop: 2 },
  heroBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  heroBadgeText: { color: "#FFF", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  heroBody: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroStats: { flex: 1, paddingLeft: 14, gap: 10 },
  heroStatRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  heroStatIcon: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  heroStatVal: { fontSize: 14, color: "#FFF", fontFamily: "Inter_700Bold" },
  heroStatLabel: { fontSize: 10, color: "rgba(255,255,255,0.65)", fontFamily: "Inter_400Regular" },

  remainCard: { marginBottom: 14, borderRadius: 18, shadowColor: C.orange, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
  remainInner: { borderRadius: 18, flexDirection: "row", alignItems: "center", padding: 16, borderWidth: 1, borderColor: "#FFE8CC" },
  remainLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  remainIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  remainLabel: { fontSize: 12, color: C.muted, fontFamily: "Inter_400Regular" },
  remainVal: { fontSize: 20, fontFamily: "Inter_700Bold" },
  remainDivider: { width: 1, height: 40, backgroundColor: "#FFE0CC", marginHorizontal: 14 },
  remainRight: { gap: 2 },
  remainSmall: { fontSize: 11, color: C.muted, fontFamily: "Inter_400Regular" },

  metricsGrid: { flexDirection: "row", gap: 12, marginBottom: 14 },

  sectionCard: { backgroundColor: C.card, borderRadius: 20, padding: 18, marginBottom: 14, shadowColor: C.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 4, borderWidth: 1, borderColor: C.border },

  tipCard: { borderRadius: 18, marginBottom: 14, shadowColor: C.accent, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  tipInner: { borderRadius: 18, flexDirection: "row", alignItems: "flex-start", gap: 14, padding: 16, borderWidth: 1, borderColor: "#C0EDE5" },
  tipIcon: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  tipHeading: { fontSize: 10, letterSpacing: 1.2, color: C.accent, fontFamily: "Inter_600SemiBold", marginBottom: 5 },
  tipText: { fontSize: 13, color: C.text, fontFamily: "Inter_400Regular", lineHeight: 19 },

  summHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  summTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: C.text },
  summBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: "#EEF5FB" },
  summBadgeText: { fontSize: 11, color: C.primary, fontFamily: "Inter_500Medium" },
});
