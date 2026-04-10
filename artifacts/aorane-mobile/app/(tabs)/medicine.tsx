import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { api } from "@/lib/api";

type Schedule = {
  id: string;
  medicineName: string;
  dosage?: string;
  mealTiming: string;
  reminderTimes: string[];
  isActive: boolean;
};

const MEAL_TIMING_LABELS: Record<string, string> = {
  before_meal: "Before Meal",
  after_meal: "After Meal",
  with_meal: "With Meal",
  anytime: "Anytime",
};

export default function MedicineScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [medicineName, setMedicineName] = useState("");
  const [dosage, setDosage] = useState("");
  const [mealTiming, setMealTiming] = useState("after_meal");
  const [reminderTime, setReminderTime] = useState("08:00");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => { loadSchedules(); }, []);

  const loadSchedules = useCallback(async () => {
    try {
      const res = await api.getMedicineSchedules();
      setSchedules(res.schedules as Schedule[]);
    } catch { }
    setIsLoading(false);
  }, []);

  const handleAdd = async () => {
    if (!medicineName.trim()) { Alert.alert("Required", "Medicine name enter karein"); return; }
    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await (api as unknown as { createMedicineSchedule: (data: Record<string, unknown>) => Promise<void> }).createMedicineSchedule?.({
        medicineName: medicineName.trim(),
        dosage,
        mealTiming,
        reminderTimes: [reminderTime],
        startDate: new Date().toISOString().slice(0, 10),
      });
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL || "http://localhost:8080/api"}/medicine/schedule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${await (await import("@/lib/storage")).storage.getToken()}`,
        },
        body: JSON.stringify({
          medicineName: medicineName.trim(),
          dosage,
          mealTiming,
          reminderTimes: [reminderTime],
          startDate: new Date().toISOString().slice(0, 10),
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setShowModal(false);
      setMedicineName("");
      setDosage("");
      await loadSchedules();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Error", "Medicine schedule save karne mein dikkat aayi");
    }
    setIsSubmitting(false);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Medicine</Text>
        <TouchableOpacity onPress={() => setShowModal(true)} style={[styles.addBtn, { backgroundColor: colors.primary }]}>
          <Ionicons name="add" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : schedules.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="medkit-outline" size={56} color={colors.muted} />
          <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Koi medicine schedule nahi</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Apni medicines add karein aur reminder set karein
          </Text>
          <TouchableOpacity onPress={() => setShowModal(true)} style={[styles.emptyBtn, { backgroundColor: colors.primary }]}>
            <Text style={[styles.emptyBtnText, { fontFamily: "Inter_600SemiBold" }]}>Medicine Add Karein</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 90 }} showsVerticalScrollIndicator={false}>
          {schedules.map((s) => (
            <View key={s.id} style={[styles.scheduleCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.pillIcon, { backgroundColor: `${colors.accent}20` }]}>
                <Ionicons name="medical" size={22} color={colors.accent} />
              </View>
              <View style={styles.scheduleInfo}>
                <Text style={[styles.scheduleName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                  {s.medicineName}
                </Text>
                {s.dosage ? (
                  <Text style={[styles.scheduleDose, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {s.dosage}
                  </Text>
                ) : null}
                <Text style={[styles.scheduleTiming, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {MEAL_TIMING_LABELS[s.mealTiming]} · {s.reminderTimes.join(", ")}
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: s.isActive ? `${colors.success}20` : colors.muted }]}>
                <Text style={[styles.statusText, { color: s.isActive ? colors.success : colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  {s.isActive ? "Active" : "Paused"}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Medicine Add Karein</Text>
            <TouchableOpacity onPress={() => { setShowModal(false); setMedicineName(""); setDosage(""); }}>
              <Ionicons name="close" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={[styles.modalLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Medicine ka naam *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, fontFamily: "Inter_400Regular" }]}
              placeholder="e.g. Metformin, Vitamin D"
              placeholderTextColor={colors.mutedForeground}
              value={medicineName}
              onChangeText={setMedicineName}
              autoFocus
            />

            <Text style={[styles.modalLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Dosage</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, fontFamily: "Inter_400Regular" }]}
              placeholder="e.g. 500mg, 1 tablet"
              placeholderTextColor={colors.mutedForeground}
              value={dosage}
              onChangeText={setDosage}
            />

            <Text style={[styles.modalLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Khaane ke sath</Text>
            <View style={styles.timingRow}>
              {(["before_meal", "with_meal", "after_meal", "anytime"] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setMealTiming(t)}
                  style={[
                    styles.timingChip,
                    { backgroundColor: mealTiming === t ? colors.accent : colors.card, borderColor: mealTiming === t ? colors.accent : colors.border },
                  ]}
                >
                  <Text style={[styles.timingText, { color: mealTiming === t ? "#FFF" : colors.foreground, fontFamily: "Inter_500Medium" }]}>
                    {MEAL_TIMING_LABELS[t]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.modalLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Reminder Time</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, fontFamily: "Inter_400Regular" }]}
              placeholder="08:00"
              placeholderTextColor={colors.mutedForeground}
              value={reminderTime}
              onChangeText={setReminderTime}
            />

            <TouchableOpacity onPress={handleAdd} disabled={isSubmitting} style={[styles.saveBtn, { backgroundColor: colors.primary }]}>
              {isSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={[styles.saveBtnText, { fontFamily: "Inter_700Bold" }]}>Schedule Save Karein</Text>}
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
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 12 },
  emptyTitle: { fontSize: 18 },
  emptyText: { fontSize: 14, textAlign: "center" },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, marginTop: 8 },
  emptyBtnText: { color: "#FFF", fontSize: 16 },
  scheduleCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 12 },
  pillIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  scheduleInfo: { flex: 1 },
  scheduleName: { fontSize: 16, marginBottom: 4 },
  scheduleDose: { fontSize: 13, marginBottom: 2 },
  scheduleTiming: { fontSize: 13 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  statusText: { fontSize: 12 },
  modal: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 20 },
  modalContent: { padding: 20 },
  modalLabel: { fontSize: 15, marginBottom: 10 },
  input: { borderWidth: 1, borderRadius: 12, height: 52, paddingHorizontal: 16, fontSize: 16, marginBottom: 20 },
  timingRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 },
  timingChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
  timingText: { fontSize: 13 },
  saveBtn: { height: 54, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  saveBtnText: { color: "#FFF", fontSize: 17 },
});
