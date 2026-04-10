import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator, Platform, useColorScheme, Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { api } from "@/lib/api";

const { width: W } = Dimensions.get("window");

type ExerciseLog = { id: string; exerciseType: string; durationMinutes: number; intensity: string; caloriesBurned?: string; };
const EXERCISES = [
  { name: "Walking", icon: "walk", color: "#10B981" },
  { name: "Running", icon: "run-fast", color: "#EF4444" },
  { name: "Yoga", icon: "yoga", color: "#8B5CF6" },
  { name: "Cycling", icon: "bike", color: "#F59E0B" },
  { name: "Swimming", icon: "swim", color: "#0EA5E9" },
  { name: "Weight Training", icon: "weight-lifter", color: "#7C3AED" },
  { name: "Dancing", icon: "dance-ballroom", color: "#EC4899" },
  { name: "Cricket", icon: "cricket", color: "#059669" },
  { name: "Badminton", icon: "badminton", color: "#0077B6" },
  { name: "Skipping", icon: "jump-rope", color: "#F97316" },
];
const INTENSITIES = [
  { value: "light", label: "Light 🚶", grad: ["#10B981","#059669"] as [string,string] },
  { value: "moderate", label: "Moderate 🚴", grad: ["#F59E0B","#EF4444"] as [string,string] },
  { value: "intense", label: "Intense 🔥", grad: ["#EF4444","#7C3AED"] as [string,string] },
];
function todayDate() { return new Date().toISOString().slice(0, 10); }

function GlassCard({ children, style }: { children: React.ReactNode; style?: object }) {
  const scheme = useColorScheme(); const isDark = scheme === "dark";
  return (
    <LinearGradient
      colors={isDark ? ["rgba(56,189,248,0.22)","rgba(45,212,191,0.12)","rgba(255,255,255,0.04)"] : ["rgba(255,255,255,0.95)","rgba(186,230,253,0.5)","rgba(167,243,208,0.35)"]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ borderRadius: 20, padding: 1.5 }, style]}
    >
      <View style={[{ borderRadius: 19, overflow: "hidden" }, { backgroundColor: isDark ? "rgba(8,18,40,0.55)" : "rgba(255,255,255,0.55)" }]}>
        {Platform.OS === "ios" ? <BlurView intensity={isDark ? 75 : 55} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? "rgba(8,16,36,0.4)" : "rgba(255,255,255,0.4)" }]} />}
        {children}
      </View>
    </LinearGradient>
  );
}

export default function ExerciseScreen() {
  const scheme = useColorScheme(); const isDark = scheme === "dark";
  const insets = useSafeAreaInsets();
  const [logs, setLogs] = useState<ExerciseLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState("");
  const [duration, setDuration] = useState("");
  const [intensity, setIntensity] = useState("moderate");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => { loadLogs(); }, []);
  const loadLogs = useCallback(async () => {
    try { const res = await api.getExerciseLogs(todayDate()); setLogs(res.logs as ExerciseLog[]); } catch { }
    setIsLoading(false);
  }, []);

  const totalMin = logs.reduce((s, l) => s + l.durationMinutes, 0);
  const totalCal = logs.reduce((s, l) => s + Number(l.caloriesBurned || 0), 0);

  const handleAdd = async () => {
    if (!selectedExercise || !duration) { Alert.alert("Required", "Exercise aur duration dono chahiye"); return; }
    const ex = EXERCISES.find((e) => e.name === selectedExercise);
    const cal = ex ? (3.5 * 70 * parseFloat(duration)) / 60 : 0;
    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await api.logExercise({ exerciseType: selectedExercise, durationMinutes: parseInt(duration), intensity, caloriesBurned: cal.toFixed(1) });
      setShowModal(false); setSelectedExercise(""); setDuration("");
      await loadLogs(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch { Alert.alert("Error", "Exercise log nahi hua"); }
    setIsSubmitting(false);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const ringPct = Math.min(1, totalMin / 60);

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={isDark ? ["#010814","#031628","#051E30","#061A2A"] : ["#C8E9FA","#D9F4EE","#E8F4FF","#D4F0F7"]}
        locations={[0,0.3,0.65,1]} style={StyleSheet.absoluteFill}
      />
      <View style={[styles.orb1, { backgroundColor: isDark ? "#065F46" : "#A7F3D0" }]} />
      <View style={[styles.orb2, { backgroundColor: isDark ? "#7C1D1D" : "#FCA5A5" }]} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <View>
          <Text style={[styles.title, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>Exercise 💪</Text>
          <Text style={[styles.subtitle, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular" }]}>
            {new Date().toLocaleDateString("hi-IN", { weekday: "long", day: "numeric", month: "short" })}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setShowModal(true)} activeOpacity={0.85}>
          <LinearGradient colors={["#1B998B","#0077B6"]} style={styles.addBtn}>
            <Ionicons name="add" size={22} color="#FFF" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <GlassCard style={{ marginHorizontal: 18, marginBottom: 18 }}>
        <View style={styles.statsCard}>
          {[
            { icon: "timer-outline" as const, label: "Minutes", value: `${totalMin}`, color: isDark ? "#2DD4BF" : "#1B998B", unit: "min" },
            { icon: "flame-outline" as const, label: "Calories", value: `${Math.round(totalCal)}`, color: isDark ? "#FCD34D" : "#D97706", unit: "kcal" },
            { icon: "trophy-outline" as const, label: "Sessions", value: `${logs.length}`, color: isDark ? "#38BDF8" : "#0077B6", unit: "sets" },
          ].map((s, i, arr) => (
            <React.Fragment key={s.label}>
              <View style={styles.statItem}>
                <LinearGradient colors={i === 0 ? ["rgba(45,212,191,0.25)","rgba(27,153,139,0.15)"] : i === 1 ? ["rgba(252,211,77,0.25)","rgba(217,119,6,0.15)"] : ["rgba(56,189,248,0.25)","rgba(0,119,182,0.15)"]} style={styles.statIconBg}>
                  <Ionicons name={s.icon} size={20} color={s.color} />
                </LinearGradient>
                <Text style={[styles.statNum, { color: s.color, fontFamily: "Inter_700Bold" }]}>{s.value}</Text>
                <Text style={[styles.statLabel, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular" }]}>{s.label}</Text>
              </View>
              {i < arr.length - 1 && <View style={[styles.statDiv, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }]} />}
            </React.Fragment>
          ))}
        </View>
        {/* Ring progress */}
        <View style={[styles.progressBar, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }]}>
          <LinearGradient colors={["#1B998B","#0077B6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.progressFill, { width: `${ringPct * 100}%` }]} />
        </View>
        <Text style={[styles.progressText, { color: isDark ? "rgba(255,255,255,0.3)" : "rgba(10,22,40,0.4)", fontFamily: "Inter_400Regular" }]}>
          Daily goal: 60 min · {Math.round(ringPct * 100)}% complete
        </Text>
      </GlassCard>

      {isLoading ? (
        <View style={styles.loadingWrap}><ActivityIndicator color={isDark ? "#38BDF8" : "#0077B6"} size="large" /></View>
      ) : logs.length === 0 ? (
        <View style={styles.emptyWrap}>
          <LinearGradient colors={["rgba(27,153,139,0.2)","rgba(0,119,182,0.12)"]} style={styles.emptyIconBg}>
            <MaterialCommunityIcons name="run" size={42} color={isDark ? "#2DD4BF" : "#1B998B"} />
          </LinearGradient>
          <Text style={[styles.emptyTitle, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>Aaj ka exercise log karein</Text>
          <Text style={[styles.emptyText, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular" }]}>Walk, yoga, gym — kuch bhi!</Text>
          <TouchableOpacity onPress={() => setShowModal(true)} activeOpacity={0.85}>
            <LinearGradient colors={["#1B998B","#0077B6"]} style={styles.emptyBtn}>
              <Text style={[styles.emptyBtnText, { fontFamily: "Inter_600SemiBold" }]}>Exercise Add Karein</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 90 }} showsVerticalScrollIndicator={false}>
          {logs.map((log) => {
            const ex = EXERCISES.find(e => e.name === log.exerciseType);
            const clr = ex?.color || "#0077B6";
            const ico = ex?.icon || "run-fast";
            return (
              <GlassCard key={log.id} style={{ marginBottom: 12 }}>
                <View style={styles.logItem}>
                  <LinearGradient colors={[`${clr}35`,`${clr}18`]} style={styles.logIconBg}>
                    <MaterialCommunityIcons name={ico as keyof typeof MaterialCommunityIcons.glyphMap} size={22} color={clr} />
                  </LinearGradient>
                  <View style={styles.logInfo}>
                    <Text style={[styles.logName, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>{log.exerciseType}</Text>
                    <Text style={[styles.logDetails, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular" }]}>
                      {log.durationMinutes} min · {log.intensity}
                    </Text>
                  </View>
                  <View style={styles.logCalWrap}>
                    <Text style={[styles.logCal, { color: isDark ? "#FCD34D" : "#D97706", fontFamily: "Inter_700Bold" }]}>{Math.round(Number(log.caloriesBurned || 0))}</Text>
                    <Text style={[styles.logCalUnit, { color: isDark ? "rgba(255,255,255,0.3)" : "rgba(10,22,40,0.4)", fontFamily: "Inter_400Regular" }]}>kcal</Text>
                  </View>
                </View>
              </GlassCard>
            );
          })}
        </ScrollView>
      )}

      {/* Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalRoot}>
          <LinearGradient colors={isDark ? ["#010814","#031628","#051E30"] : ["#C8E9FA","#D9F4EE","#E8F4FF"]} style={StyleSheet.absoluteFill} />
          <View style={[styles.modalHeader, { borderBottomColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,119,182,0.1)" }]}>
            <Text style={[styles.modalTitle, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>Exercise Log Karein 🏃</Text>
            <TouchableOpacity onPress={() => { setShowModal(false); setSelectedExercise(""); setDuration(""); }} style={[styles.closeBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.07)" }]}>
              <Ionicons name="close" size={20} color={isDark ? "#F0F8FF" : "#0A1628"} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
            <Text style={[styles.modalLabel, { color: isDark ? "rgba(255,255,255,0.7)" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>Exercise Type</Text>
            <View style={styles.exGrid}>
              {EXERCISES.map((ex) => {
                const isSelected = selectedExercise === ex.name;
                return (
                  <TouchableOpacity key={ex.name} onPress={() => setSelectedExercise(ex.name)} activeOpacity={0.8}>
                    {isSelected
                      ? <LinearGradient colors={[ex.color,`${ex.color}AA`]} style={styles.exChip}><MaterialCommunityIcons name={ex.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={16} color="#FFF" /><Text style={[styles.exName, { color: "#FFF", fontFamily: "Inter_600SemiBold" }]}>{ex.name}</Text></LinearGradient>
                      : <View style={[styles.exChip, { backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.75)", borderWidth: 1, borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,119,182,0.15)" }]}><MaterialCommunityIcons name={ex.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={16} color={isDark ? "rgba(255,255,255,0.55)" : "#0077B6"} /><Text style={[styles.exName, { color: isDark ? "rgba(255,255,255,0.65)" : "#0A1628", fontFamily: "Inter_400Regular" }]}>{ex.name}</Text></View>
                    }
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.modalLabel, { color: isDark ? "rgba(255,255,255,0.7)" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>Duration (minutes)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.8)", borderColor: isDark ? "rgba(255,255,255,0.14)" : "rgba(0,119,182,0.2)", color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_400Regular" }]}
              placeholder="30" placeholderTextColor={isDark ? "rgba(255,255,255,0.3)" : "rgba(10,22,40,0.35)"}
              keyboardType="numeric" value={duration} onChangeText={setDuration}
            />

            <Text style={[styles.modalLabel, { color: isDark ? "rgba(255,255,255,0.7)" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>Intensity</Text>
            <View style={styles.intensityRow}>
              {INTENSITIES.map((item) => (
                <TouchableOpacity key={item.value} onPress={() => setIntensity(item.value)} activeOpacity={0.8} style={{ flex: 1, borderRadius: 14, overflow: "hidden" }}>
                  {intensity === item.value
                    ? <LinearGradient colors={item.grad} style={styles.intensityBtn}><Text style={[styles.intensityText, { color: "#FFF", fontFamily: "Inter_600SemiBold" }]}>{item.label}</Text></LinearGradient>
                    : <View style={[styles.intensityBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.75)", borderWidth: 1, borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,119,182,0.15)" }]}><Text style={[styles.intensityText, { color: isDark ? "rgba(255,255,255,0.6)" : "#0077B6", fontFamily: "Inter_400Regular" }]}>{item.label}</Text></View>
                  }
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity onPress={handleAdd} disabled={isSubmitting} activeOpacity={0.85}>
              <LinearGradient colors={["#1B998B","#0077B6"]} style={styles.saveBtn}>
                {isSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={[styles.saveText, { fontFamily: "Inter_700Bold" }]}>Save Karein ✓</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  orb1: { position: "absolute", width: 280, height: 280, borderRadius: 140, top: -90, left: -60, opacity: 0.4 },
  orb2: { position: "absolute", width: 240, height: 240, borderRadius: 120, bottom: 100, right: -60, opacity: 0.35 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: 18, paddingBottom: 12 },
  title: { fontSize: 24 },
  subtitle: { fontSize: 12, marginTop: 3 },
  addBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  statsCard: { flexDirection: "row", padding: 18, alignItems: "center", justifyContent: "space-around" },
  statItem: { alignItems: "center", gap: 6 },
  statIconBg: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  statNum: { fontSize: 22 },
  statLabel: { fontSize: 11 },
  statDiv: { width: 1, height: 50 },
  progressBar: { marginHorizontal: 18, height: 4, borderRadius: 2, marginBottom: 8, overflow: "hidden" },
  progressFill: { height: 4, borderRadius: 2 },
  progressText: { fontSize: 11, textAlign: "center", paddingBottom: 14 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, paddingHorizontal: 40 },
  emptyIconBg: { width: 90, height: 90, borderRadius: 45, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 18, textAlign: "center" },
  emptyText: { fontSize: 14, textAlign: "center" },
  emptyBtn: { paddingHorizontal: 28, paddingVertical: 14, borderRadius: 16 },
  emptyBtnText: { color: "#FFF", fontSize: 16 },
  logItem: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14 },
  logIconBg: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  logInfo: { flex: 1 },
  logName: { fontSize: 15, marginBottom: 4 },
  logDetails: { fontSize: 13 },
  logCalWrap: { alignItems: "center" },
  logCal: { fontSize: 18 },
  logCalUnit: { fontSize: 10 },
  modalRoot: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, paddingTop: 56, borderBottomWidth: 1 },
  modalTitle: { fontSize: 20 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  modalLabel: { fontSize: 14, marginBottom: 12 },
  exGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 },
  exChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12 },
  exName: { fontSize: 13 },
  input: { borderWidth: 1, borderRadius: 14, height: 52, paddingHorizontal: 16, fontSize: 16, marginBottom: 24 },
  intensityRow: { flexDirection: "row", gap: 8, marginBottom: 32 },
  intensityBtn: { paddingVertical: 14, alignItems: "center", borderRadius: 14 },
  intensityText: { fontSize: 13 },
  saveBtn: { height: 56, alignItems: "center", justifyContent: "center", borderRadius: 16 },
  saveText: { color: "#FFF", fontSize: 17 },
});
