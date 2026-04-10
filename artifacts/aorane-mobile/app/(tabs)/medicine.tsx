import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator, Platform, useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { GlassCard } from "@/components/GlassCard";
import { GradientBackground } from "@/components/GradientBackground";
import { useColors } from "@/hooks/useColors";
import { api } from "@/lib/api";
import { storage } from "@/lib/storage";

type Schedule = { id: string; medicineName: string; dosage?: string; mealTiming: string; reminderTimes: string[]; isActive: boolean; };
const MEAL_TIMING: Record<string, string> = { before_meal: "Khaane se pehle", after_meal: "Khaane ke baad", with_meal: "Khaane ke saath", anytime: "Kisi bhi waqt" };

export default function MedicineScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
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
    try { const res = await api.getMedicineSchedules(); setSchedules(res.schedules as Schedule[]); } catch { }
    setIsLoading(false);
  }, []);

  const handleAdd = async () => {
    if (!medicineName.trim()) { Alert.alert("Required", "Medicine name enter karein"); return; }
    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const token = await storage.getToken();
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL || "http://localhost:8080/api"}/medicine/schedule`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ medicineName: medicineName.trim(), dosage, mealTiming, reminderTimes: [reminderTime], startDate: new Date().toISOString().slice(0, 10) }) });
      if (!res.ok) throw new Error("Failed");
      setShowModal(false); setMedicineName(""); setDosage("");
      await loadSchedules();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch { Alert.alert("Error", "Medicine schedule save karne mein dikkat aayi"); }
    setIsSubmitting(false);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <GradientBackground>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Text style={[styles.title, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>Medicine</Text>
        <TouchableOpacity onPress={() => setShowModal(true)} style={styles.addBtnWrap}>
          <LinearGradient colors={["#0077B6", "#1B998B"]} style={styles.addBtn}>
            <Ionicons name="add" size={22} color="#FFF" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {isLoading ? <ActivityIndicator color={isDark ? "#38BDF8" : "#0077B6"} style={{ marginTop: 40 }} /> : schedules.length === 0 ? (
        <View style={styles.empty}>
          <LinearGradient colors={["rgba(0,119,182,0.15)", "rgba(27,153,139,0.1)"]} style={styles.emptyIcon}>
            <Ionicons name="medkit-outline" size={40} color={isDark ? "#38BDF8" : "#0077B6"} />
          </LinearGradient>
          <Text style={[styles.emptyTitle, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>Koi medicine schedule nahi</Text>
          <Text style={[styles.emptyText, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular", textAlign: "center" }]}>
            Apni medicines add karein aur reminder set karein
          </Text>
          <TouchableOpacity onPress={() => setShowModal(true)} style={styles.emptyBtnWrap}>
            <LinearGradient colors={["#0077B6", "#1B998B"]} style={styles.emptyBtn}>
              <Text style={[styles.emptyBtnText, { fontFamily: "Inter_600SemiBold" }]}>Medicine Add Karein</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 90 }} showsVerticalScrollIndicator={false}>
          {schedules.map((s) => (
            <GlassCard key={s.id} style={styles.scheduleCard}>
              <LinearGradient colors={["rgba(124,58,237,0.2)", "rgba(0,119,182,0.15)"]} style={styles.pillIcon}>
                <Ionicons name="medical" size={20} color={isDark ? "#A78BFA" : "#7C3AED"} />
              </LinearGradient>
              <View style={styles.scheduleInfo}>
                <Text style={[styles.scheduleName, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>{s.medicineName}</Text>
                {s.dosage ? <Text style={[styles.scheduleDose, { color: isDark ? "rgba(255,255,255,0.5)" : "rgba(10,22,40,0.5)", fontFamily: "Inter_400Regular" }]}>{s.dosage}</Text> : null}
                <Text style={[styles.scheduleTiming, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular" }]}>
                  {MEAL_TIMING[s.mealTiming]} · {s.reminderTimes.join(", ")}
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: s.isActive ? "rgba(45,212,191,0.15)" : "rgba(255,255,255,0.06)" }]}>
                <Text style={[styles.statusText, { color: s.isActive ? (isDark ? "#2DD4BF" : "#1B998B") : (isDark ? "rgba(255,255,255,0.35)" : "rgba(10,22,40,0.35)"), fontFamily: "Inter_500Medium" }]}>
                  {s.isActive ? "Active" : "Paused"}
                </Text>
              </View>
            </GlassCard>
          ))}
        </ScrollView>
      )}

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modal, { backgroundColor: isDark ? "#040D1C" : "#EEF4FF" }]}>
          <LinearGradient colors={isDark ? ["#040D1C", "#062040"] : ["#E0F2FE", "#F0FDF9"]} style={StyleSheet.absoluteFill} />
          <View style={[styles.modalHeader, { borderBottomColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,119,182,0.1)" }]}>
            <Text style={[styles.modalTitle, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>Medicine Add Karein</Text>
            <TouchableOpacity onPress={() => { setShowModal(false); setMedicineName(""); setDosage(""); }}>
              <Ionicons name="close" size={24} color={isDark ? "#F0F8FF" : "#0A1628"} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={[styles.modalLabel, { color: isDark ? "rgba(255,255,255,0.7)" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>Medicine ka naam *</Text>
            <TextInput style={[styles.input, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.8)", borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,119,182,0.2)", color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_400Regular" }]} placeholder="e.g. Metformin, Vitamin D" placeholderTextColor={isDark ? "rgba(255,255,255,0.3)" : "rgba(10,22,40,0.35)"} value={medicineName} onChangeText={setMedicineName} autoFocus />

            <Text style={[styles.modalLabel, { color: isDark ? "rgba(255,255,255,0.7)" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>Dosage</Text>
            <TextInput style={[styles.input, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.8)", borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,119,182,0.2)", color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_400Regular" }]} placeholder="e.g. 500mg, 1 tablet" placeholderTextColor={isDark ? "rgba(255,255,255,0.3)" : "rgba(10,22,40,0.35)"} value={dosage} onChangeText={setDosage} />

            <Text style={[styles.modalLabel, { color: isDark ? "rgba(255,255,255,0.7)" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>Kab lena hai</Text>
            <View style={styles.timingGrid}>
              {Object.entries(MEAL_TIMING).map(([k, v]) => (
                <TouchableOpacity key={k} onPress={() => setMealTiming(k)} style={styles.timingBtnWrap} activeOpacity={0.8}>
                  {mealTiming === k
                    ? <LinearGradient colors={["#7C3AED", "#0077B6"]} style={styles.timingBtn}><Text style={[styles.timingText, { color: "#FFF", fontFamily: "Inter_500Medium" }]}>{v}</Text></LinearGradient>
                    : <View style={[styles.timingBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.75)", borderWidth: 1, borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,119,182,0.15)" }]}><Text style={[styles.timingText, { color: isDark ? "rgba(255,255,255,0.6)" : "#0077B6", fontFamily: "Inter_400Regular" }]}>{v}</Text></View>
                  }
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.modalLabel, { color: isDark ? "rgba(255,255,255,0.7)" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>Reminder Time</Text>
            <TextInput style={[styles.input, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.8)", borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,119,182,0.2)", color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_400Regular" }]} placeholder="08:00" placeholderTextColor={isDark ? "rgba(255,255,255,0.3)" : "rgba(10,22,40,0.35)"} value={reminderTime} onChangeText={setReminderTime} />

            <TouchableOpacity onPress={handleAdd} disabled={isSubmitting} style={styles.saveWrap}>
              <LinearGradient colors={["#0077B6", "#1B998B"]} style={styles.saveBtn}>
                {isSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={[styles.saveText, { fontFamily: "Inter_700Bold" }]}>Schedule Save Karein</Text>}
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
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 14 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 18 },
  emptyText: { fontSize: 14 },
  emptyBtnWrap: { borderRadius: 14, overflow: "hidden" },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 14 },
  emptyBtnText: { color: "#FFF", fontSize: 16 },
  scheduleCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, marginBottom: 12 },
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
  modalLabel: { fontSize: 14, marginBottom: 10 },
  input: { borderWidth: 1, borderRadius: 14, height: 52, paddingHorizontal: 16, fontSize: 16, marginBottom: 20 },
  timingGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 },
  timingBtnWrap: { borderRadius: 20, overflow: "hidden" },
  timingBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
  timingText: { fontSize: 13 },
  saveWrap: { borderRadius: 14, overflow: "hidden" },
  saveBtn: { height: 54, alignItems: "center", justifyContent: "center" },
  saveText: { color: "#FFF", fontSize: 17 },
});
