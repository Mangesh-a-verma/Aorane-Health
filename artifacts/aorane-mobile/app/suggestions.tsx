import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, ActivityIndicator, RefreshControl, Animated,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { DS } from "@/lib/theme";

const C = {
  bg: DS.color.bgSoft, card: "#FFFFFF", primary: DS.color.primary, accent: DS.color.green,
  text: DS.color.text, muted: DS.color.muted, border: DS.color.border,
  red: DS.color.red, yellow: DS.color.yellow, green: DS.color.green, purple: DS.color.purple,
  orange: DS.color.orange,
};

type Suggestion = Record<string, unknown>;
type FoodItem = { name: string; nameHindi: string; calories: number; proteinG: number; carbsG: number; fatG: number; portion: string; reason: string; mealType: string; isSeasonalSpecial: boolean };
type ExerciseSuggestion = { type: string; durationMinutes: number; caloriesToBurn: number; description: string; intensity: string };
type WaterReminder = { current: number; goal: number; message: string; tipsForDrinkingMore: string[] };
type HealthTip = { tip: string; category: string; emoji: string };
type MedicalWarning = { condition: string; warning: string; foodsToAvoid: string[]; foodsToPrefer: string[] };
type CalorieStatus = { goal: number; eaten: number; remaining: number; message: string };
type TargetProgress = { currentWeight: number; targetWeight: number; weightGap: number; estimatedWeeks: number; weeklyMessage: string };

const MEAL_COLORS: Record<string, string[]> = {
  breakfast: ["#F59E0B", "#FBBF24"],
  lunch: ["#10B981", "#34D399"],
  dinner: ["#0077B6", "#0EA5E9"],
  snack: ["#7C3AED", "#A78BFA"],
};
const MEAL_ICONS: Record<string, string> = {
  breakfast: "☀️", lunch: "🍱", dinner: "🌙", snack: "🍎",
};
const INTENSITY_COLORS: Record<string, string> = { light: "#10B981", moderate: "#F59E0B", intense: "#EF4444" };

function CaloriePie({ eaten, goal }: { eaten: number; goal: number }) {
  const pct = Math.min(100, (eaten / Math.max(goal, 1)) * 100);
  const remaining = Math.max(0, goal - eaten);
  const over = eaten > goal;
  return (
    <View style={{ alignItems: "center", gap: 4 }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: over ? "#FEE2E2" : "#E0F2FE", alignItems: "center", justifyContent: "center", borderWidth: 5, borderColor: over ? C.red : C.primary }}>
        <Text style={{ color: over ? C.red : C.primary, fontSize: 13, fontFamily: "Inter_700Bold" }}>{Math.round(pct)}%</Text>
      </View>
      <Text style={{ color: C.text, fontSize: 12, fontFamily: "Inter_600SemiBold" }}>{remaining} kcal remaining</Text>
    </View>
  );
}

function MacroBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / Math.max(max, 1)) * 100);
  return (
    <View style={{ flex: 1, gap: 3 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: C.muted, fontSize: 10, fontFamily: "Inter_600SemiBold" }}>{label}</Text>
        <Text style={{ color: C.text, fontSize: 10, fontFamily: "Inter_600SemiBold" }}>{value}g</Text>
      </View>
      <View style={{ height: 4, backgroundColor: "#E8F2F8", borderRadius: 2 }}>
        <View style={{ height: 4, width: `${pct}%`, backgroundColor: color, borderRadius: 2 }} />
      </View>
    </View>
  );
}

function FoodCard({ food, index }: { food: FoodItem; index: number }) {
  const [open, setOpen] = useState(false);
  const grad = MEAL_COLORS[food.mealType] || MEAL_COLORS.snack;
  return (
    <TouchableOpacity onPress={() => { setOpen(!open); Haptics.selectionAsync(); }} activeOpacity={0.87}>
      <View style={[styles.card, { borderColor: C.border }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <LinearGradient colors={grad as [string, string]} style={styles.foodIcon}>
            <Text style={{ fontSize: 18 }}>{MEAL_ICONS[food.mealType] || "🍽️"}</Text>
          </LinearGradient>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ color: C.text, fontFamily: "Inter_700Bold", fontSize: 15 }}>{food.name}</Text>
              {food.isSeasonalSpecial && <Text style={{ fontSize: 10, color: C.accent, fontFamily: "Inter_600SemiBold" }}>🌿 Seasonal</Text>}
            </View>
            <Text style={{ color: C.muted, fontFamily: "Inter_400Regular", fontSize: 12 }}>{food.nameHindi} · {food.portion}</Text>
          </View>
          <View style={{ alignItems: "flex-end", gap: 2 }}>
            <Text style={{ color: C.primary, fontFamily: "Inter_700Bold", fontSize: 15 }}>{food.calories}</Text>
            <Text style={{ color: C.muted, fontSize: 10, fontFamily: "Inter_400Regular" }}>kcal</Text>
          </View>
          <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={C.muted} />
        </View>

        {open && (
          <View style={{ marginTop: 10, gap: 8 }}>
            <Text style={{ color: C.text, fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 18, backgroundColor: "#F8FCFF", borderRadius: 8, padding: 10 }}>
              💡 {food.reason}
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <MacroBar label="Protein" value={food.proteinG} max={30} color={C.purple} />
              <MacroBar label="Carbs" value={food.carbsG} max={80} color={C.yellow} />
              <MacroBar label="Fat" value={food.fatG} max={30} color={C.orange} />
            </View>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function SectionHeader({ icon, title, subtitle, color }: { icon: string; title: string; subtitle?: string; color: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
      <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: color + "20", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 18 }}>{icon}</Text>
      </View>
      <View>
        <Text style={{ color: C.text, fontFamily: "Inter_700Bold", fontSize: 16 }}>{title}</Text>
        {subtitle ? <Text style={{ color: C.muted, fontFamily: "Inter_400Regular", fontSize: 12 }}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

export default function SuggestionsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const userPlan = ((user as Record<string, unknown>)?.plan as string || "free").toLowerCase();
  const isPremium = userPlan !== "free";
  const [suggestions, setSuggestions] = useState<Suggestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const topPad = insets.top;

  const load = useCallback(async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        await api.refreshSuggestions().catch(() => {});
      }
      const res = await api.getDailySuggestions();
      setSuggestions(res.suggestions);
      setFromCache(res.fromCache);
      setError(null);
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: Platform.OS !== "web" }).start();
    } catch (e: unknown) {
      const msg = (e as Error)?.message || "";
      if (msg.includes("429") || msg.includes("rate limit") || msg.includes("limit")) {
        setError("AI Coach is taking a short break. Your cached plan is shown below — refresh after a while to get fresh suggestions.");
      } else if (msg.includes("profile") || msg.includes("complete")) {
        setError("Please complete your health profile first so AI Coach can personalise suggestions for you.");
      } else {
        setError("Could not load suggestions right now. Tap the refresh button to try again.");
      }
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    load(true);
  };

  const s = suggestions;
  const calorieStatus = s?.calorieStatus as CalorieStatus | undefined;
  const foodSuggestions = (s?.foodSuggestions as FoodItem[]) || [];
  const exerciseSuggestion = s?.exerciseSuggestion as ExerciseSuggestion | undefined;
  const waterReminder = s?.waterReminder as WaterReminder | undefined;
  const healthTip = s?.healthTip as HealthTip | undefined;
  const medicalWarnings = (s?.medicalWarnings as MedicalWarning[]) || [];
  const motivation = s?.motivation as string || "";
  const targetProgress = s?.targetProgress as TargetProgress | undefined;
  const rawGreeting = s?.greeting as string || "";
  const timeGreeting = (() => {
    const h = new Date().getHours();
    if (h < 5)  return "Good Night 🌙";
    if (h < 12) return "Good Morning ☀️";
    if (h < 17) return "Good Afternoon 🌤️";
    return "Good Evening 🌆";
  })();
  const greeting = rawGreeting || `${timeGreeting} — Here's your personalised health plan for today!`;

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: DS.color.bgSoft, alignItems: "center", justifyContent: "center", gap: 16 }}>
        <ActivityIndicator size="large" color={DS.color.primary} />
        <Text style={{ color: DS.color.primary, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>AI Coach is getting ready... 🤖</Text>
        <Text style={{ color: DS.color.muted, fontFamily: "Inter_400Regular", fontSize: 13 }}>Building personalised suggestions from your profile</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: DS.color.bgSoft }}>
      {/* Glass Header */}
      <View style={{ overflow: "hidden", borderBottomWidth: 0.5, borderBottomColor: "rgba(0,0,0,0.07)" }}>
        {Platform.OS === "ios"
          ? <BlurView intensity={80} tint="extraLight" style={StyleSheet.absoluteFill} />
          : <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(255,255,255,0.96)" }]} />
        }
        <View style={{ paddingTop: topPad + 8, paddingHorizontal: 16, paddingBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={22} color={DS.color.primary} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={{ color: DS.color.text, fontSize: 22, fontFamily: "Inter_700Bold" }}>AI Daily Coach 🤖</Text>
              <Text style={{ color: DS.color.muted, fontSize: 12, fontFamily: "Inter_400Regular" }}>
                {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })} · {fromCache ? "Cached plan" : "Fresh plan ✨"}
              </Text>
            </View>
            <TouchableOpacity onPress={handleRefresh} style={styles.refreshBtn}>
              <Ionicons name="refresh-outline" size={18} color={DS.color.primary} />
            </TouchableOpacity>
          </View>

          {greeting && (
            <View style={{ marginTop: 12, backgroundColor: DS.color.primarySoft, borderRadius: 14, padding: 13, borderWidth: 1, borderColor: DS.color.primary + "20" }}>
              <Text style={{ color: DS.color.primary, fontFamily: "Inter_600SemiBold", fontSize: 14, lineHeight: 21 }}>{greeting}</Text>
            </View>
          )}

          {calorieStatus && (
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              {[
                { icon: "🔥", label: "Calories", val: `${calorieStatus.eaten}/${calorieStatus.goal}`, sub: "kcal" },
                { icon: "💧", label: "Water", val: waterReminder ? `${waterReminder.current}/${waterReminder.goal}` : "—", sub: "glasses" },
                { icon: "💪", label: "Exercise", val: exerciseSuggestion ? `${exerciseSuggestion.durationMinutes}` : "—", sub: "min goal" },
              ].map(stat => (
                <View key={stat.label} style={{ flex: 1, backgroundColor: "#FFF", borderRadius: 12, padding: 10, alignItems: "center", borderWidth: 1, borderColor: DS.color.border }}>
                  <Text style={{ fontSize: 16 }}>{stat.icon}</Text>
                  <Text style={{ color: DS.color.text, fontFamily: "Inter_700Bold", fontSize: 13, marginTop: 2 }}>{stat.val}</Text>
                  <Text style={{ color: DS.color.muted, fontFamily: "Inter_400Regular", fontSize: 9.5 }}>{stat.sub}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Free plan upgrade banner */}
      {!isPremium && (
        <TouchableOpacity onPress={() => router.push("/upgrade" as never)} activeOpacity={0.9}
          style={{ margin: 16, marginBottom: 0 }}>
          <LinearGradient colors={["#E8622A", "#F5A623"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Text style={{ fontSize: 26 }}>⚡</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 14 }}>Free Plan — Limited AI Coach</Text>
              <Text style={{ color: "rgba(255,255,255,0.85)", fontFamily: "Inter_400Regular", fontSize: 12 }}>Upgrade to Max for personalised diet plans, exercise routines & more.</Text>
            </View>
            <View style={{ backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 11 }}>Upgrade</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {error && (
        <View style={{ margin: 16, backgroundColor: "#FEE2E2", borderRadius: 12, padding: 14, flexDirection: "row", gap: 10 }}>
          <Ionicons name="alert-circle" size={18} color={C.red} />
          <Text style={{ color: C.red, fontFamily: "Inter_400Regular", fontSize: 13, flex: 1 }}>{error}</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 40, gap: 14 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.primary} colors={[C.primary]} />}
      >
        {/* ── CALORIE STATUS ── */}
        {calorieStatus && (
          <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
            <SectionHeader icon="🔥" title="Today's Calorie Status" color={C.orange} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
              <CaloriePie eaten={calorieStatus.eaten} goal={calorieStatus.goal} />
              <View style={{ flex: 1, gap: 8 }}>
                {[
                  { label: "Goal", value: calorieStatus.goal, color: C.primary },
                  { label: "Eaten", value: calorieStatus.eaten, color: C.green },
                  { label: "Remaining", value: calorieStatus.remaining, color: calorieStatus.remaining === 0 ? C.red : C.yellow },
                ].map((item) => (
                  <View key={item.label} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ color: C.muted, fontFamily: "Inter_400Regular", fontSize: 13 }}>{item.label}</Text>
                    <Text style={{ color: item.color, fontFamily: "Inter_700Bold", fontSize: 14 }}>{item.value} kcal</Text>
                  </View>
                ))}
              </View>
            </View>
            {calorieStatus.message && (
              <Text style={{ color: C.muted, fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 10, lineHeight: 18 }}>
                💬 {calorieStatus.message}
              </Text>
            )}
          </Animated.View>
        )}

        {/* ── FOOD SUGGESTIONS ── */}
        {foodSuggestions.length > 0 && (
          <Animated.View style={{ opacity: fadeAnim, gap: 8 }}>
            <SectionHeader icon="🥗" title="Today's Meal Plan" subtitle="Tap to see nutrition details" color={C.green} />
            {foodSuggestions.map((food, i) => (
              <FoodCard key={i} food={food} index={i} />
            ))}
          </Animated.View>
        )}

        {/* ── EXERCISE ── */}
        {exerciseSuggestion && (
          <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
            <SectionHeader icon="💪" title="Exercise Suggestion" color={C.purple} />
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 14 }}>
              <LinearGradient colors={["#7C3AED", "#A855F7"]} style={{ width: 60, height: 60, borderRadius: 16, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 28 }}>🏃</Text>
              </LinearGradient>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={{ color: C.text, fontFamily: "Inter_700Bold", fontSize: 17 }}>{exerciseSuggestion.type}</Text>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Ionicons name="time-outline" size={13} color={C.muted} />
                    <Text style={{ color: C.muted, fontSize: 13, fontFamily: "Inter_400Regular" }}>{exerciseSuggestion.durationMinutes} min</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Ionicons name="flame-outline" size={13} color={C.orange} />
                    <Text style={{ color: C.orange, fontSize: 13, fontFamily: "Inter_600SemiBold" }}>~{exerciseSuggestion.caloriesToBurn} kcal burn</Text>
                  </View>
                  <View style={{ backgroundColor: INTENSITY_COLORS[exerciseSuggestion.intensity] + "20", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ color: INTENSITY_COLORS[exerciseSuggestion.intensity], fontSize: 10, fontFamily: "Inter_700Bold" }}>{exerciseSuggestion.intensity}</Text>
                  </View>
                </View>
                <Text style={{ color: C.muted, fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 18 }}>{exerciseSuggestion.description}</Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* ── WATER ── */}
        {waterReminder && (
          <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
            <SectionHeader icon="💧" title="Water Tracker" color={C.primary} />
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
              {Array.from({ length: waterReminder.goal }, (_, i) => (
                <View key={i} style={{ flex: 1, height: 28, borderRadius: 6, backgroundColor: i < waterReminder.current ? "#0077B620" : "#E8F2F8", borderWidth: 1, borderColor: i < waterReminder.current ? C.primary : C.border, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 12 }}>{i < waterReminder.current ? "💧" : "○"}</Text>
                </View>
              ))}
            </View>
            <Text style={{ color: C.text, fontFamily: "Inter_600SemiBold", fontSize: 13, marginBottom: 6 }}>{waterReminder.message}</Text>
            {waterReminder.tipsForDrinkingMore?.map((tip, i) => (
              <Text key={i} style={{ color: C.muted, fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 17 }}>• {tip}</Text>
            ))}
          </Animated.View>
        )}

        {/* ── HEALTH TIP ── */}
        {healthTip && (
          <Animated.View style={{ opacity: fadeAnim }}>
            <LinearGradient colors={["#E8F7FB", "#EDF9F5"]} style={[styles.card, { borderColor: C.accent }]}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                <Text style={{ fontSize: 32 }}>{healthTip.emoji}</Text>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={{ color: C.accent, fontFamily: "Inter_700Bold", fontSize: 12, textTransform: "uppercase" }}>Today's Health Tip</Text>
                    <View style={{ backgroundColor: C.accent + "20", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ color: C.accent, fontSize: 9, fontFamily: "Inter_700Bold" }}>{healthTip.category}</Text>
                    </View>
                  </View>
                  <Text style={{ color: C.text, fontFamily: "Inter_600SemiBold", fontSize: 14, lineHeight: 20 }}>{healthTip.tip}</Text>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>
        )}

        {/* ── MEDICAL WARNINGS ── */}
        {medicalWarnings.length > 0 && (
          <Animated.View style={{ opacity: fadeAnim, gap: 8 }}>
            <SectionHeader icon="⚕️" title="For Medical Conditions" subtitle="Special health recommendations for you" color={C.red} />
            {medicalWarnings.map((w, i) => (
              <View key={i} style={[styles.card, { borderColor: "#FECACA" }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <View style={{ backgroundColor: "#FEE2E2", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ color: C.red, fontFamily: "Inter_700Bold", fontSize: 12 }}>{w.condition}</Text>
                  </View>
                </View>
                <Text style={{ color: C.text, fontFamily: "Inter_600SemiBold", fontSize: 13, lineHeight: 18, marginBottom: 8 }}>⚠️ {w.warning}</Text>
                {w.foodsToAvoid?.length > 0 && (
                  <View style={{ backgroundColor: "#FFF5F5", borderRadius: 8, padding: 8, marginBottom: 6 }}>
                    <Text style={{ color: C.red, fontFamily: "Inter_700Bold", fontSize: 11, marginBottom: 4 }}>❌ Avoid these:</Text>
                    <Text style={{ color: C.text, fontFamily: "Inter_400Regular", fontSize: 12 }}>{w.foodsToAvoid.join(" · ")}</Text>
                  </View>
                )}
                {w.foodsToPrefer?.length > 0 && (
                  <View style={{ backgroundColor: "#F0FFF4", borderRadius: 8, padding: 8 }}>
                    <Text style={{ color: C.green, fontFamily: "Inter_700Bold", fontSize: 11, marginBottom: 4 }}>✅ Eat these:</Text>
                    <Text style={{ color: C.text, fontFamily: "Inter_400Regular", fontSize: 12 }}>{w.foodsToPrefer.join(" · ")}</Text>
                  </View>
                )}
              </View>
            ))}
          </Animated.View>
        )}

        {/* ── TARGET PROGRESS ── */}
        {targetProgress && targetProgress.targetWeight > 0 && (
          <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
            <SectionHeader icon="🎯" title="Goal Progress" color={C.primary} />
            <View style={{ flexDirection: "row", gap: 12, marginBottom: 10 }}>
              <View style={styles.targetBox}>
                <Text style={{ color: C.muted, fontSize: 11, fontFamily: "Inter_400Regular" }}>Current</Text>
                <Text style={{ color: C.text, fontSize: 18, fontFamily: "Inter_700Bold" }}>{targetProgress.currentWeight} kg</Text>
              </View>
              <View style={{ alignSelf: "center" }}>
                <Ionicons name="arrow-forward" size={20} color={C.muted} />
              </View>
              <View style={[styles.targetBox, { borderColor: C.primary }]}>
                <Text style={{ color: C.primary, fontSize: 11, fontFamily: "Inter_400Regular" }}>Target</Text>
                <Text style={{ color: C.primary, fontSize: 18, fontFamily: "Inter_700Bold" }}>{targetProgress.targetWeight} kg</Text>
              </View>
              <View style={{ flex: 1, alignItems: "flex-end", justifyContent: "center" }}>
                <Text style={{ color: C.yellow, fontFamily: "Inter_700Bold", fontSize: 17 }}>{targetProgress.weightGap} kg</Text>
                <Text style={{ color: C.muted, fontSize: 11, fontFamily: "Inter_400Regular" }}>remaining</Text>
              </View>
            </View>
            <Text style={{ color: C.muted, fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 18 }}>{targetProgress.weeklyMessage}</Text>
          </Animated.View>
        )}

        {/* ── MOTIVATION ── */}
        {motivation && (
          <Animated.View style={{ opacity: fadeAnim }}>
            <LinearGradient colors={["#0077B6", "#00B896"]} style={[styles.card, { borderColor: "transparent" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={{ fontSize: 28 }}>🚀</Text>
                <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 15, lineHeight: 22, flex: 1 }}>{motivation}</Text>
              </View>
            </LinearGradient>
          </Animated.View>
        )}

        {/* Notification settings link */}
        <TouchableOpacity onPress={() => router.push("/notification-settings" as never)} style={[styles.card, { flexDirection: "row", alignItems: "center", gap: 12 }]}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.primary + "15", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="notifications-outline" size={20} color={C.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>Reminder Settings</Text>
            <Text style={{ color: C.muted, fontFamily: "Inter_400Regular", fontSize: 12 }}>Water, Food, Medicine, Period reminders</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={C.muted} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  backBtn: { backgroundColor: DS.color.primarySoft, borderRadius: 20, padding: 8 },
  refreshBtn: { backgroundColor: DS.color.primarySoft, borderRadius: 16, padding: 8 },
  card: { backgroundColor: "#FFF", borderRadius: 18, borderWidth: 1, borderColor: DS.color.border, padding: 16 },
  foodIcon: { width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  targetBox: { borderWidth: 1.5, borderColor: DS.color.border, borderRadius: 12, padding: 10, alignItems: "center", minWidth: 70 },
});
