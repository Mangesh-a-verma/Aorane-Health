import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Platform, ActivityIndicator, Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { AdsSlider } from "@/components/AdsSlider";
import { router, useFocusEffect } from "expo-router";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import * as Haptics from "expo-haptics";
import { DS } from "@/lib/theme";
import {
  Flame, Droplets, Dumbbell, Heart,
  Utensils, Pill, ScanLine, Brain, FileText,
  ChevronRight, Sparkles, Plus, Beef, Wheat, Zap,
} from "lucide-react-native";

function todayDate() { return new Date().toISOString().slice(0, 10); }

function getGreeting() {
  const h = new Date().getHours();
  if (h < 5)  return "Good Night 🌙";
  if (h < 12) return "Good Morning ☀️";
  if (h < 17) return "Good Afternoon 🌤️";
  return "Good Evening 🌆";
}

// ── SUMMARY BANNER ─────────────────────────────────────────────────────────────
function SummaryBanner({ greeting, healthScore, calories, water, exerciseMin, activityPct }: {
  greeting: string; healthScore: number;
  calories: { eaten: number; burned: number };
  water: { current: number; goal: number };
  exerciseMin: number;
  activityPct: number;
}) {
  return (
    <LinearGradient
      colors={["#C0392B", "#E8622A", "#F5A623"]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={bn.card}
    >
      <View style={bn.shine1} />
      <View style={bn.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={bn.greet}>{greeting}</Text>
          <Text style={bn.sub}>Today's health overview</Text>
        </View>
        <View style={bn.scoreBlock}>
          <View style={bn.badge}>
            <Text style={bn.badgeNum}>{healthScore}</Text>
            <Text style={bn.badgeLbl}>HEALTH</Text>
          </View>
          <View style={bn.actBadge}>
            <Text style={bn.actNum}>{activityPct}%</Text>
            <Text style={bn.actLbl}>ACTIVE</Text>
          </View>
        </View>
      </View>
      <View style={bn.divider} />
      <View style={bn.statsRow}>
        {[
          { icon: <Utensils  size={13} color="rgba(255,255,255,0.9)" strokeWidth={2} />, val: String(calories.eaten),            lbl: "Kcal" },
          { icon: <Flame     size={13} color="rgba(255,255,255,0.9)" strokeWidth={2} />, val: String(calories.burned),           lbl: "Burned" },
          { icon: <Droplets  size={13} color="rgba(255,255,255,0.9)" strokeWidth={2} />, val: `${water.current}/${water.goal}`,  lbl: "Glass" },
          { icon: <Dumbbell  size={13} color="rgba(255,255,255,0.9)" strokeWidth={2} />, val: `${exerciseMin}m`,                 lbl: "Active" },
        ].map((s, i) => (
          <View key={i} style={bn.stat}>
            {s.icon}
            <Text style={bn.statVal}>{s.val}</Text>
            <Text style={bn.statLbl}>{s.lbl}</Text>
          </View>
        ))}
      </View>
    </LinearGradient>
  );
}
const bn = StyleSheet.create({
  card:     { borderRadius: 20, padding: 16, overflow: "hidden" },
  shine1:   { position: "absolute", width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(255,255,255,0.07)", top: -50, right: -30 },
  topRow:   { flexDirection: "row", alignItems: "flex-start", marginBottom: 12 },
  greet:    { color: "#FFF", fontSize: 15, fontFamily: "Inter_700Bold", marginBottom: 2 },
  sub:      { color: "rgba(255,255,255,0.7)", fontSize: 11, fontFamily: "Inter_400Regular" },
  scoreBlock: { flexDirection: "row", gap: 8, alignItems: "flex-end" },
  badge:    { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", minWidth: 56 },
  badgeNum: { color: "#FFF", fontSize: 16, fontFamily: "Inter_700Bold", lineHeight: 20 },
  badgeLbl: { color: "rgba(255,255,255,0.85)", fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 0.6 },
  actBadge: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", minWidth: 56 },
  actNum:   { color: "#FFF", fontSize: 16, fontFamily: "Inter_700Bold", lineHeight: 20 },
  actLbl:   { color: "rgba(255,255,255,0.85)", fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 0.6 },
  divider:  { height: 0.8, backgroundColor: "rgba(255,255,255,0.18)", marginBottom: 12 },
  statsRow: { flexDirection: "row" },
  stat:     { flex: 1, alignItems: "center", gap: 4 },
  statVal:  { color: "#FFF", fontSize: 14, fontFamily: "Inter_700Bold" },
  statLbl:  { color: "rgba(255,255,255,0.72)", fontSize: 9.5, fontFamily: "Inter_400Regular" },
});

// ── NUTRITION CARD ─────────────────────────────────────────────────────────────
function NutritionCard({ calories, protein, carbs, fat }: {
  calories: number; protein: number; carbs: number; fat: number;
}) {
  const total = protein + carbs + fat || 1;
  const pctP = Math.round((protein / total) * 100);
  const pctC = Math.round((carbs / total) * 100);
  const pctF = 100 - pctP - pctC;

  const items = [
    { label: "Calories", value: `${calories}`, unit: "kcal", color: "#E8622A", icon: <Flame size={16} color="#E8622A" strokeWidth={2} />, width: "100%" as const },
    { label: "Protein",  value: `${protein}`,  unit: "g",    color: "#6366F1", icon: <Beef  size={16} color="#6366F1" strokeWidth={2} />, width: `${pctP}%` as `${number}%` },
    { label: "Carbs",    value: `${carbs}`,    unit: "g",    color: "#10B981", icon: <Wheat size={16} color="#10B981" strokeWidth={2} />, width: `${pctC}%` as `${number}%` },
    { label: "Fat",      value: `${fat}`,      unit: "g",    color: "#F59E0B", icon: <Droplets size={16} color="#F59E0B" strokeWidth={2} />, width: `${pctF}%` as `${number}%` },
  ];

  return (
    <View style={nc.card}>
      <View style={nc.header}>
        <Text style={nc.title}>Today's Nutrition</Text>
        <TouchableOpacity onPress={() => router.push("/(tabs)/food" as never)}>
          <Text style={nc.viewAll}>Log Food</Text>
        </TouchableOpacity>
      </View>
      <View style={nc.grid}>
        {items.map((item, i) => (
          <View key={i} style={nc.item}>
            <View style={nc.itemTop}>
              {item.icon}
              <View style={nc.itemTextWrap}>
                <Text style={nc.itemVal}>{item.value}<Text style={nc.itemUnit}> {item.unit}</Text></Text>
                <Text style={nc.itemLabel}>{item.label}</Text>
              </View>
            </View>
            <View style={nc.barBg}>
              <View style={[nc.barFill, { backgroundColor: item.color, width: item.width }]} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
const nc = StyleSheet.create({
  card:      { backgroundColor: "#FFF", borderRadius: 20, padding: 16 },
  header:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  title:     { fontSize: 15, fontFamily: "Inter_700Bold", color: DS.color.text },
  viewAll:   { fontSize: 12, fontFamily: "Inter_600SemiBold", color: DS.color.primary },
  grid:      { gap: 10 },
  item:      { gap: 5 },
  itemTop:   { flexDirection: "row", alignItems: "center", gap: 8 },
  itemTextWrap: { flex: 1, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  itemVal:   { fontSize: 15, fontFamily: "Inter_700Bold", color: DS.color.text },
  itemUnit:  { fontSize: 11, fontFamily: "Inter_400Regular", color: DS.color.muted },
  itemLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: DS.color.muted },
  barBg:     { height: 5, borderRadius: 3, backgroundColor: "#F1F5F9" },
  barFill:   { height: 5, borderRadius: 3 },
});

// ── SERVICE TILE ───────────────────────────────────────────────────────────────
function ServiceTile({ icon, label, color, onPress, badge }: {
  icon: React.ReactNode; label: string; color: string; onPress?: () => void; badge?: string;
}) {
  const sc = useRef(new Animated.Value(1)).current;
  return (
    <TouchableOpacity
      style={st.wrap} activeOpacity={1}
      onPressIn ={() => Animated.spring(sc, { toValue: 0.88, useNativeDriver: true, damping: 10 }).start()}
      onPressOut={() => Animated.spring(sc, { toValue: 1,    useNativeDriver: true, damping: 8  }).start()}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress?.(); }}
    >
      <Animated.View style={[st.inner, { transform: [{ scale: sc }] }]}>
        <View style={[st.shadow3d, { backgroundColor: color + "44" }]} />
        <LinearGradient
          colors={[color + "DD", color + "FF"]}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          style={st.circle}
        >
          {icon}
          {badge ? <View style={st.badgeDot}><Text style={st.badgeT}>{badge}</Text></View> : null}
        </LinearGradient>
        <Text style={st.lbl} numberOfLines={2}>{label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}
const st = StyleSheet.create({
  wrap:     { width: "33.33%", alignItems: "center", paddingVertical: 6 },
  inner:    { alignItems: "center", gap: 7 },
  shadow3d: { position: "absolute", width: 52, height: 18, borderRadius: 10, top: 42, left: "50%", marginLeft: -26 },
  circle:   { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  lbl:      { fontSize: 11, fontFamily: "Inter_600SemiBold", color: DS.color.text, textAlign: "center", lineHeight: 14, height: 28 },
  badgeDot: { position: "absolute", top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: "#FFF", alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  badgeT:   { fontSize: 8, fontFamily: "Inter_700Bold", color: DS.color.primary },
});

// ── WATER DOTS ─────────────────────────────────────────────────────────────────
function WaterDots({ current, goal, onAdd }: { current: number; goal: number; onAdd: () => void }) {
  const total = Math.max(goal, 6);
  return (
    <View style={wd.wrap}>
      <View style={wd.header}>
        <Text style={wd.title}>Water Intake</Text>
        <Text style={wd.sub}>{current} of {goal} cups goal met</Text>
      </View>
      <View style={wd.row}>
        {Array.from({ length: total }).map((_, i) => {
          const filled = i < current;
          return (
            <TouchableOpacity
              key={i}
              onPress={() => { if (!filled) onAdd(); }}
              activeOpacity={filled ? 1 : 0.7}
              style={wd.dotWrap}
            >
              <View style={[wd.dot, filled ? wd.filled : wd.empty]}>
                {filled
                  ? <Droplets size={16} color="#FFF" strokeWidth={2} />
                  : <Plus size={14} color={DS.color.sky + "90"} strokeWidth={2.5} />
                }
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
const wd = StyleSheet.create({
  wrap:    { backgroundColor: "#FFF", borderRadius: 20, padding: 16 },
  header:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  title:   { fontSize: 14, fontFamily: "Inter_700Bold", color: DS.color.text },
  sub:     { fontSize: 11, fontFamily: "Inter_400Regular", color: DS.color.muted },
  row:     { flexDirection: "row", justifyContent: "space-between", gap: 4 },
  dotWrap: { flex: 1, alignItems: "center" },
  dot:     { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  filled:  { backgroundColor: DS.color.sky },
  empty:   { backgroundColor: "#EBF5FB", borderWidth: 1.5, borderColor: DS.color.sky + "30" },
});

// ── STRESS CARD ────────────────────────────────────────────────────────────────
type StressToday = { checkedIn: boolean; latestScore: number | null; avgScore: number | null; count: number; latestMood: string | null; burnoutRisk: boolean };

function stressScoreColor(s: number): string {
  if (s < 26) return DS.color.green;
  if (s < 51) return "#F59E0B";
  if (s < 76) return "#F97316";
  return "#EF4444";
}
function stressScoreLabel(s: number): string {
  if (s < 26) return "Low";
  if (s < 51) return "Moderate";
  if (s < 76) return "Elevated";
  return "High Risk";
}

function StressCard({ data, onPress }: { data: StressToday | null; onPress: () => void }) {
  const hasScore = data?.checkedIn && data.latestScore !== null;
  const score    = data?.latestScore ?? 0;
  const col      = hasScore ? stressScoreColor(score) : "#8B5CF6";
  const label    = hasScore ? stressScoreLabel(score) : "Not checked in";

  const gradColors: [string, string] = hasScore
    ? (score < 26  ? ["#10B981", "#059669"]
      : score < 51 ? ["#F59E0B", "#D97706"]
      : score < 76 ? ["#F97316", "#EA580C"]
      : ["#EF4444", "#DC2626"])
    : ["#7C3AED", "#6D28D9"];

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={{ borderRadius: 20, overflow: "hidden" }}>
      <LinearGradient colors={gradColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={sc.wrap}>
        <View style={sc.shine1} />
        <View style={sc.shine2} />
        {/* Header row */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={sc.badge}>
            <Brain size={12} color="#FFF" strokeWidth={2.5} />
            <Text style={sc.badgeTxt}> MENTAL WELLNESS</Text>
          </View>
          {data?.burnoutRisk && (
            <View style={sc.burnoutBadge}>
              <Text style={sc.burnoutTxt}>⚠️ Burnout Risk</Text>
            </View>
          )}
        </View>
        {/* Content row */}
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={sc.title}>Stress Check-In</Text>
            <Text style={sc.status}>
              {hasScore ? `${label} · ${data!.count} check-in${data!.count !== 1 ? "s" : ""} today` : "Tap to log your stress level"}
            </Text>
          </View>
          {hasScore ? (
            <View style={sc.ring}>
              <Text style={sc.ringNum}>{score}</Text>
              <Text style={sc.ringLabel}>/100</Text>
            </View>
          ) : (
            <View style={sc.addBtn}>
              <Plus size={20} color="#FFF" strokeWidth={2.5} />
            </View>
          )}
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const sc = StyleSheet.create({
  wrap:        { borderRadius: 20, padding: 16, overflow: "hidden", minHeight: 100 },
  shine1:      { position: "absolute", top: -30, right: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: "rgba(255,255,255,0.1)" },
  shine2:      { position: "absolute", bottom: -20, left: -10, width: 70, height: 70, borderRadius: 35, backgroundColor: "rgba(255,255,255,0.06)" },
  badge:       { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.22)", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4, alignSelf: "flex-start" },
  badgeTxt:    { color: "#FFF", fontSize: 8.5, fontFamily: "Inter_700Bold", letterSpacing: 0.4 },
  burnoutBadge:{ backgroundColor: "rgba(0,0,0,0.25)", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  burnoutTxt:  { color: "#FFF", fontSize: 9, fontFamily: "Inter_700Bold" },
  title:       { fontSize: 16, fontFamily: "Inter_700Bold", color: "#FFF", marginBottom: 3 },
  status:      { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.85)" },
  ring:        { width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" },
  ringNum:     { fontSize: 16, fontFamily: "Inter_700Bold", color: "#FFF", lineHeight: 18 },
  ringLabel:   { fontSize: 8, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)" },
  addBtn:      { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" },
});

// ── MEDICINE ROW ───────────────────────────────────────────────────────────────
const mealColors: Record<string, string> = {
  before_meal: DS.color.orange, after_meal: DS.color.green, with_meal: DS.color.sky, anytime: DS.color.purple,
};
const mealLabels: Record<string, string> = {
  before_meal: "Before Breakfast", after_meal: "After Breakfast", with_meal: "With Meal", anytime: "Anytime",
};

// ── MAIN SCREEN ────────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [healthScore, setHealthScore] = useState(0);
  const [water,       setWater]       = useState({ current: 0, goal: 8 });
  const [calories,    setCalories]    = useState({ eaten: 0, burned: 0 });
  const [nutrition,   setNutrition]   = useState({ protein: 0, carbs: 0, fat: 0 });
  const [exerciseMin, setExerciseMin] = useState(0);
  const [activityPct, setActivityPct] = useState(0);
  const [stressToday, setStressToday] = useState<StressToday | null>(null);
  const [isLoading,   setIsLoading]   = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [userName,    setUserName]    = useState("");
  const [medicines,   setMedicines]   = useState<Array<{
    id: string; medicineName: string; dosage?: string;
    mealTiming: string; reminderTimes: string[]; isActive: boolean;
  }>>([]);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const scrollRef = useRef<ScrollView>(null);

  const greeting = getGreeting();

  const loadData = useCallback(async () => {
    try {
      const date = todayDate();
      const [scoreRes, waterRes, foodRes, exerciseRes, profileRes, medRes, activityRes, stressRes] = await Promise.allSettled([
        api.getHealthScore(date), api.getWaterLog(date), api.getFoodSummary(date),
        api.getExerciseLogs(date), api.getProfile(), api.getMedicineSchedules(),
        api.getWeeklyActivity(), api.getStressToday(),
      ]);
      if (scoreRes.status === "fulfilled") {
        const sc = scoreRes.value.score as Record<string, number>;
        setHealthScore(sc.healthScore ?? 0);
      }
      if (waterRes.status === "fulfilled")
        setWater({ current: waterRes.value.totalGlasses || 0, goal: waterRes.value.goal || 8 });
      if (foodRes.status === "fulfilled") {
        const summ = foodRes.value.summary as Record<string, number>;
        setCalories((c) => ({ ...c, eaten: Math.round(summ.totalCalories || 0) }));
        setNutrition({
          protein: Math.round(Number(summ.totalProteinG || 0)),
          carbs:   Math.round(Number(summ.totalCarbsG   || 0)),
          fat:     Math.round(Number(summ.totalFatG     || 0)),
        });
      }
      if (exerciseRes.status === "fulfilled") {
        const logs = exerciseRes.value.logs as Array<{ durationMinutes: number; caloriesBurned?: string }>;
        setExerciseMin(logs.reduce((s, l) => s + l.durationMinutes, 0));
        setCalories((c) => ({ ...c, burned: Math.round(logs.reduce((s, l) => s + Number(l.caloriesBurned || 0), 0)) }));
      }
      if (profileRes.status === "fulfilled") {
        const p = profileRes.value.profile as Record<string, string>;
        const name = p?.full_name || p?.fullName || "";
        setUserName(name.split(" ")[0] || "");
      }
      if (medRes.status === "fulfilled") {
        setMedicines(
          (medRes.value.schedules as typeof medicines).filter((m) => m.isActive)
        );
      }
      if (activityRes.status === "fulfilled") {
        setActivityPct(activityRes.value.percentage ?? 0);
      }
      if (stressRes.status === "fulfilled") {
        setStressToday(stressRes.value as StressToday);
      }
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[Dashboard] Data load error:", err);
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 460, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, damping: 18,   useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => { loadData(); }, []);

  useFocusEffect(useCallback(() => {
    loadData();
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [loadData]));

  const handleAddWater = async () => {
    if (water.current >= water.goal) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await api.logWater({ glassesCount: 1 });
      setWater((w) => ({ ...w, current: Math.min(w.current + 1, w.goal) }));
    } catch { }
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const today  = new Date().toLocaleDateString("en-IN", { month: "long", day: "numeric", year: "numeric" });

  if (isLoading) {
    return (
      <View style={[s.root, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator size="large" color={DS.color.primary} />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <LinearGradient
        colors={["#FFF8F3", "#F9F2ED", "#FFF8F3"]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }}
            tintColor={DS.color.primary} colors={[DS.color.primary]} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── HEADER ── */}
        <LinearGradient
          colors={["#C0392B", "#E8622A", "#F5A623"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={[s.header, { paddingTop: topPad }]}
        >
          <View style={s.headerRow}>
            <View>
              <Text style={s.greetTxt}>{greeting}</Text>
              <Text style={s.dateTxt}>{today}</Text>
            </View>
            {/* User name where bell used to be */}
            {userName !== "" && (
              <View style={s.namePill}>
                <Heart size={11} color={DS.color.primary} strokeWidth={2.5} fill={DS.color.primary} />
                <Text style={s.namePillTxt} numberOfLines={1}>{userName}</Text>
              </View>
            )}
          </View>
        </LinearGradient>

        {/* ── BODY ── */}
        <Animated.View style={[s.body, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

          {/* 1. SUMMARY BANNER */}
          <SummaryBanner
            greeting={greeting}
            healthScore={healthScore}
            calories={calories}
            water={water}
            exerciseMin={exerciseMin}
            activityPct={activityPct}
          />

          {/* 2. NUTRITION CARD */}
          <NutritionCard
            calories={calories.eaten}
            protein={nutrition.protein}
            carbs={nutrition.carbs}
            fat={nutrition.fat}
          />

          {/* 3. ADS SLIDER */}
          <AdsSlider />

          {/* 4. QUICK SERVICES */}
          <View style={s.surfaceCard}>
            <Text style={s.secTitle}>Quick Services</Text>
            <View style={s.grid}>
              {[
                { icon: <Utensils size={22} color="#FFF" strokeWidth={2.2} />, label: "Meal Log",  color: "#F5A623", route: "/(tabs)/food" },
                { icon: <Dumbbell size={22} color="#FFF" strokeWidth={2.2} />, label: "Exercise",  color: DS.color.green,  route: "/(tabs)/exercise" },
                { icon: <Pill     size={22} color="#FFF" strokeWidth={2.2} />, label: "Medicine",  color: DS.color.purple, route: "/(tabs)/medicine",
                  badge: medicines.length > 0 ? String(medicines.length) : undefined },
                { icon: <ScanLine size={22} color="#FFF" strokeWidth={2.2} />, label: "AI Scan",   color: DS.color.primary, route: "/(tabs)/scan" },
                { icon: <Brain    size={22} color="#FFF" strokeWidth={2.2} />, label: "AI Coach",  color: "#8E44AD", route: "/suggestions" },
                { icon: <FileText size={22} color="#FFF" strokeWidth={2.2} />, label: "Reports",   color: DS.color.sky,     route: "/health-report" },
              ].map((t, i) => (
                <ServiceTile
                  key={i} icon={t.icon} label={t.label} color={t.color}
                  badge={(t as { badge?: string }).badge}
                  onPress={() => router.push(t.route as never)}
                />
              ))}
            </View>
          </View>

          {/* 5. WATER INTAKE */}
          <WaterDots current={water.current} goal={Math.max(water.goal, 6)} onAdd={handleAddWater} />

          {/* 6. STRESS CHECK-IN */}
          <StressCard data={stressToday} onPress={() => router.push("/stress" as never)} />

          {/* 7. TODAY'S MEDICINES */}
          <View style={s.surfaceCard}>
            <View style={s.cardHeader}>
              <Text style={s.secTitle}>Today's Medicines 💊</Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/medicine" as never)}>
                <Text style={s.viewAll}>View All</Text>
              </TouchableOpacity>
            </View>
            {medicines.length === 0 ? (
              <TouchableOpacity
                style={s.emptyRow}
                onPress={() => router.push("/(tabs)/medicine" as never)}
                activeOpacity={0.8}
              >
                <View style={[s.medIcon, { backgroundColor: DS.color.purple + "18" }]}>
                  <Pill size={15} color={DS.color.purple} strokeWidth={2} />
                </View>
                <Text style={s.emptyTxt}>No medicine schedule — Add one</Text>
                <ChevronRight size={14} color={DS.color.purple} strokeWidth={2} />
              </TouchableOpacity>
            ) : (
              medicines.slice(0, 3).map((med, idx) => (
                <View
                  key={med.id}
                  style={[s.medRow, idx === Math.min(medicines.length, 3) - 1 && { borderBottomWidth: 0 }]}
                >
                  <View style={[s.medIcon, { backgroundColor: (mealColors[med.mealTiming] || DS.color.purple) + "18" }]}>
                    <Pill size={15} color={mealColors[med.mealTiming] || DS.color.purple} strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.medName}>{med.medicineName}{med.dosage ? ` · ${med.dosage}` : ""}</Text>
                    <Text style={s.medSub}>{med.reminderTimes[0] || ""} • {mealLabels[med.mealTiming] || "Anytime"}</Text>
                  </View>
                  <ChevronRight size={14} color={DS.color.muted} strokeWidth={1.5} />
                </View>
              ))
            )}
          </View>

          {/* 7. AI FEATURES — 2-column layout */}
          <View style={s.aiGrid}>
            <TouchableOpacity
              style={{ flex: 1 }}
              onPress={() => router.push("/suggestions" as never)}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={["#E8622A", "#F5A623"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={s.aiCard}
              >
                <View style={s.aiShine} />
                <View style={s.aiBadge}><Sparkles size={9} color="#FFF" strokeWidth={2} /><Text style={s.aiBadgeTxt}> AI</Text></View>
                <View style={s.aiIconBox}><Sparkles size={18} color="#FFF" strokeWidth={1.8} /></View>
                <Text style={s.aiTitle}>Daily Coach</Text>
                <Text style={s.aiSub}>AI nutrition insights</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ flex: 1 }}
              onPress={() => router.push("/intelligence" as never)}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={["#8E44AD", "#9B59B6"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={s.aiCard}
              >
                <View style={s.aiShine} />
                <View style={s.aiBadge}><Text style={s.aiBadgeTxt}>🔬 AI</Text></View>
                <View style={s.aiIconBox}><Brain size={18} color="#FFF" strokeWidth={1.8} /></View>
                <Text style={s.aiTitle}>Intelligence</Text>
                <Text style={s.aiSub}>Deep health analysis</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ flex: 1 }}
              onPress={() => router.push("/blood" as never)}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={["#E53E3E", "#FC8181"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={s.aiCard}
              >
                <View style={s.aiShine} />
                <View style={[s.aiBadge, { backgroundColor: "rgba(255,255,255,0.25)" }]}><Text style={s.aiBadgeTxt}>🩸 SOS</Text></View>
                <View style={[s.aiIconBox, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
                  <Text style={{ fontSize: 18 }}>🆘</Text>
                </View>
                <Text style={s.aiTitle}>Blood{"\n"}Emergency</Text>
                <Text style={s.aiSub}>Find donors fast</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

        </Animated.View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1 },
  scroll: { gap: 0 },

  header:    { borderBottomLeftRadius: 24, borderBottomRightRadius: 24, overflow: "hidden" },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16 },
  greetTxt:  { fontSize: 17, fontFamily: "Inter_700Bold", color: "#FFF" },
  dateTxt:   { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)", marginTop: 2 },
  namePill:  { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, maxWidth: 130 },
  namePillTxt: { fontSize: 13, fontFamily: "Inter_700Bold", color: DS.color.primary },

  body:     { paddingHorizontal: 14, paddingTop: 14, gap: 12 },

  surfaceCard: { backgroundColor: "#FFF", borderRadius: 20, padding: 16 },
  cardHeader:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  secTitle:    { fontSize: 15, fontFamily: "Inter_700Bold", color: DS.color.text, marginBottom: 14 },
  viewAll:     { fontSize: 12, fontFamily: "Inter_600SemiBold", color: DS.color.primary },

  grid: { flexDirection: "row", flexWrap: "wrap" },

  emptyRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: DS.color.purple + "0D", borderRadius: 12, padding: 12 },
  emptyTxt: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: DS.color.muted },
  medRow:   { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F3EDE8" },
  medIcon:  { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  medName:  { fontSize: 13, fontFamily: "Inter_600SemiBold", color: DS.color.text },
  medSub:   { fontSize: 11, fontFamily: "Inter_400Regular", color: DS.color.muted, marginTop: 1 },

  aiGrid:    { flexDirection: "row", gap: 8 },
  aiCard:    { borderRadius: 18, padding: 11, minHeight: 108, overflow: "hidden", gap: 6 },
  aiShine:   { position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(255,255,255,0.1)" },
  aiBadge:   { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20, paddingHorizontal: 7, paddingVertical: 3, alignSelf: "flex-start" },
  aiBadgeTxt:{ color: "#FFF", fontSize: 8.5, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  aiIconBox: { width: 36, height: 36, borderRadius: 11, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  aiTitle:   { fontSize: 14, fontFamily: "Inter_700Bold", color: "#FFF", lineHeight: 18 },
  aiSub:     { fontSize: 10.5, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.82)", lineHeight: 14 },
});
