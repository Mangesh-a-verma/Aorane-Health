import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Platform, Alert, StyleSheet, ActivityIndicator, KeyboardAvoidingView,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { api } from "@/lib/api";

type Tab = "bp" | "sugar";
type SugarContext = "fasting" | "post_meal" | "random" | "bedtime";

const SUGAR_CONTEXTS: { key: SugarContext; label: string }[] = [
  { key: "fasting",   label: "Fasting" },
  { key: "post_meal", label: "Post-meal" },
  { key: "random",    label: "Random" },
  { key: "bedtime",   label: "Bedtime" },
];

// Same AHA/ACC categories as lib/scoring.ts's scoreBloodPressure — kept in
// sync manually since this is display-only classification, the server is
// still the source of truth for the actual Health Score contribution.
function bpCategory(systolic: number, diastolic: number): { label: string; color: string } {
  if (systolic < 90 || diastolic < 60) return { label: "Low", color: "#3B82F6" };
  if (systolic < 120 && diastolic < 80) return { label: "Normal", color: "#10B981" };
  if (systolic < 130 && diastolic < 80) return { label: "Elevated", color: "#F59E0B" };
  if (systolic < 140 || diastolic < 90) return { label: "Stage 1 High", color: "#F97316" };
  if (systolic < 180 && diastolic < 120) return { label: "Stage 2 High", color: "#EF4444" };
  return { label: "Crisis — seek care", color: "#B91C1C" };
}

// Same ADA ranges as lib/scoring.ts's scoreBloodSugar
function sugarCategory(glucose: number, context: SugarContext | null): { label: string; color: string } {
  if (glucose < 70) return { label: "Low", color: "#3B82F6" };
  const isFasting = context === "fasting" || context === "bedtime";
  const normalCeiling = isFasting ? 99 : 139;
  const preCeiling = isFasting ? 125 : 199;
  if (glucose <= normalCeiling) return { label: "Normal", color: "#10B981" };
  if (glucose <= preCeiling) return { label: "Prediabetic range", color: "#F59E0B" };
  return { label: "Diabetic range", color: "#EF4444" };
}

function todayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <LinearGradient
      colors={["rgba(255,255,255,0.9)", "rgba(254,226,226,0.4)"]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{ borderRadius: 20, padding: 1.5, marginBottom: 14 }}
    >
      <View style={{ borderRadius: 19, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.55)", padding: 18 }}>
        {Platform.OS === "ios"
          ? <BlurView intensity={60} tint={"light"} style={StyleSheet.absoluteFill} />
          : <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(255,255,255,0.45)" }]} />
        }
        {children}
      </View>
    </LinearGradient>
  );
}

export default function VitalsScreen() {
  const insets = useSafeAreaInsets();
  const bg = "#FEF2F2";
  const [tab, setTab] = useState<Tab>("bp");

  // Blood pressure state
  const [bpLatest, setBpLatest] = useState<Record<string, unknown> | null>(null);
  const [bpHistory, setBpHistory] = useState<Array<Record<string, unknown>>>([]);
  const [loadingBp, setLoadingBp] = useState(true);
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [pulse, setPulse] = useState("");
  const [savingBp, setSavingBp] = useState(false);

  // Blood sugar state
  const [sugarLatest, setSugarLatest] = useState<Record<string, unknown> | null>(null);
  const [sugarHistory, setSugarHistory] = useState<Array<Record<string, unknown>>>([]);
  const [loadingSugar, setLoadingSugar] = useState(true);
  const [glucose, setGlucose] = useState("");
  const [sugarContext, setSugarContext] = useState<SugarContext>("fasting");
  const [savingSugar, setSavingSugar] = useState(false);

  const loadBp = useCallback(async () => {
    setLoadingBp(true);
    try {
      const [todayRes, histRes] = await Promise.all([api.getBloodPressureToday(), api.getBloodPressureHistory(14)]);
      setBpLatest(todayRes.latest);
      setBpHistory(histRes.logs ?? []);
    } catch {
      // silently ignore
    } finally {
      setLoadingBp(false);
    }
  }, []);

  const loadSugar = useCallback(async () => {
    setLoadingSugar(true);
    try {
      const [todayRes, histRes] = await Promise.all([api.getBloodSugarToday(), api.getBloodSugarHistory(14)]);
      setSugarLatest(todayRes.latest);
      setSugarHistory(histRes.logs ?? []);
    } catch {
      // silently ignore
    } finally {
      setLoadingSugar(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadBp();
    loadSugar();
  }, [loadBp, loadSugar]));

  const handleSaveBp = async () => {
    const sys = parseInt(systolic);
    const dia = parseInt(diastolic);
    if (isNaN(sys) || isNaN(dia) || sys < 50 || sys > 300 || dia < 30 || dia > 200) {
      Alert.alert("Invalid reading", "Systolic must be 50-300 and diastolic 30-200.");
      return;
    }
    const pulseNum = pulse.trim() ? parseInt(pulse) : undefined;
    setSavingBp(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await api.logBloodPressure({ systolic: sys, diastolic: dia, pulse: pulseNum });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSystolic(""); setDiastolic(""); setPulse("");
      await loadBp();
      Alert.alert("Saved", "Blood pressure reading logged!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      Alert.alert("Error", msg);
    } finally {
      setSavingBp(false);
    }
  };

  const handleSaveSugar = async () => {
    const g = parseInt(glucose);
    if (isNaN(g) || g < 20 || g > 600) {
      Alert.alert("Invalid reading", "Glucose must be between 20 and 600 mg/dL.");
      return;
    }
    setSavingSugar(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await api.logBloodSugar({ glucoseMgDl: g, readingContext: sugarContext });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setGlucose("");
      await loadSugar();
      Alert.alert("Saved", "Blood sugar reading logged!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      Alert.alert("Error", msg);
    } finally {
      setSavingSugar(false);
    }
  };

  const latestBpCat = bpLatest ? bpCategory(Number(bpLatest.systolic), Number(bpLatest.diastolic)) : null;
  const latestSugarCat = sugarLatest ? sugarCategory(Number(sugarLatest.glucose_mg_dl), (sugarLatest.reading_context as SugarContext) ?? null) : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ flex: 1, backgroundColor: bg }}>
        <LinearGradient colors={["#FEE2E2", "#FECACA", "#FEF2F2"]} style={StyleSheet.absoluteFill} />

        <ScrollView
          contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 110, paddingHorizontal: 16 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
            <TouchableOpacity activeOpacity={0.8}
              onPress={() => router.back()}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(239,68,68,0.12)", alignItems: "center", justifyContent: "center", marginRight: 12 }}
              accessibilityLabel="Go back"
              accessibilityRole="button"
            >
              <Ionicons name="arrow-back" size={20} color={"#DC2626"} />
            </TouchableOpacity>
            <View>
              <Text style={{ color: "#1a1a2e", fontFamily: "Inter_700Bold", fontSize: 22 }}>
                Vitals 🩺
              </Text>
              <Text style={{ color: "rgba(10,22,40,0.5)", fontSize: 12, fontFamily: "Inter_400Regular" }}>
                Track blood pressure & blood sugar
              </Text>
            </View>
          </View>

          {/* Tab Switcher */}
          <View style={{ flexDirection: "row", backgroundColor: "rgba(239,68,68,0.08)", borderRadius: 14, padding: 4, marginBottom: 16 }}>
            {(["bp", "sugar"] as Tab[]).map(t => (
              <TouchableOpacity activeOpacity={0.8} key={t}
                onPress={() => { setTab(t); Haptics.selectionAsync(); }}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: "center", backgroundColor: tab === t ? "#DC2626" : "transparent" }}
              >
                <Text style={{ color: tab === t ? "#FFF" : "rgba(10,22,40,0.5)", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                  {t === "bp" ? "Blood Pressure" : "Blood Sugar"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {tab === "bp" ? (
            <>
              {/* Hero */}
              <LinearGradient colors={["#B91C1C", "#DC2626", "#EF4444"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 22, padding: 24, marginBottom: 16 }}>
                {loadingBp ? (
                  <ActivityIndicator color="#FFF" />
                ) : bpLatest ? (
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 4 }}>Latest Reading Today</Text>
                    <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 44, lineHeight: 52 }}>
                      {String(bpLatest.systolic)}/{String(bpLatest.diastolic)}
                    </Text>
                    <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 10 }}>mmHg</Text>
                    {latestBpCat && (
                      <View style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 }}>
                        <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>{latestBpCat.label}</Text>
                      </View>
                    )}
                    {bpLatest.pulse ? (
                      <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 8 }}>
                        Pulse: {String(bpLatest.pulse)} bpm
                      </Text>
                    ) : null}
                  </View>
                ) : (
                  <View style={{ alignItems: "center", paddingVertical: 12 }}>
                    <Text style={{ fontSize: 48 }}>💗</Text>
                    <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 18, marginTop: 8 }}>No reading today</Text>
                    <Text style={{ color: "rgba(255,255,255,0.65)", fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 4, textAlign: "center" }}>
                      Log a reading below to track your BP
                    </Text>
                  </View>
                )}
              </LinearGradient>

              {/* Form */}
              <Card>
                <Text style={{ color: "#1a1a2e", fontFamily: "Inter_700Bold", fontSize: 16, marginBottom: 16 }}>📝 Log Blood Pressure</Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={lbl()}>Systolic</Text>
                    <View style={inputRow()}>
                      <TextInput value={systolic} onChangeText={setSystolic} keyboardType="number-pad" placeholder="120" placeholderTextColor="rgba(0,0,0,0.3)" style={{ flex: 1, color: "#1a1a2e", fontFamily: "Inter_500Medium", fontSize: 16 }} />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={lbl()}>Diastolic</Text>
                    <View style={inputRow()}>
                      <TextInput value={diastolic} onChangeText={setDiastolic} keyboardType="number-pad" placeholder="80" placeholderTextColor="rgba(0,0,0,0.3)" style={{ flex: 1, color: "#1a1a2e", fontFamily: "Inter_500Medium", fontSize: 16 }} />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={lbl()}>Pulse (optional)</Text>
                    <View style={inputRow()}>
                      <TextInput value={pulse} onChangeText={setPulse} keyboardType="number-pad" placeholder="72" placeholderTextColor="rgba(0,0,0,0.3)" style={{ flex: 1, color: "#1a1a2e", fontFamily: "Inter_500Medium", fontSize: 16 }} />
                    </View>
                  </View>
                </View>
                <TouchableOpacity activeOpacity={0.8} onPress={handleSaveBp} disabled={savingBp} style={{ marginTop: 12, borderRadius: 14, overflow: "hidden" }}>
                  <LinearGradient colors={["#DC2626", "#EF4444"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 16, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}>
                    {savingBp ? <ActivityIndicator color="#FFF" /> : (
                      <>
                        <Ionicons name="save" size={20} color="#FFF" />
                        <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 16 }}>Save Reading</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </Card>

              {/* History */}
              <Card>
                <Text style={{ color: "#1a1a2e", fontFamily: "Inter_700Bold", fontSize: 16, marginBottom: 12 }}>Recent Readings</Text>
                {loadingBp ? (
                  <ActivityIndicator color="#DC2626" />
                ) : bpHistory.length === 0 ? (
                  <Text style={{ color: "rgba(10,22,40,0.4)", fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center", paddingVertical: 16 }}>
                    No readings yet — log your first one above
                  </Text>
                ) : (
                  bpHistory.slice(0, 10).map((log, i) => {
                    const cat = bpCategory(Number(log.systolic), Number(log.diastolic));
                    return (
                      <View key={i} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: i < bpHistory.length - 1 ? 1 : 0, borderBottomColor: "rgba(220,38,38,0.08)" }}>
                        <View>
                          <Text style={{ color: "#1a1a2e", fontFamily: "Inter_600SemiBold", fontSize: 15 }}>{String(log.systolic)}/{String(log.diastolic)} mmHg</Text>
                          <Text style={{ color: "rgba(10,22,40,0.4)", fontSize: 11, fontFamily: "Inter_400Regular" }}>{todayLabel(String(log.measured_at))}</Text>
                        </View>
                        <View style={{ backgroundColor: cat.color + "20", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                          <Text style={{ color: cat.color, fontFamily: "Inter_600SemiBold", fontSize: 11 }}>{cat.label}</Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </Card>
            </>
          ) : (
            <>
              {/* Hero */}
              <LinearGradient colors={["#7C2D12", "#C2410C", "#EA580C"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 22, padding: 24, marginBottom: 16 }}>
                {loadingSugar ? (
                  <ActivityIndicator color="#FFF" />
                ) : sugarLatest ? (
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 4 }}>Latest Reading Today</Text>
                    <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 44, lineHeight: 52 }}>
                      {String(sugarLatest.glucose_mg_dl)}
                    </Text>
                    <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 10 }}>mg/dL{sugarLatest.reading_context ? ` · ${String(sugarLatest.reading_context).replace("_", "-")}` : ""}</Text>
                    {latestSugarCat && (
                      <View style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 }}>
                        <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>{latestSugarCat.label}</Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={{ alignItems: "center", paddingVertical: 12 }}>
                    <Text style={{ fontSize: 48 }}>🩸</Text>
                    <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 18, marginTop: 8 }}>No reading today</Text>
                    <Text style={{ color: "rgba(255,255,255,0.65)", fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 4, textAlign: "center" }}>
                      Log a reading below to track your glucose
                    </Text>
                  </View>
                )}
              </LinearGradient>

              {/* Form */}
              <Card>
                <Text style={{ color: "#1a1a2e", fontFamily: "Inter_700Bold", fontSize: 16, marginBottom: 16 }}>📝 Log Blood Sugar</Text>
                <Text style={lbl()}>Glucose (mg/dL)</Text>
                <View style={inputRow()}>
                  <TextInput value={glucose} onChangeText={setGlucose} keyboardType="number-pad" placeholder="e.g. 95" placeholderTextColor="rgba(0,0,0,0.3)" style={{ flex: 1, color: "#1a1a2e", fontFamily: "Inter_500Medium", fontSize: 16 }} />
                </View>
                <Text style={[lbl(), { marginTop: 8 }]}>Reading Context</Text>
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                  {SUGAR_CONTEXTS.map(opt => (
                    <TouchableOpacity activeOpacity={0.8} key={opt.key}
                      onPress={() => { setSugarContext(opt.key); Haptics.selectionAsync(); }}
                      style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 2, borderColor: sugarContext === opt.key ? "#EA580C" : "transparent", backgroundColor: sugarContext === opt.key ? "#EA580C20" : "rgba(234,88,12,0.06)" }}
                    >
                      <Text style={{ color: sugarContext === opt.key ? "#EA580C" : "rgba(10,22,40,0.55)", fontFamily: "Inter_500Medium", fontSize: 12 }}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity activeOpacity={0.8} onPress={handleSaveSugar} disabled={savingSugar} style={{ marginTop: 8, borderRadius: 14, overflow: "hidden" }}>
                  <LinearGradient colors={["#C2410C", "#EA580C"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 16, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}>
                    {savingSugar ? <ActivityIndicator color="#FFF" /> : (
                      <>
                        <Ionicons name="save" size={20} color="#FFF" />
                        <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 16 }}>Save Reading</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </Card>

              {/* History */}
              <Card>
                <Text style={{ color: "#1a1a2e", fontFamily: "Inter_700Bold", fontSize: 16, marginBottom: 12 }}>Recent Readings</Text>
                {loadingSugar ? (
                  <ActivityIndicator color="#EA580C" />
                ) : sugarHistory.length === 0 ? (
                  <Text style={{ color: "rgba(10,22,40,0.4)", fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center", paddingVertical: 16 }}>
                    No readings yet — log your first one above
                  </Text>
                ) : (
                  sugarHistory.slice(0, 10).map((log, i) => {
                    const cat = sugarCategory(Number(log.glucose_mg_dl), (log.reading_context as SugarContext) ?? null);
                    return (
                      <View key={i} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: i < sugarHistory.length - 1 ? 1 : 0, borderBottomColor: "rgba(234,88,12,0.08)" }}>
                        <View>
                          <Text style={{ color: "#1a1a2e", fontFamily: "Inter_600SemiBold", fontSize: 15 }}>{String(log.glucose_mg_dl)} mg/dL</Text>
                          <Text style={{ color: "rgba(10,22,40,0.4)", fontSize: 11, fontFamily: "Inter_400Regular" }}>
                            {todayLabel(String(log.measured_at))}{log.reading_context ? ` · ${String(log.reading_context).replace("_", "-")}` : ""}
                          </Text>
                        </View>
                        <View style={{ backgroundColor: cat.color + "20", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                          <Text style={{ color: cat.color, fontFamily: "Inter_600SemiBold", fontSize: 11 }}>{cat.label}</Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </Card>
            </>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

function lbl() {
  return {
    color: "rgba(10,22,40,0.55)",
    fontFamily: "Inter_600SemiBold" as const,
    fontSize: 12,
    marginBottom: 6,
    letterSpacing: 0.3,
    textTransform: "uppercase" as const,
  };
}

function inputRow() {
  return {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: "rgba(239,68,68,0.06)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.15)",
    marginBottom: 8,
  };
}
