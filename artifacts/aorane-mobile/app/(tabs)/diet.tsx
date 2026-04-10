import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, useColorScheme, Animated, Dimensions, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { api } from "@/lib/api";
import * as Haptics from "expo-haptics";

const { width: W } = Dimensions.get("window");

interface MealItem {
  name: string; nameHindi: string; quantityG: number; quantityDesc: string;
  calories: number; proteinG: number; carbsG: number; fatG: number;
}
interface MealSection { items: MealItem[]; totalCalories: number }
interface DayPlan {
  day: number; dayName: string; totalCalories: number;
  meals: { breakfast: MealSection; lunch: MealSection; dinner: MealSection; snacks: MealSection };
  waterIntakeMl: number; tip: string;
}
interface DietPlan {
  targetCalories: number; targetProteinG: number; targetCarbsG: number; targetFatG: number;
  days: DayPlan[]; generalTips: string[];
}

const MEAL_CONFIG = [
  { key: "breakfast", label: "Breakfast", icon: "sunny", colors: ["#F97316", "#FBBF24"] as [string, string] },
  { key: "lunch", label: "Lunch", icon: "restaurant", colors: ["#0077B6", "#1B998B"] as [string, string] },
  { key: "dinner", label: "Dinner", icon: "moon", colors: ["#7C3AED", "#C084FC"] as [string, string] },
  { key: "snacks", label: "Snacks", icon: "cafe", colors: ["#16A34A", "#4ADE80"] as [string, string] },
] as const;

function MacroBar({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const pct = Math.min((value / Math.max(target, 1)) * 100, 100);
  const isDark = useColorScheme() === "dark";
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: isDark ? "rgba(255,255,255,0.5)" : "rgba(10,22,40,0.5)", fontSize: 11, fontFamily: "Inter_500Medium", marginBottom: 4 }}>{label}</Text>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)", overflow: "hidden" }}>
        <View style={{ width: `${pct}%`, height: 6, borderRadius: 3, backgroundColor: color }} />
      </View>
      <Text style={{ color: isDark ? "#F0F8FF" : "#0A1628", fontSize: 13, fontFamily: "Inter_700Bold", marginTop: 3 }}>{Math.round(value)}<Text style={{ fontSize: 10, fontFamily: "Inter_400Regular" }}>g</Text></Text>
    </View>
  );
}

function MealCard({ mealKey, label, icon, colors, section }: { mealKey: string; label: string; icon: string; colors: [string, string]; section: MealSection }) {
  const [expanded, setExpanded] = useState(false);
  const isDark = useColorScheme() === "dark";
  const anim = useRef(new Animated.Value(0)).current;

  const toggle = () => {
    Haptics.selectionAsync().catch(() => {});
    Animated.timing(anim, { toValue: expanded ? 0 : 1, duration: 200, useNativeDriver: false }).start();
    setExpanded((e) => !e);
  };

  return (
    <View style={[styles.mealCard, { backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.85)", borderColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,119,182,0.12)" }]}>
      <TouchableOpacity onPress={toggle} activeOpacity={0.7} style={styles.mealHeader}>
        <LinearGradient colors={colors} style={styles.mealIcon}>
          <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={16} color="#FFF" />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={[styles.mealLabel, { color: isDark ? "#F0F8FF" : "#0A1628" }]}>{label}</Text>
          <Text style={{ color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontSize: 12, fontFamily: "Inter_400Regular" }}>
            {section.items.length} items · {section.totalCalories} kcal
          </Text>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={isDark ? "rgba(255,255,255,0.35)" : "rgba(10,22,40,0.35)"}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={{ marginTop: 10, gap: 8 }}>
          {section.items.map((item, i) => (
            <View key={i} style={[styles.foodItem, { backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,119,182,0.04)", borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,119,182,0.08)" }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: isDark ? "#E2F4FF" : "#0A1628", fontSize: 14, fontFamily: "Inter_600SemiBold" }}>{item.name}</Text>
                {item.nameHindi ? <Text style={{ color: isDark ? "rgba(255,255,255,0.35)" : "rgba(10,22,40,0.5)", fontSize: 12, fontFamily: "Inter_400Regular" }}>{item.nameHindi}</Text> : null}
                <Text style={{ color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.4)", fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 }}>{item.quantityDesc || `${item.quantityG}g`}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ color: colors[0], fontSize: 15, fontFamily: "Inter_700Bold" }}>{item.calories}</Text>
                <Text style={{ color: isDark ? "rgba(255,255,255,0.35)" : "rgba(10,22,40,0.4)", fontSize: 10, fontFamily: "Inter_400Regular" }}>kcal</Text>
                <Text style={{ color: isDark ? "rgba(255,255,255,0.35)" : "rgba(10,22,40,0.4)", fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 2 }}>
                  P{Math.round(item.proteinG)}·C{Math.round(item.carbsG)}·F{Math.round(item.fatG)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function DayView({ dayPlan, targetCals, targetProtein, targetCarbs, targetFat }: { dayPlan: DayPlan; targetCals: number; targetProtein: number; targetCarbs: number; targetFat: number }) {
  const isDark = useColorScheme() === "dark";
  const totalP = MEAL_CONFIG.reduce((s, m) => s + (dayPlan.meals[m.key]?.items || []).reduce((a, i) => a + i.proteinG, 0), 0);
  const totalC = MEAL_CONFIG.reduce((s, m) => s + (dayPlan.meals[m.key]?.items || []).reduce((a, i) => a + i.carbsG, 0), 0);
  const totalF = MEAL_CONFIG.reduce((s, m) => s + (dayPlan.meals[m.key]?.items || []).reduce((a, i) => a + i.fatG, 0), 0);

  return (
    <View style={{ gap: 12 }}>
      {/* Calorie ring summary */}
      <View style={[styles.summaryCard, { backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.85)", borderColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,119,182,0.12)" }]}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <View>
            <Text style={[styles.calorieCount, { color: isDark ? "#F0F8FF" : "#0A1628" }]}>{dayPlan.totalCalories}</Text>
            <Text style={{ color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontSize: 12, fontFamily: "Inter_400Regular" }}>of {targetCals} kcal target</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Ionicons name="water-outline" size={14} color="#0077B6" />
              <Text style={{ color: isDark ? "#F0F8FF" : "#0A1628", fontSize: 14, fontFamily: "Inter_600SemiBold" }}>{dayPlan.waterIntakeMl / 1000}L</Text>
            </View>
            <Text style={{ color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.4)", fontSize: 11, fontFamily: "Inter_400Regular" }}>water target</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <MacroBar label="Protein" value={totalP} target={targetProtein} color="#0077B6" />
          <MacroBar label="Carbs" value={totalC} target={targetCarbs} color="#1B998B" />
          <MacroBar label="Fat" value={totalF} target={targetFat} color="#F97316" />
        </View>
      </View>

      {/* Meals */}
      {MEAL_CONFIG.map((m) => dayPlan.meals[m.key] && (
        <MealCard key={m.key} mealKey={m.key} label={m.label} icon={m.icon} colors={m.colors} section={dayPlan.meals[m.key]} />
      ))}

      {/* Day tip */}
      {dayPlan.tip ? (
        <View style={[styles.tipCard, { backgroundColor: isDark ? "rgba(0,119,182,0.12)" : "rgba(0,119,182,0.08)", borderColor: isDark ? "rgba(0,119,182,0.25)" : "rgba(0,119,182,0.2)" }]}>
          <Ionicons name="bulb-outline" size={16} color="#0077B6" style={{ marginTop: 1 }} />
          <Text style={{ flex: 1, color: isDark ? "#90CAF9" : "#0056A0", fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 }}>{dayPlan.tip}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function DietTab() {
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === "dark";
  const [plan, setPlan] = useState<DietPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeDay, setActiveDay] = useState(0);
  const [planDays, setPlanDays] = useState(3);
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Animated.loop(Animated.timing(rotateAnim, { toValue: 1, duration: 1000, useNativeDriver: false })).start();
    try {
      const { plan: p } = await api.getDietPlan(planDays, "en");
      setPlan(p);
      setActiveDay(0);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      setError((e as Error).message || "Failed to generate plan");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setLoading(false);
      rotateAnim.stopAnimation();
      rotateAnim.setValue(0);
    }
  }, [planDays]);

  const rotation = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? "#010814" : "#F0F9FF" }}>
      {/* Header */}
      <LinearGradient
        colors={isDark ? ["#020F2A", "#010814"] : ["#E0F2FE", "#F0F9FF"]}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.headerTitle, { color: isDark ? "#F0F8FF" : "#0A1628" }]}>AI Coach</Text>
            <Text style={{ color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontSize: 13, fontFamily: "Inter_400Regular" }}>Personalized Indian Diet Plan</Text>
          </View>
          <LinearGradient colors={["#0077B6", "#1B998B"]} style={styles.aiChip}>
            <Ionicons name="sparkles" size={12} color="#FFF" />
            <Text style={{ color: "#FFF", fontSize: 11, fontFamily: "Inter_600SemiBold" }}>Gemini AI</Text>
          </LinearGradient>
        </View>

        {/* Day selector */}
        <View style={styles.daySelectorRow}>
          {[1, 3, 7].map((d) => (
            <TouchableOpacity
              key={d}
              onPress={() => { setPlanDays(d); setPlan(null); }}
              activeOpacity={0.7}
              style={[styles.dayBtn, planDays === d && styles.dayBtnActive, { borderColor: planDays === d ? "#0077B6" : (isDark ? "rgba(255,255,255,0.1)" : "rgba(0,119,182,0.2)") }]}
            >
              {planDays === d ? (
                <LinearGradient colors={["#0077B6", "#1B998B"]} style={[StyleSheet.absoluteFill, { borderRadius: 10 }]} />
              ) : null}
              <Text style={[styles.dayBtnText, { color: planDays === d ? "#FFF" : (isDark ? "rgba(255,255,255,0.5)" : "rgba(10,22,40,0.5)") }]}>{d} Day{d > 1 ? "s" : ""}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Generate button */}
        <TouchableOpacity onPress={generate} disabled={loading} activeOpacity={0.85} style={{ marginTop: 12 }}>
          <LinearGradient
            colors={loading ? ["#555", "#444"] : ["#0077B6", "#1B998B"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.generateBtn}
          >
            {loading ? (
              <Animated.View style={{ transform: [{ rotate: rotation }] }}>
                <Ionicons name="refresh" size={18} color="#FFF" />
              </Animated.View>
            ) : (
              <Ionicons name="sparkles" size={18} color="#FFF" />
            )}
            <Text style={{ color: "#FFF", fontSize: 15, fontFamily: "Inter_600SemiBold" }}>
              {loading ? "Generating..." : plan ? "Regenerate Plan" : "Generate My Plan"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100, paddingHorizontal: 16, paddingTop: 16 }}
      >
        {error && (
          <View style={[styles.errorCard, { backgroundColor: isDark ? "rgba(220,38,38,0.12)" : "rgba(220,38,38,0.08)" }]}>
            <Ionicons name="alert-circle-outline" size={18} color="#EF4444" />
            <Text style={{ color: "#EF4444", fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 }}>{error}</Text>
          </View>
        )}

        {!plan && !loading && (
          <View style={styles.emptyState}>
            <LinearGradient colors={["#0077B6", "#1B998B"]} style={styles.emptyIcon}>
              <Ionicons name="nutrition" size={36} color="#FFF" />
            </LinearGradient>
            <Text style={[styles.emptyTitle, { color: isDark ? "#F0F8FF" : "#0A1628" }]}>Your AI Diet Coach</Text>
            <Text style={[styles.emptySubtitle, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)" }]}>
              Get a personalized Indian diet plan based on your health profile, conditions, and goals
            </Text>
            <View style={styles.featureList}>
              {["Traditional Indian cuisine tailored for you", "Calories & macros tracked per meal", "Health condition–aware planning", "Tap any meal to see full details"].map((f, i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="checkmark-circle" size={16} color="#1B998B" />
                  <Text style={{ color: isDark ? "rgba(255,255,255,0.5)" : "rgba(10,22,40,0.55)", fontSize: 13, fontFamily: "Inter_400Regular" }}>{f}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {loading && (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color="#0077B6" />
            <Text style={{ color: isDark ? "rgba(255,255,255,0.5)" : "rgba(10,22,40,0.45)", fontSize: 14, fontFamily: "Inter_500Medium", marginTop: 12 }}>
              Creating your personalized plan…
            </Text>
            <Text style={{ color: isDark ? "rgba(255,255,255,0.3)" : "rgba(10,22,40,0.35)", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 4 }}>
              Analyzing your health profile with Gemini AI
            </Text>
          </View>
        )}

        {plan && !loading && (
          <View style={{ gap: 16 }}>
            {/* Day tabs */}
            {plan.days.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, flexDirection: "row" }}>
                {plan.days.map((d, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => { setActiveDay(i); Haptics.selectionAsync().catch(() => {}); }}
                    activeOpacity={0.7}
                    style={[styles.dayTab, { borderColor: activeDay === i ? "#0077B6" : (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,119,182,0.12)"), backgroundColor: activeDay === i ? (isDark ? "rgba(0,119,182,0.2)" : "rgba(0,119,182,0.08)") : (isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.85)") }]}
                  >
                    <Text style={{ color: activeDay === i ? "#0077B6" : (isDark ? "rgba(255,255,255,0.5)" : "rgba(10,22,40,0.5)"), fontSize: 13, fontFamily: activeDay === i ? "Inter_600SemiBold" : "Inter_400Regular" }}>
                      {d.dayName}
                    </Text>
                    <Text style={{ color: activeDay === i ? "#1B998B" : (isDark ? "rgba(255,255,255,0.3)" : "rgba(10,22,40,0.35)"), fontSize: 11, fontFamily: "Inter_400Regular" }}>
                      {d.totalCalories} kcal
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* Active day content */}
            <DayView
              dayPlan={plan.days[activeDay]}
              targetCals={plan.targetCalories}
              targetProtein={plan.targetProteinG}
              targetCarbs={plan.targetCarbsG}
              targetFat={plan.targetFatG}
            />

            {/* General tips */}
            {plan.generalTips?.length > 0 && (
              <View style={[styles.tipsBox, { backgroundColor: isDark ? "rgba(27,153,139,0.1)" : "rgba(27,153,139,0.06)", borderColor: isDark ? "rgba(27,153,139,0.25)" : "rgba(27,153,139,0.2)" }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <Ionicons name="leaf" size={16} color="#1B998B" />
                  <Text style={{ color: isDark ? "#4ADE80" : "#15803D", fontSize: 14, fontFamily: "Inter_600SemiBold" }}>General Tips</Text>
                </View>
                {plan.generalTips.map((t, i) => (
                  <View key={i} style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
                    <Text style={{ color: "#1B998B", fontSize: 13 }}>•</Text>
                    <Text style={{ color: isDark ? "rgba(255,255,255,0.55)" : "rgba(10,22,40,0.6)", fontSize: 13, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 19 }}>{t}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 },
  headerTitle: { fontSize: 26, fontFamily: "Inter_700Bold" },
  aiChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  daySelectorRow: { flexDirection: "row", gap: 8 },
  dayBtn: { flex: 1, height: 36, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" },
  dayBtnActive: {},
  dayBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", zIndex: 1 },
  generateBtn: { height: 50, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  mealCard: { borderRadius: 16, borderWidth: 1, padding: 14 },
  mealHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  mealIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  mealLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  foodItem: { borderRadius: 10, borderWidth: 1, padding: 10, flexDirection: "row", alignItems: "flex-start", gap: 8 },
  tipCard: { borderRadius: 12, borderWidth: 1, padding: 12, flexDirection: "row", gap: 8, alignItems: "flex-start" },
  summaryCard: { borderRadius: 16, borderWidth: 1, padding: 16 },
  calorieCount: { fontSize: 32, fontFamily: "Inter_700Bold" },
  errorCard: { borderRadius: 12, padding: 12, flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 12 },
  emptyState: { alignItems: "center", paddingVertical: 32, gap: 12 },
  emptyIcon: { width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  emptySubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 21, maxWidth: 280 },
  featureList: { gap: 8, alignSelf: "stretch", paddingHorizontal: 8, marginTop: 4 },
  loadingState: { alignItems: "center", paddingVertical: 60 },
  dayTab: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, alignItems: "center", gap: 2 },
  tipsBox: { borderRadius: 16, borderWidth: 1, padding: 16 },
});
