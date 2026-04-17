import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Animated, Platform, Alert, Dimensions,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { api } from "@/lib/api";

const { width: W } = Dimensions.get("window");

const C = {
  bg: "#F0F9FF", card: "#FFFFFF", primary: "#0077B6", accent: "#00B896",
  text: "#0D1F33", muted: "#7A90A4", border: "#E2EFF5",
  purple: "#8B5CF6", green: "#10B981", orange: "#F97316", red: "#DC2626",
  amber: "#F59E0B",
};

const MOODS = [
  { key: "happy",    label: "Happy",    emoji: "😊", color: C.green,  score: 15, desc: "All good!" },
  { key: "neutral",  label: "Neutral",  emoji: "😐", color: C.amber,  score: 40, desc: "Feeling okay" },
  { key: "stressed", label: "Stressed", emoji: "😟", color: C.orange, score: 72, desc: "Under pressure" },
  { key: "sad",      label: "Sad",      emoji: "😢", color: C.red,    score: 65, desc: "Mood is low" },
];

const PILLARS = [
  { key: "sleep",    label: "Sleep",    icon: "moon-outline" as const,       color: C.purple },
  { key: "water",    label: "Water",    icon: "water-outline" as const,      color: C.primary },
  { key: "exercise", label: "Exercise", icon: "barbell-outline" as const,    color: C.green },
  { key: "medicine", label: "Medicine", icon: "medical-outline" as const,    color: C.amber },
  { key: "food",     label: "Food",     icon: "restaurant-outline" as const, color: "#EC4899" },
];

type DayData = { date: string; dayLabel: string; dayLabelHi: string; avgScore: number; count: number; dominantMood: string | null };
type InsightData = { avgScore: number; insight: string; tips: string[]; logsCount: number; aiPowered: boolean };
type LogItem = { stressScore: number; stressType: string; mood?: string; pillars?: Record<string, number>; loggedAt: string };

function scoreColor(s: number) {
  return s === 0 ? C.border : s < 30 ? C.green : s < 55 ? C.amber : s < 75 ? C.orange : C.red;
}
function scoreLabel(s: number) {
  return s < 30 ? "Low" : s < 55 ? "Moderate" : s < 75 ? "High" : "Critical";
}
function moodEmoji(m: string | null) {
  return { happy: "😊", neutral: "😐", stressed: "😟", sad: "😢" }[m ?? ""] ?? "—";
}

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View style={[{ backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.border, shadowColor: "#0077B6", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3, overflow: "hidden" }, style]}>
      {Platform.OS === "ios"
        ? <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
        : null}
      {children}
    </View>
  );
}

function WeeklyChart({ days }: { days: DayData[] }) {
  const bars = useRef(days.map(() => new Animated.Value(0))).current;
  const maxH = 90;

  useEffect(() => {
    Animated.stagger(60, bars.map((b, i) =>
      Animated.timing(b, { toValue: days[i]?.avgScore || 0, duration: 500, useNativeDriver: false })
    )).start();
  }, [days]);

  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 16, paddingTop: 8 }}>
      <Text style={{ color: C.muted, fontSize: 11, fontFamily: "Inter_500Medium", marginBottom: 12 }}>7-Din Ka Stress Trend</Text>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, height: maxH + 36 }}>
        {days.map((d, i) => {
          const isToday = i === days.length - 1;
          const col = scoreColor(d.avgScore);
          const barH = bars[i]!.interpolate({ inputRange: [0, 100], outputRange: [0, maxH] });
          return (
            <View key={d.date} style={{ flex: 1, alignItems: "center" }}>
              <View style={{ height: maxH, justifyContent: "flex-end", width: "100%" }}>
                {d.count > 0 ? (
                  <Animated.View style={{ height: barH, borderRadius: 6, backgroundColor: col, opacity: isToday ? 1 : 0.7 }} />
                ) : (
                  <View style={{ height: 4, borderRadius: 3, backgroundColor: C.border }} />
                )}
              </View>
              {d.count > 0 && (
                <Text style={{ color: col, fontSize: 9, fontFamily: "Inter_700Bold", marginTop: 3 }}>{d.avgScore}</Text>
              )}
              <Text style={{ color: isToday ? C.primary : C.muted, fontSize: 10, fontFamily: isToday ? "Inter_700Bold" : "Inter_400Regular", marginTop: 2 }}>
                {d.dayLabel}
              </Text>
              {d.dominantMood && d.count > 0 && (
                <Text style={{ fontSize: 9, marginTop: 1 }}>{moodEmoji(d.dominantMood)}</Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function BreathingCircle() {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [phase, setPhase] = useState<"inhale" | "hold" | "exhale">("inhale");
  const [active, setActive] = useState(false);
  const loopRef = useRef<ReturnType<typeof Animated.loop> | null>(null);

  const startCycle = () => {
    setActive(true);
    const seq = Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.55, duration: 4000, useNativeDriver: false }),
      Animated.delay(7000),
      Animated.timing(scaleAnim, { toValue: 1, duration: 8000, useNativeDriver: false }),
    ]);
    setPhase("inhale");
    const t1 = setTimeout(() => setPhase("hold"), 4000);
    const t2 = setTimeout(() => setPhase("exhale"), 11000);
    const t3 = setTimeout(() => setPhase("inhale"), 19000);
    loopRef.current = Animated.loop(seq);
    loopRef.current.start();
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  };

  const stop = () => {
    loopRef.current?.stop();
    setActive(false);
    scaleAnim.setValue(1);
    setPhase("inhale");
  };

  const phaseText = { inhale: "Saans lo… (4s)", hold: "Roko… (7s)", exhale: "Chodo… (8s)" }[phase];
  const phaseColor = { inhale: C.primary, hold: C.purple, exhale: C.green }[phase];

  return (
    <View style={{ alignItems: "center", paddingVertical: 20 }}>
      <Text style={{ color: C.text, fontFamily: "Inter_700Bold", fontSize: 15, marginBottom: 4 }}>4-7-8 Breathing</Text>
      <Text style={{ color: C.muted, fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 18, textAlign: "center" }}>
        This breathing technique helps reduce stress immediately
      </Text>
      {active ? (
        <>
          <Animated.View style={{
            width: 110, height: 110, borderRadius: 55,
            backgroundColor: phaseColor + "18",
            transform: [{ scale: scaleAnim }],
            alignItems: "center", justifyContent: "center",
            borderWidth: 2.5, borderColor: phaseColor,
          }}>
            <Text style={{ fontSize: 30 }}>🌬️</Text>
          </Animated.View>
          <Text style={{ color: phaseColor, fontFamily: "Inter_700Bold", fontSize: 15, marginTop: 14 }}>{phaseText}</Text>
          <TouchableOpacity onPress={stop} style={{ marginTop: 16, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 12, backgroundColor: C.red + "15" }}>
            <Text style={{ color: C.red, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>Stop it</Text>
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity onPress={startCycle} style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: C.primary + "12", borderWidth: 2.5, borderColor: C.primary, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 34 }}>🌬️</Text>
          <Text style={{ color: C.primary, fontSize: 11, fontFamily: "Inter_600SemiBold", marginTop: 4 }}>Get Started</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function StressScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [tab, setTab] = useState<"today" | "pillar" | "history">("today");
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [logLoading, setLogLoading] = useState(false);
  const [pillarLoading, setPillarLoading] = useState(false);

  const [weekly, setWeekly] = useState<DayData[]>([]);
  const [weekAvg, setWeekAvg] = useState(0);
  const [insight, setInsight] = useState<InsightData | null>(null);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setDataLoading(true);
    const [weekRes, insightRes, logsRes] = await Promise.allSettled([
      api.getStressWeekly(),
      api.getStressInsight(),
      api.getStressLogs(30),
    ]);
    if (weekRes.status === "fulfilled") {
      setWeekly(weekRes.value.days);
      setWeekAvg(weekRes.value.weekAvg);
    }
    if (insightRes.status === "fulfilled") setInsight(insightRes.value);
    if (logsRes.status === "fulfilled") setLogs(logsRes.value.logs as LogItem[]);
    setDataLoading(false);
  };

  const submitMood = async () => {
    if (!selectedMood) return;
    setLogLoading(true);
    try {
      const res = await api.logStress({ stressType: "mood", mood: selectedMood });
      const m = MOODS.find(x => x.key === selectedMood);
      Alert.alert("Logged! ✅", `${m?.emoji} ${m?.label} — Stress score: ${res.stressScore}/100`);
      setSelectedMood(null);
      loadAll();
    } catch (e: unknown) {
      Alert.alert("Error", (e as Error).message || "Failed");
    } finally { setLogLoading(false); }
  };

  const submit5Pillar = async () => {
    setPillarLoading(true);
    try {
      const res = await api.logStress({ stressType: "five_pillar" });
      Alert.alert(
        "5-Pillar Analysis ✅",
        `Today's stress score: ${res.stressScore}/100\n\nCalculated based on today's water intake, exercise and sleep data.`
      );
      loadAll();
    } catch (e: unknown) {
      Alert.alert("Error", (e as Error).message || "Failed");
    } finally { setPillarLoading(false); }
  };

  const todayStr = new Date().toISOString().split("T")[0]!;
  const todayLogs = logs.filter(l => l.loggedAt?.split("T")[0] === todayStr);
  const todayAvg = todayLogs.length
    ? Math.round(todayLogs.reduce((s, l) => s + l.stressScore, 0) / todayLogs.length)
    : 0;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <LinearGradient colors={["#E0F2FE", "#F0FAFB", "#F5FFF8"]} style={StyleSheet.absoluteFill} />

      <ScrollView contentContainerStyle={{ paddingTop: topPad + 12, paddingBottom: 100, paddingHorizontal: 16 }}>

        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.primary + "15", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
            <Ionicons name="arrow-back" size={20} color={C.primary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontFamily: "Inter_700Bold", fontSize: 22 }}>Stress Tracker 🧘</Text>
            <Text style={{ color: C.muted, fontSize: 12, fontFamily: "Inter_400Regular" }}>Daily + weekly mood aur stress analysis</Text>
          </View>
        </View>

        {/* Today Summary Row */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
          <Card style={{ flex: 1, padding: 14 }}>
            <Text style={{ color: C.muted, fontSize: 11, fontFamily: "Inter_500Medium" }}>Today's avg</Text>
            <Text style={{ color: todayAvg > 0 ? scoreColor(todayAvg) : C.muted, fontFamily: "Inter_700Bold", fontSize: 26, marginTop: 2 }}>
              {todayAvg > 0 ? todayAvg : "—"}
            </Text>
            {todayAvg > 0 && <Text style={{ color: scoreColor(todayAvg), fontSize: 11, fontFamily: "Inter_600SemiBold" }}>{scoreLabel(todayAvg)}</Text>}
            <Text style={{ color: C.muted, fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 2 }}>{todayLogs.length} log{todayLogs.length !== 1 ? "s" : ""} today</Text>
          </Card>
          <Card style={{ flex: 1, padding: 14 }}>
            <Text style={{ color: C.muted, fontSize: 11, fontFamily: "Inter_500Medium" }}>Weekly avg</Text>
            <Text style={{ color: weekAvg > 0 ? scoreColor(weekAvg) : C.muted, fontFamily: "Inter_700Bold", fontSize: 26, marginTop: 2 }}>
              {weekAvg > 0 ? weekAvg : "—"}
            </Text>
            {weekAvg > 0 && <Text style={{ color: scoreColor(weekAvg), fontSize: 11, fontFamily: "Inter_600SemiBold" }}>{scoreLabel(weekAvg)}</Text>}
            <Text style={{ color: C.muted, fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 2 }}>7-day trend</Text>
          </Card>
        </View>

        {/* Weekly Chart */}
        {weekly.length > 0 && (
          <Card style={{ marginBottom: 14 }}>
            <WeeklyChart days={weekly} />
            <View style={{ flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingBottom: 12, flexWrap: "wrap" }}>
              {[
                { label: "Low (<30)", color: C.green },
                { label: "Moderate", color: C.amber },
                { label: "High", color: C.orange },
                { label: "Critical", color: C.red },
              ].map(leg => (
                <View key={leg.label} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: leg.color }} />
                  <Text style={{ color: C.muted, fontSize: 10, fontFamily: "Inter_400Regular" }}>{leg.label}</Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* AI Insight Card */}
        {insight && insight.logsCount > 0 && (
          <Card style={{ marginBottom: 14 }}>
            <LinearGradient colors={[C.purple + "15", C.primary + "08"]} style={{ borderRadius: 20, padding: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.purple + "20", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 16 }}>🤖</Text>
                </View>
                <View>
                  <Text style={{ color: C.text, fontFamily: "Inter_700Bold", fontSize: 14 }}>AI Analysis</Text>
                  <Text style={{ color: C.muted, fontSize: 10, fontFamily: "Inter_400Regular" }}>{insight.aiPowered ? "Gemini AI se" : "Pattern analysis"}</Text>
                </View>
              </View>
              <Text style={{ color: C.text, fontFamily: "Inter_500Medium", fontSize: 13, lineHeight: 20, marginBottom: 12 }}>{insight.insight}</Text>
              {insight.tips?.length > 0 && (
                <View style={{ gap: 6 }}>
                  {insight.tips.map((tip, i) => (
                    <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: C.accent + "20", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                        <Text style={{ color: C.accent, fontSize: 10, fontFamily: "Inter_700Bold" }}>{i + 1}</Text>
                      </View>
                      <Text style={{ color: C.text, fontSize: 12, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 18 }}>{tip}</Text>
                    </View>
                  ))}
                </View>
              )}
            </LinearGradient>
          </Card>
        )}

        {/* Tabs */}
        <View style={{ flexDirection: "row", backgroundColor: C.primary + "10", borderRadius: 14, padding: 4, marginBottom: 16, gap: 4 }}>
          {([
            { key: "today", label: "Mood Log" },
            { key: "pillar", label: "5-Pillar" },
            { key: "history", label: "History" },
          ] as const).map(t => (
            <TouchableOpacity key={t.key} onPress={() => setTab(t.key)} style={{ flex: 1, paddingVertical: 9, borderRadius: 11, backgroundColor: tab === t.key ? C.primary : "transparent", alignItems: "center" }}>
              <Text style={{ color: tab === t.key ? "#FFF" : C.muted, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* MOOD TAB */}
        {tab === "today" && (
          <View style={{ gap: 12 }}>
            <Card>
              <View style={{ padding: 18 }}>
                <Text style={{ color: C.text, fontFamily: "Inter_700Bold", fontSize: 16, marginBottom: 4 }}>How are you feeling right now?</Text>
                <Text style={{ color: C.muted, fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 16 }}>Select a mood — you can log multiple times today</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
                  {MOODS.map(m => (
                    <TouchableOpacity key={m.key} onPress={() => setSelectedMood(m.key)} activeOpacity={0.85}
                      style={{ flex: 1, minWidth: (W - 80) / 2, alignItems: "center", padding: 16, borderRadius: 16, borderWidth: 2, borderColor: selectedMood === m.key ? m.color : C.border, backgroundColor: selectedMood === m.key ? m.color + "15" : C.card }}>
                      <Text style={{ fontSize: 36, marginBottom: 6 }}>{m.emoji}</Text>
                      <Text style={{ color: selectedMood === m.key ? m.color : C.text, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>{m.label}</Text>
                      <Text style={{ color: C.muted, fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 2 }}>{m.desc}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity onPress={submitMood} disabled={!selectedMood || logLoading} activeOpacity={0.85}
                  style={{ backgroundColor: selectedMood ? C.primary : C.border, borderRadius: 14, padding: 15, alignItems: "center" }}>
                  <Text style={{ color: selectedMood ? "#FFF" : C.muted, fontFamily: "Inter_700Bold", fontSize: 15 }}>
                    {logLoading ? "Saving…" : "Log Mood ✓"}
                  </Text>
                </TouchableOpacity>
              </View>
            </Card>

            {/* Today's logs mini list */}
            {todayLogs.length > 0 && (
              <Card>
                <View style={{ padding: 14 }}>
                  <Text style={{ color: C.text, fontFamily: "Inter_600SemiBold", fontSize: 13, marginBottom: 10 }}>Today's {todayLogs.length} logs</Text>
                  {todayLogs.slice(0, 5).map((l, i) => {
                    const t = new Date(l.loggedAt);
                    const hhmm = t.toLocaleTimeString("hi-IN", { hour: "2-digit", minute: "2-digit" });
                    return (
                      <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: C.border }}>
                        <Text style={{ fontSize: 20 }}>{moodEmoji(l.mood ?? null)}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: C.text, fontFamily: "Inter_500Medium", fontSize: 12 }}>
                            {l.stressType === "mood" ? `Mood: ${l.mood}` : "5-Pillar Analysis"}
                          </Text>
                          <Text style={{ color: C.muted, fontSize: 10 }}>{hhmm}</Text>
                        </View>
                        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: scoreColor(l.stressScore) + "20", alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ color: scoreColor(l.stressScore), fontFamily: "Inter_700Bold", fontSize: 13 }}>{l.stressScore}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </Card>
            )}

            <Card>
              <View style={{ paddingTop: 16, paddingHorizontal: 16, paddingBottom: 4 }}>
                <BreathingCircle />
              </View>
            </Card>
          </View>
        )}

        {/* 5-PILLAR TAB */}
        {tab === "pillar" && (
          <Card>
            <View style={{ padding: 18 }}>
              <Text style={{ color: C.text, fontFamily: "Inter_700Bold", fontSize: 16, marginBottom: 4 }}>5-Pillar Stress Analysis</Text>
              <Text style={{ color: C.muted, fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 16 }}>
                Automatically calculates stress based on today's water, exercise and sleep data
              </Text>
              <View style={{ gap: 10, marginBottom: 20 }}>
                {PILLARS.map(p => (
                  <View key={p.key} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, backgroundColor: p.color + "10", borderWidth: 1, borderColor: p.color + "25" }}>
                    <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: p.color + "20", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name={p.icon} size={20} color={p.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.text, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>{p.label}</Text>
                      <Text style={{ color: C.muted, fontSize: 11, fontFamily: "Inter_400Regular" }}>
                        {p.key === "sleep" ? "Avg sleep from profile" : p.key === "water" ? "Today's water logs" : p.key === "exercise" ? "Today's exercise logs" : "Estimated score"}
                      </Text>
                    </View>
                    <Ionicons name="checkmark-circle" size={22} color={p.color} />
                  </View>
                ))}
              </View>
              <TouchableOpacity onPress={submit5Pillar} disabled={pillarLoading} activeOpacity={0.85}
                style={{ backgroundColor: C.accent, borderRadius: 14, padding: 15, alignItems: "center" }}>
                <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 15 }}>
                  {pillarLoading ? "Calculating…" : "Run 5-Pillar Analysis 🔍"}
                </Text>
              </TouchableOpacity>
              <Text style={{ color: C.muted, fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 10 }}>
                More data logged means more accurate results
              </Text>
            </View>
          </Card>
        )}

        {/* HISTORY TAB */}
        {tab === "history" && (
          <View style={{ gap: 10 }}>
            {/* Weekly summary by day */}
            {weekly.some(d => d.count > 0) && (
              <Card>
                <View style={{ padding: 14 }}>
                  <Text style={{ color: C.text, fontFamily: "Inter_700Bold", fontSize: 14, marginBottom: 12 }}>Daily avg stress</Text>
                  {[...weekly].reverse().filter(d => d.count > 0).map(d => (
                    <View key={d.date} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border }}>
                      <View style={{ width: 36, alignItems: "center" }}>
                        <Text style={{ color: C.muted, fontSize: 11, fontFamily: "Inter_600SemiBold" }}>{d.dayLabel}</Text>
                        {d.dominantMood && <Text style={{ fontSize: 14 }}>{moodEmoji(d.dominantMood)}</Text>}
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ height: 6, borderRadius: 3, backgroundColor: C.border, overflow: "hidden" }}>
                          <View style={{ height: "100%", width: `${d.avgScore}%`, backgroundColor: scoreColor(d.avgScore), borderRadius: 3 }} />
                        </View>
                      </View>
                      <Text style={{ color: scoreColor(d.avgScore), fontFamily: "Inter_700Bold", fontSize: 14, width: 30, textAlign: "right" }}>{d.avgScore}</Text>
                      <Text style={{ color: C.muted, fontSize: 10, width: 50 }}>{d.count} log{d.count !== 1 ? "s" : ""}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            )}

            {/* Raw log list */}
            {logs.length === 0 ? (
              <Card>
                <View style={{ padding: 36, alignItems: "center" }}>
                  <Text style={{ fontSize: 44, marginBottom: 12 }}>🧘</Text>
                  <Text style={{ color: C.text, fontFamily: "Inter_600SemiBold", fontSize: 16, textAlign: "center" }}>No history yet</Text>
                  <Text style={{ color: C.muted, fontSize: 12, textAlign: "center", marginTop: 6, lineHeight: 18 }}>
                    Go to the Mood Log tab to log your mood
                  </Text>
                </View>
              </Card>
            ) : (
              logs.slice(0, 20).map((log, i) => {
                const d = new Date(log.loggedAt);
                const dateStr = d.toLocaleDateString("hi-IN", { day: "numeric", month: "short" });
                const timeStr = d.toLocaleTimeString("hi-IN", { hour: "2-digit", minute: "2-digit" });
                const pillars = log.pillars as Record<string, number> | undefined;
                return (
                  <Card key={i}>
                    <View style={{ padding: 14 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                        <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: scoreColor(log.stressScore) + "18", alignItems: "center", justifyContent: "center", borderWidth: 2.5, borderColor: scoreColor(log.stressScore) }}>
                          <Text style={{ color: scoreColor(log.stressScore), fontFamily: "Inter_700Bold", fontSize: 18 }}>{log.stressScore}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Text style={{ color: C.text, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>{scoreLabel(log.stressScore)} Stress</Text>
                            {log.mood && <Text style={{ fontSize: 16 }}>{moodEmoji(log.mood)}</Text>}
                          </View>
                          <Text style={{ color: C.muted, fontSize: 12, fontFamily: "Inter_400Regular" }}>
                            {log.stressType === "mood" ? `Mood: ${log.mood}` : "5-Pillar Analysis"}
                          </Text>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={{ color: C.text, fontSize: 11, fontFamily: "Inter_500Medium" }}>{dateStr}</Text>
                          <Text style={{ color: C.muted, fontSize: 10 }}>{timeStr}</Text>
                        </View>
                      </View>
                      {pillars && (
                        <View style={{ flexDirection: "row", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                          {Object.entries(pillars).map(([k, v]) => {
                            const p = PILLARS.find(x => x.key === k);
                            return p ? (
                              <View key={k} style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: p.color + "12", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                                <Ionicons name={p.icon} size={11} color={p.color} />
                                <Text style={{ color: p.color, fontSize: 10, fontFamily: "Inter_600SemiBold" }}>{Math.round(v)}%</Text>
                              </View>
                            ) : null;
                          })}
                        </View>
                      )}
                    </View>
                  </Card>
                );
              })
            )}
          </View>
        )}

      </ScrollView>
    </View>
  );
}
