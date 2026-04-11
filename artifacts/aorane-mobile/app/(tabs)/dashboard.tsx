import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Platform, ActivityIndicator,
  Animated, Dimensions, FlatList, Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { WaterTracker } from "@/components/WaterTracker";
import { AdsSlider } from "@/components/AdsSlider";
import { router, useFocusEffect } from "expo-router";
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

function formatAtmId(id: string): string {
  const clean = id.replace(/[-\s]/g, "").toUpperCase();
  return clean.match(/.{1,4}/g)?.join("  ") || id;
}

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

// ─── NUTRITION CAROUSEL ───────────────────────────────────────────────────────
type NutritionTile = { key: string; icon: string; value: string; label: string; color: string };

function NutritionCarousel({ items }: { items: NutritionTile[] }) {
  const flatRef = useRef<FlatList<NutritionTile>>(null);
  const idxRef = useRef(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => {
      const next = (idxRef.current + 1) % items.length;
      idxRef.current = next;
      flatRef.current?.scrollToIndex({ index: next, animated: true, viewPosition: 0 });
    }, 2200);
    return () => clearInterval(timer);
  }, [items.length]);

  const TILE_W = 64;

  return (
    <FlatList
      ref={flatRef}
      data={items}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(item) => item.key}
      contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 6 }}
      ItemSeparatorComponent={() => <View style={{ width: 6 }} />}
      getItemLayout={(_, index) => ({ length: TILE_W, offset: (TILE_W + 6) * index, index })}
      onScrollToIndexFailed={() => {}}
      renderItem={({ item }) => (
        <View style={nc.tile}>
          <Text style={nc.icon}>{item.icon}</Text>
          <Text style={[nc.val, { color: item.color }]}>{item.value}</Text>
          <Text style={nc.label}>{item.label}</Text>
        </View>
      )}
    />
  );
}
const nc = StyleSheet.create({
  tile: {
    width: 64, alignItems: "center", gap: 3, paddingVertical: 10, paddingHorizontal: 4,
  },
  icon: { fontSize: 24 },
  val: { fontSize: 13, fontFamily: "Inter_700Bold", textAlign: "center" },
  label: { fontSize: 9, fontFamily: "Inter_400Regular", color: C.muted, textAlign: "center" },
});

// ─── QUICK ACTION BUTTON (compact icon tile) ──────────────────────────────────
function QuickAction({ icon, label, bgColors, onPress }: {
  icon: string; label: string; bgColors: [string, string]; onPress: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  function onIn() { Animated.spring(scaleAnim, { toValue: 0.88, useNativeDriver: true, damping: 12 }).start(); }
  function onOut() { Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 10 }).start(); }
  return (
    <TouchableOpacity activeOpacity={1} onPressIn={onIn} onPressOut={onOut}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      style={{ flex: 1 }}
    >
      <Animated.View style={[qa.tile, { transform: [{ scale: scaleAnim }] }]}>
        <LinearGradient colors={bgColors} style={qa.iconBox}>
          <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={24} color="#FFF" />
        </LinearGradient>
        <Text style={qa.label} numberOfLines={1}>{label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}
const qa = StyleSheet.create({
  tile: {
    alignItems: "center", gap: 6, paddingVertical: 12, paddingHorizontal: 4,
    backgroundColor: C.glass,
    borderRadius: 16, borderWidth: 1.2, borderColor: C.glassBorder,
    shadowColor: C.glassShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  iconBox: {
    width: 48, height: 48, borderRadius: 15,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 5, elevation: 3,
  },
  label: { fontSize: 10.5, fontFamily: "Inter_600SemiBold", color: C.text, textAlign: "center" },
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
  const [aoraneId, setAoraneId] = useState("");
  const [medicines, setMedicines] = useState<Array<{
    id: string; medicineName: string; dosage?: string;
    mealTiming: string; reminderTimes: string[]; isActive: boolean;
  }>>([]);
  const [userAge, setUserAge] = useState<number | null>(null);
  const [monthlyActivePct, setMonthlyActivePct] = useState(0);
  const [showActivityModal, setShowActivityModal] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);

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
        setMonthlyActivePct((activityRes.value as Record<string, unknown>).monthlyActivePct as number ?? 0);
      }
      if (profileRes.status === "fulfilled") {
        const p = profileRes.value.profile as Record<string, string>;
        const fullFirst = p?.fullName?.split(" ")?.[0] || "";
        setUserName(fullFirst);
        if (p?.dateOfBirth) {
          const age = Math.floor((Date.now() - new Date(p.dateOfBirth).getTime()) / (86400000 * 365.25));
          setUserAge(age);
        }
        if (p?.aoraneId) {
          setAoraneId(p.aoraneId);
        } else if (user?.id) {
          setAoraneId("AOR-" + user.id.slice(-6).toUpperCase());
        }
      }
      if (medRes.status === "fulfilled") {
        const activeMeds = (medRes.value.schedules as Array<{
          id: string; medicineName: string; dosage?: string;
          mealTiming: string; reminderTimes: string[]; isActive: boolean;
        }>).filter(m => m.isActive);
        setMedicines(activeMeds);
      }
    } catch { }
    setIsLoading(false);
    setRefreshing(false);
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  // Refresh data + scroll to top every time Home tab is focused (e.g. after food/exercise log)
  useFocusEffect(
    useCallback(() => {
      loadData();
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, [loadData])
  );

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

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingTop: topPad + 6, paddingBottom: insets.bottom + 96, paddingHorizontal: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={C.primary} colors={[C.primary]} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── HEADER ── */}
        <Animated.View style={[s.header, { opacity: fadeAnim }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.greet}>{greeting}{userName ? `, ${userName}` : ""}</Text>
            <View style={s.headerBottomRow}>
              <Text style={s.dateText}>{today}</Text>
              {aoraneId ? (
                <TouchableOpacity style={s.aoraneIdChip} onPress={() => router.push("/profile/scorecard" as never)}>
                  <Ionicons name="id-card-outline" size={11} color={C.primary} />
                  <Text style={s.aoraneIdText}>{aoraneId}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
          <View style={s.headerRight}>
            <TouchableOpacity style={s.notifBtn} onPress={() => router.push("/notification-settings" as never)}>
              <Ionicons name="notifications-outline" size={20} color={C.primary} />
              <View style={s.notifDot} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ── HERO SCORE CARD — PAN/ATM Format ── */}
        <Animated.View style={{ opacity: fadeAnim, marginBottom: 14, alignItems: "center" }}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowActivityModal(true); }}
            style={{ width: Math.floor(W / 2), borderRadius: 18, overflow: "hidden", shadowColor: "#003A75", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.32, shadowRadius: 14, elevation: 10 }}
          >
            <LinearGradient
              colors={["#002D62", "#005EA3", "#0077B6", "#009E82"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={s.heroCard}
            >
              {/* Shine overlays */}
              <View style={s.heroShine} />
              <View style={s.heroShine2} />

              {/* ── TOP ROW: avatar/name | score/pillars ── */}
              <View style={{ flexDirection: "row", gap: 9 }}>
                {/* Left — Photo + Name + Age (PAN style) */}
                <View style={{ flex: 45, gap: 4 }}>
                  <View style={s.heroAvatar}>
                    <Text style={s.heroAvatarLetter}>{(userName || "A")[0].toUpperCase()}</Text>
                  </View>
                  <Text style={s.heroName} numberOfLines={2}>
                    {(userName || "AORANE USER").toUpperCase()}
                  </Text>
                  {userAge ? <Text style={s.heroAge}>Age: {userAge} yr</Text> : null}
                </View>

                {/* Vertical divider */}
                <View style={{ width: 0.8, backgroundColor: "rgba(255,255,255,0.2)", marginVertical: 2 }} />

                {/* Right — Health Score + 3 Pillars */}
                <View style={{ flex: 55, gap: 2 }}>
                  <Text style={s.heroScoreSup}>HEALTH SCORE</Text>
                  <Text style={s.heroScoreNum}>{healthScore}</Text>
                  <View style={[s.heroStatusBadge, { backgroundColor: healthScore >= 70 ? "rgba(0,255,180,0.2)" : "rgba(255,193,7,0.25)" }]}>
                    <Text style={s.heroStatusText}>{healthScore >= 70 ? "● GOOD" : "▲ IMPROVE"}</Text>
                  </View>

                  {/* 3 Calorie Pillars */}
                  <View style={{ gap: 3, marginTop: 5 }}>
                    {[
                      { icon: "🔥", label: "CAL IN", val: calories.eaten },
                      { icon: "⚡", label: "CAL OUT", val: calories.burned },
                      { icon: "⚖️", label: "BALANCE", val: calories.eaten - calories.burned },
                    ].map(p => (
                      <View key={p.label} style={s.heroPillarRow}>
                        <Text style={{ fontSize: 8 }}>{p.icon}</Text>
                        <Text style={s.heroPillarLabel}>{p.label}</Text>
                        <Text style={s.heroPillarVal}>{p.val}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>

              {/* ── Monthly Active Bar (1px thin) ── */}
              <View style={{ marginTop: 10, gap: 3 }}>
                <View style={s.heroMonthlyTrack}>
                  <View style={[s.heroMonthlyFill, { width: `${Math.min(monthlyActivePct, 100)}%` as `${number}%` }]} />
                </View>
                <Text style={s.heroMonthlyLabel}>{monthlyActivePct}% Active This Month</Text>
              </View>

              {/* ── AORANE ID — ATM format ── */}
              <View style={s.heroAtmRow}>
                <Text style={s.heroAtmId}>AOR  {formatAtmId(aoraneId.replace(/^AOR[-\s]?/i, ""))}</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* ── QUICK ACTIONS — single horizontal row ── */}
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={s.sectionTitle}>Quick Actions</Text>
          <View style={s.qaRow}>
            <QuickAction
              icon="restaurant-outline" label="Meal"
              bgColors={["#F97316", "#FB923C"]}
              onPress={() => router.push("/(tabs)/food" as never)}
            />
            <QuickAction
              icon="medkit-outline" label="Medicine"
              bgColors={["#7C3AED", "#8B5CF6"]}
              onPress={() => router.push("/(tabs)/medicine" as never)}
            />
            <QuickAction
              icon="barbell-outline" label="Exercise"
              bgColors={["#059669", "#10B981"]}
              onPress={() => router.push("/(tabs)/exercise" as never)}
            />
            <QuickAction
              icon="document-text-outline" label="Report"
              bgColors={["#005EA3", "#0077B6"]}
              onPress={() => router.push("/health-report" as never)}
            />
          </View>
        </Animated.View>

        {/* ── MEDICINE REMINDER CARD ── */}
        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={s.sectionRow}>
            <Text style={[s.sectionTitle, { marginBottom: 0 }]}>Today's Medicines 💊</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/medicine" as never)}>
              <Text style={s.sectionLink}>View All</Text>
            </TouchableOpacity>
          </View>
          {medicines.length === 0 ? (
            <TouchableOpacity onPress={() => router.push("/(tabs)/medicine" as never)} activeOpacity={0.85}>
              <View style={s.medEmpty}>
                <Ionicons name="medkit-outline" size={20} color={C.purple} />
                <Text style={s.medEmptyText}>Koi medicine schedule nahi — Add karein</Text>
                <Ionicons name="chevron-forward" size={14} color={C.purple} />
              </View>
            </TouchableOpacity>
          ) : (
            <Glass>
              {medicines.slice(0, 4).map((med, idx) => {
                const mealLabel: Record<string, string> = {
                  before_meal: "Khaane se pehle", after_meal: "Khaane ke baad",
                  with_meal: "Khaane ke saath", anytime: "Kabhi bhi",
                };
                const mealColor: Record<string, string> = {
                  before_meal: C.amber, after_meal: C.accent,
                  with_meal: C.sky, anytime: C.purple,
                };
                const isLast = idx === Math.min(medicines.length, 4) - 1;
                return (
                  <View key={med.id} style={[s.medRow, isLast && { borderBottomWidth: 0 }]}>
                    <View style={[s.medDot, { backgroundColor: (mealColor[med.mealTiming] || C.purple) + "20" }]}>
                      <Ionicons name="medical" size={15} color={mealColor[med.mealTiming] || C.purple} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.medName}>{med.medicineName}{med.dosage ? ` · ${med.dosage}` : ""}</Text>
                      <Text style={s.medSub}>{mealLabel[med.mealTiming] || "Kabhi bhi"} · {med.reminderTimes.join(", ")}</Text>
                    </View>
                    <View style={[s.medBadge, { backgroundColor: (mealColor[med.mealTiming] || C.purple) + "15" }]}>
                      <Text style={[s.medBadgeText, { color: mealColor[med.mealTiming] || C.purple }]}>
                        {med.reminderTimes[0] || ""}
                      </Text>
                    </View>
                  </View>
                );
              })}
              {medicines.length > 4 && (
                <TouchableOpacity onPress={() => router.push("/(tabs)/medicine" as never)} style={s.medMoreBtn}>
                  <Text style={s.medMoreText}>+{medicines.length - 4} aur medicines</Text>
                  <Ionicons name="chevron-forward" size={12} color={C.primary} />
                </TouchableOpacity>
              )}
            </Glass>
          )}
        </Animated.View>

        {/* ── NUTRITION CAROUSEL ── */}
        <Animated.View style={{ opacity: fadeAnim, marginBottom: 14 }}>
          <View style={s.sectionRow}>
            <Text style={[s.sectionTitle, { marginBottom: 0 }]}>Today's Nutrition</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/food" as never)}>
              <Text style={s.sectionLink}>View All</Text>
            </TouchableOpacity>
          </View>
          <View style={s.nutritionCarouselWrap}>
            <NutritionCarousel items={[
              { key: "cal",   icon: "🔥", value: `${calories.eaten}`,           label: "kcal\nearned",   color: C.orange  },
              { key: "goal",  icon: "🎯", value: `${remaining}`,                 label: "kcal\nleft",     color: C.red     },
              { key: "burn",  icon: "⚡", value: `${calories.burned}`,           label: "kcal\nburned",   color: C.amber   },
              { key: "carb",  icon: "🍞", value: `${macros.carbs}g`,             label: "Carbs",          color: "#D97706" },
              { key: "fat",   icon: "🥑", value: `${macros.fat}g`,               label: "Fat",            color: C.purple  },
              { key: "fiber", icon: "🥦", value: `${macros.fiber}g`,             label: "Fiber",          color: C.accent  },
              { key: "water", icon: "💧", value: `${water.current}/${water.goal}`,label: "Water",         color: C.sky     },
              { key: "ex",    icon: "🏃", value: `${exerciseMin}m`,              label: "Active",         color: C.green   },
              { key: "vC",    icon: "🍊", value: "—",                            label: "Vit C",          color: "#F97316" },
              { key: "vD",    icon: "☀️", value: "—",                            label: "Vit D",          color: C.amber   },
              { key: "ca",    icon: "🥛", value: "—",                            label: "Calcium",        color: C.sky     },
              { key: "fe",    icon: "🥩", value: "—",                            label: "Iron",           color: "#EF4444" },
            ]} />
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

        {/* ── WATER TRACKER — same height as AdsSlider (118px) ── */}
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={s.sectionTitle}>Hydration</Text>
          <View style={s.hydrationCard}>
            {Platform.OS === "ios" && (
              <BlurView intensity={55} tint="extraLight" style={StyleSheet.absoluteFill} />
            )}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: C.glass, borderRadius: 20 }]} />
            <View style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
              <WaterTracker current={water.current} goal={water.goal} onAdd={handleAddWater} minimal />
            </View>
          </View>
        </Animated.View>

        {/* Activity Score section removed — now inside hero card */}

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
      </ScrollView>

      {/* ── ACTIVITY SCORE MODAL ── */}
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

              {/* Modal header */}
              <View style={s.modalHeader}>
                <View>
                  <Text style={s.modalTitle}>⚡ Today's Activity</Text>
                  <Text style={s.modalSub}>{activeScore?.label ?? ""}</Text>
                </View>
                <TouchableOpacity onPress={() => setShowActivityModal(false)} style={s.modalCloseBtn}>
                  <Ionicons name="close" size={18} color={C.muted} />
                </TouchableOpacity>
              </View>

              {/* Big % circle */}
              {activeScore && (
                <>
                  <LinearGradient
                    colors={activeScore.overall >= 70 ? ["#064E3B","#0D9488"] : activeScore.overall >= 40 ? ["#92400E","#F59E0B"] : ["#374151","#6B7280"]}
                    style={s.modalCircle}
                  >
                    <Text style={s.modalCirclePct}>{activeScore.overall}%</Text>
                    <Text style={s.modalCircleLabel}>Active</Text>
                  </LinearGradient>

                  {/* Breakdown bars */}
                  {[
                    { label: "Food", pct: activeScore.foodPct, icon: "🍛", color: C.orange },
                    { label: "Water", pct: activeScore.waterPct, icon: "💧", color: C.sky },
                    { label: "Exercise", pct: activeScore.exercisePct, icon: "🏃", color: C.accent },
                  ].map(item => (
                    <View key={item.label} style={s.modalBar}>
                      <View style={s.modalBarHeader}>
                        <Text style={s.modalBarLabel}>{item.icon} {item.label}</Text>
                        <Text style={[s.modalBarPct, { color: item.color }]}>{item.pct}%</Text>
                      </View>
                      <View style={s.modalBarTrack}>
                        <View style={[s.modalBarFill, { width: `${item.pct}%`, backgroundColor: item.color }]} />
                      </View>
                    </View>
                  ))}

                  {/* Tips */}
                  <View style={s.modalTip}>
                    <Ionicons name="bulb-outline" size={15} color={C.amber} />
                    <Text style={s.modalTipText}>
                      {activeScore.overall >= 70
                        ? "Aaj ka din bahut productive raha! Keep it up 💪"
                        : activeScore.overall >= 40
                        ? "Acha progress! Thoda aur exercise aur paani peeyo"
                        : "Kal se food, water aur exercise track karo for better score"}
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
  root: { flex: 1, backgroundColor: C.bg },
  loadRing: { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(255,255,255,0.9)", alignItems: "center", justifyContent: "center", shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 6 },
  loadText: { fontSize: 14, color: C.muted, fontFamily: "Inter_400Regular" },

  blob1: { position: "absolute", width: 340, height: 340, borderRadius: 170, backgroundColor: "#7DD3FC", opacity: 0.2, top: -110, right: -130 },
  blob2: { position: "absolute", width: 280, height: 280, borderRadius: 140, backgroundColor: "#6EE7B7", opacity: 0.15, bottom: 200, left: -100 },
  blob3: { position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: "#C7D2FE", opacity: 0.12, top: 300, left: 80 },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16, paddingTop: 4 },
  greet: { fontSize: 20, fontFamily: "Inter_700Bold", color: C.text },
  headerBottomRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  dateText: { fontSize: 12.5, fontFamily: "Inter_400Regular", color: C.muted },
  aoraneIdChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(0,119,182,0.08)",
    borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3,
    borderWidth: 1, borderColor: "rgba(0,119,182,0.15)",
  },
  aoraneIdText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: C.primary },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  notifBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.glass, borderWidth: 1.2, borderColor: C.glassBorder, alignItems: "center", justifyContent: "center" },
  notifDot: { position: "absolute", top: 6, right: 6, width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.red, borderWidth: 1.5, borderColor: "#FFF" },

  heroCard: { padding: 12 },
  heroShine: { position: "absolute", top: -30, right: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: "rgba(255,255,255,0.08)" },
  heroShine2: { position: "absolute", bottom: -25, left: -10, width: 70, height: 70, borderRadius: 35, backgroundColor: "rgba(255,255,255,0.06)" },

  heroAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.35)" },
  heroAvatarLetter: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#FFF" },
  heroName: { color: "#FFF", fontSize: 9.5, fontFamily: "Inter_700Bold", lineHeight: 12, letterSpacing: 0.4 },
  heroAge: { color: "rgba(255,255,255,0.6)", fontSize: 8.5, fontFamily: "Inter_400Regular" },

  heroScoreSup: { color: "rgba(255,255,255,0.55)", fontSize: 7, fontFamily: "Inter_700Bold", letterSpacing: 1.8 },
  heroScoreNum: { color: "#FFF", fontSize: 30, fontFamily: "Inter_700Bold", lineHeight: 34 },
  heroStatusBadge: { borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, alignSelf: "flex-start", marginBottom: 3 },
  heroStatusText: { color: "#FFF", fontSize: 7.5, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },

  heroPillarRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  heroPillarLabel: { color: "rgba(255,255,255,0.55)", fontSize: 7, fontFamily: "Inter_500Medium", flex: 1 },
  heroPillarVal: { color: "#FFF", fontSize: 8.5, fontFamily: "Inter_700Bold" },

  heroMonthlyTrack: { height: 1.5, backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 1, overflow: "hidden" },
  heroMonthlyFill: { height: 1.5, backgroundColor: "rgba(255,255,255,0.85)", borderRadius: 1 },
  heroMonthlyLabel: { color: "rgba(255,255,255,0.5)", fontSize: 7, fontFamily: "Inter_400Regular" },

  heroAtmRow: { marginTop: 8, borderTopWidth: 0.5, borderTopColor: "rgba(255,255,255,0.15)", paddingTop: 6 },
  heroAtmId: { color: "rgba(255,255,255,0.88)", fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 2.5 },

  sectionTitle: { fontSize: 14.5, fontFamily: "Inter_700Bold", color: C.text, marginBottom: 10, letterSpacing: 0.2 },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sectionLink: { fontSize: 12.5, fontFamily: "Inter_600SemiBold", color: C.primary },

  // Medicine reminder styles
  medEmpty: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: C.glass, borderRadius: 16, padding: 14, marginBottom: 14,
    borderWidth: 1.2, borderColor: C.glassBorder,
    shadowColor: C.glassShadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  medEmptyText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: C.muted },
  medRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "rgba(0,119,182,0.06)",
  },
  medDot: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  medName: { fontSize: 13.5, fontFamily: "Inter_600SemiBold", color: C.text, marginBottom: 2 },
  medSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.muted },
  medBadge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10 },
  medBadgeText: { fontSize: 11.5, fontFamily: "Inter_700Bold" },
  medMoreBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4,
    paddingTop: 10, marginTop: 2, borderTopWidth: 1, borderTopColor: "rgba(0,119,182,0.08)",
  },
  medMoreText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.primary },

  qaRow: { flexDirection: "row", gap: 8, marginBottom: 14 },

  nutritionCarouselWrap: {
    marginHorizontal: -16,
    backgroundColor: "transparent",
  },

  hydrationCard: {
    height: 118,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1.2, borderColor: C.glassBorder,
    backgroundColor: Platform.OS === "ios" ? "transparent" : C.glass,
    shadowColor: C.glassShadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 4,
    marginBottom: 14,
    justifyContent: "center",
    paddingHorizontal: 2,
  },

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

  // Activity row inside hero card
  activityRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginTop: 12, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.18)",
  },
  activityRowLeft: { flex: 1, gap: 5 },
  activityRowLabel: { fontSize: 9.5, fontFamily: "Inter_700Bold", color: "rgba(255,255,255,0.65)", letterSpacing: 1.2 },
  activityRowBar: { height: 5, backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 3, overflow: "hidden" },
  activityRowFill: { height: 5, backgroundColor: "rgba(255,255,255,0.85)", borderRadius: 3 },
  activityRowRight: { flexDirection: "row", alignItems: "center", gap: 4, paddingLeft: 12 },
  activityRowPct: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#FFF" },

  // Activity Modal
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 36,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 20,
  },
  modalHandle: {
    width: 38, height: 4, borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.12)",
    alignSelf: "center", marginBottom: 18,
  },
  modalHeader: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: C.text },
  modalSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: C.muted, marginTop: 2 },
  modalCloseBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.06)",
    alignItems: "center", justifyContent: "center",
  },
  modalCircle: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: "center", justifyContent: "center",
    alignSelf: "center", marginBottom: 24,
  },
  modalCirclePct: { fontSize: 30, fontFamily: "Inter_700Bold", color: "#FFF" },
  modalCircleLabel: { fontSize: 10, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.75)" },
  modalBar: { marginBottom: 16 },
  modalBarHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 7 },
  modalBarLabel: { fontSize: 13.5, fontFamily: "Inter_600SemiBold", color: C.text },
  modalBarPct: { fontSize: 13.5, fontFamily: "Inter_700Bold" },
  modalBarTrack: { height: 8, backgroundColor: "rgba(0,0,0,0.07)", borderRadius: 4, overflow: "hidden" },
  modalBarFill: { height: 8, borderRadius: 4 },
  modalTip: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: "rgba(245,158,11,0.08)",
    borderRadius: 14, padding: 12, marginTop: 4,
    borderWidth: 1, borderColor: "rgba(245,158,11,0.2)",
  },
  modalTipText: { flex: 1, fontSize: 12.5, fontFamily: "Inter_400Regular", color: C.text, lineHeight: 18 },
});
