import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, ActivityIndicator, RefreshControl, Animated,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { DS } from "@/lib/theme";
import { logSilentError } from "@/lib/silentCatch";

const C = {
  bg: DS.color.bgSoft, card: DS.color.bg, primary: DS.color.primary, accent: DS.color.green,
  text: DS.color.text, muted: DS.color.muted, border: DS.color.border,
  red: DS.color.red, yellow: DS.color.yellow, green: DS.color.green, purple: DS.color.purple,
  orange: DS.color.orange,
};

// React Native renders ONE shadow direction per view — there is no light+dark
// neumorphic pair and no inset shadow. So "raised" is a single soft drop
// shadow and "recessed" is a darker fill. Same compromise app/wearable.tsx
// already ships, and the same numbers, so the two screens match.
const NEU = Platform.select({
  ios:     { shadowColor: "#8CA3C4", shadowOffset: { width: 4, height: 5 }, shadowOpacity: 0.30, shadowRadius: 11 },
  android: { elevation: 4 },
  default: { shadowColor: "#8CA3C4", shadowOffset: { width: 4, height: 5 }, shadowOpacity: 0.30, shadowRadius: 11 },
}) as object;
const NEU_SM = Platform.select({
  ios:     { shadowColor: "#8CA3C4", shadowOffset: { width: 2, height: 3 }, shadowOpacity: 0.26, shadowRadius: 7 },
  android: { elevation: 2 },
  default: { shadowColor: "#8CA3C4", shadowOffset: { width: 2, height: 3 }, shadowOpacity: 0.26, shadowRadius: 7 },
}) as object;

// Raised means "you can act on this", recessed means "this is a readout".
const RECESS = "#E8EEF9";

type Suggestion = Record<string, unknown>;
// `nameLocal` is the dish name in the user's own language — Tamil for a Tamil
// user, not Hindi. `nameHindi` is the old field name, still sent so an app on
// the previous build keeps working; the server fills both.
type FoodItem = { name: string; nameLocal?: string; nameHindi?: string; calories: number; proteinG: number; carbsG: number; fatG: number; portion: string; reason: string; mealType: string; isSeasonalSpecial: boolean };
type ExerciseSuggestion = { type: string; durationMinutes: number; caloriesToBurn: number; description: string; intensity: string };
// Water is a plain count now, not an AI-written section: the Water Tracker
// card duplicated the dashboard's, so the Coach only keeps the number for the
// header strip and mentions hydration inside the health tip when it matters.
// `WaterReminder` stays only to read yesterday-shaped cached payloads.
type WaterStatus = { current: number; goal: number };
// Only the count is read off a legacy payload — its message and tips are the
// part that duplicated the dashboard and are deliberately not rendered.
type WaterReminder = WaterStatus;
type HealthTip = { tip: string; category: string; emoji: string };
type MedicalWarning = { condition: string; warning: string; foodsToAvoid: string[]; foodsToPrefer: string[] };
type CalorieStatus = { goal: number; eaten: number; remaining: number; message: string };
type TargetProgress = { currentWeight: number; targetWeight: number; startWeight: number | null; weightGap: number; estimatedWeeks: number | null; weeklyMessage: string };

// These came from constants/colors.ts, the abandoned second token source, so
// every blue and green on this screen sat a few degrees off the rest of the
// app. Same roles, DS values.
const MEAL_COLORS: Record<string, string[]> = {
  breakfast: [DS.color.orange,    "#F7B267"],
  lunch:     [DS.color.green,     "#5FD09A"],
  dinner:    [DS.color.primary,   DS.color.sky],
  snack:     [DS.color.purple,    "#9B7BD4"],
};
const MEAL_ICONS: Record<string, string> = {
  breakfast: "☀️", lunch: "🍱", dinner: "🌙", snack: "🍎",
};
const INTENSITY_COLORS: Record<string, string> = { light: DS.color.green, moderate: DS.color.orange, intense: DS.color.red };
const INTENSITY_SOFT: Record<string, string> = { light: DS.color.greenSoft, moderate: DS.color.orangeSoft, intense: DS.color.redSoft };

/** A ring that actually shows progress.
 *
 *  What this replaces was called CaloriePie but drew a full circle border at
 *  all times, with the percentage only as text in the middle — so it looked
 *  identical at 5% and at 95%. The one graphic on the screen whose whole job
 *  is "how am I doing at a glance" was showing nothing. */
function CalorieRing({ eaten, goal }: { eaten: number; goal: number }) {
  const SIZE = 76, STROKE = 7;
  const r = (SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * r;

  const rawPct = (eaten / Math.max(goal, 1)) * 100;
  const over = eaten > goal;
  // The arc caps at a full circle; the number below it keeps telling the
  // truth, so 140% reads as over budget rather than as a ring that wrapped.
  const arcPct = Math.max(0, Math.min(100, rawPct));
  const remaining = Math.max(0, goal - eaten);
  const color = over ? C.red : C.primary;

  return (
    <View style={{ alignItems: "center", gap: 4 }}>
      <View style={{ width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" }}>
        <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={r} stroke="#DCE6F4" strokeWidth={STROKE} fill="none" />
          <Circle
            cx={SIZE / 2} cy={SIZE / 2} r={r}
            stroke={color} strokeWidth={STROKE} fill="none" strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - arcPct / 100)}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </Svg>
        <Text style={{ color, fontSize: 15, fontFamily: "Inter_700Bold" }}>{Math.round(rawPct)}%</Text>
      </View>
      <Text style={{ color: C.text, fontSize: 12, fontFamily: "Inter_600SemiBold" }}>
        {over ? `${eaten - goal} kcal over` : `${remaining} kcal left`}
      </Text>
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
      <View style={{ height: 4, backgroundColor: RECESS, borderRadius: 2 }}>
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
            <Text style={{ color: C.muted, fontFamily: "Inter_400Regular", fontSize: 12 }}>{[food.nameLocal || food.nameHindi, food.portion].filter(Boolean).join(" · ")}</Text>
          </View>
          <View style={{ alignItems: "flex-end", gap: 2 }}>
            <Text style={{ color: C.primary, fontFamily: "Inter_700Bold", fontSize: 15 }}>{food.calories}</Text>
            <Text style={{ color: C.muted, fontSize: 10, fontFamily: "Inter_400Regular" }}>kcal</Text>
          </View>
          <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={C.muted} />
        </View>

        {open && (
          <View style={{ marginTop: 10, gap: 8 }}>
            <Text style={{ color: C.text, fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 18, backgroundColor: RECESS, borderRadius: 8, padding: 10 }}>
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
        await api.refreshSuggestions().catch((e) => logSilentError('suggestions-refresh', e));
      }
      const res = await api.getDailySuggestions();
      let cleanSuggestions = res.suggestions as unknown;
      if (typeof cleanSuggestions === "string") {
        try {
          cleanSuggestions = JSON.parse(cleanSuggestions);
        } catch {
          let cleanStr = (cleanSuggestions as string).trim();
          if (cleanStr.startsWith("```json")) cleanStr = cleanStr.substring(7);
          if (cleanStr.endsWith("```")) cleanStr = cleanStr.substring(0, cleanStr.length - 3);
          try {
            cleanSuggestions = JSON.parse(cleanStr.trim());
          } catch {
            cleanSuggestions = { greeting: "Hello!", foodSuggestions: [], medicalWarnings: [] };
          }
        }
      }
      setSuggestions(cleanSuggestions as Suggestion || { greeting: "Hello!", foodSuggestions: [], medicalWarnings: [] });
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
  // A cached row generated before this change still carries `waterReminder`,
  // so fall back to it for the count rather than showing "—" for a day.
  const waterStatus = (s?.waterStatus as WaterStatus | undefined)
    ?? (s?.waterReminder as WaterReminder | undefined);
  const mealPlanSource = s?.mealPlanSource as string | undefined;
  const nextMealSlot = s?.nextMealSlot as string | undefined;
  const healthTip = s?.healthTip as HealthTip | undefined;
  const medicalWarnings = (s?.medicalWarnings as MedicalWarning[]) || [];
  const motivation = s?.motivation as string || "";
  const targetProgress = s?.targetProgress as TargetProgress | undefined;
  // How far they are between the weight they started at and the one they are
  // aiming for. This needs the START weight — `weightGap` is the distance
  // still to go, so current/target/gap alone describe only what is left and
  // can never say what is done. `startWeight` comes from the goal row; when
  // it is missing (a goal saved before that column was populated) or the goal
  // was already met at the start, this returns null and the bar is not drawn
  // rather than showing a made-up number.
  const goalPct: number | null = (() => {
    const tp = targetProgress;
    if (!tp || tp.startWeight === null || tp.startWeight === undefined) return null;
    const total = Math.abs(tp.startWeight - tp.targetWeight);
    if (total <= 0) return null;
    const done = total - tp.weightGap;
    return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
  })();
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
      {/* Header — flat neumorphic, matching app/wearable.tsx. The blur/glass
          treatment was the only one of its kind in the app and read as a
          different screen family. */}
      <View style={{ backgroundColor: C.bg }}>
        <View style={{ paddingTop: topPad + 8, paddingHorizontal: 16, paddingBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back" accessibilityRole="button">
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
            <View style={{ marginTop: 12, backgroundColor: DS.color.bg, borderRadius: 14, padding: 13, ...NEU }}>
              <Text style={{ color: DS.color.primary, fontFamily: "Inter_600SemiBold", fontSize: 14, lineHeight: 21 }}>{greeting}</Text>
            </View>
          )}

          {calorieStatus && (
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              {[
                { icon: "🔥", label: "Calories", val: `${calorieStatus.eaten}/${calorieStatus.goal}`, sub: "kcal" },
                { icon: "💧", label: "Water", val: waterStatus ? `${waterStatus.current}/${waterStatus.goal}` : "—", sub: "glasses" },
                { icon: "💪", label: "Exercise", val: exerciseSuggestion ? `${exerciseSuggestion.durationMinutes}` : "—", sub: "min goal" },
              ].map(stat => (
                <View key={stat.label} style={{ flex: 1, backgroundColor: RECESS, borderRadius: 12, padding: 10, alignItems: "center" }}>
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
        <View style={{ margin: 16, backgroundColor: DS.color.redSoft, borderRadius: 12, padding: 14, flexDirection: "row", gap: 10 }}>
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
              <CalorieRing eaten={calorieStatus.eaten} goal={calorieStatus.goal} />
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

        {/* ── MEDICAL WARNINGS ──
            Moved above the meal plan. It used to sit fifth of seven, below
            the dishes it is warning about — a diabetic user read the
            suggestions first and the warning several scrolls later. Still
            renders only when they actually have a condition. */}
        {medicalWarnings.length > 0 && (
          <Animated.View style={{ opacity: fadeAnim, gap: 8 }}>
            <SectionHeader icon="⚕️" title="For Your Conditions" subtitle="Read this before you eat" color={C.red} />
            {medicalWarnings.map((w, i) => (
              <View key={i} style={[styles.card, { borderLeftWidth: 3, borderLeftColor: C.red }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <View style={{ backgroundColor: DS.color.redSoft, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ color: C.red, fontFamily: "Inter_700Bold", fontSize: 12 }}>{w.condition}</Text>
                  </View>
                </View>
                <Text style={{ color: C.text, fontFamily: "Inter_600SemiBold", fontSize: 13, lineHeight: 18, marginBottom: 8 }}>⚠️ {w.warning}</Text>
                {w.foodsToAvoid?.length > 0 && (
                  <View style={{ backgroundColor: DS.color.redSoft, borderRadius: 8, padding: 8, marginBottom: 6 }}>
                    <Text style={{ color: C.red, fontFamily: "Inter_700Bold", fontSize: 11, marginBottom: 4 }}>❌ Avoid these:</Text>
                    <Text style={{ color: C.text, fontFamily: "Inter_400Regular", fontSize: 12 }}>{w.foodsToAvoid.join(" · ")}</Text>
                  </View>
                )}
                {w.foodsToPrefer?.length > 0 && (
                  <View style={{ backgroundColor: DS.color.greenSoft, borderRadius: 8, padding: 8 }}>
                    <Text style={{ color: C.green, fontFamily: "Inter_700Bold", fontSize: 11, marginBottom: 4 }}>✅ Eat these:</Text>
                    <Text style={{ color: C.text, fontFamily: "Inter_400Regular", fontSize: 12 }}>{w.foodsToPrefer.join(" · ")}</Text>
                  </View>
                )}
              </View>
            ))}
          </Animated.View>
        )}

        {/* ── FOOD SUGGESTIONS ── */}
        {foodSuggestions.length > 0 && (
          <Animated.View style={{ opacity: fadeAnim, gap: 8 }}>
            <SectionHeader
              icon="🥗"
              title={mealPlanSource === "next_meal" ? "Your Next Meal" : "Today's Meal Plan"}
              subtitle="Tap a dish for nutrition"
              color={C.green}
            />
            {/* Where these dishes came from is the answer to "why is it
                suggesting this?", so it gets a chip rather than grey subtitle
                text — and a one-meal answer explains itself instead of
                looking like a loading bug. */}
            {mealPlanSource && (
              <View style={{ flexDirection: "row", marginBottom: 2 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: DS.color.bg, borderRadius: 13, paddingHorizontal: 10, paddingVertical: 6, ...NEU_SM }}>
                  <Ionicons
                    name={mealPlanSource === "diet_chart" ? "calendar-outline" : "time-outline"}
                    size={12} color={C.primary}
                  />
                  <Text style={{ color: C.primary, fontFamily: "Inter_600SemiBold", fontSize: 10.5 }}>
                    {mealPlanSource === "diet_chart"
                      ? "From your weekly diet chart"
                      : `Next up${nextMealSlot ? ` · ${nextMealSlot[0].toUpperCase()}${nextMealSlot.slice(1)}` : ""}`}
                  </Text>
                </View>
              </View>
            )}
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
              <LinearGradient colors={[DS.color.purple, "#9B7BD4"]} style={{ width: 60, height: 60, borderRadius: 16, alignItems: "center", justifyContent: "center", ...NEU_SM }}>
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
                  <View style={{ backgroundColor: INTENSITY_SOFT[exerciseSuggestion.intensity] || DS.color.orangeSoft, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ color: INTENSITY_COLORS[exerciseSuggestion.intensity], fontSize: 10, fontFamily: "Inter_700Bold" }}>{exerciseSuggestion.intensity}</Text>
                  </View>
                </View>
                <Text style={{ color: C.muted, fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 18 }}>{exerciseSuggestion.description}</Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* ── HEALTH TIP ── */}
        {healthTip && (
          <Animated.View style={{ opacity: fadeAnim }}>
            <LinearGradient colors={[DS.color.skySoft, DS.color.greenSoft]} style={styles.card}>
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

        {/* ── TARGET PROGRESS ── */}
        {targetProgress && targetProgress.targetWeight > 0 && (
          <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
            <SectionHeader icon="🎯" title="Goal Progress" color={C.primary} />
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center", marginBottom: 10 }}>
              <View style={[styles.targetBox, { flex: 1 }]}>
                <Text style={{ color: C.muted, fontSize: 11, fontFamily: "Inter_400Regular" }}>Current</Text>
                <Text style={{ color: C.text, fontSize: 18, fontFamily: "Inter_700Bold" }}>{targetProgress.currentWeight} kg</Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color={C.muted} />
              <View style={[styles.targetBox, { flex: 1, backgroundColor: DS.color.primarySoft }]}>
                <Text style={{ color: C.primary, fontSize: 11, fontFamily: "Inter_400Regular" }}>Target</Text>
                <Text style={{ color: C.primary, fontSize: 18, fontFamily: "Inter_700Bold" }}>{targetProgress.targetWeight} kg</Text>
              </View>
            </View>

            {/* "Goal Progress" had no progress in it — three numbers and a
                sentence. `estimatedWeeks` was already computed server-side
                and never shown; it is null when no deficit is configured
                (Phase 2), and then the label is simply omitted rather than
                guessing a date. */}
            <View style={{ gap: 5, marginBottom: 10 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: C.muted, fontSize: 11, fontFamily: "Inter_500Medium" }}>
                  {targetProgress.weightGap} kg to go
                </Text>
                {targetProgress.estimatedWeeks ? (
                  <Text style={{ color: C.muted, fontSize: 11, fontFamily: "Inter_500Medium" }}>
                    about {targetProgress.estimatedWeeks} weeks
                  </Text>
                ) : null}
              </View>
              {goalPct !== null && (
                <View style={{ height: 7, backgroundColor: RECESS, borderRadius: 4 }}>
                  <View style={{ height: 7, width: `${goalPct}%`, backgroundColor: C.primary, borderRadius: 4 }} />
                </View>
              )}
            </View>
            <Text style={{ color: C.muted, fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 18 }}>{targetProgress.weeklyMessage}</Text>
          </Animated.View>
        )}

        {/* ── MOTIVATION ── */}
        {motivation && (
          <Animated.View style={{ opacity: fadeAnim }}>
            <LinearGradient colors={[DS.color.primary, DS.color.secondary]} style={styles.card}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={{ fontSize: 28 }}>🚀</Text>
                <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 15, lineHeight: 22, flex: 1 }}>{motivation}</Text>
              </View>
            </LinearGradient>
          </Animated.View>
        )}

        {/* Notification settings link */}
        <TouchableOpacity onPress={() => router.push("/notification-settings" as never)} style={[styles.card, { flexDirection: "row", alignItems: "center", gap: 12 }]}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: RECESS, alignItems: "center", justifyContent: "center" }}>
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
  backBtn:    { backgroundColor: DS.color.bg, borderRadius: 20, padding: 8, ...NEU_SM },
  refreshBtn: { backgroundColor: DS.color.bg, borderRadius: 16, padding: 8, ...NEU_SM },
  card:       { backgroundColor: DS.color.bg, borderRadius: 18, padding: 16, ...NEU },
  foodIcon:   { width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  targetBox:  { backgroundColor: RECESS, borderRadius: 12, padding: 10, alignItems: "center", minWidth: 70 },
});
