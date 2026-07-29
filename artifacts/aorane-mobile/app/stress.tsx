import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Animated, Platform, Alert, Dimensions, Modal, ActivityIndicator,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { api } from "@/lib/api";
import { DS } from "@/lib/theme";

const { width: W } = Dimensions.get("window");

// ── Color palette consistent with app theme ─────────────────────────────────
const C = {
  bg:      "#F9F5FF",
  card:    "#FFFFFF",
  text:    DS.color.text,
  muted:   DS.color.muted,
  border:  "#EDE9FA",
  primary: "#7C3AED",          // deep purple — calm, clinical
  accent:  "#06B6D4",          // cyan — breathing/relaxation
  green:   "#10B981",
  amber:   "#F59E0B",
  orange:  "#F97316",
  red:     "#EF4444",
};

// ── Score helpers ─────────────────────────────────────────────────────────────
function scoreColor(s: number): string {
  if (s === 0)  return C.border;
  if (s < 26)   return C.green;
  if (s < 51)   return C.amber;
  if (s < 76)   return C.orange;
  return C.red;
}
function scoreLabel(s: number): string {
  if (s < 26)  return "Low";
  if (s < 51)  return "Moderate";
  if (s < 76)  return "Elevated";
  return "High Risk";
}
function scoreEmoji(s: number): string {
  if (s < 26)  return "😌";
  if (s < 51)  return "😐";
  if (s < 76)  return "😟";
  return "🚨";
}

// ── MOOD options (5-level) ─────────────────────────────────────────────────
const MOODS = [
  { score: 1, label: "Excellent", emoji: "😄", color: C.green,   subText: "Feeling great!" },
  { score: 2, label: "Good",      emoji: "🙂", color: "#34D399", subText: "Doing well"      },
  { score: 3, label: "Fair",      emoji: "😐", color: C.amber,   subText: "So-so"           },
  { score: 4, label: "Low",       emoji: "😟", color: C.orange,  subText: "Struggling"      },
  { score: 5, label: "Very Low",  emoji: "😞", color: C.red,     subText: "Really hard day" },
];

// ── ENERGY options ─────────────────────────────────────────────────────────
const ENERGY_LABELS = ["Exhausted", "Low", "Okay", "Good", "High Energy"];

// ── Clinical PSS-style questions (PHQ-4 inspired) ─────────────────────────
const PSS_QUESTIONS = [
  { q: "Feeling nervous, anxious, or overwhelmed?",       key: "q1" },
  { q: "Unable to control important things in your life?",key: "q2" },
  { q: "Things piling up beyond what you can handle?",    key: "q3" },
];
const PSS_OPTIONS = ["Not at all", "Rarely", "Sometimes", "Often"];

// ── Body symptoms multi-select ─────────────────────────────────────────────
const SYMPTOMS = [
  "Headache",  "Fatigue",   "Tight shoulders", "Trouble sleeping",
  "Racing heart", "Low appetite", "Difficulty focusing", "Irritability",
  "Chest tightness", "Muscle tension",
];

// ── 5-Pillar icons ─────────────────────────────────────────────────────────
const PILLARS = [
  { key: "sleep",    label: "Sleep",    icon: "moon-outline" as const,       color: "#8B5CF6" },
  { key: "water",    label: "Hydration",icon: "water-outline" as const,      color: "#06B6D4" },
  { key: "exercise", label: "Exercise", icon: "barbell-outline" as const,    color: C.green   },
  { key: "medicine", label: "Medicine", icon: "medical-outline" as const,    color: C.amber   },
  { key: "food",     label: "Nutrition",icon: "restaurant-outline" as const, color: "#EC4899" },
];

type DayData  = { date: string; dayLabel: string; avgScore: number; count: number; dominantMood: string | null };
type LogItem  = { stressScore: number; stressType: string; mood?: string; pillars?: Record<string, unknown>; loggedAt: string };
type Insight  = { avgScore: number; insight: string; tips: string[]; logsCount: number; aiPowered: boolean };
type WeekData = { days: DayData[]; weekAvg: number; totalLogs: number; highStreakDays: number; burnoutRisk: boolean; personalBaseline: number | null; vsBaseline: number | null; baselineLogsCount: number };

// ── Animated weekly bar chart ──────────────────────────────────────────────
function WeeklyChart({ days }: { days: DayData[] }) {
  const bars   = useRef(days.map(() => new Animated.Value(0))).current;
  const maxH   = 80;

  useEffect(() => {
    Animated.stagger(55, bars.map((b, i) =>
      Animated.timing(b, { toValue: days[i]?.avgScore || 0, duration: 450, useNativeDriver: false })
    )).start();
  }, [days]);

  return (
    <View style={{ paddingHorizontal: 14, paddingBottom: 14, paddingTop: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 5, height: maxH + 34 }}>
        {days.map((d, i) => {
          const isToday = i === days.length - 1;
          const col     = scoreColor(d.avgScore);
          const barH    = bars[i]!.interpolate({ inputRange: [0, 100], outputRange: [0, maxH] });
          return (
            <View key={d.date} style={{ flex: 1, alignItems: "center" }}>
              <View style={{ height: maxH, justifyContent: "flex-end", width: "100%" }}>
                {d.count > 0
                  ? <Animated.View style={{ height: barH, borderRadius: 6, backgroundColor: col, opacity: isToday ? 1 : 0.72, borderWidth: isToday ? 1.5 : 0, borderColor: col }} />
                  : <View style={{ height: 3, borderRadius: 3, backgroundColor: C.border }} />
                }
              </View>
              {d.count > 0 && (
                <Text style={{ color: col, fontSize: 8.5, fontFamily: "Inter_700Bold", marginTop: 2 }}>{d.avgScore}</Text>
              )}
              <Text style={{ color: isToday ? C.primary : C.muted, fontSize: 9.5, fontFamily: isToday ? "Inter_700Bold" : "Inter_400Regular", marginTop: 1 }}>
                {d.dayLabel}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── Live score ring ────────────────────────────────────────────────────────
function ScoreRing({ score, size = 90 }: { score: number; size?: number }) {
  const col   = scoreColor(score);
  const label = scoreLabel(score);
  const emoji = scoreEmoji(score);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 3.5, borderColor: col, alignItems: "center", justifyContent: "center", backgroundColor: col + "12" }}>
      <Text style={{ fontSize: size * 0.28, fontFamily: "Inter_800ExtraBold", color: col, lineHeight: size * 0.32 }}>{score}</Text>
      <Text style={{ fontSize: size * 0.14, fontFamily: "Inter_500Medium", color: col }}>{label}</Text>
      <Text style={{ fontSize: size * 0.22, marginTop: 1 }}>{emoji}</Text>
    </View>
  );
}

// ── 4-7-8 Breathing exercise component ────────────────────────────────────
function BreathingExercise() {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [phase,   setPhase]  = useState<"inhale" | "hold" | "exhale">("inhale");
  const [active,  setActive] = useState(false);
  const loopRef   = useRef<ReturnType<typeof Animated.loop> | null>(null);
  const timers    = useRef<ReturnType<typeof setTimeout>[]>([]);

  const startCycle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActive(true);
    setPhase("inhale");
    const seq = Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.55, duration: 4000, useNativeDriver: false }),
      Animated.delay(7000),
      Animated.timing(scaleAnim, { toValue: 1, duration: 8000, useNativeDriver: false }),
    ]);
    timers.current.push(
      setTimeout(() => setPhase("hold"),   4000),
      setTimeout(() => setPhase("exhale"), 11000),
      setTimeout(() => setPhase("inhale"), 19000),
    );
    loopRef.current = Animated.loop(seq);
    loopRef.current.start();
  };

  const stop = () => {
    loopRef.current?.stop();
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setActive(false);
    scaleAnim.setValue(1);
    setPhase("inhale");
  };

  const phaseInfo = {
    inhale: { text: "Breathe In…",  sub: "4 seconds", color: C.accent  },
    hold:   { text: "Hold…",        sub: "7 seconds", color: C.primary  },
    exhale: { text: "Breathe Out…", sub: "8 seconds", color: C.green    },
  }[phase];

  return (
    <View style={{ alignItems: "center", paddingVertical: 20, paddingHorizontal: 16 }}>
      <Text style={{ color: C.text, fontFamily: "Inter_700Bold", fontSize: 16, marginBottom: 4 }}>4-7-8 Breathing Technique</Text>
      <Text style={{ color: C.muted, fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 20, textAlign: "center", lineHeight: 18 }}>
        A clinically proven breathing method. Inhale 4s → Hold 7s → Exhale 8s. Repeat 4 cycles.
      </Text>
      {active ? (
        <View style={{ alignItems: "center" }}>
          <Animated.View style={{
            width: 120, height: 120, borderRadius: 60,
            backgroundColor: phaseInfo.color + "18",
            transform: [{ scale: scaleAnim }],
            alignItems: "center", justifyContent: "center",
            borderWidth: 2.5, borderColor: phaseInfo.color,
          }}>
            <Text style={{ fontSize: 36 }}>🌬️</Text>
          </Animated.View>
          <Text style={{ color: phaseInfo.color, fontFamily: "Inter_700Bold", fontSize: 17, marginTop: 18 }}>{phaseInfo.text}</Text>
          <Text style={{ color: C.muted, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 3 }}>{phaseInfo.sub}</Text>
          <TouchableOpacity onPress={stop} style={{ marginTop: 18, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12, backgroundColor: C.red + "18" }}>
            <Text style={{ color: C.red, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>Stop</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity onPress={startCycle} style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: C.accent + "12", borderWidth: 2.5, borderColor: C.accent, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 38 }}>🌬️</Text>
          <Text style={{ color: C.accent, fontSize: 11, fontFamily: "Inter_600SemiBold", marginTop: 6 }}>Start</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Main Screen ─────────────────────────────────────────────────────────────
export default function StressScreen() {
  const insets = useSafeAreaInsets();
  const topPad = insets.top;

  const [tab,          setTab]          = useState<"checkin" | "pillar" | "history">("checkin");
  const [dataLoading,  setDataLoading]  = useState(true);
  const [weekly,       setWeekly]       = useState<WeekData | null>(null);
  const [insight,      setInsight]      = useState<Insight | null>(null);
  const [logs,         setLogs]         = useState<LogItem[]>([]);

  // ── Check-in form state (3-step) ──────────────────────────────────────────
  const [step,         setStep]         = useState<1 | 2 | 3>(1);
  const [moodScore,    setMoodScore]    = useState<number | null>(null);
  const [energyScore,  setEnergyScore]  = useState<number>(3);
  const [pssAnswers,   setPssAnswers]   = useState<number[]>([0, 0, 0]);
  const [symptoms,     setSymptoms]     = useState<string[]>([]);
  const [submitting,   setSubmitting]   = useState(false);
  const [resultScore,  setResultScore]  = useState<number | null>(null);

  // ── 5-Pillar tab ──────────────────────────────────────────────────────────
  const [pillarLoading, setPillarLoading] = useState(false);
  const [pillarResult,  setPillarResult]  = useState<{ score: number; pillars: Record<string, number> } | null>(null);

  const loadAll = useCallback(async () => {
    setDataLoading(true);
    const [weekRes, insightRes, logsRes] = await Promise.allSettled([
      api.getStressWeekly(), api.getStressInsight(), api.getStressLogs(30),
    ]);
    if (weekRes.status    === "fulfilled") setWeekly(weekRes.value as WeekData);
    if (insightRes.status === "fulfilled") setInsight(insightRes.value);
    if (logsRes.status    === "fulfilled") setLogs(logsRes.value.logs as LogItem[]);
    setDataLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, []);
  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));

  const todayStr  = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const todayLogs = logs.filter(l => l.loggedAt?.split("T")[0] === todayStr);
  const todayAvg  = todayLogs.length ? Math.round(todayLogs.reduce((s, l) => s + l.stressScore, 0) / todayLogs.length) : 0;

  // ── Live preview score calculation ─────────────────────────────────────────
  const liveScore: number = (() => {
    if (!moodScore) return 0;
    const moodBase    = ((moodScore - 1) / 4) * 35;
    const energyBase  = ((energyScore - 1) / 4) * 15;
    const pssTotal    = pssAnswers.reduce((s, q) => s + q, 0);
    const pssComp     = (pssTotal / 9) * 35;
    const sympComp    = Math.min(symptoms.length * 3, 15);
    return Math.max(5, Math.min(98, Math.round(moodBase + energyBase + pssComp + sympComp)));
  })();

  const resetForm = () => {
    setStep(1); setMoodScore(null); setEnergyScore(3);
    setPssAnswers([0, 0, 0]); setSymptoms([]); setResultScore(null);
  };

  const handleSubmit = async () => {
    if (!moodScore) { Alert.alert("Select Mood", "Please select how you are feeling."); return; }
    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await api.logStress({
        stressType: "full_assessment",
        moodScore, energyScore, pssScores: pssAnswers, symptoms,
      });
      setResultScore(res.stressScore);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadAll();
    } catch (e: unknown) {
      Alert.alert("Error", (e as Error).message || "Could not save check-in.");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePillarAnalysis = async () => {
    setPillarLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const res = await api.logStress({ stressType: "five_pillar" });
      const pillarsData = (res.log as Record<string, unknown>).pillars as Record<string, number> | undefined;
      setPillarResult({ score: res.stressScore, pillars: pillarsData || {} });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadAll();
    } catch (e: unknown) {
      Alert.alert("Error", (e as Error).message || "Failed to compute analysis.");
    } finally {
      setPillarLoading(false); }
  };

  const toggleSymptom = (s: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <LinearGradient colors={["#F5F0FF", "#EDE9FA", "#F9F5FF"]} style={StyleSheet.absoluteFill} />

      <ScrollView
        contentContainerStyle={{ paddingTop: topPad + 8, paddingBottom: 120, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 18 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.primary + "15", alignItems: "center", justifyContent: "center", marginRight: 12 }}
          >
            <Ionicons name="arrow-back" size={20} color={C.primary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontFamily: "Inter_700Bold", fontSize: 22 }}>Stress Tracker 🧘</Text>
            <Text style={{ color: C.muted, fontSize: 11, fontFamily: "Inter_400Regular" }}>Clinically-informed daily check-in</Text>
          </View>
          {weekly?.burnoutRisk && (
            <View style={{ backgroundColor: C.red + "15", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: C.red + "30" }}>
              <Text style={{ color: C.red, fontFamily: "Inter_700Bold", fontSize: 10 }}>⚠️ Burnout Risk</Text>
            </View>
          )}
        </View>

        {/* ── TODAY SUMMARY ROW ──────────────────────────────────────────── */}
        {!dataLoading && (
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
            <View style={[sCard, { flex: 1, padding: 14 }]}>
              <Text style={{ color: C.muted, fontSize: 11, fontFamily: "Inter_500Medium" }}>Today's Avg</Text>
              <Text style={{ color: todayAvg > 0 ? scoreColor(todayAvg) : C.muted, fontFamily: "Inter_700Bold", fontSize: 28, marginTop: 2 }}>
                {todayAvg > 0 ? todayAvg : "—"}
              </Text>
              {todayAvg > 0 && <Text style={{ color: scoreColor(todayAvg), fontSize: 11, fontFamily: "Inter_600SemiBold" }}>{scoreLabel(todayAvg)}</Text>}
              <Text style={{ color: C.muted, fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 3 }}>{todayLogs.length} log{todayLogs.length !== 1 ? "s" : ""} today</Text>
            </View>
            <View style={[sCard, { flex: 1, padding: 14 }]}>
              <Text style={{ color: C.muted, fontSize: 11, fontFamily: "Inter_500Medium" }}>Weekly Avg</Text>
              <Text style={{ color: (weekly?.weekAvg ?? 0) > 0 ? scoreColor(weekly?.weekAvg ?? 0) : C.muted, fontFamily: "Inter_700Bold", fontSize: 28, marginTop: 2 }}>
                {(weekly?.weekAvg ?? 0) > 0 ? weekly!.weekAvg : "—"}
              </Text>
              {(weekly?.weekAvg ?? 0) > 0 && <Text style={{ color: scoreColor(weekly!.weekAvg), fontSize: 11, fontFamily: "Inter_600SemiBold" }}>{scoreLabel(weekly!.weekAvg)}</Text>}
              {(weekly?.highStreakDays ?? 0) >= 2 && (
                <Text style={{ color: C.orange, fontSize: 9, fontFamily: "Inter_600SemiBold", marginTop: 2 }}>
                  {weekly!.highStreakDays} high-stress days in a row
                </Text>
              )}
            </View>
          </View>
        )}

        {/* ── PERSONAL BASELINE CARD ─────────────────────────────────────── */}
        {!dataLoading && weekly?.personalBaseline !== null && weekly?.personalBaseline !== undefined && (
          <View style={[sCard, { marginBottom: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 14 }]}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.primary + "15", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="analytics-outline" size={22} color={C.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.muted, fontSize: 10, fontFamily: "Inter_500Medium" }}>Your 30-Day Baseline</Text>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 2 }}>
                <Text style={{ color: C.primary, fontFamily: "Inter_700Bold", fontSize: 20 }}>{weekly.personalBaseline}</Text>
                <Text style={{ color: C.muted, fontSize: 10, fontFamily: "Inter_400Regular" }}>/ 100 personal avg</Text>
              </View>
              {weekly.vsBaseline !== null && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
                  <Ionicons
                    name={weekly.vsBaseline > 5 ? "trending-up" : weekly.vsBaseline < -5 ? "trending-down" : "remove"}
                    size={13}
                    color={weekly.vsBaseline > 5 ? C.red : weekly.vsBaseline < -5 ? C.green : C.amber}
                  />
                  <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: weekly.vsBaseline > 5 ? C.red : weekly.vsBaseline < -5 ? C.green : C.amber }}>
                    {weekly.vsBaseline > 5
                      ? `+${weekly.vsBaseline} pts above your usual — more stressed than normal`
                      : weekly.vsBaseline < -5
                      ? `${weekly.vsBaseline} pts below your usual — less stressed than normal`
                      : "Within your normal range"}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
        {!dataLoading && (weekly?.personalBaseline === null || weekly?.personalBaseline === undefined) && (weekly?.baselineLogsCount ?? 0) < 5 && (
          <View style={[sCard, { marginBottom: 14, padding: 12, flexDirection: "row", alignItems: "center", gap: 10, borderColor: C.primary + "20" }]}>
            <Ionicons name="information-circle-outline" size={18} color={C.primary} />
            <Text style={{ color: C.muted, fontSize: 10, fontFamily: "Inter_400Regular", flex: 1 }}>
              Log stress {5 - (weekly?.baselineLogsCount ?? 0)} more times to unlock your personal baseline comparison.
            </Text>
          </View>
        )}

        {/* ── WEEKLY CHART ──────────────────────────────────────────────── */}
        {weekly && weekly.days.length > 0 && (
          <View style={[sCard, { marginBottom: 14 }]}>
            <View style={{ padding: 14, paddingBottom: 0 }}>
              <Text style={{ color: C.text, fontFamily: "Inter_700Bold", fontSize: 13 }}>7-Day Stress Trend</Text>
            </View>
            <WeeklyChart days={weekly.days} />
            <View style={{ flexDirection: "row", gap: 14, paddingHorizontal: 14, paddingBottom: 12, flexWrap: "wrap" }}>
              {[{ label: "Low (<26)", color: C.green }, { label: "Moderate", color: C.amber }, { label: "Elevated", color: C.orange }, { label: "High Risk", color: C.red }].map(l => (
                <View key={l.label} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: l.color }} />
                  <Text style={{ color: C.muted, fontSize: 9.5, fontFamily: "Inter_400Regular" }}>{l.label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── AI INSIGHT ────────────────────────────────────────────────── */}
        {insight && insight.logsCount > 0 && (
          <View style={[sCard, { marginBottom: 14 }]}>
            <LinearGradient colors={[C.primary + "12", "#E0E7FF"]} style={{ borderRadius: 18, padding: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.primary + "20", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 18 }}>🤖</Text>
                </View>
                <View>
                  <Text style={{ color: C.text, fontFamily: "Inter_700Bold", fontSize: 14 }}>AI Insight</Text>
                  <Text style={{ color: C.muted, fontSize: 10, fontFamily: "Inter_400Regular" }}>{insight.aiPowered ? "Gemini AI analysis" : "Pattern analysis"}</Text>
                </View>
              </View>
              <Text style={{ color: C.text, fontFamily: "Inter_500Medium", fontSize: 13, lineHeight: 20, marginBottom: 12 }}>{insight.insight}</Text>
              {insight.tips?.length > 0 && (
                <View style={{ gap: 8 }}>
                  {insight.tips.map((tip, i) => (
                    <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: C.primary + "20", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                        <Text style={{ color: C.primary, fontSize: 9, fontFamily: "Inter_700Bold" }}>{i + 1}</Text>
                      </View>
                      <Text style={{ color: C.text, fontSize: 12, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 18 }}>{tip}</Text>
                    </View>
                  ))}
                </View>
              )}
            </LinearGradient>
          </View>
        )}

        {/* ── TABS ──────────────────────────────────────────────────────── */}
        <View style={{ flexDirection: "row", backgroundColor: C.primary + "12", borderRadius: 14, padding: 4, marginBottom: 16, gap: 4 }}>
          {([
            { key: "checkin", label: "Check In"   },
            { key: "pillar",  label: "Auto Analysis" },
            { key: "history", label: "History"    },
          ] as const).map(t => (
            <TouchableOpacity
              key={t.key} onPress={() => { setTab(t.key); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              style={{ flex: 1, paddingVertical: 9, borderRadius: 11, backgroundColor: tab === t.key ? C.primary : "transparent", alignItems: "center" }}
            >
              <Text style={{ color: tab === t.key ? "#FFF" : C.muted, fontFamily: "Inter_600SemiBold", fontSize: 11.5 }}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ══════════════════════════════════════════════════════════════════
            TAB 1 — CLINICAL CHECK-IN (3 steps)
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "checkin" && (
          <View style={{ gap: 12 }}>

            {/* Result card after submission */}
            {resultScore !== null && (
              <View style={[sCard, { padding: 20, alignItems: "center", gap: 10 }]}>
                <Text style={{ color: C.text, fontFamily: "Inter_700Bold", fontSize: 15 }}>Check-In Saved ✅</Text>
                <ScoreRing score={resultScore} size={110} />
                <Text style={{ color: C.muted, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "center", lineHeight: 18 }}>
                  {resultScore < 26  ? "You are doing well. Keep maintaining your current routine." :
                   resultScore < 51  ? "Some stress detected. Try a short walk or breathing exercise." :
                   resultScore < 76  ? "Elevated stress. Take a break, hydrate, and try the 4-7-8 exercise below." :
                                       "High stress detected. Consider speaking with a doctor or counselor."}
                </Text>
                <TouchableOpacity onPress={resetForm} style={{ backgroundColor: C.primary + "15", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 }}>
                  <Text style={{ color: C.primary, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>Log Again</Text>
                </TouchableOpacity>
              </View>
            )}

            {resultScore === null && (
              <>
                {/* Step indicator */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  {[1, 2, 3].map(s => (
                    <React.Fragment key={s}>
                      <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: step >= s ? C.primary : C.border }} />
                    </React.Fragment>
                  ))}
                </View>
                <Text style={{ color: C.muted, fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 8, textAlign: "center" }}>
                  Step {step} of 3 — {step === 1 ? "Mood & Energy" : step === 2 ? "Stress Indicators" : "Physical Symptoms"}
                </Text>

                {/* ── STEP 1: Mood + Energy ─────────────────────────────── */}
                {step === 1 && (
                  <View style={[sCard, { padding: 18 }]}>
                    <Text style={{ color: C.text, fontFamily: "Inter_700Bold", fontSize: 15, marginBottom: 4 }}>How are you feeling right now?</Text>
                    <Text style={{ color: C.muted, fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 16 }}>Select your overall mood today</Text>

                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
                      {MOODS.map(m => (
                        <TouchableOpacity
                          key={m.score} onPress={() => { setMoodScore(m.score); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                          style={{ width: (W - 80) / 2, alignItems: "center", padding: 14, borderRadius: 14, borderWidth: 2, borderColor: moodScore === m.score ? m.color : C.border, backgroundColor: moodScore === m.score ? m.color + "15" : C.card }}
                          activeOpacity={0.8}
                        >
                          <Text style={{ fontSize: 34, marginBottom: 6 }}>{m.emoji}</Text>
                          <Text style={{ color: moodScore === m.score ? m.color : C.text, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>{m.label}</Text>
                          <Text style={{ color: C.muted, fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 2 }}>{m.subText}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={{ color: C.text, fontFamily: "Inter_600SemiBold", fontSize: 13, marginBottom: 10 }}>Energy Level</Text>
                    <View style={{ flexDirection: "row", gap: 6, marginBottom: 20 }}>
                      {[1, 2, 3, 4, 5].map(e => (
                        <TouchableOpacity
                          key={e}
                          onPress={() => { setEnergyScore(e); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                          style={{ flex: 1, height: 40, borderRadius: 10, borderWidth: 1.5, borderColor: energyScore === e ? C.primary : C.border, backgroundColor: energyScore === e ? C.primary + "15" : C.card, alignItems: "center", justifyContent: "center" }}
                        >
                          <Text style={{ color: energyScore === e ? C.primary : C.muted, fontFamily: "Inter_600SemiBold", fontSize: 11 }}>
                            {e === 1 ? "😴" : e === 2 ? "🥱" : e === 3 ? "😶" : e === 4 ? "🙂" : "⚡"}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Text style={{ color: C.muted, fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "center", marginBottom: 18 }}>
                      {ENERGY_LABELS[energyScore - 1]}
                    </Text>

                    <TouchableOpacity
                      onPress={() => { if (!moodScore) { Alert.alert("Select Mood", "Please select a mood first."); return; } setStep(2); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
                      style={{ backgroundColor: C.primary, borderRadius: 14, padding: 15, alignItems: "center" }}
                      activeOpacity={0.85}
                    >
                      <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 15 }}>Next →</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* ── STEP 2: Clinical PSS questions ───────────────────── */}
                {step === 2 && (
                  <View style={[sCard, { padding: 18 }]}>
                    <Text style={{ color: C.text, fontFamily: "Inter_700Bold", fontSize: 15, marginBottom: 4 }}>Stress Indicators</Text>
                    <Text style={{ color: C.muted, fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 18 }}>In the past few days, how often did you experience the following?</Text>

                    {PSS_QUESTIONS.map((q, qi) => (
                      <View key={qi} style={{ marginBottom: 20 }}>
                        <Text style={{ color: C.text, fontFamily: "Inter_600SemiBold", fontSize: 13, marginBottom: 10, lineHeight: 18 }}>{q.q}</Text>
                        <View style={{ flexDirection: "row", gap: 6 }}>
                          {PSS_OPTIONS.map((opt, oi) => (
                            <TouchableOpacity
                              key={oi}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setPssAnswers(prev => { const n = [...prev]; n[qi] = oi; return n; });
                              }}
                              style={{ flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: pssAnswers[qi] === oi ? C.primary : C.border, backgroundColor: pssAnswers[qi] === oi ? C.primary + "15" : C.card, alignItems: "center" }}
                            >
                              <Text style={{ color: pssAnswers[qi] === oi ? C.primary : C.muted, fontFamily: pssAnswers[qi] === oi ? "Inter_700Bold" : "Inter_400Regular", fontSize: 9.5, textAlign: "center" }}>{opt}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    ))}

                    {/* Live preview */}
                    {moodScore && (
                      <View style={{ backgroundColor: scoreColor(liveScore) + "12", borderRadius: 12, padding: 12, marginBottom: 16, flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <View style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: scoreColor(liveScore), alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ color: scoreColor(liveScore), fontFamily: "Inter_700Bold", fontSize: 14 }}>{liveScore}</Text>
                        </View>
                        <View>
                          <Text style={{ color: scoreColor(liveScore), fontFamily: "Inter_600SemiBold", fontSize: 12 }}>Live Score — {scoreLabel(liveScore)}</Text>
                          <Text style={{ color: C.muted, fontSize: 10, fontFamily: "Inter_400Regular" }}>Updates as you answer</Text>
                        </View>
                      </View>
                    )}

                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <TouchableOpacity onPress={() => setStep(1)} style={{ flex: 1, backgroundColor: C.border, borderRadius: 14, padding: 14, alignItems: "center" }}>
                        <Text style={{ color: C.muted, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>← Back</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => { setStep(3); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }} style={{ flex: 2, backgroundColor: C.primary, borderRadius: 14, padding: 14, alignItems: "center" }}>
                        <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 14 }}>Next →</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* ── STEP 3: Body symptoms ─────────────────────────────── */}
                {step === 3 && (
                  <View style={[sCard, { padding: 18 }]}>
                    <Text style={{ color: C.text, fontFamily: "Inter_700Bold", fontSize: 15, marginBottom: 4 }}>Physical Symptoms</Text>
                    <Text style={{ color: C.muted, fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 16 }}>Any physical signs of stress today? (select all that apply)</Text>

                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                      {SYMPTOMS.map(sym => {
                        const selected = symptoms.includes(sym);
                        return (
                          <TouchableOpacity
                            key={sym} onPress={() => toggleSymptom(sym)}
                            style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: selected ? C.primary : C.border, backgroundColor: selected ? C.primary + "15" : C.card }}
                          >
                            <Text style={{ color: selected ? C.primary : C.muted, fontFamily: selected ? "Inter_600SemiBold" : "Inter_400Regular", fontSize: 12 }}>
                              {selected ? "✓ " : ""}{sym}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Final live score preview */}
                    {moodScore && (
                      <View style={{ alignItems: "center", marginBottom: 20 }}>
                        <ScoreRing score={liveScore} size={100} />
                        <Text style={{ color: C.muted, fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 10 }}>Your stress index preview</Text>
                      </View>
                    )}

                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <TouchableOpacity onPress={() => setStep(2)} style={{ flex: 1, backgroundColor: C.border, borderRadius: 14, padding: 14, alignItems: "center" }}>
                        <Text style={{ color: C.muted, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>← Back</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleSubmit}
                        disabled={submitting}
                        style={{ flex: 2, backgroundColor: C.primary, borderRadius: 14, padding: 14, alignItems: "center" }}
                      >
                        {submitting
                          ? <ActivityIndicator color="#FFF" size="small" />
                          : <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 14 }}>Save Check-In ✓</Text>
                        }
                      </TouchableOpacity>
                    </View>
                    <Text style={{ color: C.muted, fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 10 }}>
                      No symptoms? That's great — just tap Save.
                    </Text>
                  </View>
                )}
              </>
            )}

            {/* Today's check-ins mini list */}
            {todayLogs.length > 0 && (
              <View style={[sCard, { padding: 14 }]}>
                <Text style={{ color: C.text, fontFamily: "Inter_600SemiBold", fontSize: 13, marginBottom: 10 }}>Today's {todayLogs.length} Check-In{todayLogs.length > 1 ? "s" : ""}</Text>
                {todayLogs.slice(0, 4).map((l, i) => {
                  const t    = new Date(l.loggedAt);
                  const hhmm = t.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
                  const mode = (l.pillars as Record<string, unknown>)?.mode as string || l.stressType;
                  const modeLabel = mode === "full_assessment" ? "Clinical Check-In" : mode === "five_pillar" ? "Auto Analysis" : "Mood Log";
                  return (
                    <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: C.border }}>
                      <Text style={{ fontSize: 20 }}>{scoreEmoji(l.stressScore)}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: C.text, fontFamily: "Inter_500Medium", fontSize: 12 }}>{modeLabel}</Text>
                        <Text style={{ color: C.muted, fontSize: 10 }}>{hhmm}</Text>
                      </View>
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: scoreColor(l.stressScore) + "20", alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ color: scoreColor(l.stressScore), fontFamily: "Inter_700Bold", fontSize: 14 }}>{l.stressScore}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Breathing exercise */}
            <View style={sCard}>
              <BreathingExercise />
            </View>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB 2 — 5-PILLAR AUTO ANALYSIS
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "pillar" && (
          <View style={{ gap: 12 }}>
            <View style={[sCard, { padding: 18 }]}>
              <Text style={{ color: C.text, fontFamily: "Inter_700Bold", fontSize: 15, marginBottom: 4 }}>Auto Stress Analysis</Text>
              <Text style={{ color: C.muted, fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 16, lineHeight: 18 }}>
                Automatically calculates your stress score based on today's tracked data across 5 health pillars. More data logged = more accurate result.
              </Text>

              {PILLARS.map(p => (
                <View key={p.key} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, backgroundColor: p.color + "10", borderWidth: 1, borderColor: p.color + "25", marginBottom: 10 }}>
                  <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: p.color + "20", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={p.icon} size={20} color={p.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>{p.label}</Text>
                    <Text style={{ color: C.muted, fontSize: 11, fontFamily: "Inter_400Regular" }}>
                      {p.key === "sleep"    ? "From your profile average" :
                       p.key === "water"    ? "Today's water logs" :
                       p.key === "exercise" ? "Today's exercise sessions" :
                       p.key === "medicine" ? "Schedule adherence" : "Food log quality"}
                    </Text>
                  </View>
                  {pillarResult?.pillars[p.key] !== undefined && (
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ color: p.color, fontFamily: "Inter_700Bold", fontSize: 15 }}>{Math.round(pillarResult.pillars[p.key]!)}%</Text>
                      <Text style={{ color: C.muted, fontSize: 9, fontFamily: "Inter_400Regular" }}>Wellness</Text>
                    </View>
                  )}
                </View>
              ))}

              {pillarResult && (
                <View style={{ alignItems: "center", paddingVertical: 16 }}>
                  <ScoreRing score={pillarResult.score} size={110} />
                  <Text style={{ color: C.muted, fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 10, textAlign: "center" }}>
                    Based on today's activity data
                  </Text>
                </View>
              )}

              <TouchableOpacity
                onPress={handlePillarAnalysis}
                disabled={pillarLoading}
                style={{ backgroundColor: "#06B6D4", borderRadius: 14, padding: 15, alignItems: "center", marginTop: 8 }}
                activeOpacity={0.85}
              >
                {pillarLoading
                  ? <ActivityIndicator color="#FFF" size="small" />
                  : <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 15 }}>Run Auto Analysis 🔍</Text>
                }
              </TouchableOpacity>
            </View>

            {/* Clinical use note */}
            <View style={[sCard, { padding: 14 }]}>
              <LinearGradient colors={["#EFF6FF", "#F0FDFA"]} style={{ borderRadius: 14, padding: 14 }}>
                <Text style={{ color: C.text, fontFamily: "Inter_700Bold", fontSize: 13, marginBottom: 8 }}>📋 For Corporate & Clinical Use</Text>
                <Text style={{ color: C.muted, fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 18 }}>
                  This stress score is computed using a weighted formula across sleep quality, hydration, physical activity, medication adherence, and nutrition. It correlates with validated burnout indices used in occupational health settings.{"\n\n"}Clinicians and HR managers can access aggregated anonymized trends from the admin panel.
                </Text>
              </LinearGradient>
            </View>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB 3 — HISTORY
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "history" && (
          <View style={{ gap: 10 }}>
            {weekly && weekly.days.some(d => d.count > 0) && (
              <View style={[sCard, { padding: 14 }]}>
                <Text style={{ color: C.text, fontFamily: "Inter_700Bold", fontSize: 14, marginBottom: 12 }}>Daily Average Stress</Text>
                {[...weekly.days].reverse().filter(d => d.count > 0).map(d => (
                  <View key={d.date} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border }}>
                    <Text style={{ color: C.muted, fontSize: 11, fontFamily: "Inter_600SemiBold", width: 32 }}>{d.dayLabel}</Text>
                    <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: C.border, overflow: "hidden" }}>
                      <View style={{ height: "100%", width: `${d.avgScore}%`, backgroundColor: scoreColor(d.avgScore), borderRadius: 3 }} />
                    </View>
                    <Text style={{ color: scoreColor(d.avgScore), fontFamily: "Inter_700Bold", fontSize: 12, width: 28, textAlign: "right" }}>{d.avgScore}</Text>
                    <Text style={{ fontSize: 14 }}>{scoreEmoji(d.avgScore)}</Text>
                  </View>
                ))}
              </View>
            )}

            {logs.length === 0 && !dataLoading && (
              <View style={[sCard, { padding: 30, alignItems: "center" }]}>
                <Text style={{ fontSize: 40, marginBottom: 12 }}>📊</Text>
                <Text style={{ color: C.text, fontFamily: "Inter_600SemiBold", fontSize: 15, marginBottom: 6 }}>No history yet</Text>
                <Text style={{ color: C.muted, fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" }}>Complete your first check-in to see your stress history here.</Text>
              </View>
            )}

            {logs.slice(0, 20).map((l, i) => {
              const t    = new Date(l.loggedAt);
              const mode = (l.pillars as Record<string, unknown>)?.mode as string || l.stressType;
              const modeLabel = mode === "full_assessment" ? "Clinical" : mode === "five_pillar" ? "Auto" : "Mood";
              return (
                <View key={i} style={[sCard, { padding: 14 }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: scoreColor(l.stressScore), backgroundColor: scoreColor(l.stressScore) + "12", alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ color: scoreColor(l.stressScore), fontFamily: "Inter_700Bold", fontSize: 15 }}>{l.stressScore}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={{ color: C.text, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>{scoreLabel(l.stressScore)}</Text>
                        <View style={{ backgroundColor: C.primary + "15", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 }}>
                          <Text style={{ color: C.primary, fontSize: 9.5, fontFamily: "Inter_600SemiBold" }}>{modeLabel}</Text>
                        </View>
                      </View>
                      <Text style={{ color: C.muted, fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 }}>
                        {t.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {t.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 24 }}>{scoreEmoji(l.stressScore)}</Text>
                  </View>
                  {!!(l.pillars as Record<string, unknown>)?.symptoms && (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 10 }}>
                      {((l.pillars as Record<string, unknown>).symptoms as string[]).map(sym => (
                        <View key={sym} style={{ backgroundColor: C.orange + "12", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
                          <Text style={{ color: C.orange, fontSize: 10, fontFamily: "Inter_400Regular" }}>{sym}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const sCard = StyleSheet.create({
  card: {
    backgroundColor: "#FFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EDE9FA",
    shadowColor: "#7C3AED",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    overflow: "hidden",
  },
}).card;
