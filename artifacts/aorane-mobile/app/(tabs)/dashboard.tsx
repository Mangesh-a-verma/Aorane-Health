import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Platform, ActivityIndicator,
  Animated, Dimensions, Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { WaterTracker } from "@/components/WaterTracker";
import { AdsSlider } from "@/components/AdsSlider";
import { router, useFocusEffect } from "expo-router";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import * as Haptics from "expo-haptics";
import { DS } from "@/lib/theme";
import {
  Bell, Heart, Flame, Droplets, Dumbbell,
  Utensils, Pill, ScanLine, Brain, FileText,
  ChevronRight, Activity, TrendingUp, Zap, Sparkles,
} from "lucide-react-native";

const { width: W } = Dimensions.get("window");
const P  = DS.color.primary;   // #E8622A saffron-orange
const G  = DS.color.green;     // #27AE60

function todayDate() { return new Date().toISOString().slice(0, 10); }

function formatAtmId(id: string): string {
  const clean = id.replace(/[-\s]/g, "").toUpperCase();
  return clean.match(/.{1,4}/g)?.join("  ") || id;
}

// ── Animated MacroBar ─────────────────────────────────────────────────────────
function MacroBar({ label, value, goal, color }: {
  label: string; value: number; goal: number; color: string;
}) {
  const bar = useRef(new Animated.Value(0)).current;
  const pct = Math.min(100, goal > 0 ? (value / goal) * 100 : 0);
  useEffect(() => {
    Animated.timing(bar, { toValue: pct / 100, duration: 800, useNativeDriver: false }).start();
  }, [pct]);
  const barW = bar.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <View style={mb.row}>
      <View style={mb.meta}>
        <Text style={mb.label}>{label}</Text>
        <Text style={[mb.val, { color }]}>{value}g <Text style={mb.goal}>/ {goal}g</Text></Text>
      </View>
      <View style={mb.track}>
        <Animated.View style={[mb.fill, { width: barW as any, backgroundColor: color }]} />
      </View>
    </View>
  );
}
const mb = StyleSheet.create({
  row:   { marginBottom: 10 },
  meta:  { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", color: DS.color.muted },
  val:   { fontSize: 12, fontFamily: "Inter_700Bold", color: DS.color.text },
  goal:  { fontFamily: "Inter_400Regular", color: DS.color.muted },
  track: { height: 6, borderRadius: 3, backgroundColor: DS.color.bgSoft, overflow: "hidden" },
  fill:  { height: 6, borderRadius: 3 },
});

// ── Service tile (Paytm-style) ────────────────────────────────────────────────
function ServiceTile({ icon, label, color, bg, onPress, badge }: {
  icon: React.ReactNode; label: string; color: string; bg: string;
  onPress?: () => void; badge?: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <TouchableOpacity
      style={st.wrap}
      activeOpacity={1}
      onPressIn ={() => Animated.spring(scale, { toValue: 0.92, useNativeDriver: true, damping: 14 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, damping: 10 }).start()}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress?.(); }}
    >
      <Animated.View style={[st.inner, { transform: [{ scale }] }]}>
        <View style={[st.circle, { backgroundColor: bg }]}>
          {icon}
          {badge ? (
            <View style={[st.badge, { backgroundColor: color }]}>
              <Text style={st.badgeT}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={st.label} numberOfLines={2}>{label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}
const st = StyleSheet.create({
  wrap:   { flex: 1, alignItems: "center" },
  inner:  { alignItems: "center", paddingVertical: 8, gap: 7, width: "100%" },
  circle: { width: 58, height: 58, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  label:  { fontSize: 11, fontFamily: "Inter_600SemiBold", color: DS.color.text, textAlign: "center", lineHeight: 14 },
  badge:  { position: "absolute", top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badgeT: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#FFF" },
});

// ── Stat card (4-col top grid) ────────────────────────────────────────────────
function StatCard({ icon, value, unit, label, color, bg }: {
  icon: React.ReactNode; value: string | number; unit?: string;
  label: string; color: string; bg: string;
}) {
  return (
    <View style={[sc.card, { borderTopColor: color, borderTopWidth: 2.5 }]}>
      <View style={[sc.iconBox, { backgroundColor: bg }]}>{icon}</View>
      <Text style={[sc.val, { color }]} numberOfLines={1}>
        {value}{unit ? <Text style={sc.unit}>{unit}</Text> : null}
      </Text>
      <Text style={sc.label} numberOfLines={1}>{label}</Text>
    </View>
  );
}
const sc = StyleSheet.create({
  card:    { flex: 1, backgroundColor: "#FFF", borderRadius: 14, padding: 10, alignItems: "center", gap: 4, borderWidth: 1, borderColor: "rgba(0,0,0,0.055)", ...DS.shadow.sm },
  iconBox: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  val:     { fontSize: 15, fontFamily: "Inter_700Bold", marginTop: 2 },
  unit:    { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  label:   { fontSize: 10, fontFamily: "Inter_500Medium", color: DS.color.muted },
});

// ── Activity row for recent activity ─────────────────────────────────────────
function ActRow({ icon, color, title, sub, time, last }: {
  icon: React.ReactNode; color: string; title: string; sub: string; time: string; last?: boolean;
}) {
  return (
    <View style={[ar.row, last && { borderBottomWidth: 0 }]}>
      <View style={[ar.iconBox, { backgroundColor: color + "18" }]}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={ar.title}>{title}</Text>
        <Text style={ar.sub}>{sub}</Text>
      </View>
      <Text style={ar.time}>{time}</Text>
    </View>
  );
}
const ar = StyleSheet.create({
  row:     { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: DS.color.borderLight },
  iconBox: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  title:   { fontSize: 13, fontFamily: "Inter_600SemiBold", color: DS.color.text, marginBottom: 1 },
  sub:     { fontSize: 11, fontFamily: "Inter_400Regular", color: DS.color.muted },
  time:    { fontSize: 10.5, fontFamily: "Inter_400Regular", color: DS.color.muted },
});

// ── MAIN SCREEN ───────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [healthScore,      setHealthScore]      = useState(0);
  const [confidence,       setConfidence]       = useState(0);
  const [water,            setWater]            = useState({ current: 0, goal: 8 });
  const [calories,         setCalories]         = useState({ eaten: 0, goal: 2000, burned: 0 });
  const [macros,           setMacros]           = useState({ carbs: 0, carbsGoal: 280, fat: 0, fatGoal: 65, fiber: 0, fiberGoal: 30 });
  const [exerciseMin,      setExerciseMin]      = useState(0);
  const [activeScore,      setActiveScore]      = useState<{ overall: number; foodPct: number; waterPct: number; exercisePct: number; label: string } | null>(null);
  const [isLoading,        setIsLoading]        = useState(true);
  const [refreshing,       setRefreshing]       = useState(false);
  const [greeting,         setGreeting]         = useState("Good Morning");
  const [userName,         setUserName]         = useState("");
  const [aoraneId,         setAoraneId]         = useState("");
  const [medicines,        setMedicines]        = useState<Array<{ id: string; medicineName: string; dosage?: string; mealTiming: string; reminderTimes: string[]; isActive: boolean }>>([]);
  const [userAge,          setUserAge]          = useState<number | null>(null);
  const [monthlyActivePct, setMonthlyActivePct] = useState(0);
  const [showActivityModal,setShowActivityModal]= useState(false);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;
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
      const [scoreRes, waterRes, foodRes, exerciseRes, activityRes, profileRes, medRes] = await Promise.allSettled([
        api.getHealthScore(date), api.getWaterLog(date), api.getFoodSummary(date),
        api.getExerciseLogs(date), api.getActivityScore(date),
        api.getProfile(), api.getMedicineSchedules(),
      ]);
      if (scoreRes.status === "fulfilled") {
        const s = scoreRes.value.score as Record<string, number>;
        setHealthScore(s.healthScore ?? 0);
        setConfidence(Number(s.dataConfidencePct) ?? 0);
      }
      if (waterRes.status === "fulfilled")
        setWater({ current: waterRes.value.totalGlasses || 0, goal: waterRes.value.goal || 8 });
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
        setMonthlyActivePct((activityRes.value as Record<string, unknown>).monthlyActivePct as number ?? 0);
      }
      if (profileRes.status === "fulfilled") {
        const p = profileRes.value.profile as Record<string, string>;
        setUserName(p?.fullName?.split(" ")?.[0] || "");
        if (p?.dateOfBirth) {
          const age = Math.floor((Date.now() - new Date(p.dateOfBirth).getTime()) / (86400000 * 365.25));
          setUserAge(age);
        }
        setAoraneId(p?.aoraneId || (user?.id ? "AOR-" + user.id.slice(-6).toUpperCase() : ""));
      }
      if (medRes.status === "fulfilled") {
        setMedicines((medRes.value.schedules as Array<{ id: string; medicineName: string; dosage?: string; mealTiming: string; reminderTimes: string[]; isActive: boolean }>).filter((m) => m.isActive));
      }
    } catch { }
    setIsLoading(false);
    setRefreshing(false);
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, damping: 20, useNativeDriver: true }),
    ]).start();
  }, []);

  useFocusEffect(useCallback(() => {
    loadData();
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [loadData]));

  const handleAddWater = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try { await api.logWater({ glassesCount: 1 }); setWater((w) => ({ ...w, current: w.current + 1 })); } catch { }
  };

  const topPad   = Platform.OS === "web" ? 67 : insets.top;
  const remaining = Math.max(0, calories.goal - calories.eaten + calories.burned);
  const scoreColor = healthScore >= 75 ? G : healthScore >= 50 ? DS.color.orange : DS.color.red;

  if (isLoading) {
    return (
      <View style={[s.root, { alignItems: "center", justifyContent: "center", gap: 16 }]}>
        <ActivityIndicator size="large" color={P} />
        <Text style={s.loadText}>Loading your health data…</Text>
      </View>
    );
  }

  const today = new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  const mealColors: Record<string, string> = {
    before_meal: DS.color.orange, after_meal: G, with_meal: DS.color.sky, anytime: DS.color.purple,
  };
  const mealLabels: Record<string, string> = {
    before_meal: "Before meal", after_meal: "After meal", with_meal: "With meal", anytime: "Anytime",
  };

  return (
    <View style={s.root}>
      {/* Warm gradient background */}
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
        {/* ──────────────────────────────────────────────────────── */}
        {/* GLASSMORPHISM HEADER                                     */}
        {/* ──────────────────────────────────────────────────────── */}
        <View style={[s.headerWrap, { paddingTop: topPad }]}>
          <LinearGradient
            colors={[DS.color.headerStart, DS.color.headerEnd]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={s.headerBorder} />

          <Animated.View style={[s.headerRow, { opacity: fadeAnim }]}>
            {/* Avatar + Greeting */}
            <TouchableOpacity
              style={s.avatarBtn}
              onPress={() => router.push("/(tabs)/profile" as never)}
              activeOpacity={0.8}
            >
              <LinearGradient colors={["rgba(255,255,255,0.35)", "rgba(255,255,255,0.15)"]} style={s.avatar}>
                <Text style={s.avatarLetter}>{(userName || user?.fullName || "A")[0].toUpperCase()}</Text>
              </LinearGradient>
            </TouchableOpacity>

            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={s.greet}>{greeting}{userName ? `, ${userName}` : ""}</Text>
              <Text style={s.dateText}>{today}</Text>
            </View>

            {/* Health Score pill */}
            <TouchableOpacity
              style={s.scorePill}
              onPress={() => setShowActivityModal(true)}
              activeOpacity={0.8}
            >
              <View style={[s.scoreDot, { backgroundColor: scoreColor }]} />
              <Text style={[s.scoreNum, { color: scoreColor }]}>{healthScore}</Text>
              <Text style={s.scoreLabel}>Score</Text>
            </TouchableOpacity>

            {/* Bell */}
            <TouchableOpacity
              style={s.bellBtn}
              onPress={() => router.push("/notification-settings" as never)}
              activeOpacity={0.8}
            >
              <Bell size={20} color="#FFF" strokeWidth={2} />
              <View style={s.bellDot} />
            </TouchableOpacity>
          </Animated.View>
        </View>

        <View style={s.body}>
          {/* ──────────────────────────────────────────────────────── */}
          {/* 4-COLUMN STATS GRID                                      */}
          {/* ──────────────────────────────────────────────────────── */}
          <Animated.View style={[s.statsRow, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <StatCard
              icon={<Heart size={16} color={P} strokeWidth={2.5} />}
              value={healthScore} label="Health" color={P} bg={DS.color.primarySoft}
            />
            <StatCard
              icon={<Flame size={16} color={DS.color.orange} strokeWidth={2.5} />}
              value={calories.eaten} unit=" kcal" label="Calories" color={DS.color.orange} bg={DS.color.orangeSoft}
            />
            <StatCard
              icon={<Droplets size={16} color={DS.color.sky} strokeWidth={2.5} />}
              value={`${water.current}/${water.goal}`} label="Water" color={DS.color.sky} bg={DS.color.skySoft}
            />
            <StatCard
              icon={<Dumbbell size={16} color={G} strokeWidth={2.5} />}
              value={exerciseMin} unit="m" label="Active" color={G} bg={DS.color.greenSoft}
            />
          </Animated.View>

          {/* ──────────────────────────────────────────────────────── */}
          {/* HERO PAN CARD                                            */}
          {/* ──────────────────────────────────────────────────────── */}
          <Animated.View style={[{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], alignItems: "center" }]}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowActivityModal(true); }}
              style={s.heroOuter}
            >
              <LinearGradient
                colors={["#C0392B", "#E8622A", "#F5A623", "#F39C12"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={s.heroCard}
              >
                <View style={s.heroShine} />
                <View style={s.heroShine2} />

                <View style={{ flexDirection: "row", gap: 10 }}>
                  {/* Left */}
                  <View style={{ flex: 45, gap: 5 }}>
                    <View style={s.heroAvatar}>
                      <Text style={s.heroAvatarLetter}>{(userName || "A")[0].toUpperCase()}</Text>
                    </View>
                    <Text style={s.heroName} numberOfLines={2}>
                      {(userName || "AORANE USER").toUpperCase()}
                    </Text>
                    {userAge ? <Text style={s.heroAge}>Age: {userAge} yr</Text> : null}
                  </View>

                  <View style={{ width: 0.7, backgroundColor: "rgba(255,255,255,0.2)", marginVertical: 2 }} />

                  {/* Right */}
                  <View style={{ flex: 55, gap: 2 }}>
                    <Text style={s.heroScoreSup}>HEALTH SCORE</Text>
                    <Text style={s.heroScoreNum}>{healthScore}</Text>
                    <View style={[s.heroStatusBadge, { backgroundColor: healthScore >= 70 ? "rgba(52,199,89,0.25)" : "rgba(255,149,0,0.25)" }]}>
                      <Text style={s.heroStatusText}>{healthScore >= 70 ? "● GOOD" : "▲ IMPROVE"}</Text>
                    </View>
                    <View style={{ gap: 3, marginTop: 5 }}>
                      {[
                        { label: "CAL IN",   val: calories.eaten },
                        { label: "CAL OUT",  val: calories.burned },
                        { label: "BALANCE",  val: calories.eaten - calories.burned },
                      ].map((p) => (
                        <View key={p.label} style={s.heroPillarRow}>
                          <Text style={s.heroPillarLabel}>{p.label}</Text>
                          <Text style={s.heroPillarVal}>{p.val}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>

                {/* Monthly bar */}
                <View style={{ marginTop: 10, gap: 3 }}>
                  <View style={s.heroMonthTrack}>
                    <View style={[s.heroMonthFill, { width: `${Math.min(monthlyActivePct, 100)}%` as any }]} />
                  </View>
                  <Text style={s.heroMonthLabel}>{monthlyActivePct}% Active This Month</Text>
                </View>

                {/* ATM ID */}
                <View style={s.heroAtmRow}>
                  <Text style={s.heroAtmId}>AOR  {formatAtmId(aoraneId.replace(/^AOR[-\s]?/i, ""))}</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* ──────────────────────────────────────────────────────── */}
          {/* PAYTM SERVICES GRID                                      */}
          {/* ──────────────────────────────────────────────────────── */}
          <Animated.View style={[s.card, { opacity: fadeAnim }]}>
            <Text style={s.sectionTitle}>Quick Services</Text>
            <View style={s.servicesGrid}>
              {/* Row 1 */}
              <View style={s.serviceRow}>
                <ServiceTile
                  icon={<Utensils size={24} color={DS.color.orange} strokeWidth={2} />}
                  label="Meal Log" color={DS.color.orange} bg={DS.color.orangeSoft}
                  onPress={() => router.push("/(tabs)/food" as never)}
                />
                <ServiceTile
                  icon={<Dumbbell size={24} color={G} strokeWidth={2} />}
                  label="Exercise" color={G} bg={DS.color.greenSoft}
                  onPress={() => router.push("/(tabs)/exercise" as never)}
                />
                <ServiceTile
                  icon={<Pill size={24} color={DS.color.purple} strokeWidth={2} />}
                  label="Medicine" color={DS.color.purple} bg={DS.color.purpleSoft}
                  onPress={() => router.push("/(tabs)/medicine" as never)}
                  badge={medicines.length > 0 ? String(medicines.length) : undefined}
                />
              </View>
              {/* Row 2 */}
              <View style={s.serviceRow}>
                <ServiceTile
                  icon={<ScanLine size={24} color={P} strokeWidth={2} />}
                  label="AI Scan" color={P} bg={DS.color.primarySoft}
                  onPress={() => router.push("/(tabs)/scan" as never)}
                />
                <ServiceTile
                  icon={<Brain size={24} color="#AF52DE" strokeWidth={2} />}
                  label="AI Coach" color="#AF52DE" bg="#F5EEFF"
                  onPress={() => router.push("/suggestions" as never)}
                />
                <ServiceTile
                  icon={<FileText size={24} color={DS.color.sky} strokeWidth={2} />}
                  label="Reports" color={DS.color.sky} bg={DS.color.skySoft}
                  onPress={() => router.push("/health-report" as never)}
                />
              </View>
            </View>
          </Animated.View>

          {/* ──────────────────────────────────────────────────────── */}
          {/* TODAY'S MEDICINES                                        */}
          {/* ──────────────────────────────────────────────────────── */}
          <Animated.View style={[s.card, { opacity: fadeAnim }]}>
            <View style={s.cardHeader}>
              <Text style={s.sectionTitle}>Today's Medicines 💊</Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/medicine" as never)}>
                <Text style={s.sectionLink}>View All</Text>
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
              <>
                {medicines.slice(0, 4).map((med, idx) => (
                  <View
                    key={med.id}
                    style={[s.medRow, idx === Math.min(medicines.length, 4) - 1 && { borderBottomWidth: 0 }]}
                  >
                    <View style={[s.medIcon, { backgroundColor: (mealColors[med.mealTiming] || DS.color.purple) + "18" }]}>
                      <Pill size={15} color={mealColors[med.mealTiming] || DS.color.purple} strokeWidth={2} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.medName}>{med.medicineName}{med.dosage ? ` · ${med.dosage}` : ""}</Text>
                      <Text style={s.medSub}>{mealLabels[med.mealTiming] || "Anytime"} · {med.reminderTimes.join(", ")}</Text>
                    </View>
                    <View style={[s.medBadge, { backgroundColor: (mealColors[med.mealTiming] || DS.color.purple) + "15" }]}>
                      <Text style={[s.medBadgeText, { color: mealColors[med.mealTiming] || DS.color.purple }]}>
                        {med.reminderTimes[0] || ""}
                      </Text>
                    </View>
                  </View>
                ))}
                {medicines.length > 4 && (
                  <TouchableOpacity
                    style={s.seeMoreBtn}
                    onPress={() => router.push("/(tabs)/medicine" as never)}
                  >
                    <Text style={s.seeMoreText}>+{medicines.length - 4} more medicines</Text>
                    <ChevronRight size={12} color={P} strokeWidth={2} />
                  </TouchableOpacity>
                )}
              </>
            )}
          </Animated.View>

          {/* ──────────────────────────────────────────────────────── */}
          {/* NUTRITION CARD                                           */}
          {/* ──────────────────────────────────────────────────────── */}
          <Animated.View style={[s.card, { opacity: fadeAnim }]}>
            <View style={s.cardHeader}>
              <View>
                <Text style={s.sectionTitle}>Today's Nutrition</Text>
                <Text style={s.cardSubtitle}>Macros breakdown</Text>
              </View>
              <TouchableOpacity onPress={() => router.push("/(tabs)/food" as never)} style={s.viewBtn}>
                <Text style={s.viewBtnText}>Log Food</Text>
              </TouchableOpacity>
            </View>

            {/* Calorie summary row */}
            <View style={s.calRow}>
              {[
                { label: "Consumed",  val: calories.eaten,  color: DS.color.orange },
                { label: "Burned",    val: calories.burned, color: G },
                { label: "Remaining", val: remaining,       color: P },
              ].map((item) => (
                <View key={item.label} style={s.calPill}>
                  <Text style={[s.calVal, { color: item.color }]}>{item.val}</Text>
                  <Text style={s.calLabel}>{item.label}</Text>
                </View>
              ))}
            </View>

            {/* Divider */}
            <View style={s.divider} />

            <MacroBar label="Carbohydrates" value={macros.carbs}  goal={macros.carbsGoal} color={DS.color.orange} />
            <MacroBar label="Fat"           value={macros.fat}    goal={macros.fatGoal}   color={DS.color.purple} />
            <MacroBar label="Fiber"         value={macros.fiber}  goal={macros.fiberGoal} color={G} />
          </Animated.View>

          {/* ──────────────────────────────────────────────────────── */}
          {/* HYDRATION CARD                                           */}
          {/* ──────────────────────────────────────────────────────── */}
          <Animated.View style={[s.card, { opacity: fadeAnim }]}>
            <Text style={s.sectionTitle}>Hydration 💧</Text>
            <WaterTracker current={water.current} goal={water.goal} onAdd={handleAddWater} minimal />
          </Animated.View>

          {/* ──────────────────────────────────────────────────────── */}
          {/* RECENT ACTIVITY                                          */}
          {/* ──────────────────────────────────────────────────────── */}
          <Animated.View style={[s.card, { opacity: fadeAnim }]}>
            <Text style={s.sectionTitle}>Today's Activity</Text>
            <ActRow
              icon={<Utensils size={16} color={DS.color.orange} strokeWidth={2} />}
              color={DS.color.orange}
              title={calories.eaten > 0 ? `${calories.eaten} kcal consumed` : "No meals logged yet"}
              sub="Food intake" time="Today"
            />
            <ActRow
              icon={<Dumbbell size={16} color={G} strokeWidth={2} />}
              color={G}
              title={exerciseMin > 0 ? `${exerciseMin} min workout` : "No exercise logged"}
              sub="Physical activity" time="Today"
            />
            <ActRow
              icon={<Droplets size={16} color={DS.color.sky} strokeWidth={2} />}
              color={DS.color.sky}
              title={`${water.current} of ${water.goal} glasses`}
              sub="Water intake" time="Today" last
            />
          </Animated.View>

          {/* ──────────────────────────────────────────────────────── */}
          {/* ADS SLIDER                                               */}
          {/* ──────────────────────────────────────────────────────── */}
          <Animated.View style={{ opacity: fadeAnim }}>
            <AdsSlider />
          </Animated.View>

          {/* ──────────────────────────────────────────────────────── */}
          {/* AI FEATURES                                              */}
          {/* ──────────────────────────────────────────────────────── */}
          <Text style={[s.sectionTitle, { marginHorizontal: 0, marginTop: 8, marginBottom: 10 }]}>AI Features</Text>

          <TouchableOpacity onPress={() => router.push("/suggestions" as never)} activeOpacity={0.88}>
            <LinearGradient
              colors={["#E8622A", "#F5A623", "#F39C12"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={s.aiCard}
            >
              <View style={s.aiShine} />
              <View style={s.aiIconBox}>
                <Sparkles size={28} color="#FFF" strokeWidth={1.8} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.aiTitle}>Daily AI Coach</Text>
                <Text style={s.aiSub}>Personalized food, exercise & health tips</Text>
                <View style={s.aiBadge}><Text style={s.aiBadgeText}>✨ AI Powered</Text></View>
              </View>
              <ChevronRight size={18} color="rgba(255,255,255,0.8)" strokeWidth={2} />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/intelligence" as never)}
            activeOpacity={0.88}
            style={{ marginTop: 10 }}
          >
            <LinearGradient
              colors={["#8E44AD", "#9B59B6", "#C39BD3"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={s.aiCard}
            >
              <View style={s.aiShine} />
              <View style={s.aiIconBox}>
                <Brain size={28} color="#FFF" strokeWidth={1.8} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.aiTitle}>Health Intelligence</Text>
                <Text style={s.aiSub}>Disease risk prediction & weekly diet plan</Text>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <View style={s.aiBadge}><Text style={s.aiBadgeText}>🔬 DeepSeek AI</Text></View>
                  <View style={[s.aiBadge, { backgroundColor: "rgba(255,255,255,0.12)" }]}>
                    <Text style={s.aiBadgeText}>Monthly</Text>
                  </View>
                </View>
              </View>
              <ChevronRight size={18} color="rgba(255,255,255,0.8)" strokeWidth={2} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ──────────────────────────────────────────────────────── */}
      {/* ACTIVITY SCORE MODAL                                    */}
      {/* ──────────────────────────────────────────────────────── */}
      <Modal
        visible={showActivityModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowActivityModal(false)}
      >
        <TouchableOpacity
          style={s.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowActivityModal(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={s.modalSheet}>
              <View style={s.modalHandle} />
              <View style={s.modalHead}>
                <View>
                  <Text style={s.modalTitle}>⚡ Today's Activity</Text>
                  <Text style={s.modalSub}>{activeScore?.label ?? ""}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowActivityModal(false)}
                  style={s.modalCloseBtn}
                >
                  <Text style={{ fontSize: 16, color: DS.color.muted }}>✕</Text>
                </TouchableOpacity>
              </View>

              {activeScore && (
                <>
                  <LinearGradient
                    colors={activeScore.overall >= 70 ? [P, G] : activeScore.overall >= 40 ? [DS.color.orange, "#F97316"] : ["#6B7280", "#9CA3AF"]}
                    style={s.modalCircle}
                  >
                    <Text style={s.modalCirclePct}>{activeScore.overall}%</Text>
                    <Text style={s.modalCircleLabel}>Active</Text>
                  </LinearGradient>

                  {[
                    { label: "Food",     pct: activeScore.foodPct,     color: DS.color.orange },
                    { label: "Water",    pct: activeScore.waterPct,    color: DS.color.sky },
                    { label: "Exercise", pct: activeScore.exercisePct, color: G },
                  ].map((item) => (
                    <View key={item.label} style={s.modalBar}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 5 }}>
                        <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: DS.color.text }}>{item.label}</Text>
                        <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: item.color }}>{item.pct}%</Text>
                      </View>
                      <View style={{ height: 7, borderRadius: 4, backgroundColor: DS.color.bgSoft, overflow: "hidden" }}>
                        <View style={{ height: 7, borderRadius: 4, width: `${item.pct}%` as any, backgroundColor: item.color }} />
                      </View>
                    </View>
                  ))}

                  <View style={s.modalTip}>
                    <Zap size={14} color={DS.color.orange} strokeWidth={2} />
                    <Text style={s.modalTipText}>
                      {activeScore.overall >= 70
                        ? "Excellent day! Keep up the great work 💪"
                        : activeScore.overall >= 40
                        ? "Good progress! Add more exercise and water"
                        : "Track food, water & exercise for a better score"}
                    </Text>
                  </View>
                </>
              )}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: DS.color.bgSoft },
  loadText:  { fontSize: 14, color: DS.color.muted, fontFamily: "Inter_400Regular", marginTop: 8 },

  // Header (Glassmorphism)
  headerWrap: {
    overflow: "hidden",
    borderBottomWidth: 0.5, borderBottomColor: "rgba(0,0,0,0.07)",
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 4 },
      default: {},
    }),
  },
  headerBorder: { position: "absolute", bottom: 0, left: 0, right: 0, height: 0.5, backgroundColor: "rgba(0,0,0,0.06)" },
  headerRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, paddingTop: 10, gap: 0 },

  avatarBtn:  {},
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarLetter: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#FFF" },

  greet:    { fontSize: 15, fontFamily: "Inter_700Bold", color: "#FFF" },
  dateText: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)", marginTop: 1 },

  scorePill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(255,255,255,0.22)", borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 6,
    marginLeft: "auto",
  },
  scoreDot:  { width: 7, height: 7, borderRadius: 3.5 },
  scoreNum:  { fontSize: 15, fontFamily: "Inter_700Bold", color: "#FFF" },
  scoreLabel:{ fontSize: 10, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)" },

  bellBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center", justifyContent: "center",
    marginLeft: 8,
  },
  bellDot: {
    position: "absolute", top: 7, right: 7,
    width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: "#FFF",
    borderWidth: 1.5, borderColor: DS.color.primary,
  },

  body: { paddingHorizontal: 16, paddingTop: 14, gap: 12 },

  // 4-col stats
  statsRow: { flexDirection: "row", gap: 8 },

  // Hero card
  heroOuter: {
    width: Math.floor(W / 2 + 24),
    borderRadius: 18, overflow: "hidden",
    ...DS.shadow.lg,
  },
  heroCard:   { padding: 13 },
  heroShine:  { position: "absolute", top: -30, right: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: "rgba(255,255,255,0.08)" },
  heroShine2: { position: "absolute", bottom: -25, left: -10, width: 70, height: 70, borderRadius: 35, backgroundColor: "rgba(255,255,255,0.06)" },
  heroAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.35)" },
  heroAvatarLetter: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#FFF" },
  heroName:   { color: "#FFF", fontSize: 9.5, fontFamily: "Inter_700Bold", lineHeight: 12, letterSpacing: 0.4 },
  heroAge:    { color: "rgba(255,255,255,0.6)", fontSize: 8.5, fontFamily: "Inter_400Regular" },
  heroScoreSup: { color: "rgba(255,255,255,0.55)", fontSize: 7, fontFamily: "Inter_700Bold", letterSpacing: 1.8 },
  heroScoreNum: { color: "#FFF", fontSize: 30, fontFamily: "Inter_700Bold", lineHeight: 34 },
  heroStatusBadge: { borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, alignSelf: "flex-start", marginBottom: 3 },
  heroStatusText:  { color: "#FFF", fontSize: 7.5, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  heroPillarRow:   { flexDirection: "row", alignItems: "center", gap: 3 },
  heroPillarLabel: { color: "rgba(255,255,255,0.55)", fontSize: 7, fontFamily: "Inter_500Medium", flex: 1 },
  heroPillarVal:   { color: "#FFF", fontSize: 8.5, fontFamily: "Inter_700Bold" },
  heroMonthTrack:  { height: 1.5, backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 1, overflow: "hidden" },
  heroMonthFill:   { height: 1.5, backgroundColor: "rgba(255,255,255,0.85)", borderRadius: 1 },
  heroMonthLabel:  { color: "rgba(255,255,255,0.5)", fontSize: 7, fontFamily: "Inter_400Regular" },
  heroAtmRow:      { marginTop: 8, borderTopWidth: 0.5, borderTopColor: "rgba(255,255,255,0.15)", paddingTop: 6 },
  heroAtmId:       { color: "rgba(255,255,255,0.88)", fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 2.5 },

  // Section card
  card: {
    backgroundColor: "#FFF", borderRadius: DS.radius.xl,
    padding: 16, borderWidth: 1, borderColor: "rgba(0,0,0,0.055)",
    ...DS.shadow.sm,
  },
  cardHeader:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  cardSubtitle: { fontSize: 11, fontFamily: "Inter_400Regular", color: DS.color.muted, marginTop: 2 },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: DS.color.text, marginBottom: 12, letterSpacing: 0.1 },
  sectionLink:  { fontSize: 12.5, fontFamily: "Inter_600SemiBold", color: P },
  viewBtn: {
    backgroundColor: DS.color.primarySoft, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  viewBtnText: { fontSize: 11.5, fontFamily: "Inter_600SemiBold", color: P },

  // Services grid
  servicesGrid: { gap: 0 },
  serviceRow:   { flexDirection: "row" },

  // Medicine
  emptyRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: DS.color.purpleSoft, borderRadius: DS.radius.sm,
    padding: 12,
  },
  emptyText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: DS.color.muted },
  medRow:    { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: DS.color.borderLight },
  medIcon:   { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  medName:   { fontSize: 13.5, fontFamily: "Inter_600SemiBold", color: DS.color.text, marginBottom: 2 },
  medSub:    { fontSize: 11, fontFamily: "Inter_400Regular", color: DS.color.muted },
  medBadge:  { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10 },
  medBadgeText: { fontSize: 11.5, fontFamily: "Inter_700Bold" },
  seeMoreBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4,
    paddingTop: 8, marginTop: 4,
    borderTopWidth: 1, borderTopColor: DS.color.borderLight,
  },
  seeMoreText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: P },

  // Calorie row
  calRow:  { flexDirection: "row", marginBottom: 14, gap: 4 },
  calPill: { flex: 1, alignItems: "center", paddingVertical: 10, backgroundColor: DS.color.bgSoft, borderRadius: DS.radius.sm },
  calVal:  { fontSize: 17, fontFamily: "Inter_700Bold" },
  calLabel:{ fontSize: 10, fontFamily: "Inter_400Regular", color: DS.color.muted, marginTop: 2 },
  divider: { height: 1, backgroundColor: DS.color.borderLight, marginBottom: 12 },

  // AI cards
  aiCard: {
    borderRadius: DS.radius.xl, padding: 18,
    flexDirection: "row", alignItems: "center", gap: 14,
    overflow: "hidden",
    ...DS.shadow.md,
  },
  aiShine:   { position: "absolute", top: -30, right: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: "rgba(255,255,255,0.09)" },
  aiIconBox: { width: 52, height: 52, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" },
  aiTitle:   { fontSize: 16, fontFamily: "Inter_700Bold", color: "#FFF" },
  aiSub:     { fontSize: 11.5, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)", lineHeight: 16 },
  aiBadge:   { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" },
  aiBadgeText: { color: "#FFF", fontSize: 10, fontFamily: "Inter_700Bold" },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet:   { backgroundColor: "#FFF", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  modalHandle:  { width: 38, height: 4, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.1)", alignSelf: "center", marginBottom: 18 },
  modalHead:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  modalTitle:   { fontSize: 18, fontFamily: "Inter_700Bold", color: DS.color.text },
  modalSub:     { fontSize: 12, fontFamily: "Inter_400Regular", color: DS.color.muted, marginTop: 2 },
  modalCloseBtn:{ width: 32, height: 32, borderRadius: 16, backgroundColor: DS.color.bgSoft, alignItems: "center", justifyContent: "center" },
  modalCircle:  { width: 100, height: 100, borderRadius: 50, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 24 },
  modalCirclePct:   { fontSize: 30, fontFamily: "Inter_700Bold", color: "#FFF" },
  modalCircleLabel: { fontSize: 10, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.75)" },
  modalBar: { marginBottom: 14 },
  modalTip: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFFBEB", borderRadius: 12, padding: 12, marginTop: 6 },
  modalTipText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: DS.color.text, lineHeight: 18 },
});
