import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator, Platform, useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { GlassCard } from "@/components/GlassCard";
import { GradientBackground } from "@/components/GradientBackground";
import { useColors } from "@/hooks/useColors";
import { api } from "@/lib/api";

type ExerciseLog = { id: string; exerciseType: string; durationMinutes: number; intensity: string; caloriesBurned?: string; };
const EXERCISES = [
  { name: "Walking", icon: "walk", met: 3.5 },
  { name: "Running", icon: "run-fast", met: 9.8 },
  { name: "Yoga", icon: "yoga", met: 2.5 },
  { name: "Cycling", icon: "bike", met: 7.5 },
  { name: "Swimming", icon: "swim", met: 8.0 },
  { name: "Weight Training", icon: "weight-lifter", met: 5.0 },
  { name: "Dancing", icon: "dance-ballroom", met: 4.5 },
  { name: "Cricket", icon: "cricket", met: 5.0 },
  { name: "Badminton", icon: "badminton", met: 5.5 },
  { name: "Skipping", icon: "jump-rope", met: 11.0 },
];
const INTENSITIES = [{ value: "light", label: "Light" }, { value: "moderate", label: "Moderate" }, { value: "intense", label: "Intense" }];
function todayDate() { return new Date().toISOString().slice(0, 10); }

export default function ExerciseScreen() {
  const colors = useColors();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
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
    const cal = ex ? (ex.met * 70 * parseFloat(duration)) / 60 : 0;
    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await api.logExercise({ exerciseType: selectedExercise, durationMinutes: parseInt(duration), intensity, caloriesBurned: cal.toFixed(1) });
      setShowModal(false); setSelectedExercise(""); setDuration("");
      await loadLogs();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch { Alert.alert("Error", "Failed to log exercise"); }
    setIsSubmitting(false);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <GradientBackground>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Text style={[styles.title, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>Exercise</Text>
        <TouchableOpacity onPress={() => setShowModal(true)} style={styles.addBtnWrap}>
          <LinearGradient colors={["#0077B6", "#1B998B"]} style={styles.addBtn}>
            <Ionicons name="add" size={22} color="#FFF" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <GlassCard style={styles.summaryCard}>
        {[
          { icon: "run-fast", label: "Minutes", value: `${totalMin}`, color: isDark ? "#2DD4BF" : "#1B998B" },
          { icon: "fire", label: "Calories", value: `${Math.round(totalCal)}`, color: isDark ? "#FCD34D" : "#D97706" },
          { icon: "trophy-outline", label: "Sessions", value: `${logs.length}`, color: isDark ? "#38BDF8" : "#0077B6" },
        ].map((s, i, arr) => (
          <React.Fragment key={s.label}>
            <View style={styles.summaryItem}>
              <MaterialCommunityIcons name={s.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={22} color={s.color} />
              <Text style={[styles.summaryNum, { color: s.color, fontFamily: "Inter_700Bold" }]}>{s.value}</Text>
              <Text style={[styles.summaryLabel, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular" }]}>{s.label}</Text>
            </View>
            {i < arr.length - 1 && <View style={[styles.summDiv, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }]} />}
          </React.Fragment>
        ))}
      </GlassCard>

      {isLoading ? <ActivityIndicator color={isDark ? "#38BDF8" : "#0077B6"} /> : logs.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="run" size={54} color={isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} />
          <Text style={[styles.emptyTitle, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>Aaj ka exercise log karein</Text>
          <Text style={[styles.emptyText, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular" }]}>Koi bhi activity — walk, yoga, gym</Text>
          <TouchableOpacity onPress={() => setShowModal(true)} style={styles.emptyBtnWrap}>
            <LinearGradient colors={["#0077B6", "#1B998B"]} style={styles.emptyBtn}>
              <Text style={[styles.emptyBtnText, { fontFamily: "Inter_600SemiBold" }]}>Exercise Add Karein</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 90 }} showsVerticalScrollIndicator={false}>
          {logs.map((log) => (
            <GlassCard key={log.id} style={styles.logItem}>
              <LinearGradient colors={["rgba(27,153,139,0.2)", "rgba(0,119,182,0.15)"]} style={styles.logIconBg}>
                <MaterialCommunityIcons name="run-fast" size={20} color={isDark ? "#2DD4BF" : "#1B998B"} />
              </LinearGradient>
              <View style={styles.logInfo}>
                <Text style={[styles.logName, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>{log.exerciseType}</Text>
                <Text style={[styles.logDetails, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular" }]}>{log.durationMinutes} min · {log.intensity}</Text>
              </View>
              <Text style={[styles.logCal, { color: isDark ? "#FCD34D" : "#D97706", fontFamily: "Inter_700Bold" }]}>{Math.round(Number(log.caloriesBurned || 0))} kcal</Text>
            </GlassCard>
          ))}
        </ScrollView>
      )}

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modal, { backgroundColor: isDark ? "#040D1C" : "#EEF4FF" }]}>
          <LinearGradient colors={isDark ? ["#040D1C", "#062040"] : ["#E0F2FE", "#F0FDF9"]} style={StyleSheet.absoluteFill} />
          <View style={[styles.modalHeader, { borderBottomColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,119,182,0.1)" }]}>
            <Text style={[styles.modalTitle, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>Exercise Log Karein</Text>
            <TouchableOpacity onPress={() => { setShowModal(false); setSelectedExercise(""); setDuration(""); }}>
              <Ionicons name="close" size={24} color={isDark ? "#F0F8FF" : "#0A1628"} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={[styles.modalLabel, { color: isDark ? "rgba(255,255,255,0.7)" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>Exercise Type</Text>
            <View style={styles.exGrid}>
              {EXERCISES.map((ex) => (
                <TouchableOpacity key={ex.name} onPress={() => setSelectedExercise(ex.name)} style={styles.exChipWrap} activeOpacity={0.8}>
                  {selectedExercise === ex.name
                    ? <LinearGradient colors={["#0077B6", "#1B998B"]} style={styles.exChip}><MaterialCommunityIcons name={ex.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={18} color="#FFF" /><Text style={[styles.exName, { color: "#FFF", fontFamily: "Inter_500Medium" }]}>{ex.name}</Text></LinearGradient>
                    : <View style={[styles.exChip, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.75)", borderWidth: 1, borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,119,182,0.15)" }]}><MaterialCommunityIcons name={ex.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={18} color={isDark ? "rgba(255,255,255,0.6)" : "#0077B6"} /><Text style={[styles.exName, { color: isDark ? "rgba(255,255,255,0.7)" : "#0A1628", fontFamily: "Inter_500Medium" }]}>{ex.name}</Text></View>
                  }
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.modalLabel, { color: isDark ? "rgba(255,255,255,0.7)" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>Duration (minutes)</Text>
            <TextInput style={[styles.input, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.75)", borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,119,182,0.2)", color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_400Regular" }]} placeholder="30" placeholderTextColor={isDark ? "rgba(255,255,255,0.3)" : "rgba(10,22,40,0.35)"} keyboardType="numeric" value={duration} onChangeText={setDuration} />

            <Text style={[styles.modalLabel, { color: isDark ? "rgba(255,255,255,0.7)" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>Intensity</Text>
            <View style={styles.intensityRow}>
              {INTENSITIES.map((i) => (
                <TouchableOpacity key={i.value} onPress={() => setIntensity(i.value)} style={[styles.intensityBtnWrap, { flex: 1 }]} activeOpacity={0.8}>
                  {intensity === i.value
                    ? <LinearGradient colors={["#7C3AED", "#0077B6"]} style={styles.intensityBtn}><Text style={[styles.intensityText, { color: "#FFF", fontFamily: "Inter_600SemiBold" }]}>{i.label}</Text></LinearGradient>
                    : <View style={[styles.intensityBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.75)", borderWidth: 1, borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,119,182,0.15)" }]}><Text style={[styles.intensityText, { color: isDark ? "rgba(255,255,255,0.6)" : "#0077B6", fontFamily: "Inter_500Medium" }]}>{i.label}</Text></View>
                  }
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity onPress={handleAdd} disabled={isSubmitting} style={styles.saveWrap}>
              <LinearGradient colors={["#0077B6", "#1B998B"]} style={styles.saveBtn}>
                {isSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={[styles.saveText, { fontFamily: "Inter_700Bold" }]}>Save Karein</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 18, paddingBottom: 14 },
  title: { fontSize: 24 },
  addBtnWrap: { borderRadius: 20, overflow: "hidden" },
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  summaryCard: { flexDirection: "row", marginHorizontal: 18, marginBottom: 16, padding: 16, alignItems: "center", justifyContent: "space-around" },
  summaryItem: { alignItems: "center", gap: 4 },
  summaryNum: { fontSize: 22 },
  summaryLabel: { fontSize: 12 },
  summDiv: { width: 1, height: 40 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 12 },
  emptyTitle: { fontSize: 18 },
  emptyText: { fontSize: 14, textAlign: "center" },
  emptyBtnWrap: { borderRadius: 14, overflow: "hidden", marginTop: 8 },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 14 },
  emptyBtnText: { color: "#FFF", fontSize: 16 },
  logItem: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, marginBottom: 12 },
  logIconBg: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  logInfo: { flex: 1 },
  logName: { fontSize: 15, marginBottom: 4 },
  logDetails: { fontSize: 13 },
  logCal: { fontSize: 16 },
  modal: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 20 },
  modalContent: { padding: 20 },
  modalLabel: { fontSize: 14, marginBottom: 12 },
  exGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 },
  exChipWrap: { borderRadius: 12, overflow: "hidden" },
  exChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 },
  exName: { fontSize: 13 },
  input: { borderWidth: 1, borderRadius: 14, height: 52, paddingHorizontal: 16, fontSize: 16, marginBottom: 24 },
  intensityRow: { flexDirection: "row", gap: 8, marginBottom: 28 },
  intensityBtnWrap: { borderRadius: 12, overflow: "hidden" },
  intensityBtn: { paddingVertical: 12, alignItems: "center", borderRadius: 12 },
  intensityText: { fontSize: 14 },
  saveWrap: { borderRadius: 14, overflow: "hidden" },
  saveBtn: { height: 54, alignItems: "center", justifyContent: "center" },
  saveText: { color: "#FFF", fontSize: 17 },
});
