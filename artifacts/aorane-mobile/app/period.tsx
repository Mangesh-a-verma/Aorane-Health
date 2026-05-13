import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Platform, useColorScheme, Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { api } from "@/lib/api";

type PredictionData = { nextPeriodDate: string; fertileWindowStart: string; fertileWindowEnd: string; avgCycleLength: number; daysUntilNext: number } | null;
type Log = { id: string; startDate: string; endDate?: string; cycleLength?: number; flow?: string; symptoms?: string[] };

const SYMPTOMS = ["Cramps", "Bloating", "Headache", "Mood swings", "Back pain", "Fatigue", "Nausea", "Acne"];
const FLOWS = [
  { key: "light",  label: "Halka",   color: "#FCA5A5" },
  { key: "medium", label: "Medium",  color: "#F97316" },
  { key: "heavy",  label: "Bhari",   color: "#DC2626" },
];

function GlassCard({ children, style }: { children: React.ReactNode; style?: object }) {
  const isDark = useColorScheme() === "dark";
  return (
    <LinearGradient colors={isDark ? ["rgba(236,72,153,0.15)","rgba(168,85,247,0.08)","rgba(255,255,255,0.03)"] : ["rgba(255,255,255,0.9)","rgba(252,231,243,0.5)","rgba(255,255,255,0.7)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ borderRadius: 20, padding: 1.5 }, style]}>
      <View style={{ borderRadius: 19, overflow: "hidden", backgroundColor: isDark ? "rgba(40,10,40,0.5)" : "rgba(255,255,255,0.5)" }}>
        {Platform.OS === "ios" ? <BlurView intensity={60} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? "rgba(30,8,40,0.45)" : "rgba(255,255,255,0.45)" }]} />}
        {children}
      </View>
    </LinearGradient>
  );
}

export default function PeriodScreen() {
  const isDark = useColorScheme() === "dark";
  const insets = useSafeAreaInsets();
  const [logs, setLogs] = useState<Log[]>([]);
  const [prediction, setPrediction] = useState<PredictionData>(null);
  const [tab, setTab] = useState<"tracker" | "log" | "history">("tracker");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [selectedFlow, setSelectedFlow] = useState("medium");
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const topPad = insets.top;
  const bg = isDark ? "#010814" : "#FFF5F9";

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await api.getPeriodLogs();
      setLogs((res.logs || []) as Log[]);
      setPrediction(res.prediction as PredictionData);
    } catch { }
  };

  const saveLog = async () => {
    if (!startDate) { Alert.alert("Date required", "Please enter your period start date"); return; }
    setSaving(true);
    try {
      await api.logPeriod({ startDate, endDate: endDate || undefined, flow: selectedFlow, symptoms: selectedSymptoms, notes });
      Alert.alert("Logged! 🌸", "Your period data has been saved");
      setStartDate(new Date().toISOString().split("T")[0]);
      setEndDate(""); setNotes(""); setSelectedSymptoms([]);
      setTab("tracker"); load();
    } catch (e: unknown) {
      Alert.alert("Error", (e as Error).message || "Failed");
    } finally { setSaving(false); }
  };

  const toggleSymptom = (s: string) => setSelectedSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const daysLeft = prediction?.daysUntilNext;

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <LinearGradient colors={isDark ? ["#010814","#180820","#010814"] : ["#FFF5F9","#FCE7F3","#FFF0F5"]} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={{ paddingTop: topPad + 12, paddingBottom: 100, paddingHorizontal: 16 }}>

        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: isDark ? "rgba(236,72,153,0.15)" : "rgba(236,72,153,0.1)", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
            <Ionicons name="arrow-back" size={20} color="#EC4899" />
          </TouchableOpacity>
          <View>
            <Text style={{ color: isDark ? "#F0F8FF" : "#1a1a2e", fontFamily: "Inter_700Bold", fontSize: 22 }}>Period Tracker 🌸</Text>
            <Text style={{ color: isDark ? "rgba(255,255,255,0.45)" : "rgba(10,22,40,0.5)", fontSize: 12, fontFamily: "Inter_400Regular" }}>Track your cycle, predict your future periods</Text>
          </View>
        </View>

        {prediction && (
          <LinearGradient colors={["#EC4899","#8B5CF6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 22, padding: 20, marginBottom: 16 }}>
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 6 }}>Next Period</Text>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 12 }}>
              <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 42 }}>{daysLeft}</Text>
              <Text style={{ color: "rgba(255,255,255,0.8)", fontFamily: "Inter_500Medium", fontSize: 16, paddingBottom: 6 }}>days away</Text>
            </View>
            <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontFamily: "Inter_500Medium" }}>📅 {prediction.nextPeriodDate}</Text>
            <View style={{ marginTop: 12, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 12, padding: 10, flexDirection: "row", gap: 16 }}>
              <View>
                <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, fontFamily: "Inter_500Medium" }}>Fertile Window</Text>
                <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>{prediction.fertileWindowStart} to {prediction.fertileWindowEnd}</Text>
              </View>
              <View style={{ width: 1, backgroundColor: "rgba(255,255,255,0.2)" }} />
              <View>
                <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, fontFamily: "Inter_500Medium" }}>Avg Cycle</Text>
                <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>{prediction.avgCycleLength} din</Text>
              </View>
            </View>
          </LinearGradient>
        )}

        <View style={{ flexDirection: "row", backgroundColor: isDark ? "rgba(236,72,153,0.1)" : "rgba(236,72,153,0.08)", borderRadius: 14, padding: 4, marginBottom: 18, gap: 4 }}>
          {(["tracker","log","history"] as const).map(t => (
            <TouchableOpacity key={t} onPress={() => setTab(t)} style={{ flex: 1, paddingVertical: 9, borderRadius: 11, backgroundColor: tab === t ? "#EC4899" : "transparent", alignItems: "center" }}>
              <Text style={{ color: tab === t ? "#FFF" : (isDark ? "rgba(255,255,255,0.5)" : "rgba(10,22,40,0.5)"), fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                {t === "tracker" ? "Tracker" : t === "log" ? "+ Log" : "History"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === "tracker" && !prediction && (
          <GlassCard>
            <View style={{ padding: 30, alignItems: "center" }}>
              <Text style={{ fontSize: 56 }}>🌸</Text>
              <Text style={{ color: isDark ? "#F0F8FF" : "#1a1a2e", fontFamily: "Inter_700Bold", fontSize: 17, marginTop: 14, textAlign: "center" }}>Start Period Tracker</Text>
              <Text style={{ color: isDark ? "rgba(255,255,255,0.5)" : "rgba(10,22,40,0.5)", fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 8, lineHeight: 20 }}>Log your first period and AI will predict your cycle</Text>
              <TouchableOpacity onPress={() => setTab("log")} style={{ marginTop: 20, backgroundColor: "#EC4899", borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14 }}>
                <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 15 }}>+ Log Period</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        )}

        {tab === "log" && (
          <GlassCard>
            <View style={{ padding: 18 }}>
              <Text style={{ color: isDark ? "#F0F8FF" : "#1a1a2e", fontFamily: "Inter_700Bold", fontSize: 16, marginBottom: 16 }}>Log Period 🌸</Text>

              <Text style={{ color: isDark ? "rgba(255,255,255,0.6)" : "rgba(10,22,40,0.6)", fontFamily: "Inter_500Medium", fontSize: 13, marginBottom: 8 }}>Start Date</Text>
              <TextInput value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" placeholderTextColor={isDark ? "rgba(255,255,255,0.3)" : "rgba(10,22,40,0.3)"} style={{ backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(236,72,153,0.06)", borderRadius: 12, padding: 14, color: isDark ? "#FFF" : "#1a1a2e", fontFamily: "Inter_500Medium", fontSize: 14, borderWidth: 1, borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(236,72,153,0.2)", marginBottom: 14 }} />

              <Text style={{ color: isDark ? "rgba(255,255,255,0.6)" : "rgba(10,22,40,0.6)", fontFamily: "Inter_500Medium", fontSize: 13, marginBottom: 8 }}>End Date (optional)</Text>
              <TextInput value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" placeholderTextColor={isDark ? "rgba(255,255,255,0.3)" : "rgba(10,22,40,0.3)"} style={{ backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(236,72,153,0.06)", borderRadius: 12, padding: 14, color: isDark ? "#FFF" : "#1a1a2e", fontFamily: "Inter_500Medium", fontSize: 14, borderWidth: 1, borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(236,72,153,0.2)", marginBottom: 14 }} />

              <Text style={{ color: isDark ? "rgba(255,255,255,0.6)" : "rgba(10,22,40,0.6)", fontFamily: "Inter_500Medium", fontSize: 13, marginBottom: 8 }}>Flow</Text>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
                {FLOWS.map(f => (
                  <TouchableOpacity key={f.key} onPress={() => setSelectedFlow(f.key)} style={{ flex: 1, padding: 12, borderRadius: 12, alignItems: "center", backgroundColor: selectedFlow === f.key ? f.color + "22" : "transparent", borderWidth: 2, borderColor: selectedFlow === f.key ? f.color : (isDark ? "rgba(255,255,255,0.1)" : "rgba(236,72,153,0.15)") }}>
                    <Text style={{ color: selectedFlow === f.key ? f.color : (isDark ? "rgba(255,255,255,0.5)" : "rgba(10,22,40,0.5)"), fontFamily: "Inter_600SemiBold", fontSize: 13 }}>{f.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={{ color: isDark ? "rgba(255,255,255,0.6)" : "rgba(10,22,40,0.6)", fontFamily: "Inter_500Medium", fontSize: 13, marginBottom: 8 }}>Symptoms</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                {SYMPTOMS.map(s => (
                  <TouchableOpacity key={s} onPress={() => toggleSymptom(s)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: selectedSymptoms.includes(s) ? "#EC489922" : (isDark ? "rgba(255,255,255,0.06)" : "rgba(236,72,153,0.06)"), borderWidth: 1, borderColor: selectedSymptoms.includes(s) ? "#EC4899" : (isDark ? "rgba(255,255,255,0.12)" : "rgba(236,72,153,0.2)") }}>
                    <Text style={{ color: selectedSymptoms.includes(s) ? "#EC4899" : (isDark ? "rgba(255,255,255,0.55)" : "rgba(10,22,40,0.55)"), fontFamily: "Inter_500Medium", fontSize: 12 }}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity onPress={saveLog} disabled={saving} style={{ backgroundColor: "#EC4899", borderRadius: 14, padding: 15, alignItems: "center" }}>
                <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 15 }}>{saving ? "Saving..." : "Save Period Log"}</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        )}

        {tab === "history" && (
          <View style={{ gap: 10 }}>
            {logs.length === 0 ? (
              <GlassCard><View style={{ padding: 30, alignItems: "center" }}><Text style={{ fontSize: 40 }}>🌸</Text><Text style={{ color: isDark ? "#F0F8FF" : "#1a1a2e", fontFamily: "Inter_600SemiBold", fontSize: 16, marginTop: 12 }}>No history yet</Text></View></GlassCard>
            ) : logs.map((log, i) => (
              <GlassCard key={i}>
                <View style={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#EC489922", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 22 }}>🌸</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: isDark ? "#F0F8FF" : "#1a1a2e", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>{log.startDate} {log.endDate ? `→ ${log.endDate}` : ""}</Text>
                    <Text style={{ color: isDark ? "rgba(255,255,255,0.45)" : "rgba(10,22,40,0.5)", fontSize: 12, fontFamily: "Inter_400Regular" }}>
                      {log.flow ? `Flow: ${log.flow}` : ""}{log.cycleLength ? ` • Cycle: ${log.cycleLength} din` : ""}
                    </Text>
                    {log.symptoms && log.symptoms.length > 0 && <Text style={{ color: "#EC4899", fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 3 }}>{log.symptoms.join(", ")}</Text>}
                  </View>
                </View>
              </GlassCard>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
