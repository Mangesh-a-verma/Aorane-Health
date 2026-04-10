import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { api } from "@/lib/api";

type ExerciseLog = {
  id: string;
  exerciseType: string;
  durationMinutes: number;
  intensity: string;
  caloriesBurned?: string;
  loggedAt: string;
};

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

const INTENSITY_LABELS: Record<string, string> = {
  light: "Light",
  moderate: "Moderate",
  intense: "Intense",
};

function todayDate() { return new Date().toISOString().slice(0, 10); }

export default function ExerciseScreen() {
  const colors = useColors();
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
    try {
      const res = await api.getExerciseLogs(todayDate());
      setLogs(res.logs as ExerciseLog[]);
    } catch { }
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
      await api.logExercise({
        exerciseType: selectedExercise,
        durationMinutes: parseInt(duration),
        intensity,
        caloriesBurned: cal.toFixed(1),
      });
      setShowModal(false);
      setSelectedExercise("");
      setDuration("");
      await loadLogs();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Error", "Failed to log exercise");
    }
    setIsSubmitting(false);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Exercise</Text>
        <TouchableOpacity onPress={() => setShowModal(true)} style={[styles.addBtn, { backgroundColor: colors.primary }]}>
          <Ionicons name="add" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border, marginHorizontal: 20, marginBottom: 20 }]}>
        <View style={styles.summaryItem}>
          <MaterialCommunityIcons name="run-fast" size={24} color={colors.success} />
          <Text style={[styles.summaryNum, { color: colors.success, fontFamily: "Inter_700Bold" }]}>{totalMin}</Text>
          <Text style={[styles.summaryLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>minutes</Text>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.summaryItem}>
          <Ionicons name="flame" size={24} color={colors.warning} />
          <Text style={[styles.summaryNum, { color: colors.warning, fontFamily: "Inter_700Bold" }]}>{Math.round(totalCal)}</Text>
          <Text style={[styles.summaryLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>kcal</Text>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.summaryItem}>
          <Ionicons name="trophy" size={24} color={colors.accent} />
          <Text style={[styles.summaryNum, { color: colors.accent, fontFamily: "Inter_700Bold" }]}>{logs.length}</Text>
          <Text style={[styles.summaryLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>sessions</Text>
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} />
      ) : logs.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="run" size={56} color={colors.muted} />
          <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Aaj ka exercise log karein</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Koi bhi activity — walk, yoga, gym</Text>
          <TouchableOpacity onPress={() => setShowModal(true)} style={[styles.emptyBtn, { backgroundColor: colors.primary }]}>
            <Text style={[styles.emptyBtnText, { fontFamily: "Inter_600SemiBold" }]}>Exercise Add Karein</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 90 }} showsVerticalScrollIndicator={false}>
          {logs.map((log) => (
            <View key={log.id} style={[styles.logItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.logIcon, { backgroundColor: `${colors.success}20` }]}>
                <MaterialCommunityIcons name="run-fast" size={22} color={colors.success} />
              </View>
              <View style={styles.logInfo}>
                <Text style={[styles.logName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{log.exerciseType}</Text>
                <Text style={[styles.logDetails, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {log.durationMinutes} min · {INTENSITY_LABELS[log.intensity]}
                </Text>
              </View>
              <Text style={[styles.logCal, { color: colors.warning, fontFamily: "Inter_700Bold" }]}>
                {Math.round(Number(log.caloriesBurned || 0))} kcal
              </Text>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Exercise Log Karein</Text>
            <TouchableOpacity onPress={() => { setShowModal(false); setSelectedExercise(""); setDuration(""); }}>
              <Ionicons name="close" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={[styles.modalLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Exercise Type</Text>
            <View style={styles.exGrid}>
              {EXERCISES.map((ex) => (
                <TouchableOpacity
                  key={ex.name}
                  onPress={() => setSelectedExercise(ex.name)}
                  style={[
                    styles.exChip,
                    { backgroundColor: selectedExercise === ex.name ? colors.primary : colors.card, borderColor: selectedExercise === ex.name ? colors.primary : colors.border },
                  ]}
                >
                  <MaterialCommunityIcons name={ex.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={20} color={selectedExercise === ex.name ? "#FFF" : colors.foreground} />
                  <Text style={[styles.exName, { color: selectedExercise === ex.name ? "#FFF" : colors.foreground, fontFamily: "Inter_500Medium" }]}>{ex.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.modalLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Duration (minutes)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, fontFamily: "Inter_400Regular" }]}
              placeholder="30"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numeric"
              value={duration}
              onChangeText={setDuration}
            />

            <Text style={[styles.modalLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Intensity</Text>
            <View style={styles.intensityRow}>
              {(["light", "moderate", "intense"] as const).map((i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => setIntensity(i)}
                  style={[
                    styles.intensityChip,
                    { backgroundColor: intensity === i ? colors.accent : colors.card, borderColor: intensity === i ? colors.accent : colors.border, flex: 1 },
                  ]}
                >
                  <Text style={[styles.intensityText, { color: intensity === i ? "#FFF" : colors.foreground, fontFamily: "Inter_500Medium" }]}>
                    {INTENSITY_LABELS[i]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity onPress={handleAdd} disabled={isSubmitting} style={[styles.saveBtn, { backgroundColor: colors.primary }]}>
              {isSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={[styles.saveBtnText, { fontFamily: "Inter_700Bold" }]}>Save Karein</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 16 },
  title: { fontSize: 24 },
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  summaryCard: { flexDirection: "row", borderRadius: 16, padding: 16, borderWidth: 1, alignItems: "center", justifyContent: "space-around" },
  summaryItem: { alignItems: "center", gap: 4 },
  summaryNum: { fontSize: 24 },
  summaryLabel: { fontSize: 12 },
  divider: { width: 1, height: 40 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 12 },
  emptyTitle: { fontSize: 18 },
  emptyText: { fontSize: 14, textAlign: "center" },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, marginTop: 8 },
  emptyBtnText: { color: "#FFF", fontSize: 16 },
  logItem: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 12 },
  logIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  logInfo: { flex: 1 },
  logName: { fontSize: 15, marginBottom: 4 },
  logDetails: { fontSize: 13 },
  logCal: { fontSize: 16 },
  modal: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 20 },
  modalContent: { padding: 20 },
  modalLabel: { fontSize: 15, marginBottom: 12 },
  exGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },
  exChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  exName: { fontSize: 13 },
  input: { borderWidth: 1, borderRadius: 12, height: 52, paddingHorizontal: 16, fontSize: 16, marginBottom: 24 },
  intensityRow: { flexDirection: "row", gap: 10, marginBottom: 28 },
  intensityChip: { paddingVertical: 12, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  intensityText: { fontSize: 14 },
  saveBtn: { height: 54, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  saveBtnText: { color: "#FFF", fontSize: 17 },
});
