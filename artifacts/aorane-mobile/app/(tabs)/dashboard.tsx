import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Platform, ActivityIndicator, Image,
  Animated, Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { HealthRing } from "@/components/HealthRing";
import { WaterTracker } from "@/components/WaterTracker";
import { AdsSlider } from "@/components/AdsSlider";
import { router } from "expo-router";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import * as Haptics from "expo-haptics";

const { width: W } = Dimensions.get("window");

const C = {
  bg: "#EBF5FF",
  primary: "#0077B6",
  sky: "#0EA5E9",
  accent: "#00B896",
  green: "#10B981",
  amber: "#F59E0B",
  purple: "#8B5CF6",
  red: "#EF4444",
  orange: "#F97316",
  text: "#0D1F33",
  muted: "#5B7A8E",
  glass: "rgba(255,255,255,0.78)",
  glassBorder: "rgba(255,255,255,0.92)",
  glassShadow: "#0077B6",
};

function todayDate() { return new Date().toISOString().slice(0, 10); }

// ─── GLASS CARD ──────────────────────────────────────────────────────────────
function Glass({ children, style, padding = 16 }: {
  children: React.ReactNode; style?: object; padding?: number;
}) {
  return (
    <View style={[gc.wrap, style]}>
      {Platform.OS === "ios" && (
        <BlurView intensity={55} tint="extraLight" style={StyleSheet.absoluteFill} />
      )}
      <View style={[StyleSheet.absoluteFill, gc.fill]} />
      <View style={{ padding }}>{children}</View>
    </View>
  );
}
const gc = StyleSheet.create({
  wrap: {
    borderRadius: 22, overflow: "hidden",
    borderWidth: 1.2, borderColor: C.glassBorder,
    backgroundColor: Platform.OS === "ios" ? "transparent" : C.glass,
    shadowColor: C.glassShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 14, elevation: 5,
    marginBottom: 14,
  },
  fill: {
    backgroundColor: C.glass,
    borderRadius: 22,
  },
});

// ─── ANIMATED PROGRESS BAR ────────────────────────────────────────────────────
function MacroBar({ label, value, goal, color, icon }: {
  label: string; value: number; goal: number; color: string; icon: string;
}) {
  const barAnim = useRef(new Animated.Value(0)).current;
  const pct = Math.min(100, goal > 0 ? (value / goal) * 100 : 0);

  useEffect(() => {
    Animated.timing(barAnim, {
      toValue: pct / 100, duration: 900, useNativeDriver: false,
    }).start();
  }, [pct]);

  const barW = barAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <View style={mb.row}>
      <View style={[mb.dot, { backgroundColor: color + "22" }]}>
        <Text style={{ fontSize: 12 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={mb.labelRow}>
          <Text style={mb.label}>{label}</Text>
          <Text style={[mb.val, { color }]}>{value}g <Text style={mb.goal}>/ {goal}g</Text></Text>
        </View>
        <View style={mb.track}>
          <Animated.View style={[mb.fill, { width: barW, backgroundColor: color }]} />
        </View>
      </View>
    </View>
  );
}
const mb = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  dot: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  labelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  label: { fontSize: 12.5, fontFamily: "Inter_500Medium", color: C.muted },
  val: { fontSize: 12.5, fontFamily: "Inter_700Bold" },
  goal: { color: C.muted, fontFamily: "Inter_400Regular" },
  track: { height: 6, borderRadius: 3, backgroundColor: "#E4EFFE", overflow: "hidden" },
  fill: { height: 6, borderRadius: 3 },
});

// ─── QUICK ACTION BUTTON ──────────────────────────────────────────────────────
function QuickAction({ icon, label, color, bgColors, onPress }: {
  icon: string; label: string; color: string;
  bgColors: [string, string]; onPress: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  function onIn() { Animated.spring(scaleAnim, { toValue: 0.92, useNativeDriver: true, damping: 12 }).start(); }
  function onOut() { Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 10 }).start(); }

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={onIn} onPressOut={onOut}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      style={{ flex: 1 }}
    >
      <Animated.View style={[qa.card, { transform: [{ scale: scaleAnim }] }]}>
        <LinearGradient colors={bgColors} style={qa.iconBox}>
          <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={22} color="#FFF" />
        </LinearGradient>
        <Text style={qa.label}>{label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}
const qa = StyleSheet.create({
  card: {
    flex: 1, alignItems: "center", gap: 8, padding: 14,
    backgroundColor: C.glass,
    borderRadius: 18, borderWidth: 1.2, borderColor: C.glassBorder,
    shadowColor: C.glassShadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 4,
  },
  iconBox: {
    width: 46, height: 46, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 6, elevation: 3,
  },
  label: { fontSize: 11.5, fontFamily: "Inter_600SemiBold", color: C.text, textAlign: "center" },
});

// ─── ACTIVITY ITEM ────────────────────────────────────────────────────────────
function ActivityItem({ icon, color, title, subtitle, time, last }: {
  icon: string; color: string; title: string;
  subtitle: string; time: string; last?: boolean;
}) {
  return (
    <View style={[ai.row, last && { borderBottomWidth: 0 }]}>
      <View style={[ai.iconBox, { backgroundColor: color + "18" }]}>
        <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={18} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={ai.title}>{title}</Text>
        <Text style={ai.sub}>{subtitle}</Text>
      </View>
      <Text style={ai.time}>{time}</Text>
    </View>
  );
}
const ai = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "rgba(0,119,182,0.06)",
  },
  iconBox: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.text, marginBottom: 2 },
  sub: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.muted },
  time: { fontSize: 10.5, fontFamily: "Inter_400Regular", color: C.muted },
});

// ─── METRIC PILL ──────────────────────────────────────────────────────────────
function MetricPill({ icon, value, unit, color, bgColors }: {
  icon: string; value: string | number; unit: string;
  color: string; bgColors: [string, string];
}) {
  return (
    <View style={mp.pill}>
      <LinearGradient colors={bgColors} style={mp.iconBox}>
        <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={14} color="#FFF" />
      </LinearGradient>
      <Text style={[mp.val, { color }]}>{value}</Text>
      <Text style={mp.unit}>{unit}</Text>
    </View>
  );
}
const mp = StyleSheet.create({
  pill: {
    flex: 1, alignItems: "center", gap: 5,
    paddingVertical: 12, backgroundColor: C.glass,
    borderRadius: 16, borderWidth: 1.2, borderColor: C.glassBorder,
    shadowColor: C.glassShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  iconBox: { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  val: { fontSize: 18, fontFamily: "Inter_700Bold" },
  unit: { fontSize: 9.5, color: C.muted, fontFamily: "Inter_400Regular" },
});

// ─── MAIN SCREEN ─────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [healthScore, setHealthScore] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [water, setWater] = useState({ current: 0, goal: 8 });
  const [calories, setCalories] = useState({ eaten: 0, goal: 2000, burned: 0 });
  const [macros, setMacros] = useState({ carbs: 0, carbsGoal: 280, fat: 0, fatGoal: 65, fiber: 0, fiberGoal: 30 });
  const [exerciseMin, setExerciseMin] = useState(0);
  const [activeScore, setActiveScore] = useState<{
    overall: number; foodPct: number; waterPct: number; exercisePct: number; label: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [greeting, setGreeting] = useState("Good Morning");
  const [userName, setUserName] = useState("");

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
      const [scoreRes, waterRes, foodRes, exerciseRes, activityRes, profileRes] = await Promise.allSettled([
        api.getHealthScore(date), api.getWaterLog(date), api.getFoodSummary(date),
        api.getExerciseLogs(date), api.getActivityScore(date),
        api.getProfile(),
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
        setMacros({
          carbs: Math.round(summ.totalCarbs || 0), carbsGoal: 280,
          fat: Math.round(summ.totalFat || 0), fatGoal: 65,
          fiber: Math.round(summ.totalFiber || 0), fiberGoal: 30,
        });
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
      if (profileRes.status === "fulfilled") {
        const p = profileRes.value.profile as Record<string, string>;
        setUserName(p?.fullName?.split(" ")?.[0] || "");
      }
    } catch { }
    setIsLoading(false);
    setRefreshing(false);
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
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
      <View style={[s.root, { alignItems: "center", justifyContent: "center", gap: 16 }]}>
        <LinearGradient colors={["#C5E8FF", "#D1FAE5", "#EFF8FF"]} style={StyleSheet.absoluteFill} />
        <View style={s.blob1} /><View style={s.blob2} />
        <View style={s.loadRing}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
        <Text style={s.loadText}>Loading your health data...</Text>
      </View>
    );
  }

  const today = new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  const scoreColor = healthScore >= 75 ? C.accent : healthScore >= 50 ? C.amber : C.red;

  return (
    <View style={s.root}>
      {/* Gradient background */}
      <LinearGradient
        colors={["#C5E8FF", "#DCF5EF", "#EFF8FF", "#FFFFFF"]}
        locations={[0, 0.25, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Soft blobs */}
      <View style={s.blob1} /><View style={s.blob2} /><View style={s.blob3} />

      {/* Sticky mini header */}
      <Animated.View style={[s.stickyHdr, { opacity: headerOpacity, top: topPad }]}>
        <Image source={require("../../assets/images/aorane-logo.png")} style={s.stickyLogo} resizeMode="contain" />
        <View style={[s.scorePill, { backgroundColor: scoreColor + "18" }]}>
          <Ionicons name="heart" size={12} color={scoreColor} />
          <Text style={[s.scorePillText, { color: scoreColor }]}>{healthScore}</Text>
        </View>
      </Animated.View>

      <Animated.ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: topPad + 6, paddingBottom: insets.bottom + 96, paddingHorizontal: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={C.primary} colors={[C.primary]} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── HEADER ── */}
        <Animated.View style={[s.header, { opacity: fadeAnim }]}>
          <View>
            <Text style={s.greet}>{greeting}{userName ? `, ${userName}` : ""}</Text>
            <Text style={s.dateText}>{today}</Text>
          </View>
          <View style={s.headerRight}>
            <TouchableOpacity style={s.notifBtn} onPress={() => router.push("/notification-settings" as never)}>
              <Ionicons name="notifications-outline" size={20} color={C.primary} />
              <View style={s.notifDot} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ── HERO SCORE CARD ── */}
        <Animated.View style={{ opacity: fadeAnim, marginBottom: 14 }}>
          <LinearGradient
            colors={["#005EA3", "#0077B6", "#0EA5E9", "#00B896"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={s.heroCard}
          >
            <View style={s.heroShine} />
            <View style={s.heroShine2} />

            {/* Top row */}
            <View style={s.heroTop}>
              <View>
                <Text style={s.heroSup}>HEALTH SCORE</Text>
                <Text style={s.heroTitle}>Today's Report</Text>
              </View>
              <View style={[s.heroBadge, {
                backgroundColor: healthScore >= 70
                  ? "rgba(0,255,180,0.2)" : "rgba(255,193,7,0.25)"
              }]}>
                <Ionicons name={healthScore >= 70 ? "trending-up" : "trending-down"} size={12} color="#FFF" />
                <Text style={s.heroBadgeText}>{healthScore >= 70 ? "Good" : "Improve"}</Text>
              </View>
            </View>

            {/* Body */}
            <View style={s.heroBody}>
              <HealthRing score={healthScore} confidence={confidence} size={140} />
              <View style={s.heroStats}>
                {[
                  { icon: "flame", label: "Calories", val: `${calories.eaten}`, sub: "kcal eaten", color: "#FFD580" },
                  { icon: "barbell-outline", label: "Exercise", val: `${exerciseMin}m`, sub: "active", color: "#A7F3D0" },
                  { icon: "water-outline", label: "Water", val: `${water.current}/${water.goal}`, sub: "glasses", color: "#BAE6FD" },
                ].map(st => (
                  <View key={st.label} style={s.heroStatRow}>
                    <View style={s.heroStatIcon}>
                      <Ionicons name={st.icon as keyof typeof Ionicons.glyphMap} size={13} color={st.color} />
                    </View>
                    <View>
                      <Text style={s.heroStatVal}>{st.val}</Text>
                      <Text style={s.heroStatSub}>{st.sub}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Calorie bar */}
            <View style={s.calBar}>
              <View style={s.calBarLabels}>
                <Text style={s.calBarLabel}>Calories Progress</Text>
                <Text style={s.calBarVal}>{Math.round(calPct)}%</Text>
              </View>
              <View style={s.calBarTrack}>
                <View style={[s.calBarFill, { width: `${calPct}%` }]} />
              </View>
              <View style={s.calBarMeta}>
                <Text style={s.calBarMeta1}>🍛 {calories.eaten} eaten</Text>
                <Text style={s.calBarMeta1}>🔥 {calories.burned} burned</Text>
                <Text style={s.calBarMeta1}>🎯 {remaining} left</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ── QUICK ACTIONS ── */}
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={s.sectionTitle}>Quick Actions</Text>
          <View style={s.qaGrid}>
            <View style={s.qaRow}>
              <QuickAction
                icon="restaurant-outline" label="Log Meal"
                color={C.orange} bgColors={["#F97316", "#FB923C"]}
                onPress={() => router.push("/(tabs)/food" as never)}
              />
              <QuickAction
                icon="medkit-outline" label="Medicine"
                color={C.purple} bgColors={["#7C3AED", "#8B5CF6"]}
                onPress={() => router.push("/(tabs)/medicine" as never)}
              />
            </View>
            <View style={s.qaRow}>
              <QuickAction
                icon="barbell-outline" label="Exercise"
                color={C.accent} bgColors={["#059669", "#10B981"]}
                onPress={() => router.push("/(tabs)/exercise" as never)}
              />
              <QuickAction
                icon="document-text-outline" label="My Report"
                color={C.primary} bgColors={["#005EA3", "#0077B6"]}
                onPress={() => router.push("/health-report" as never)}
              />
            </View>
          </View>
        </Animated.View>

        {/* ── NUTRITION CARD ── */}
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={s.sectionTitle}>Today's Nutrition</Text>
          <Glass>
            <View style={s.nutritionHeader}>
              <View>
                <Text style={s.nutritionTitle}>Macro Breakdown</Text>
                <Text style={s.nutritionSub}>Daily targets</Text>
              </View>
              <LinearGradient colors={[C.primary, C.sky]} style={s.nutritionBadge}>
                <Ionicons name="nutrition-outline" size={14} color="#FFF" />
              </LinearGradient>
            </View>
            <MacroBar label="Carbohydrates" value={macros.carbs} goal={macros.carbsGoal} color={C.amber} icon="🍞" />
            <MacroBar label="Healthy Fats" value={macros.fat} goal={macros.fatGoal} color={C.purple} icon="🥑" />
            <MacroBar label="Dietary Fiber" value={macros.fiber} goal={macros.fiberGoal} color={C.accent} icon="🥦" />
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/food" as never)}
              style={s.nutritionLink}
            >
              <Text style={s.nutritionLinkText}>View detailed food log</Text>
              <Ionicons name="chevron-forward" size={14} color={C.primary} />
            </TouchableOpacity>
          </Glass>
        </Animated.View>

        {/* ── METRICS ROW ── */}
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={s.sectionTitle}>At a Glance</Text>
          <View style={s.pillsRow}>
            <MetricPill icon="flame" value={calories.eaten} unit="kcal" color={C.orange} bgColors={["#F97316", "#FB923C"]} />
            <MetricPill icon="water-outline" value={water.current} unit="glasses" color={C.sky} bgColors={["#0369A1", "#0EA5E9"]} />
            <MetricPill icon="barbell-outline" value={exerciseMin} unit="minutes" color={C.accent} bgColors={["#059669", "#10B981"]} />
          </View>
        </Animated.View>

        {/* ── RECENT ACTIVITY ── */}
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={s.sectionTitle}>Recent Activity</Text>
          <Glass>
            <ActivityItem
              icon="restaurant" color={C.orange}
              title={calories.eaten > 0 ? `${calories.eaten} kcal logged` : "No meals logged yet"}
              subtitle="Food intake today"
              time="Today"
            />
            <ActivityItem
              icon="barbell-outline" color={C.accent}
              title={exerciseMin > 0 ? `${exerciseMin} min workout` : "No exercise logged"}
              subtitle="Physical activity"
              time="Today"
            />
            <ActivityItem
              icon="water-outline" color={C.sky}
              title={`${water.current} of ${water.goal} glasses`}
              subtitle="Water intake"
              time="Today"
              last
            />
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/index" as never)}
              style={s.activityLink}
            >
              <Text style={s.activityLinkText}>View all activity</Text>
              <Ionicons name="chevron-forward" size={14} color={C.primary} />
            </TouchableOpacity>
          </Glass>
        </Animated.View>

        {/* ── WATER TRACKER ── */}
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={s.sectionTitle}>Hydration</Text>
          <Glass padding={14}>
            <WaterTracker current={water.current} goal={water.goal} onAdd={handleAddWater} />
          </Glass>
        </Animated.View>

        {/* ── ACTIVITY SCORE ── */}
        {activeScore !== null && (
          <Animated.View style={{ opacity: fadeAnim, marginBottom: 14 }}>
            <Text style={s.sectionTitle}>Activity Score</Text>
            <LinearGradient
              colors={activeScore.overall >= 70
                ? ["#064E3B", "#0D9488", "#0EA5E9"]
                : activeScore.overall >= 40
                  ? ["#92400E", "#F59E0B", "#FB923C"]
                  : ["#374151", "#6B7280", "#9CA3AF"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={s.actCard}
            >
              <View style={s.actShine} />
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <View>
                  <Text style={s.actSubLabel}>TODAY'S ACTIVITY</Text>
                  <Text style={s.actLabel}>{activeScore.label}</Text>
                </View>
                <View style={s.actCircle}>
                  <Text style={s.actScore}>{activeScore.overall}</Text>
                  <Text style={s.actScoreSub}>% Active</Text>
                </View>
              </View>
              {[
                { label: "Food", pct: activeScore.foodPct, icon: "🍛" },
                { label: "Water", pct: activeScore.waterPct, icon: "💧" },
                { label: "Exercise", pct: activeScore.exercisePct, icon: "🏃" },
              ].map((item) => (
                <View key={item.label} style={{ marginBottom: 8 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                    <Text style={{ color: "rgba(255,255,255,0.82)", fontSize: 11, fontFamily: "Inter_500Medium" }}>{item.icon} {item.label}</Text>
                    <Text style={{ color: "#FFF", fontSize: 11, fontFamily: "Inter_700Bold" }}>{item.pct}%</Text>
                  </View>
                  <View style={{ height: 5, backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 3, overflow: "hidden" }}>
                    <View style={{ height: 5, width: `${item.pct}%`, backgroundColor: "rgba(255,255,255,0.88)", borderRadius: 3 }} />
                  </View>
                </View>
              ))}
            </LinearGradient>
          </Animated.View>
        )}

        {/* ── ADS ── */}
        <Animated.View style={{ opacity: fadeAnim, marginBottom: 14 }}>
          <AdsSlider />
        </Animated.View>

        {/* ── AI COACH ── */}
        <Animated.View style={{ opacity: fadeAnim, marginBottom: 14 }}>
          <Text style={s.sectionTitle}>AI Features</Text>
          <TouchableOpacity onPress={() => router.push("/suggestions" as never)} activeOpacity={0.88}>
            <LinearGradient colors={["#005285", "#0077B6", "#0EA5E9", "#00B896"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.aiCard}>
              <View style={s.aiShine} />
              <View style={s.aiIconBox}><Text style={{ fontSize: 28 }}>🤖</Text></View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={s.aiTitle}>Daily AI Coach</Text>
                <Text style={s.aiSub}>Personalized food, exercise & health tips for today</Text>
                <View style={s.aiBadge}><Text style={s.aiBadgeText}>✨ AI Powered</Text></View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* ── HEALTH INTELLIGENCE ── */}
        <Animated.View style={{ opacity: fadeAnim, marginBottom: 14 }}>
          <TouchableOpacity onPress={() => router.push("/intelligence" as never)} activeOpacity={0.88}>
            <LinearGradient colors={["#3730A3", "#4F46E5", "#6366F1", "#818CF8"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.aiCard}>
              <View style={s.aiShine} />
              <View style={s.aiIconBox}><Text style={{ fontSize: 28 }}>🧠</Text></View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={s.aiTitle}>Health Intelligence</Text>
                <Text style={s.aiSub}>Disease risk prediction & weekly diet plan</Text>
                <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
                  <View style={s.aiBadge}><Text style={s.aiBadgeText}>🔬 DeepSeek AI</Text></View>
                  <View style={[s.aiBadge, { backgroundColor: "rgba(255,255,255,0.12)" }]}>
                    <Text style={s.aiBadgeText}>Monthly</Text>
                  </View>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </Animated.ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  loadRing: { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(255,255,255,0.9)", alignItems: "center", justifyContent: "center", shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 6 },
  loadText: { fontSize: 14, color: C.muted, fontFamily: "Inter_400Regular" },

  blob1: { position: "absolute", width: 340, height: 340, borderRadius: 170, backgroundColor: "#7DD3FC", opacity: 0.2, top: -110, right: -130 },
  blob2: { position: "absolute", width: 280, height: 280, borderRadius: 140, backgroundColor: "#6EE7B7", opacity: 0.15, bottom: 200, left: -100 },
  blob3: { position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: "#C7D2FE", opacity: 0.12, top: 300, left: 80 },

  stickyHdr: {
    position: "absolute", left: 0, right: 0, zIndex: 99,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 18, paddingVertical: 8,
    backgroundColor: "rgba(235,245,255,0.88)",
  },
  stickyLogo: { width: 90, height: 26 },
  scorePill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  scorePillText: { fontSize: 13, fontFamily: "Inter_700Bold" },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16, paddingTop: 4 },
  greet: { fontSize: 20, fontFamily: "Inter_700Bold", color: C.text },
  dateText: { fontSize: 12.5, fontFamily: "Inter_400Regular", color: C.muted, marginTop: 2 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  notifBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.glass, borderWidth: 1.2, borderColor: C.glassBorder, alignItems: "center", justifyContent: "center" },
  notifDot: { position: "absolute", top: 6, right: 6, width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.red, borderWidth: 1.5, borderColor: "#FFF" },

  heroCard: { borderRadius: 24, padding: 20, overflow: "hidden", shadowColor: C.primary, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 12 },
  heroShine: { position: "absolute", top: -60, right: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(255,255,255,0.08)" },
  heroShine2: { position: "absolute", bottom: -40, left: -20, width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(255,255,255,0.06)" },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  heroSup: { fontSize: 9.5, fontFamily: "Inter_700Bold", color: "rgba(255,255,255,0.65)", letterSpacing: 1.5, marginBottom: 3 },
  heroTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#FFF" },
  heroBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  heroBadgeText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#FFF" },
  heroBody: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 16 },
  heroStats: { flex: 1, gap: 10 },
  heroStatRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  heroStatIcon: { width: 28, height: 28, borderRadius: 9, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" },
  heroStatVal: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#FFF" },
  heroStatSub: { fontSize: 10, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.65)" },
  calBar: { marginTop: 4 },
  calBarLabels: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  calBarLabel: { fontSize: 11, color: "rgba(255,255,255,0.75)", fontFamily: "Inter_500Medium" },
  calBarVal: { fontSize: 11, color: "#FFF", fontFamily: "Inter_700Bold" },
  calBarTrack: { height: 6, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 3, overflow: "hidden", marginBottom: 8 },
  calBarFill: { height: 6, backgroundColor: "rgba(255,255,255,0.9)", borderRadius: 3 },
  calBarMeta: { flexDirection: "row", justifyContent: "space-between" },
  calBarMeta1: { fontSize: 10.5, color: "rgba(255,255,255,0.78)", fontFamily: "Inter_400Regular" },

  sectionTitle: { fontSize: 14.5, fontFamily: "Inter_700Bold", color: C.text, marginBottom: 10, letterSpacing: 0.2 },

  qaGrid: { gap: 10, marginBottom: 14 },
  qaRow: { flexDirection: "row", gap: 10 },

  nutritionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  nutritionTitle: { fontSize: 14.5, fontFamily: "Inter_700Bold", color: C.text },
  nutritionSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.muted, marginTop: 2 },
  nutritionBadge: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  nutritionLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: "rgba(0,119,182,0.08)", marginTop: 4 },
  nutritionLinkText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.primary },

  pillsRow: { flexDirection: "row", gap: 10, marginBottom: 14 },

  activityLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: "rgba(0,119,182,0.08)", marginTop: 6 },
  activityLinkText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.primary },

  actCard: { borderRadius: 22, padding: 18, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 8 },
  actShine: { position: "absolute", top: -40, right: -20, width: 140, height: 140, borderRadius: 70, backgroundColor: "rgba(255,255,255,0.07)" },
  actSubLabel: { fontSize: 9.5, color: "rgba(255,255,255,0.65)", fontFamily: "Inter_700Bold", letterSpacing: 1.5, marginBottom: 3 },
  actLabel: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#FFF" },
  actCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(255,255,255,0.25)" },
  actScore: { fontSize: 26, fontFamily: "Inter_700Bold", color: "#FFF", lineHeight: 32 },
  actScoreSub: { fontSize: 9, color: "rgba(255,255,255,0.7)", fontFamily: "Inter_500Medium" },

  aiCard: { borderRadius: 22, padding: 18, flexDirection: "row", alignItems: "center", gap: 14, overflow: "hidden", shadowColor: C.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.28, shadowRadius: 16, elevation: 10 },
  aiShine: { position: "absolute", top: -30, right: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: "rgba(255,255,255,0.09)" },
  aiIconBox: { width: 52, height: 52, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" },
  aiTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#FFF" },
  aiSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)", lineHeight: 17 },
  aiBadge: { backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" },
  aiBadgeText: { color: "#FFF", fontSize: 10, fontFamily: "Inter_700Bold" },
});
