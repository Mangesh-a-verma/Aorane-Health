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
import { AdsSlider } from "@/components/AdsSlider";
import { router } from "expo-router";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import * as Haptics from "expo-haptics";

const { width: W } = Dimensions.get("window");

const C = {
  bg: "#E8F6FF",
  primary: "#0077B6",
  skyBlue: "#0EA5E9",
  accent: "#00B896",
  green: "#10B981",
  card: "rgba(255,255,255,0.82)",
  cardBorder: "rgba(255,255,255,0.9)",
  text: "#0D1F33",
  muted: "#5B7A8E",
  border: "#C8E8F5",
  orange: "#F97316",
  red: "#EF4444",
  yellow: "#F59E0B",
};

function todayDate() { return new Date().toISOString().slice(0, 10); }

// ── SMALL METRIC CARD (glass style) ─────────────────────────────────────────
function MetricCard({ icon, label, value, unit, color, bgColors, pct }: {
  icon: string; label: string; value: string | number; unit: string;
  color: string; bgColors: [string, string]; pct?: number;
}) {
  const barAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (pct !== undefined) {
      Animated.timing(barAnim, { toValue: pct / 100, duration: 900, useNativeDriver: false }).start();
    }
  }, [pct]);
  const barWidth = barAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <View style={mc.card}>
      <LinearGradient colors={bgColors} style={mc.iconBox}>
        <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={14} color="#FFF" />
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
  card: {
    flex: 1, borderRadius: 16, padding: 11, gap: 4, minHeight: 90,
    backgroundColor: C.card,
    borderWidth: 1.2, borderColor: C.cardBorder,
    shadowColor: "#0077B6", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10, shadowRadius: 12, elevation: 5,
  },
  iconBox: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  val: { fontSize: 18, fontFamily: "Inter_700Bold", color: C.text, marginTop: 2 },
  unit: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.muted },
  label: { fontSize: 10.5, fontFamily: "Inter_400Regular", color: C.muted },
  barTrack: { height: 3, borderRadius: 2, overflow: "hidden", marginTop: 4, backgroundColor: "#E2EFF5" },
  barFill: { height: 3, borderRadius: 2 },
});

function StatRow({ icon, label, value, color, pct }: {
  icon: string; label: string; value: string; color: string; pct: number;
}) {
  return (
    <View style={sr.row}>
      <View style={[sr.iconBox, { backgroundColor: color + "20" }]}>
        <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={14} color={color} />
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
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "#F0F6FA" },
  iconBox: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  labelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  label: { fontSize: 12.5, color: C.muted, fontFamily: "Inter_400Regular" },
  val: { fontSize: 12.5, fontFamily: "Inter_600SemiBold" },
  barTrack: { height: 3.5, backgroundColor: "#E4F0F8", borderRadius: 2, overflow: "hidden" },
  barFill: { height: 3.5, borderRadius: 2 },
});

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [healthScore, setHealthScore] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [water, setWater] = useState({ current: 0, goal: 8 });
  const [calories, setCalories] = useState({ eaten: 0, goal: 2000, burned: 0 });
  const [exerciseMin, setExerciseMin] = useState(0);
  const [activeScore, setActiveScore] = useState<{
    overall: number; foodPct: number; waterPct: number; exercisePct: number; label: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [greeting, setGreeting] = useState("Good Morning");

  const scrollY = useRef(new Animated.Value(0)).current;
  const headerOpacity = scrollY.interpolate({ inputRange: [0, 60], outputRange: [0, 1], extrapolate: "clamp" });
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 5) setGreeting("Good Night 🌙");
    else if (h < 12) setGreeting("Good Morning ☀️");
    else if (h < 17) setGreeting("Good Afternoon 🌤️");
    else setGreeting("Good Evening 🌆");
    loadData();
  }, []);

  const loadData = useCallback(async () => {
    try {
      const date = todayDate();
      const [scoreRes, waterRes, foodRes, exerciseRes, activityRes] = await Promise.allSettled([
        api.getHealthScore(date), api.getWaterLog(date), api.getFoodSummary(date),
        api.getExerciseLogs(date), api.getActivityScore(date),
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
      if (activityRes.status === "fulfilled") {
        setActiveScore({
          overall: activityRes.value.overall,
          foodPct: activityRes.value.foodPct,
          waterPct: activityRes.value.waterPct,
          exercisePct: activityRes.value.exercisePct,
          label: activityRes.value.label,
        });
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
        <LinearGradient colors={["#BAE6FD", "#D1FAE5", "#F0FAFB"]} style={StyleSheet.absoluteFill} />
        <View style={s.loadingRing}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
        <Text style={s.loadText}>Loading your health data...</Text>
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* Rich sky-blue + white + green gradient background */}
      <LinearGradient
        colors={["#BAE6FD", "#E0F7F4", "#F0FAFB", "#FFFFFF"]}
        locations={[0, 0.3, 0.65, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Decorative blobs */}
      <View style={s.blob1} />
      <View style={s.blob2} />
      <View style={s.blob3} />

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
        {/* ── TOP BAR with BIG LOGO ── */}
        <Animated.View style={[s.topBar, { opacity: fadeAnim }]}>
          <View style={s.logoBlock}>
            {/* LARGE LOGO */}
            <Image source={require("../../assets/images/aorane-logo.png")} style={s.headerLogo} resizeMode="contain" />
            <Text style={s.greeting}>{greeting}</Text>
          </View>
          <TouchableOpacity style={s.notifBtn}>
            <Ionicons name="notifications-outline" size={20} color={C.primary} />
            <View style={s.notifDot} />
          </TouchableOpacity>
        </Animated.View>

        {/* ── HERO HEALTH SCORE CARD (glass 3D) ── */}
        <Animated.View style={[s.heroCard, { opacity: fadeAnim }]}>
          <LinearGradient
            colors={["#0077B6", "#0EA5E9", "#00B896"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={s.heroGrad}
          >
            {/* Glass shine overlay */}
            <View style={s.heroShine} />
            <View style={s.heroTop}>
              <View>
                <Text style={s.heroSup}>Today's Health Score</Text>
                <Text style={s.heroDate}>
                  {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
                </Text>
              </View>
              <View style={[s.heroBadge, { backgroundColor: healthScore >= 70 ? "rgba(255,255,255,0.22)" : "rgba(255,200,0,0.28)" }]}>
                <Ionicons name={healthScore >= 70 ? "trending-up" : "trending-down"} size={13} color="#FFF" />
                <Text style={s.heroBadgeText}>{healthScore >= 70 ? "Good" : "Improve"}</Text>
              </View>
            </View>

            <View style={s.heroBody}>
              <HealthRing score={healthScore} confidence={confidence} size={148} />
              <View style={s.heroStats}>
                {[
                  { icon: "flame", label: "Calories", val: `${calories.eaten}`, color: "#FFD166" },
                  { icon: "barbell-outline", label: "Exercise", val: `${exerciseMin}m`, color: "#A7F3D0" },
                  { icon: "water-outline", label: "Water", val: `${water.current}/${water.goal}`, color: "#BAE6FD" },
                ].map(st => (
                  <View key={st.label} style={s.heroStatRow}>
                    <View style={[s.heroStatIcon, { backgroundColor: "rgba(255,255,255,0.18)" }]}>
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

        {/* ── REMAINING CALORIES BANNER (glass) ── */}
        <Animated.View style={[s.remainCard, { opacity: fadeAnim }]}>
          <View style={s.remainInner}>
            <View style={s.remainLeft}>
              <View style={[s.remainIcon, { backgroundColor: "#FF8C0015" }]}>
                <Ionicons name="flame" size={16} color={C.orange} />
              </View>
              <View>
                <Text style={s.remainLabel}>Remaining Calories</Text>
                <Text style={[s.remainVal, { color: C.orange }]}>{remaining} kcal</Text>
              </View>
            </View>
            <View style={s.remainDivider} />
            <View style={s.remainRight}>
              <Text style={s.remainSmall}>Goal: {calories.goal}</Text>
              <Text style={s.remainSmall}>Eaten: {calories.eaten}</Text>
              <Text style={s.remainSmall}>Burned: {calories.burned}</Text>
            </View>
          </View>
        </Animated.View>

        {/* ── 2x2 SMALLER METRIC CARDS ── */}
        <Animated.View style={[s.metricsGrid, { opacity: fadeAnim }]}>
          <View style={{ flex: 1, gap: 10 }}>
            <MetricCard icon="restaurant-outline" label="Calories Eaten" value={calories.eaten} unit="kcal" color={C.yellow} bgColors={["#F59E0B", "#EF4444"]} pct={calPct} />
            <MetricCard icon="barbell-outline" label="Exercise" value={exerciseMin} unit="min" color={C.green} bgColors={["#059669", "#10B981"]} pct={exPct} />
          </View>
          <View style={{ flex: 1, gap: 10 }}>
            <MetricCard icon="water-outline" label="Water" value={water.current} unit="glass" color={C.skyBlue} bgColors={["#0369A1", "#0EA5E9"]} pct={waterPct} />
            <MetricCard icon="flame-outline" label="Calories Burned" value={calories.burned} unit="kcal" color={C.red} bgColors={["#DC2626", "#F87171"]} />
          </View>
        </Animated.View>

        {/* ── ACTIVITY SCORE WIDGET (glass 3D) ── */}
        {activeScore !== null && (
          <Animated.View style={{ opacity: fadeAnim, marginBottom: 14 }}>
            <LinearGradient
              colors={activeScore.overall >= 70 ? ["#0D9488", "#0EA5E9"] : activeScore.overall >= 40 ? ["#F59E0B", "#EF4444"] : ["#6B7280", "#374151"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={s.activityCard}
            >
              <View style={s.activityShine} />
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <View>
                  <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1 }}>TODAY'S ACTIVITY</Text>
                  <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 16, marginTop: 3 }}>{activeScore.label}</Text>
                </View>
                <View style={s.activityScoreCircle}>
                  <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 32, lineHeight: 38 }}>{activeScore.overall}</Text>
                  <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 10, fontFamily: "Inter_500Medium" }}>% Active</Text>
                </View>
              </View>
              <View style={{ gap: 8 }}>
                {[
                  { label: "Food", pct: activeScore.foodPct, icon: "🍛" },
                  { label: "Water", pct: activeScore.waterPct, icon: "💧" },
                  { label: "Exercise", pct: activeScore.exercisePct, icon: "🏃" },
                ].map((item) => (
                  <View key={item.label}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                      <Text style={{ color: "rgba(255,255,255,0.82)", fontSize: 11, fontFamily: "Inter_500Medium" }}>{item.icon} {item.label}</Text>
                      <Text style={{ color: "#FFF", fontSize: 11, fontFamily: "Inter_700Bold" }}>{item.pct}%</Text>
                    </View>
                    <View style={{ height: 5, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 3, overflow: "hidden" }}>
                      <View style={{ height: 5, width: `${item.pct}%`, backgroundColor: "rgba(255,255,255,0.85)", borderRadius: 3 }} />
                    </View>
                  </View>
                ))}
              </View>
            </LinearGradient>
          </Animated.View>
        )}

        {/* ── WATER TRACKER (glass card) ── */}
        <Animated.View style={[s.glassCard, { opacity: fadeAnim }]}>
          <WaterTracker current={water.current} goal={water.goal} onAdd={handleAddWater} />
        </Animated.View>

        {/* ── ADS SLIDER ── */}
        <Animated.View style={{ opacity: fadeAnim, marginBottom: 14 }}>
          <AdsSlider />
        </Animated.View>

        {/* ── AI COACH WIDGET (glass 3D) ── */}
        <Animated.View style={{ opacity: fadeAnim, marginBottom: 14 }}>
          <TouchableOpacity onPress={() => router.push("/suggestions" as never)} activeOpacity={0.88}>
            <LinearGradient colors={["#0077B6", "#0EA5E9", "#00B896"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.aiCard}>
              <View style={s.aiShine} />
              <View style={s.aiIconBox}>
                <Text style={{ fontSize: 26 }}>🤖</Text>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 17 }}>Daily AI Coach</Text>
                <Text style={{ color: "rgba(255,255,255,0.82)", fontFamily: "Inter_400Regular", fontSize: 12.5 }}>
                  Personalized food, exercise & health tips for today
                </Text>
                <View style={{ flexDirection: "row", marginTop: 5 }}>
                  <View style={s.aiBadge}>
                    <Text style={{ color: "#FFF", fontSize: 10, fontFamily: "Inter_700Bold" }}>✨ AI Powered</Text>
                  </View>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* ── HEALTH INTELLIGENCE CARD ── */}
        <Animated.View style={{ opacity: fadeAnim, marginBottom: 14 }}>
          <TouchableOpacity onPress={() => router.push("/intelligence" as never)} activeOpacity={0.88}>
            <LinearGradient colors={["#4F46E5", "#6366F1", "#818CF8"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.aiCard}>
              <View style={s.aiShine} />
              <View style={s.aiIconBox}>
                <Text style={{ fontSize: 26 }}>🧠</Text>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 17 }}>Health Intelligence</Text>
                <Text style={{ color: "rgba(255,255,255,0.82)", fontFamily: "Inter_400Regular", fontSize: 12.5 }}>
                  Disease risk prediction & weekly diet chart
                </Text>
                <View style={{ flexDirection: "row", marginTop: 5, gap: 6 }}>
                  <View style={s.aiBadge}>
                    <Text style={{ color: "#FFF", fontSize: 10, fontFamily: "Inter_700Bold" }}>🔬 DeepSeek AI</Text>
                  </View>
                  <View style={[s.aiBadge, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
                    <Text style={{ color: "#FFF", fontSize: 10, fontFamily: "Inter_700Bold" }}>Monthly Predictions</Text>
                  </View>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* ── DAILY TIP (glass) ── */}
        <Animated.View style={[s.tipCard, { opacity: fadeAnim }]}>
          <LinearGradient colors={["#E0F7FA", "#E8F7FB"]} style={s.tipInner}>
            <LinearGradient colors={["#0077B6", "#00B896"]} style={s.tipIcon}>
              <Ionicons name="bulb" size={14} color="#FFF" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={s.tipHeading}>TODAY'S TIP</Text>
              <Text style={s.tipText}>Drinking 2 glasses of water every morning boosts metabolism by 24%. Try it! 💧</Text>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ── SUMMARY CARD (glass) ── */}
        <Animated.View style={[s.glassCard, { opacity: fadeAnim }]}>
          <View style={s.summHeader}>
            <Text style={s.summTitle}>Today's Summary</Text>
            <View style={s.summBadge}>
              <Ionicons name="bar-chart-outline" size={12} color={C.primary} />
              <Text style={s.summBadgeText}>Today</Text>
            </View>
          </View>
          <StatRow icon="restaurant-outline" label="Calories Eaten" value={`${calories.eaten} kcal`} color={C.yellow} pct={calPct} />
          <StatRow icon="water-outline" label="Water Drank" value={`${water.current}/${water.goal} glass`} color={C.skyBlue} pct={waterPct} />
          <StatRow icon="barbell-outline" label="Exercise" value={`${exerciseMin} min`} color={C.green} pct={exPct} />
          <View style={[sr.row, { borderBottomWidth: 0 }]}>
            <View style={[sr.iconBox, { backgroundColor: C.red + "20" }]}>
              <Ionicons name="flame-outline" size={14} color={C.red} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={sr.labelRow}>
                <Text style={sr.label}>Calories Burned</Text>
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
  root: { flex: 1, backgroundColor: "#E8F6FF" },
  loadText: { fontSize: 14, color: C.muted, fontFamily: "Inter_400Regular" },
  loadingRing: { width: 60, height: 60, borderRadius: 30, backgroundColor: "rgba(255,255,255,0.9)", alignItems: "center", justifyContent: "center", shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 6 },

  // Decorative blobs
  blob1: { position: "absolute", width: 320, height: 320, borderRadius: 160, backgroundColor: "#7DD3FC", opacity: 0.22, top: -100, right: -120 },
  blob2: { position: "absolute", width: 260, height: 260, borderRadius: 130, backgroundColor: "#6EE7B7", opacity: 0.18, bottom: 180, left: -90 },
  blob3: { position: "absolute", width: 180, height: 180, borderRadius: 90, backgroundColor: "#BAE6FD", opacity: 0.15, top: 280, left: 60 },

  // Sticky header
  stickyHeader: { position: "absolute", left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 18, paddingVertical: 8, zIndex: 100, backgroundColor: "rgba(232,246,255,0.94)", borderBottomWidth: 1, borderBottomColor: "rgba(200,232,245,0.8)" },
  stickyLogo: { width: 130, height: 40 },
  stickyScoreBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: "#E0F7F0", borderWidth: 1, borderColor: "#A7F3D0" },
  stickyScoreText: { fontSize: 14, fontFamily: "Inter_700Bold", color: C.accent },

  // Top bar
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  logoBlock: { flex: 1 },
  // ── BIG LOGO ──
  headerLogo: { width: 220, height: 70, marginBottom: 4 },
  greeting: { fontSize: 12.5, color: C.muted, fontFamily: "Inter_400Regular" },
  notifBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.88)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border, shadowColor: C.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3, marginTop: 4 },
  notifDot: { position: "absolute", top: 10, right: 10, width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.red },

  // Hero card
  heroCard: { borderRadius: 26, marginBottom: 12, shadowColor: "#0077B6", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 20, elevation: 10 },
  heroGrad: { borderRadius: 26, padding: 18, overflow: "hidden" },
  heroShine: { position: "absolute", top: 0, left: 0, right: 0, height: "50%", backgroundColor: "rgba(255,255,255,0.08)", borderTopLeftRadius: 26, borderTopRightRadius: 26 },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  heroSup: { fontSize: 13, color: "rgba(255,255,255,0.85)", fontFamily: "Inter_600SemiBold" },
  heroDate: { fontSize: 11, color: "rgba(255,255,255,0.6)", fontFamily: "Inter_400Regular", marginTop: 2 },
  heroBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  heroBadgeText: { color: "#FFF", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  heroBody: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroStats: { flex: 1, paddingLeft: 14, gap: 10 },
  heroStatRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  heroStatIcon: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  heroStatVal: { fontSize: 14, color: "#FFF", fontFamily: "Inter_700Bold" },
  heroStatLabel: { fontSize: 10, color: "rgba(255,255,255,0.65)", fontFamily: "Inter_400Regular" },

  // Remaining calories
  remainCard: { marginBottom: 12, borderRadius: 18, shadowColor: C.orange, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.09, shadowRadius: 10, elevation: 4 },
  remainInner: { borderRadius: 18, flexDirection: "row", alignItems: "center", padding: 14, backgroundColor: C.card, borderWidth: 1.2, borderColor: C.cardBorder },
  remainLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  remainIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  remainLabel: { fontSize: 11, color: C.muted, fontFamily: "Inter_400Regular" },
  remainVal: { fontSize: 19, fontFamily: "Inter_700Bold" },
  remainDivider: { width: 1, height: 36, backgroundColor: "#FFE0CC", marginHorizontal: 12 },
  remainRight: { gap: 2 },
  remainSmall: { fontSize: 10.5, color: C.muted, fontFamily: "Inter_400Regular" },

  // Metric grid
  metricsGrid: { flexDirection: "row", gap: 10, marginBottom: 12 },

  // Glass card (reusable)
  glassCard: {
    backgroundColor: C.card, borderRadius: 20, padding: 16, marginBottom: 12,
    borderWidth: 1.2, borderColor: C.cardBorder,
    shadowColor: "#0077B6", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 5,
  },

  // Activity card
  activityCard: { borderRadius: 22, padding: 18, overflow: "hidden", shadowColor: "#0077B6", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 8 },
  activityShine: { position: "absolute", top: 0, left: 0, right: 0, height: "40%", backgroundColor: "rgba(255,255,255,0.1)", borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  activityScoreCircle: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 50, padding: 12, minWidth: 72 },

  // AI coach card
  aiCard: { borderRadius: 22, padding: 16, flexDirection: "row", alignItems: "center", gap: 14, overflow: "hidden", shadowColor: "#0077B6", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 8 },
  aiShine: { position: "absolute", top: 0, left: 0, right: 0, height: "45%", backgroundColor: "rgba(255,255,255,0.08)" },
  aiIconBox: { width: 50, height: 50, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  aiBadge: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },

  // Tip card
  tipCard: { borderRadius: 18, marginBottom: 12, shadowColor: C.accent, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.09, shadowRadius: 8, elevation: 3 },
  tipInner: { borderRadius: 18, flexDirection: "row", alignItems: "flex-start", gap: 14, padding: 14, borderWidth: 1, borderColor: "#B2EBF2" },
  tipIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  tipHeading: { fontSize: 9.5, letterSpacing: 1.2, color: C.accent, fontFamily: "Inter_700Bold", marginBottom: 4 },
  tipText: { fontSize: 12.5, color: C.text, fontFamily: "Inter_400Regular", lineHeight: 18 },

  // Summary
  summHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  summTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: C.text },
  summBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: "#EEF5FB" },
  summBadgeText: { fontSize: 11, color: C.primary, fontFamily: "Inter_500Medium" },
});
