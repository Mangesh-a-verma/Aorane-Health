import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Animated, Platform, useColorScheme, Alert, Dimensions,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { api } from "@/lib/api";

const { width: W } = Dimensions.get("window");

const MOODS = [
  { key: "happy",   label: "Khush",   emoji: "😊", color: "#10B981", score: 15 },
  { key: "neutral", label: "Theek",   emoji: "😐", color: "#F59E0B", score: 40 },
  { key: "stressed",label: "Stressed",emoji: "😟", color: "#F97316", score: 72 },
  { key: "sad",     label: "Udaas",   emoji: "😢", color: "#DC2626", score: 65 },
];

const PILLARS = [
  { key: "sleep",    label: "Neend",    icon: "moon" as const,      color: "#8B5CF6" },
  { key: "water",    label: "Paani",    icon: "water" as const,     color: "#0077B6" },
  { key: "exercise", label: "Exercise", icon: "barbell" as const,   color: "#10B981" },
  { key: "medicine", label: "Dawai",    icon: "medical" as const,   color: "#F59E0B" },
  { key: "food",     label: "Khaana",   icon: "restaurant" as const,color: "#EC4899" },
];

function GlassCard({ children, style }: { children: React.ReactNode; style?: object }) {
  const isDark = useColorScheme() === "dark";
  return (
    <LinearGradient
      colors={isDark ? ["rgba(56,189,248,0.18)","rgba(45,212,191,0.08)","rgba(255,255,255,0.03)"] : ["rgba(255,255,255,0.9)","rgba(186,230,253,0.45)","rgba(255,255,255,0.7)"]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ borderRadius: 20, padding: 1.5 }, style]}
    >
      <View style={{ borderRadius: 19, overflow: "hidden", backgroundColor: isDark ? "rgba(4,20,40,0.5)" : "rgba(255,255,255,0.5)" }}>
        {Platform.OS === "ios" ? <BlurView intensity={60} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? "rgba(4,16,32,0.45)" : "rgba(255,255,255,0.45)" }]} />}
        {children}
      </View>
    </LinearGradient>
  );
}

function BreathingCircle() {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [phase, setPhase] = useState<"inhale" | "hold" | "exhale">("inhale");
  const [active, setActive] = useState(false);

  const runCycle = () => {
    const seq = Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.5, duration: 4000, useNativeDriver: false }),
      Animated.delay(7000),
      Animated.timing(scaleAnim, { toValue: 1, duration: 8000, useNativeDriver: false }),
    ]);
    setPhase("inhale");
    setTimeout(() => setPhase("hold"), 4000);
    setTimeout(() => setPhase("exhale"), 11000);
    Animated.loop(seq).start();
  };

  return (
    <View style={{ alignItems: "center", marginVertical: 12 }}>
      <Text style={{ color: "#38BDF8", fontFamily: "Inter_600SemiBold", fontSize: 13, marginBottom: 10 }}>4-7-8 Breathing</Text>
      {active ? (
        <>
          <Animated.View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: "rgba(56,189,248,0.2)", transform: [{ scale: scaleAnim }], alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#38BDF8" }}>
            <Text style={{ fontSize: 24 }}>🌬️</Text>
          </Animated.View>
          <Text style={{ color: "#38BDF8", fontFamily: "Inter_600SemiBold", marginTop: 10, fontSize: 14 }}>
            {phase === "inhale" ? "Saans lo (4s)" : phase === "hold" ? "Roko (7s)" : "Chodo (8s)"}
          </Text>
          <TouchableOpacity onPress={() => { setActive(false); scaleAnim.setValue(1); }} style={{ marginTop: 10 }}>
            <Text style={{ color: "#DC2626", fontFamily: "Inter_500Medium", fontSize: 13 }}>Rokna hai</Text>
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity onPress={() => { setActive(true); runCycle(); }} style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: "rgba(56,189,248,0.12)", borderWidth: 2, borderColor: "#38BDF8", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 32 }}>🌬️</Text>
          <Text style={{ color: "#38BDF8", fontSize: 10, fontFamily: "Inter_500Medium" }}>Start</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function StressScreen() {
  const isDark = useColorScheme() === "dark";
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<"mood" | "pillar" | "history">("mood");
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState<{ avgScore: number; insight: string } | null>(null);
  const [logs, setLogs] = useState<Array<Record<string, unknown>>>([]);
  const [avgScore, setAvgScore] = useState(0);
  const [pillarLoading, setPillarLoading] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bg = isDark ? "#010814" : "#F0F9FF";

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [insightRes, logsRes] = await Promise.allSettled([api.getStressInsight(), api.getStressLogs(14)]);
      if (insightRes.status === "fulfilled") setInsight(insightRes.value);
      if (logsRes.status === "fulfilled") { setLogs(logsRes.value.logs); setAvgScore(logsRes.value.avgScore); }
    } catch { }
  };

  const submitMood = async () => {
    if (!selectedMood) return;
    setLoading(true);
    try {
      const res = await api.logStress({ stressType: "mood", mood: selectedMood });
      Alert.alert("Done!", `Stress score: ${res.stressScore}/100 log ho gaya`);
      setSelectedMood(null);
      loadData();
    } catch (e: unknown) {
      Alert.alert("Error", (e as Error).message || "Failed");
    } finally { setLoading(false); }
  };

  const submit5Pillar = async () => {
    setPillarLoading(true);
    try {
      const res = await api.logStress({ stressType: "five_pillar" });
      Alert.alert("5-Pillar Analysis Done!", `Tera stress score: ${res.stressScore}/100\n\nYeh aaj ki activity ke basis pe calculate hua.`);
      loadData();
    } catch (e: unknown) {
      Alert.alert("Error", (e as Error).message || "Failed");
    } finally { setPillarLoading(false); }
  };

  const getScoreColor = (s: number) => s < 30 ? "#10B981" : s < 55 ? "#F59E0B" : s < 75 ? "#F97316" : "#DC2626";
  const getScoreLabel = (s: number) => s < 30 ? "Low" : s < 55 ? "Moderate" : s < 75 ? "High" : "Critical";

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <LinearGradient colors={isDark ? ["#010814","#041428","#020C20"] : ["#E0F2FE","#BAE6FD","#F0FDF4"]} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={{ paddingTop: topPad + 12, paddingBottom: 100, paddingHorizontal: 16 }}>

        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,119,182,0.1)", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
            <Ionicons name="arrow-back" size={20} color={isDark ? "#FFF" : "#0077B6"} />
          </TouchableOpacity>
          <View>
            <Text style={{ color: isDark ? "#F0F8FF" : "#1a1a2e", fontFamily: "Inter_700Bold", fontSize: 22 }}>Stress Tracker</Text>
            <Text style={{ color: isDark ? "rgba(255,255,255,0.45)" : "rgba(10,22,40,0.5)", fontSize: 12, fontFamily: "Inter_400Regular" }}>Apna mental health track karo</Text>
          </View>
        </View>

        {insight && (
          <GlassCard style={{ marginBottom: 16 }}>
            <View style={{ padding: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: getScoreColor(insight.avgScore) + "22", alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: getScoreColor(insight.avgScore) }}>
                  <Text style={{ color: getScoreColor(insight.avgScore), fontFamily: "Inter_700Bold", fontSize: 20 }}>{insight.avgScore}</Text>
                  <Text style={{ color: getScoreColor(insight.avgScore), fontSize: 9, fontFamily: "Inter_500Medium" }}>/ 100</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: isDark ? "#F0F8FF" : "#1a1a2e", fontFamily: "Inter_700Bold", fontSize: 16 }}>Stress Level: {getScoreLabel(insight.avgScore)}</Text>
                  <Text style={{ color: isDark ? "rgba(255,255,255,0.55)" : "rgba(10,22,40,0.55)", fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 4, lineHeight: 17 }}>{insight.insight}</Text>
                </View>
              </View>
            </View>
          </GlassCard>
        )}

        <View style={{ flexDirection: "row", backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,119,182,0.08)", borderRadius: 14, padding: 4, marginBottom: 18, gap: 4 }}>
          {(["mood","pillar","history"] as const).map(t => (
            <TouchableOpacity key={t} onPress={() => setTab(t)} style={{ flex: 1, paddingVertical: 9, borderRadius: 11, backgroundColor: tab === t ? "#0077B6" : "transparent", alignItems: "center" }}>
              <Text style={{ color: tab === t ? "#FFF" : (isDark ? "rgba(255,255,255,0.5)" : "rgba(10,22,40,0.5)"), fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                {t === "mood" ? "Mood" : t === "pillar" ? "5-Pillar" : "History"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === "mood" && (
          <GlassCard>
            <View style={{ padding: 18 }}>
              <Text style={{ color: isDark ? "#F0F8FF" : "#1a1a2e", fontFamily: "Inter_700Bold", fontSize: 16, marginBottom: 4 }}>Abhi kaisa feel ho raha hai?</Text>
              <Text style={{ color: isDark ? "rgba(255,255,255,0.45)" : "rgba(10,22,40,0.5)", fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 16 }}>Ek mood select karo</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
                {MOODS.map(m => (
                  <TouchableOpacity key={m.key} onPress={() => setSelectedMood(m.key)} style={{ flex: 1, minWidth: (W - 80) / 2, alignItems: "center", padding: 16, borderRadius: 16, borderWidth: 2, borderColor: selectedMood === m.key ? m.color : isDark ? "rgba(255,255,255,0.1)" : "rgba(0,119,182,0.15)", backgroundColor: selectedMood === m.key ? m.color + "22" : "transparent" }}>
                    <Text style={{ fontSize: 34, marginBottom: 6 }}>{m.emoji}</Text>
                    <Text style={{ color: selectedMood === m.key ? m.color : (isDark ? "#F0F8FF" : "#1a1a2e"), fontFamily: "Inter_600SemiBold", fontSize: 13 }}>{m.label}</Text>
                    <Text style={{ color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.4)", fontSize: 10, fontFamily: "Inter_400Regular" }}>Score: {m.score}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity onPress={submitMood} disabled={!selectedMood || loading} style={{ backgroundColor: selectedMood ? "#0077B6" : (isDark ? "rgba(255,255,255,0.1)" : "rgba(0,119,182,0.15)"), borderRadius: 14, padding: 15, alignItems: "center" }}>
                <Text style={{ color: selectedMood ? "#FFF" : (isDark ? "rgba(255,255,255,0.35)" : "rgba(10,22,40,0.35)"), fontFamily: "Inter_700Bold", fontSize: 15 }}>{loading ? "Saving..." : "Mood Log Karo"}</Text>
              </TouchableOpacity>
              <View style={{ marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,119,182,0.1)" }}>
                <BreathingCircle />
              </View>
            </View>
          </GlassCard>
        )}

        {tab === "pillar" && (
          <GlassCard>
            <View style={{ padding: 18 }}>
              <Text style={{ color: isDark ? "#F0F8FF" : "#1a1a2e", fontFamily: "Inter_700Bold", fontSize: 16, marginBottom: 4 }}>5-Pillar Stress Analysis</Text>
              <Text style={{ color: isDark ? "rgba(255,255,255,0.45)" : "rgba(10,22,40,0.5)", fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 16 }}>Aaj ki activities ke basis pe automatic stress calculate karega</Text>
              <View style={{ gap: 12, marginBottom: 20 }}>
                {PILLARS.map(p => (
                  <View key={p.key} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, backgroundColor: isDark ? "rgba(255,255,255,0.04)" : p.color + "10" }}>
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: p.color + "22", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name={p.icon} size={20} color={p.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: isDark ? "#F0F8FF" : "#1a1a2e", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>{p.label}</Text>
                      <Text style={{ color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontSize: 11, fontFamily: "Inter_400Regular" }}>Aaj ka data automatically fetch hoga</Text>
                    </View>
                    <Ionicons name="checkmark-circle" size={20} color={p.color} />
                  </View>
                ))}
              </View>
              <TouchableOpacity onPress={submit5Pillar} disabled={pillarLoading} style={{ backgroundColor: "#1B998B", borderRadius: 14, padding: 15, alignItems: "center" }}>
                <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 15 }}>{pillarLoading ? "Calculating..." : "5-Pillar Analysis Karo"}</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        )}

        {tab === "history" && (
          <View style={{ gap: 10 }}>
            {logs.length === 0 ? (
              <GlassCard><View style={{ padding: 30, alignItems: "center" }}><Text style={{ fontSize: 40 }}>🧘</Text><Text style={{ color: isDark ? "#F0F8FF" : "#1a1a2e", fontFamily: "Inter_600SemiBold", fontSize: 16, marginTop: 12 }}>Koi history nahi</Text><Text style={{ color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 6 }}>Pehle mood ya 5-pillar analysis karo</Text></View></GlassCard>
            ) : logs.map((log, i) => {
              const s = Number(log.stressScore) || 0;
              const c = getScoreColor(s);
              const d = new Date(log.loggedAt as string);
              return (
                <GlassCard key={i}>
                  <View style={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: c + "22", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: c }}>
                      <Text style={{ color: c, fontFamily: "Inter_700Bold", fontSize: 17 }}>{s}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: isDark ? "#F0F8FF" : "#1a1a2e", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>{getScoreLabel(s)} Stress</Text>
                      <Text style={{ color: isDark ? "rgba(255,255,255,0.45)" : "rgba(10,22,40,0.5)", fontSize: 12, fontFamily: "Inter_400Regular" }}>{log.stressType === "mood" ? `Mood: ${log.mood}` : "5-Pillar Analysis"}</Text>
                    </View>
                    <Text style={{ color: isDark ? "rgba(255,255,255,0.35)" : "rgba(10,22,40,0.4)", fontSize: 11, fontFamily: "Inter_400Regular" }}>{d.toLocaleDateString("hi-IN")}</Text>
                  </View>
                </GlassCard>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
