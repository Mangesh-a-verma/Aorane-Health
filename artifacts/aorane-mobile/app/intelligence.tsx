import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { api } from "../lib/api";

const PRIMARY = "#0077B6";
const ACCENT = "#00B896";
const BG = "#F7F9FC";

const RISK_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  low:      { bg: "#ECFDF5", text: "#059669", bar: "#10B981" },
  moderate: { bg: "#FFFBEB", text: "#D97706", bar: "#F59E0B" },
  high:     { bg: "#FFF1F2", text: "#DC2626", bar: "#EF4444" },
  critical: { bg: "#FDF2F8", text: "#9D174D", bar: "#EC4899" },
};

const SCORE_COLORS = (score: number) => {
  if (score >= 80) return ["#10B981", "#059669"];
  if (score >= 60) return ["#F59E0B", "#D97706"];
  return ["#EF4444", "#DC2626"];
};

const DAYS_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type Prediction = {
  overallScore: number; overallLabel: string;
  risks: { name: string; percentage: number; level: string; reason: string; icon: string }[];
  recommendations: { title: string; detail: string; priority: string }[];
  disclaimer: string; generatedFor: string;
};

type DayChart = {
  day: string; date: string;
  breakfast: { time: string; items: string[]; calories: number };
  lunch: { time: string; items: string[]; calories: number };
  dinner: { time: string; items: string[]; calories: number };
  snacks: { time: string; item: string; calories: number }[];
  totalCalories: number; water: string; tip: string;
};

type DietChart = {
  weekStart: string; targetCalories: number;
  days: DayChart[]; weeklyTips: string[];
};

function ScoreRing({ score, label }: { score: number; label: string }) {
  const colors = SCORE_COLORS(score) as [string, string];
  return (
    <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.scoreRing}>
      <Text style={styles.scoreNumber}>{score}</Text>
      <Text style={styles.scoreLabel}>{label}</Text>
      <Text style={styles.scoreSubLabel}>Health Score</Text>
    </LinearGradient>
  );
}

function RiskBar({ risk }: { risk: Prediction["risks"][0] }) {
  const c = RISK_COLORS[risk.level] ?? RISK_COLORS.moderate;
  return (
    <View style={[styles.riskCard, { backgroundColor: c.bg }]}>
      <View style={styles.riskHeader}>
        <View style={styles.riskLeft}>
          <Text style={styles.riskName}>{risk.name}</Text>
          <Text style={[styles.riskLevel, { color: c.text }]}>{risk.level.toUpperCase()}</Text>
        </View>
        <Text style={[styles.riskPct, { color: c.text }]}>{risk.percentage}%</Text>
      </View>
      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${Math.min(risk.percentage, 100)}%` as `${number}%`, backgroundColor: c.bar }]} />
      </View>
      <Text style={styles.riskReason}>{risk.reason}</Text>
    </View>
  );
}

function MealSection({ label, time, items, calories, icon }: {
  label: string; time: string; items: string[]; calories: number; icon: string;
}) {
  return (
    <View style={styles.mealSection}>
      <View style={styles.mealHeader}>
        <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={16} color={PRIMARY} />
        <Text style={styles.mealLabel}>{label}</Text>
        <Text style={styles.mealTime}>{time}</Text>
        <Text style={styles.mealCal}>{calories} kcal</Text>
      </View>
      {items.map((item, i) => (
        <Text key={i} style={styles.mealItem}>• {item}</Text>
      ))}
    </View>
  );
}

function DayCard({ dayData, isToday }: { dayData: DayChart; isToday: boolean }) {
  const [expanded, setExpanded] = useState(isToday);
  return (
    <View style={[styles.dayCard, isToday && styles.dayCardToday]}>
      <TouchableOpacity style={styles.dayHeader} onPress={() => setExpanded(e => !e)}>
        <View style={styles.dayLeft}>
          {isToday && <View style={styles.todayDot} />}
          <Text style={[styles.dayName, isToday && { color: PRIMARY, fontFamily: "Inter_700Bold" }]}>{dayData.day}</Text>
        </View>
        <View style={styles.dayRight}>
          <Text style={styles.dayCalTotal}>{dayData.totalCalories} kcal</Text>
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color="#94A3B8" />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.dayExpanded}>
          <MealSection label="Breakfast" time={dayData.breakfast.time} items={dayData.breakfast.items} calories={dayData.breakfast.calories} icon="sunny-outline" />
          <MealSection label="Lunch" time={dayData.lunch.time} items={dayData.lunch.items} calories={dayData.lunch.calories} icon="restaurant-outline" />
          <MealSection label="Dinner" time={dayData.dinner.time} items={dayData.dinner.items} calories={dayData.dinner.calories} icon="moon-outline" />
          {dayData.snacks.length > 0 && (
            <View style={styles.mealSection}>
              <View style={styles.mealHeader}>
                <Ionicons name="cafe-outline" size={16} color={PRIMARY} />
                <Text style={styles.mealLabel}>Snacks</Text>
              </View>
              {dayData.snacks.map((s, i) => (
                <Text key={i} style={styles.mealItem}>• {s.time} — {s.item} ({s.calories} kcal)</Text>
              ))}
            </View>
          )}
          <View style={styles.dayTip}>
            <Ionicons name="water-outline" size={13} color="#3B82F6" />
            <Text style={styles.dayTipText}>Water: {dayData.water}</Text>
          </View>
          <View style={styles.dayTip}>
            <Ionicons name="bulb-outline" size={13} color="#F59E0B" />
            <Text style={styles.dayTipText}>{dayData.tip}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

export default function HealthIntelligence() {
  const [tab, setTab] = useState<"predict" | "diet">("predict");
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [dietChart, setDietChart] = useState<DietChart | null>(null);
  const [predLoading, setPredLoading] = useState(false);
  const [dietLoading, setDietLoading] = useState(false);
  const [predRefreshing, setPredRefreshing] = useState(false);
  const [predError, setPredError] = useState("");
  const [dietError, setDietError] = useState("");
  const [predCached, setPredCached] = useState(false);
  const [dietCached, setDietCached] = useState(false);

  const todayDay = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date());

  const loadPrediction = useCallback(async () => {
    setPredLoading(true); setPredError("");
    try {
      const data = await api.getHealthPrediction();
      setPrediction(data.prediction);
      setPredCached(data.cached);
    } catch (e: unknown) {
      setPredError(e instanceof Error ? e.message : "Failed to load prediction");
    } finally {
      setPredLoading(false);
    }
  }, []);

  const loadDietChart = useCallback(async () => {
    setDietLoading(true); setDietError("");
    try {
      const data = await api.getWeeklyDietChart();
      setDietChart(data.dietChart);
      setDietCached(data.cached);
    } catch (e: unknown) {
      setDietError(e instanceof Error ? e.message : "Failed to load diet chart");
    } finally {
      setDietLoading(false);
    }
  }, []);

  useEffect(() => { loadPrediction(); loadDietChart(); }, []);

  const handleRefreshPrediction = async () => {
    Alert.alert(
      "Refresh Prediction",
      "This will generate a fresh prediction using your latest data. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Refresh", onPress: async () => {
            setPredRefreshing(true);
            try {
              const data = await api.refreshHealthPrediction();
              setPrediction(data.prediction as unknown as Prediction);
              setPredCached(false);
            } catch (e: unknown) {
              Alert.alert("Error", e instanceof Error ? e.message : "Refresh failed");
            } finally {
              setPredRefreshing(false);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1E293B" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Health Intelligence</Text>
          <Text style={styles.headerSub}>AI-powered insights for you</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tab, tab === "predict" && styles.tabActive]} onPress={() => setTab("predict")}>
          <Ionicons name="analytics-outline" size={16} color={tab === "predict" ? PRIMARY : "#94A3B8"} />
          <Text style={[styles.tabText, tab === "predict" && styles.tabTextActive]}>Risk Prediction</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === "diet" && styles.tabActive]} onPress={() => setTab("diet")}>
          <Ionicons name="nutrition-outline" size={16} color={tab === "diet" ? PRIMARY : "#94A3B8"} />
          <Text style={[styles.tabText, tab === "diet" && styles.tabTextActive]}>Diet Chart</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={predRefreshing} onRefresh={() => {}} colors={[PRIMARY]} />}
      >
        {/* ── PREDICTION TAB ── */}
        {tab === "predict" && (
          <>
            {predLoading && !prediction && (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={PRIMARY} />
                <Text style={styles.loadingText}>DeepSeek AI is analyzing your health data...</Text>
                <Text style={styles.loadingSubText}>This may take 15-30 seconds</Text>
              </View>
            )}

            {predError !== "" && (
              <View style={styles.errorBox}>
                <Ionicons name="warning-outline" size={20} color="#DC2626" />
                <Text style={styles.errorText}>{predError}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={loadPrediction}>
                  <Text style={styles.retryBtnText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {prediction && (
              <>
                {/* Score + refresh row */}
                <View style={styles.scoreRow}>
                  <ScoreRing score={prediction.overallScore} label={prediction.overallLabel} />
                  <View style={styles.scoreInfo}>
                    <Text style={styles.sectionTitle}>Monthly Analysis</Text>
                    <Text style={styles.sectionSub}>Based on your last 30 days of food, exercise, water, and sleep data.</Text>
                    {predCached && <Text style={styles.cachedBadge}>Cached this month</Text>}
                    <TouchableOpacity
                      style={styles.refreshBtn}
                      onPress={handleRefreshPrediction}
                      disabled={predRefreshing}
                    >
                      <Ionicons name="refresh-outline" size={13} color={PRIMARY} />
                      <Text style={styles.refreshBtnText}>{predRefreshing ? "Refreshing..." : "Refresh"}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Risk cards */}
                <Text style={styles.sectionTitle}>Disease Risk Indicators</Text>
                {prediction.risks.map((r, i) => <RiskBar key={i} risk={r} />)}

                {/* Recommendations */}
                <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Recommendations</Text>
                {prediction.recommendations.map((rec, i) => (
                  <View key={i} style={styles.recCard}>
                    <View style={[styles.recDot, { backgroundColor: rec.priority === "high" ? "#EF4444" : rec.priority === "medium" ? "#F59E0B" : "#10B981" }]} />
                    <View style={styles.recContent}>
                      <Text style={styles.recTitle}>{rec.title}</Text>
                      <Text style={styles.recDetail}>{rec.detail}</Text>
                    </View>
                  </View>
                ))}

                {/* Disclaimer */}
                <View style={styles.disclaimer}>
                  <Ionicons name="information-circle-outline" size={14} color="#64748B" />
                  <Text style={styles.disclaimerText}>{prediction.disclaimer}</Text>
                </View>
              </>
            )}
          </>
        )}

        {/* ── DIET CHART TAB ── */}
        {tab === "diet" && (
          <>
            {dietLoading && !dietChart && (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={ACCENT} />
                <Text style={styles.loadingText}>Creating your personalized Indian diet chart...</Text>
                <Text style={styles.loadingSubText}>This may take 20-40 seconds</Text>
              </View>
            )}

            {dietError !== "" && (
              <View style={styles.errorBox}>
                <Ionicons name="warning-outline" size={20} color="#DC2626" />
                <Text style={styles.errorText}>{dietError}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={loadDietChart}>
                  <Text style={styles.retryBtnText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {dietChart && (
              <>
                <LinearGradient
                  colors={[PRIMARY, ACCENT]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.dietBanner}
                >
                  <View>
                    <Text style={styles.dietBannerTitle}>This Week's Diet Plan</Text>
                    <Text style={styles.dietBannerSub}>Target: {dietChart.targetCalories} kcal/day</Text>
                  </View>
                  <Ionicons name="restaurant" size={28} color="rgba(255,255,255,0.6)" />
                </LinearGradient>

                {/* Days */}
                {(dietChart.days ?? [])
                  .sort((a, b) => DAYS_ORDER.indexOf(a.day) - DAYS_ORDER.indexOf(b.day))
                  .map((d, i) => (
                    <DayCard key={i} dayData={d} isToday={d.day === todayDay} />
                  ))
                }

                {/* Weekly tips */}
                {dietChart.weeklyTips?.length > 0 && (
                  <View style={styles.weeklyTips}>
                    <Text style={styles.sectionTitle}>Weekly Health Tips</Text>
                    {dietChart.weeklyTips.map((tip, i) => (
                      <View key={i} style={styles.tipRow}>
                        <Ionicons name="checkmark-circle" size={15} color={ACCENT} />
                        <Text style={styles.tipText}>{tip}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {dietCached && (
                  <Text style={styles.cachedNote}>Diet chart is refreshed every Monday. Next refresh on Monday.</Text>
                )}
              </>
            )}
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#FFF", borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  backBtn: { padding: 4, marginRight: 10 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#1E293B" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#94A3B8", marginTop: 1 },
  tabRow: { flexDirection: "row", backgroundColor: "#FFF", borderBottomWidth: 1, borderBottomColor: "#F1F5F9", paddingHorizontal: 16 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: PRIMARY },
  tabText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#94A3B8" },
  tabTextActive: { color: PRIMARY, fontFamily: "Inter_600SemiBold" },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  loadingBox: { alignItems: "center", paddingVertical: 60, gap: 12 },
  loadingText: { fontSize: 14, fontFamily: "Inter_500Medium", color: "#475569", textAlign: "center" },
  loadingSubText: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  errorBox: { backgroundColor: "#FFF1F2", borderRadius: 12, padding: 16, alignItems: "center", gap: 8 },
  errorText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#DC2626", textAlign: "center" },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 8, backgroundColor: PRIMARY, borderRadius: 8 },
  retryBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#FFF" },
  scoreRow: { flexDirection: "row", gap: 16, alignItems: "center", backgroundColor: "#FFF", borderRadius: 16, padding: 16, elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
  scoreRing: { width: 100, height: 100, borderRadius: 50, alignItems: "center", justifyContent: "center" },
  scoreNumber: { fontSize: 30, fontFamily: "Inter_700Bold", color: "#FFF" },
  scoreLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.9)" },
  scoreSubLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)" },
  scoreInfo: { flex: 1, gap: 4 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#1E293B" },
  sectionSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#64748B", lineHeight: 17 },
  cachedBadge: { fontSize: 10, fontFamily: "Inter_500Medium", color: "#6366F1", backgroundColor: "#EEF2FF", alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, marginTop: 4 },
  refreshBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  refreshBtnText: { fontSize: 12, fontFamily: "Inter_500Medium", color: PRIMARY },
  riskCard: { borderRadius: 12, padding: 12, gap: 8 },
  riskHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  riskLeft: { gap: 2 },
  riskName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#1E293B" },
  riskLevel: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  riskPct: { fontSize: 22, fontFamily: "Inter_700Bold" },
  barBg: { height: 6, borderRadius: 3, backgroundColor: "rgba(0,0,0,0.08)" },
  barFill: { height: 6, borderRadius: 3 },
  riskReason: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#475569", lineHeight: 17 },
  recCard: { flexDirection: "row", gap: 12, backgroundColor: "#FFF", borderRadius: 12, padding: 12, alignItems: "flex-start", elevation: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
  recDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4, flexShrink: 0 },
  recContent: { flex: 1, gap: 2 },
  recTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#1E293B" },
  recDetail: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#475569", lineHeight: 17 },
  disclaimer: { flexDirection: "row", gap: 8, backgroundColor: "#F8FAFC", borderRadius: 10, padding: 12, alignItems: "flex-start", borderWidth: 1, borderColor: "#E2E8F0" },
  disclaimerText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748B", lineHeight: 16 },
  dietBanner: { borderRadius: 16, padding: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dietBannerTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#FFF" },
  dietBannerSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)", marginTop: 2 },
  dayCard: { backgroundColor: "#FFF", borderRadius: 14, overflow: "hidden", elevation: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
  dayCardToday: { borderWidth: 1.5, borderColor: PRIMARY },
  dayHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 12 },
  dayLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  todayDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: PRIMARY },
  dayName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#334155" },
  dayRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  dayCalTotal: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#64748B" },
  dayExpanded: { borderTopWidth: 1, borderTopColor: "#F1F5F9", padding: 14, gap: 10 },
  mealSection: { gap: 4 },
  mealHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  mealLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#334155", flex: 1 },
  mealTime: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  mealCal: { fontSize: 11, fontFamily: "Inter_500Medium", color: PRIMARY },
  mealItem: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#475569", lineHeight: 19, paddingLeft: 4 },
  dayTip: { flexDirection: "row", gap: 6, alignItems: "center" },
  dayTipText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748B" },
  weeklyTips: { backgroundColor: "#FFF", borderRadius: 14, padding: 14, gap: 8, elevation: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
  tipRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  tipText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: "#475569", lineHeight: 17 },
  cachedNote: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8", textAlign: "center", marginTop: 4 },
});
