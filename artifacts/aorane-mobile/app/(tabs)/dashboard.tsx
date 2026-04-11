import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Platform, ActivityIndicator,
  Animated, Dimensions,
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
  Bell, Heart, Flame, Droplets, Dumbbell,
  Utensils, Pill, ScanLine, Brain, FileText,
  ChevronRight, Sparkles,
} from "lucide-react-native";

const { width: W } = Dimensions.get("window");
const P = DS.color.primary;
const G = DS.color.green;

function todayDate() { return new Date().toISOString().slice(0, 10); }

// ── Summary Banner (same size as AdsSlider) ───────────────────────────────────
function SummaryBanner({
  userName, healthScore, calories, water, exerciseMin, onPress,
}: {
  userName: string; healthScore: number; calories: { eaten: number; goal: number; burned: number };
  water: { current: number; goal: number }; exerciseMin: number; onPress: () => void;
}) {
  const scoreColor = healthScore >= 75 ? G : healthScore >= 50 ? DS.color.orange : DS.color.red;
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={bn.outer}>
      <LinearGradient
        colors={["#C0392B", "#E8622A", "#F5A623"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={bn.card}
      >
        {/* shine orbs */}
        <View style={bn.shine1} />
        <View style={bn.shine2} />

        {/* Top row — greeting + score */}
        <View style={bn.topRow}>
          <View style={{ flex: 1 }}>
            <Text style={bn.greetSmall}>Namaste 🙏</Text>
            <Text style={bn.name} numberOfLines={1}>{(userName || "AORANE USER").toUpperCase()}</Text>
          </View>
          <View style={bn.scoreBadge}>
            <Text style={bn.scoreNum}>{healthScore}</Text>
            <Text style={bn.scoreLbl}>Score</Text>
          </View>
        </View>

        {/* Divider */}
        <View style={bn.divider} />

        {/* Stats row */}
        <View style={bn.statsRow}>
          {[
            { icon: <Flame size={14} color="#FFF" strokeWidth={2} />, val: String(calories.eaten), lbl: "kcal in" },
            { icon: <Dumbbell size={14} color="#FFF" strokeWidth={2} />, val: String(calories.burned), lbl: "burned" },
            { icon: <Droplets size={14} color="#FFF" strokeWidth={2} />, val: `${water.current}/${water.goal}`, lbl: "glasses" },
            { icon: <Heart size={14} color="#FFF" strokeWidth={2} />, val: `${exerciseMin}m`, lbl: "active" },
          ].map((s, i) => (
            <View key={i} style={bn.stat}>
              {s.icon}
              <Text style={bn.statVal}>{s.val}</Text>
              <Text style={bn.statLbl}>{s.lbl}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}
const bn = StyleSheet.create({
  outer: { borderRadius: 20, overflow: "hidden", ...DS.shadow.lg },
  card:  { padding: 16, minHeight: 155 },
  shine1: { position: "absolute", width: 140, height: 140, borderRadius: 70, backgroundColor: "rgba(255,255,255,0.07)", top: -40, right: -30 },
  shine2: { position: "absolute", width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(255,255,255,0.05)", bottom: -20, left: 20 },
  topRow:    { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  greetSmall:{ color: "rgba(255,255,255,0.75)", fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 2 },
  name:      { color: "#FFF", fontSize: 15, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  scoreBadge:{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, alignItems: "center", minWidth: 56 },
  scoreNum:  { color: "#FFF", fontSize: 20, fontFamily: "Inter_700Bold" },
  scoreLbl:  { color: "rgba(255,255,255,0.8)", fontSize: 9, fontFamily: "Inter_500Medium", marginTop: 1 },
  divider:   { height: 0.7, backgroundColor: "rgba(255,255,255,0.2)", marginBottom: 10 },
  statsRow:  { flexDirection: "row", justifyContent: "space-between" },
  stat:      { alignItems: "center", gap: 3, flex: 1 },
  statVal:   { color: "#FFF", fontSize: 13, fontFamily: "Inter_700Bold" },
  statLbl:   { color: "rgba(255,255,255,0.72)", fontSize: 9.5, fontFamily: "Inter_400Regular" },
});

// ── Paytm Service Tile — same color, 3D effect ─────────────────────────────────
function ServiceTile({ icon, label, color, onPress, badge }: {
  icon: React.ReactNode; label: string; color: string;
  onPress?: () => void; badge?: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <TouchableOpacity
      style={st.wrap}
      activeOpacity={1}
      onPressIn ={() => Animated.spring(scale, { toValue: 0.90, useNativeDriver: true, damping: 12 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, damping: 10 }).start()}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress?.(); }}
    >
      <Animated.View style={[st.inner, { transform: [{ scale }] }]}>
        {/* 3D effect: top light layer + bottom shadow layer */}
        <View style={[st.shadow3d, { backgroundColor: color + "55" }]} />
        <LinearGradient
          colors={[color + "EE", color]}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          style={st.circle}
        >
          {icon}
          {badge ? (
            <View style={st.badge}>
              <Text style={st.badgeT}>{badge}</Text>
            </View>
          ) : null}
        </LinearGradient>
        <Text style={st.label} numberOfLines={2}>{label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}
const st = StyleSheet.create({
  wrap:    { flex: 1, alignItems: "center" },
  inner:   { alignItems: "center", paddingVertical: 8, gap: 6, width: "100%" },
  shadow3d:{ position: "absolute", width: 54, height: 54, borderRadius: 18, top: 12, left: "50%", marginLeft: -27, transform: [{ translateY: 4 }] },
  circle:  { width: 54, height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  label:   { fontSize: 11, fontFamily: "Inter_600SemiBold", color: DS.color.text, textAlign: "center", lineHeight: 14 },
  badge:   { position: "absolute", top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: "#FFF", alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  badgeT:  { fontSize: 8, fontFamily: "Inter_700Bold", color: P },
});

// ── Water Dots ─────────────────────────────────────────────────────────────────
function WaterDots({ current, goal, onAdd }: { current: number; goal: number; onAdd: () => void }) {
  const dots = Math.max(goal, 6);
  const handlePress = (idx: number) => {
    // If pressing already filled → do nothing, if pressing next empty → fill
    if (idx >= current) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onAdd();
    }
  };
  return (
    <View style={wd.wrap}>
      <View style={wd.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Droplets size={16} color={DS.color.sky} strokeWidth={2} />
          <Text style={wd.title}>Water Intake</Text>
        </View>
        <Text style={wd.sub}>{current} / {goal} glasses</Text>
      </View>
      <View style={wd.dotsRow}>
        {Array.from({ length: dots }).map((_, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => handlePress(i)}
            activeOpacity={0.75}
            style={wd.dotWrap}
          >
            <View style={[wd.dot, i < current ? wd.dotFilled : wd.dotEmpty]}>
              <Droplets size={14} color={i < current ? "#FFF" : DS.color.sky + "80"} strokeWidth={2} />
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
const wd = StyleSheet.create({
  wrap:     { backgroundColor: "#FFF", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: DS.color.border },
  header:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  title:    { fontSize: 14, fontFamily: "Inter_700Bold", color: DS.color.text },
  sub:      { fontSize: 12, fontFamily: "Inter_500Medium", color: DS.color.muted },
  dotsRow:  { flexDirection: "row", justifyContent: "space-between", gap: 6 },
  dotWrap:  { flex: 1, alignItems: "center" },
  dot:      { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  dotFilled:{ backgroundColor: DS.color.sky },
  dotEmpty: { backgroundColor: DS.color.skySoft, borderWidth: 1.5, borderColor: DS.color.sky + "40" },
});

// ── MAIN SCREEN ───────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [healthScore,  setHealthScore]  = useState(0);
  const [water,        setWater]        = useState({ current: 0, goal: 8 });
  const [calories,     setCalories]     = useState({ eaten: 0, goal: 2000, burned: 0 });
  const [exerciseMin,  setExerciseMin]  = useState(0);
  const [isLoading,    setIsLoading]    = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [greeting,     setGreeting]     = useState("Good Morning");
  const [userName,     setUserName]     = useState("");
  const [medicines,    setMedicines]    = useState<Array<{ id: string; medicineName: string; dosage?: string; mealTiming: string; reminderTimes: string[]; isActive: boolean }>>([]);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 5)       setGreeting("Good Night 🌙");
    else if (h < 12) setGreeting("Good Morning ☀️");
    else if (h < 17) setGreeting("Good Afternoon 🌤️");
    else             setGreeting("Good Evening 🌆");
    loadData();
  }, []);

  const loadData = useCallback(async () => {
    try {
      const date = todayDate();
      const [scoreRes, waterRes, foodRes, exerciseRes, profileRes, medRes] = await Promise.allSettled([
        api.getHealthScore(date), api.getWaterLog(date), api.getFoodSummary(date),
        api.getExerciseLogs(date), api.getProfile(), api.getMedicineSchedules(),
      ]);
      if (scoreRes.status === "fulfilled") {
        const s = scoreRes.value.score as Record<string, number>;
        setHealthScore(s.healthScore ?? 0);
      }
      if (waterRes.status === "fulfilled")
        setWater({ current: waterRes.value.totalGlasses || 0, goal: waterRes.value.goal || 8 });
      if (foodRes.status === "fulfilled") {
        const summ = foodRes.value.summary as Record<string, number>;
        setCalories((c) => ({ ...c, eaten: Math.round(summ.totalCalories || 0) }));
      }
      if (exerciseRes.status === "fulfilled") {
        const logs = exerciseRes.value.logs as Array<{ durationMinutes: number; caloriesBurned?: string }>;
        setExerciseMin(logs.reduce((s, l) => s + l.durationMinutes, 0));
        setCalories((c) => ({ ...c, burned: Math.round(logs.reduce((s, l) => s + Number(l.caloriesBurned || 0), 0)) }));
      }
      if (profileRes.status === "fulfilled") {
        const p = profileRes.value.profile as Record<string, string>;
        setUserName(p?.fullName?.split(" ")?.[0] || "");
      }
      if (medRes.status === "fulfilled") {
        setMedicines((medRes.value.schedules as Array<{ id: string; medicineName: string; dosage?: string; mealTiming: string; reminderTimes: string[]; isActive: boolean }>).filter((m) => m.isActive));
      }
    } catch { }
    setIsLoading(false);
    setRefreshing(false);
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 480, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, damping: 18,   useNativeDriver: true }),
    ]).start();
  }, []);

  useFocusEffect(useCallback(() => {
    loadData();
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [loadData]));

  const handleAddWater = async () => {
    if (water.current >= water.goal) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try { await api.logWater({ glassesCount: 1 }); setWater((w) => ({ ...w, current: Math.min(w.current + 1, w.goal) })); } catch { }
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const mealColors: Record<string, string> = {
    before_meal: DS.color.orange, after_meal: G, with_meal: DS.color.sky, anytime: DS.color.purple,
  };
  const mealLabels: Record<string, string> = {
    before_meal: "Before meal", after_meal: "After meal", with_meal: "With meal", anytime: "Anytime",
  };

  if (isLoading) {
    return (
      <View style={[s.root, { alignItems: "center", justifyContent: "center", gap: 16 }]}>
        <LinearGradient colors={["#FFF8F3", "#FFE5D0"]} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color={P} />
        <Text style={s.loadText}>Loading…</Text>
      </View>
    );
  }

  const today = new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

  return (
    <View style={s.root}>
      <LinearGradient
        colors={["#FFF8F3", "#FFE5D0", "#FFF8F3"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(); }}
            tintColor={P} colors={[P]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── HEADER ───────────────────────────────────────────── */}
        <View style={[s.header, { paddingTop: topPad }]}>
          <LinearGradient
            colors={[DS.color.headerStart, DS.color.headerEnd]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={s.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.greet}>{greeting}</Text>
              <Text style={s.date}>{today}</Text>
            </View>
            <TouchableOpacity
              style={s.bellBtn}
              onPress={() => router.push("/notification-settings" as never)}
              activeOpacity={0.8}
            >
              <Bell size={20} color="#FFF" strokeWidth={2} />
              <View style={s.bellDot} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── BODY ─────────────────────────────────────────────── */}
        <Animated.View style={[s.body, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

          {/* 1. SUMMARY BANNER */}
          <SummaryBanner
            userName={userName}
            healthScore={healthScore}
            calories={calories}
            water={water}
            exerciseMin={exerciseMin}
            onPress={() => router.push("/scorecard" as never)}
          />

          {/* 2. ADS SLIDER — right after banner */}
          <AdsSlider />

          {/* 3. QUICK SERVICES — Paytm style, no card shadow, 3D icons */}
          <View style={s.servicesCard}>
            <Text style={s.sectionTitle}>Quick Services</Text>
            <View style={s.grid}>
              {[
                { icon: <Utensils size={22} color="#FFF" strokeWidth={2.2} />, label: "Meal Log",  color: DS.color.orange,   route: "/(tabs)/food" },
                { icon: <Dumbbell size={22} color="#FFF" strokeWidth={2.2} />, label: "Exercise",  color: G,                 route: "/(tabs)/exercise" },
                { icon: <Pill     size={22} color="#FFF" strokeWidth={2.2} />, label: "Medicine",  color: DS.color.purple,   route: "/(tabs)/medicine", badge: medicines.length > 0 ? String(medicines.length) : undefined },
                { icon: <ScanLine size={22} color="#FFF" strokeWidth={2.2} />, label: "AI Scan",   color: P,                 route: "/(tabs)/scan" },
                { icon: <Brain    size={22} color="#FFF" strokeWidth={2.2} />, label: "AI Coach",  color: "#8E44AD",         route: "/suggestions" },
                { icon: <FileText size={22} color="#FFF" strokeWidth={2.2} />, label: "Reports",   color: DS.color.sky,      route: "/health-report" },
              ].map((tile, i) => (
                <ServiceTile
                  key={i}
                  icon={tile.icon}
                  label={tile.label}
                  color={tile.color}
                  badge={(tile as { badge?: string }).badge}
                  onPress={() => router.push(tile.route as never)}
                />
              ))}
            </View>
          </View>

          {/* 4. WATER DOTS */}
          <WaterDots
            current={water.current}
            goal={Math.max(water.goal, 6)}
            onAdd={handleAddWater}
          />

          {/* 5. TODAY'S MEDICINES */}
          <View style={s.card}>
            <View style={s.cardHeader}>
              <Text style={s.sectionTitle}>Today's Medicines 💊</Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/medicine" as never)}>
                <Text style={s.link}>View All</Text>
              </TouchableOpacity>
            </View>
            {medicines.length === 0 ? (
              <TouchableOpacity
                style={s.emptyRow}
                onPress={() => router.push("/(tabs)/medicine" as never)}
                activeOpacity={0.8}
              >
                <Pill size={18} color={DS.color.purple} strokeWidth={2} />
                <Text style={s.emptyText}>No medicine schedule — Add one</Text>
                <ChevronRight size={14} color={DS.color.purple} strokeWidth={2} />
              </TouchableOpacity>
            ) : (
              medicines.slice(0, 3).map((med, idx) => (
                <View key={med.id} style={[s.medRow, idx === Math.min(medicines.length, 3) - 1 && { borderBottomWidth: 0 }]}>
                  <View style={[s.medIcon, { backgroundColor: (mealColors[med.mealTiming] || DS.color.purple) + "18" }]}>
                    <Pill size={14} color={mealColors[med.mealTiming] || DS.color.purple} strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.medName}>{med.medicineName}{med.dosage ? ` · ${med.dosage}` : ""}</Text>
                    <Text style={s.medSub}>{mealLabels[med.mealTiming] || "Anytime"} · {med.reminderTimes[0] || ""}</Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* 6. AI FEATURES */}
          <Text style={s.aiHeading}>AI Features</Text>

          <TouchableOpacity onPress={() => router.push("/suggestions" as never)} activeOpacity={0.88}>
            <LinearGradient
              colors={["#E8622A", "#F5A623", "#F39C12"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={s.aiCard}
            >
              <View style={s.aiShine} />
              <View style={s.aiIconBox}>
                <Sparkles size={26} color="#FFF" strokeWidth={1.8} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.aiTitle}>Daily AI Coach</Text>
                <Text style={s.aiSub}>Personalized food, exercise & health tips</Text>
                <View style={s.aiBadge}><Text style={s.aiBadgeText}>✨ Gemini AI</Text></View>
              </View>
              <ChevronRight size={18} color="rgba(255,255,255,0.8)" strokeWidth={2} />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push("/intelligence" as never)} activeOpacity={0.88} style={{ marginTop: 10 }}>
            <LinearGradient
              colors={["#8E44AD", "#9B59B6", "#C39BD3"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={s.aiCard}
            >
              <View style={s.aiShine} />
              <View style={s.aiIconBox}>
                <Brain size={26} color="#FFF" strokeWidth={1.8} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.aiTitle}>Health Intelligence</Text>
                <Text style={s.aiSub}>Disease risk prediction & weekly diet plan</Text>
                <View style={s.aiBadge}><Text style={s.aiBadgeText}>🔬 DeepSeek AI</Text></View>
              </View>
              <ChevronRight size={18} color="rgba(255,255,255,0.8)" strokeWidth={2} />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:     { flex: 1 },
  loadText: { fontSize: 14, color: DS.color.muted, fontFamily: "Inter_400Regular" },

  // Header
  header: {
    overflow: "hidden",
    borderBottomLeftRadius: 20, borderBottomRightRadius: 20,
  },
  headerRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14,
  },
  greet:   { fontSize: 16, fontFamily: "Inter_700Bold", color: "#FFF" },
  date:    { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)", marginTop: 1 },
  bellBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center", justifyContent: "center",
  },
  bellDot: {
    position: "absolute", top: 7, right: 7,
    width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: "#FFF",
    borderWidth: 1.5, borderColor: P,
  },

  // Body
  body: { paddingHorizontal: 14, paddingTop: 14, gap: 12 },

  // Services card (no shadow, just border)
  servicesCard: {
    backgroundColor: "#FFF",
    borderRadius: 20, padding: 14,
    borderWidth: 1, borderColor: DS.color.border,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },

  // Shared section
  sectionTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: DS.color.text, marginBottom: 12 },
  card: {
    backgroundColor: "#FFF", borderRadius: 18,
    padding: 14, borderWidth: 1, borderColor: DS.color.border,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  link:       { fontSize: 12, fontFamily: "Inter_600SemiBold", color: P },

  // Medicine
  emptyRow:  { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: DS.color.purpleSoft, borderRadius: DS.radius.sm, padding: 12 },
  emptyText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: DS.color.muted },
  medRow:    { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: DS.color.borderLight },
  medIcon:   { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  medName:   { fontSize: 13, fontFamily: "Inter_600SemiBold", color: DS.color.text },
  medSub:    { fontSize: 11, fontFamily: "Inter_400Regular", color: DS.color.muted, marginTop: 1 },

  // AI
  aiHeading: { fontSize: 14, fontFamily: "Inter_700Bold", color: DS.color.text, marginTop: 4 },
  aiCard:    { borderRadius: 18, padding: 16, flexDirection: "row", alignItems: "center", gap: 14, overflow: "hidden" },
  aiShine:   { position: "absolute", top: -30, right: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: "rgba(255,255,255,0.09)" },
  aiIconBox: { width: 50, height: 50, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  aiTitle:   { fontSize: 15, fontFamily: "Inter_700Bold", color: "#FFF" },
  aiSub:     { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.82)", lineHeight: 16 },
  aiBadge:   { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" },
  aiBadgeText: { color: "#FFF", fontSize: 10, fontFamily: "Inter_700Bold" },
});
