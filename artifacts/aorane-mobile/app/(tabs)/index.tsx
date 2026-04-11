import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Platform, ActivityIndicator,
  Animated, Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { router, useFocusEffect } from "expo-router";
import { api } from "@/lib/api";
import * as Haptics from "expo-haptics";

const { width: W } = Dimensions.get("window");
const C = {
  primary: "#0077B6", sky: "#0EA5E9", accent: "#00B896",
  green: "#10B981", amber: "#F59E0B", purple: "#8B5CF6",
  red: "#EF4444", orange: "#F97316", text: "#0D1F33",
  muted: "#5B7A8E", glass: "rgba(255,255,255,0.78)",
  glassBorder: "rgba(255,255,255,0.9)", bg: "#EBF5FF",
};

function todayDate() { return new Date().toISOString().slice(0, 10); }

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
    shadowColor: C.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 14, elevation: 5, marginBottom: 14,
  },
  fill: { backgroundColor: C.glass, borderRadius: 22 },
});

type FoodLog = { id: string; foodName: string; mealType: string; calories: number; loggedAt?: string; createdAt?: string };
type ExerciseLog = { id: string; exerciseType: string; durationMinutes: number; caloriesBurned?: string; loggedAt?: string; createdAt?: string };
type MedLog = { id: string; medicineName: string; dosage?: string; takenAt?: string; scheduledTime?: string };

export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([]);
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([]);
  const [medLogs, setMedLogs] = useState<MedLog[]>([]);
  const [water, setWater] = useState({ current: 0, goal: 8 });
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"food" | "exercise" | "medicine">("food");
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);

  const loadData = useCallback(async () => {
    try {
      const date = todayDate();
      const [foodRes, exRes, waterRes, medRes] = await Promise.allSettled([
        api.getFoodLogs(date),
        api.getExerciseLogs(date),
        api.getWaterLog(date),
        api.getMedicineLogs(date),
      ]);
      if (foodRes.status === "fulfilled") setFoodLogs((foodRes.value.logs || []) as FoodLog[]);
      if (exRes.status === "fulfilled") setExerciseLogs((exRes.value.logs || []) as ExerciseLog[]);
      if (waterRes.status === "fulfilled") setWater({ current: waterRes.value.totalGlasses || 0, goal: waterRes.value.goal || 8 });
      if (medRes.status === "fulfilled") setMedLogs((medRes.value.logs || []) as MedLog[]);
    } catch { }
    setIsLoading(false);
    setRefreshing(false);
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  useEffect(() => { loadData(); }, []);

  // Refresh data + scroll to top whenever this tab is focused
  useFocusEffect(
    useCallback(() => {
      loadData();
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, [])
  );

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const totalCalEaten = foodLogs.reduce((s, l) => s + (l.calories || 0), 0);
  const totalExMin = exerciseLogs.reduce((s, l) => s + l.durationMinutes, 0);
  const totalCalBurned = exerciseLogs.reduce((s, l) => s + Number(l.caloriesBurned || 0), 0);

  function formatTime(ts?: string) {
    if (!ts) return "";
    const d = new Date(ts);
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  }

  const MEAL_COLORS: Record<string, string> = {
    breakfast: "#F59E0B", lunch: "#10B981", dinner: "#0077B6", snack: "#8B5CF6",
  };
  const MEAL_ICONS: Record<string, string> = {
    breakfast: "sunny-outline", lunch: "restaurant-outline", dinner: "moon-outline", snack: "cafe-outline",
  };
  const EX_ICONS: Record<string, string> = {
    running: "walk-outline", cycling: "bicycle-outline", yoga: "body-outline",
    gym: "barbell-outline", swimming: "water-outline",
  };

  if (isLoading) {
    return (
      <View style={[s.root, { alignItems: "center", justifyContent: "center" }]}>
        <LinearGradient colors={["#C5E8FF", "#DCF5EF", "#EFF8FF"]} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={s.loadText}>Loading activity...</Text>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <LinearGradient colors={["#C5E8FF", "#DCF5EF", "#EFF8FF", "#FFFFFF"]} locations={[0, 0.25, 0.6, 1]} style={StyleSheet.absoluteFill} />
      <View style={s.blob1} /><View style={s.blob2} />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingTop: topPad + 8, paddingBottom: insets.bottom + 96, paddingHorizontal: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={C.primary} colors={[C.primary]} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View style={[s.header, { opacity: fadeAnim }]}>
          <View>
            <Text style={s.title}>Activity</Text>
            <Text style={s.subtitle}>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}</Text>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={() => router.push("/(tabs)/food" as never)}>
            <Ionicons name="add" size={22} color={C.primary} />
          </TouchableOpacity>
        </Animated.View>

        {/* Summary pills */}
        <Animated.View style={[s.summaryRow, { opacity: fadeAnim }]}>
          {[
            { label: "Eaten", value: totalCalEaten, unit: "kcal", color: C.orange, icon: "restaurant-outline", bgColors: ["#F97316", "#FB923C"] as [string,string] },
            { label: "Burned", value: Math.round(totalCalBurned), unit: "kcal", color: C.red, icon: "flame-outline", bgColors: ["#DC2626", "#F87171"] as [string,string] },
            { label: "Active", value: totalExMin, unit: "min", color: C.accent, icon: "barbell-outline", bgColors: ["#059669", "#10B981"] as [string,string] },
            { label: "Water", value: water.current, unit: "gls", color: C.sky, icon: "water-outline", bgColors: ["#0369A1", "#0EA5E9"] as [string,string] },
          ].map(item => (
            <View key={item.label} style={s.summaryPill}>
              <LinearGradient colors={item.bgColors} style={s.pillIcon}>
                <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={14} color="#FFF" />
              </LinearGradient>
              <Text style={[s.pillVal, { color: item.color }]}>{item.value}</Text>
              <Text style={s.pillUnit}>{item.unit}</Text>
              <Text style={s.pillLabel}>{item.label}</Text>
            </View>
          ))}
        </Animated.View>

        {/* Tab switcher */}
        <Animated.View style={[s.tabRow, { opacity: fadeAnim }]}>
          {(["food", "exercise", "medicine"] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              onPress={() => { Haptics.selectionAsync(); setActiveTab(tab); }}
              style={[s.tabBtn, activeTab === tab && s.tabBtnActive]}
            >
              <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>
                {tab === "food" ? "🍛 Food" : tab === "exercise" ? "🏃 Exercise" : "💊 Medicine"}
              </Text>
            </TouchableOpacity>
          ))}
        </Animated.View>

        {/* Content */}
        <Animated.View style={{ opacity: fadeAnim }}>
          {activeTab === "food" && (
            <>
              {foodLogs.length === 0 ? (
                <EmptyState icon="restaurant-outline" message="No meals logged today" cta="Log your first meal" onPress={() => router.push("/(tabs)/food" as never)} />
              ) : (
                <Glass>
                  {foodLogs.map((log, i) => {
                    const mealKey = log.mealType?.toLowerCase() || "snack";
                    const col = MEAL_COLORS[mealKey] || C.primary;
                    const ico = (MEAL_ICONS[mealKey] || "restaurant-outline") as keyof typeof Ionicons.glyphMap;
                    return (
                      <View key={log.id} style={[s.logRow, i === foodLogs.length - 1 && { borderBottomWidth: 0 }]}>
                        <View style={[s.logIcon, { backgroundColor: col + "18" }]}>
                          <Ionicons name={ico} size={18} color={col} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.logTitle}>{log.foodName}</Text>
                          <Text style={s.logSub}>{log.mealType || "Meal"}</Text>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={[s.logVal, { color: col }]}>{log.calories} kcal</Text>
                          <Text style={s.logTime}>{formatTime(log.loggedAt || log.createdAt)}</Text>
                        </View>
                      </View>
                    );
                  })}
                </Glass>
              )}
              <TouchableOpacity style={s.addMoreBtn} onPress={() => router.push("/(tabs)/food" as never)}>
                <LinearGradient colors={[C.orange, "#FB923C"]} style={s.addMoreGrad}>
                  <Ionicons name="add-circle-outline" size={18} color="#FFF" />
                  <Text style={s.addMoreText}>Log Meal</Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}

          {activeTab === "exercise" && (
            <>
              {exerciseLogs.length === 0 ? (
                <EmptyState icon="barbell-outline" message="No exercise logged today" cta="Log a workout" onPress={() => router.push("/(tabs)/exercise" as never)} />
              ) : (
                <Glass>
                  {exerciseLogs.map((log, i) => {
                    const exKey = log.exerciseType?.toLowerCase() || "gym";
                    const ico = (EX_ICONS[exKey] || "barbell-outline") as keyof typeof Ionicons.glyphMap;
                    return (
                      <View key={log.id} style={[s.logRow, i === exerciseLogs.length - 1 && { borderBottomWidth: 0 }]}>
                        <View style={[s.logIcon, { backgroundColor: C.accent + "18" }]}>
                          <Ionicons name={ico} size={18} color={C.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.logTitle}>{log.exerciseType}</Text>
                          <Text style={s.logSub}>{log.durationMinutes} minutes</Text>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={[s.logVal, { color: C.accent }]}>{Math.round(Number(log.caloriesBurned || 0))} kcal</Text>
                          <Text style={s.logTime}>{formatTime(log.loggedAt || log.createdAt)}</Text>
                        </View>
                      </View>
                    );
                  })}
                </Glass>
              )}
              <TouchableOpacity style={s.addMoreBtn} onPress={() => router.push("/(tabs)/exercise" as never)}>
                <LinearGradient colors={[C.accent, "#34D399"]} style={s.addMoreGrad}>
                  <Ionicons name="add-circle-outline" size={18} color="#FFF" />
                  <Text style={s.addMoreText}>Log Exercise</Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}

          {activeTab === "medicine" && (
            <>
              {medLogs.length === 0 ? (
                <EmptyState icon="medkit-outline" message="No medicines logged today" cta="Add medicine" onPress={() => router.push("/(tabs)/medicine" as never)} />
              ) : (
                <Glass>
                  {medLogs.map((log, i) => (
                    <View key={log.id} style={[s.logRow, i === medLogs.length - 1 && { borderBottomWidth: 0 }]}>
                      <View style={[s.logIcon, { backgroundColor: C.purple + "18" }]}>
                        <Ionicons name="medkit-outline" size={18} color={C.purple} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.logTitle}>{log.medicineName}</Text>
                        <Text style={s.logSub}>{log.dosage || "Dose logged"}</Text>
                      </View>
                      <Text style={s.logTime}>{formatTime(log.takenAt || log.scheduledTime)}</Text>
                    </View>
                  ))}
                </Glass>
              )}
              <TouchableOpacity style={s.addMoreBtn} onPress={() => router.push("/(tabs)/medicine" as never)}>
                <LinearGradient colors={[C.purple, "#A78BFA"]} style={s.addMoreGrad}>
                  <Ionicons name="add-circle-outline" size={18} color="#FFF" />
                  <Text style={s.addMoreText}>Add Medicine</Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}
        </Animated.View>

        {/* Water widget */}
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={s.sectionTitle}>Hydration</Text>
          <Glass>
            <View style={s.waterRow}>
              <LinearGradient colors={["#0369A1", "#0EA5E9"]} style={s.waterIcon}>
                <Ionicons name="water-outline" size={20} color="#FFF" />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={s.waterTitle}>{water.current} / {water.goal} glasses</Text>
                <View style={s.waterTrack}>
                  <View style={[s.waterFill, { width: `${Math.min(100, (water.current / water.goal) * 100)}%` }]} />
                </View>
              </View>
              <TouchableOpacity
                style={s.waterAddBtn}
                onPress={async () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  try { await api.logWater({ glassesCount: 1 }); setWater(w => ({ ...w, current: w.current + 1 })); } catch { }
                }}
              >
                <LinearGradient colors={["#0369A1", "#0EA5E9"]} style={s.waterAddGrad}>
                  <Ionicons name="add" size={18} color="#FFF" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Glass>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function EmptyState({ icon, message, cta, onPress }: {
  icon: string; message: string; cta: string; onPress: () => void;
}) {
  return (
    <Glass>
      <View style={{ alignItems: "center", paddingVertical: 24 }}>
        <View style={em.iconBox}>
          <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={32} color={C.primary} />
        </View>
        <Text style={em.msg}>{message}</Text>
        <TouchableOpacity style={em.btn} onPress={onPress}>
          <Text style={em.btnText}>{cta}</Text>
        </TouchableOpacity>
      </View>
    </Glass>
  );
}
const em = StyleSheet.create({
  iconBox: { width: 64, height: 64, borderRadius: 20, backgroundColor: C.primary + "12", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  msg: { fontSize: 14, fontFamily: "Inter_500Medium", color: C.muted, marginBottom: 14, textAlign: "center" },
  btn: { backgroundColor: C.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },
  btnText: { color: "#FFF", fontSize: 13, fontFamily: "Inter_600SemiBold" },
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  loadText: { fontSize: 14, color: C.muted, fontFamily: "Inter_400Regular", marginTop: 12 },
  blob1: { position: "absolute", width: 300, height: 300, borderRadius: 150, backgroundColor: "#7DD3FC", opacity: 0.18, top: -100, right: -100 },
  blob2: { position: "absolute", width: 240, height: 240, borderRadius: 120, backgroundColor: "#6EE7B7", opacity: 0.13, bottom: 150, left: -80 },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16, paddingTop: 4 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", color: C.text },
  subtitle: { fontSize: 12.5, fontFamily: "Inter_400Regular", color: C.muted, marginTop: 2 },
  addBtn: { width: 40, height: 40, borderRadius: 13, backgroundColor: C.glass, borderWidth: 1.2, borderColor: C.glassBorder, alignItems: "center", justifyContent: "center", shadowColor: C.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 },

  summaryRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  summaryPill: { flex: 1, alignItems: "center", gap: 4, paddingVertical: 12, backgroundColor: C.glass, borderRadius: 16, borderWidth: 1.2, borderColor: C.glassBorder, shadowColor: C.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3 },
  pillIcon: { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  pillVal: { fontSize: 16, fontFamily: "Inter_700Bold" },
  pillUnit: { fontSize: 9, color: C.muted, fontFamily: "Inter_400Regular" },
  pillLabel: { fontSize: 9.5, color: C.muted, fontFamily: "Inter_500Medium" },

  tabRow: { flexDirection: "row", backgroundColor: C.glass, borderRadius: 16, borderWidth: 1.2, borderColor: C.glassBorder, padding: 4, marginBottom: 14, shadowColor: C.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 13, alignItems: "center" },
  tabBtnActive: { backgroundColor: C.primary, shadowColor: C.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
  tabText: { fontSize: 11.5, fontFamily: "Inter_600SemiBold", color: C.muted },
  tabTextActive: { color: "#FFF" },

  sectionTitle: { fontSize: 14.5, fontFamily: "Inter_700Bold", color: C.text, marginBottom: 10 },

  logRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "rgba(0,119,182,0.06)" },
  logIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  logTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.text, marginBottom: 2 },
  logSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.muted },
  logVal: { fontSize: 13, fontFamily: "Inter_700Bold", marginBottom: 2 },
  logTime: { fontSize: 10.5, fontFamily: "Inter_400Regular", color: C.muted },

  addMoreBtn: { marginBottom: 14, borderRadius: 16, overflow: "hidden", shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 6 },
  addMoreGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14 },
  addMoreText: { color: "#FFF", fontSize: 15, fontFamily: "Inter_600SemiBold" },

  waterRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  waterIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  waterTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text, marginBottom: 8 },
  waterTrack: { height: 6, backgroundColor: "#E0F2FF", borderRadius: 3, overflow: "hidden" },
  waterFill: { height: 6, backgroundColor: C.sky, borderRadius: 3 },
  waterAddBtn: { marginLeft: 4 },
  waterAddGrad: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
