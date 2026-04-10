import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator, Platform, useColorScheme, Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { api } from "@/lib/api";
import { storage } from "@/lib/storage";

const { width: W } = Dimensions.get("window");
type Schedule = { id: string; medicineName: string; dosage?: string; mealTiming: string; reminderTimes: string[]; isActive: boolean; };
const MEAL_TIMING: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  before_meal: { label: "Khaane se pehle", icon: "arrow-back-circle-outline", color: "#F59E0B" },
  after_meal: { label: "Khaane ke baad", icon: "arrow-forward-circle-outline", color: "#10B981" },
  with_meal: { label: "Khaane ke saath", icon: "restaurant-outline", color: "#0EA5E9" },
  anytime: { label: "Kisi bhi waqt", icon: "time-outline", color: "#8B5CF6" },
};

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

export default function MedicineScreen() {
  const scheme = useColorScheme(); const isDark = scheme === "dark";
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
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL || "http://localhost:8080/api"}/medicine/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ medicineName: medicineName.trim(), dosage, mealTiming, reminderTimes: [reminderTime], startDate: new Date().toISOString().slice(0, 10) }),
      });
      if (!res.ok) throw new Error("Failed");
      setShowModal(false); setMedicineName(""); setDosage("");
      await loadSchedules(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch { Alert.alert("Error", "Medicine schedule save nahi hua"); }
    setIsSubmitting(false);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const activeCount = schedules.filter(s => s.isActive).length;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={isDark ? ["#010814","#031628","#051E30","#061A2A"] : ["#C8E9FA","#D9F4EE","#E8F4FF","#D4F0F7"]}
        locations={[0,0.3,0.65,1]} style={StyleSheet.absoluteFill}
      />
      <View style={[styles.orb1, { backgroundColor: isDark ? "#4C1D95" : "#DDD6FE" }]} />
      <View style={[styles.orb2, { backgroundColor: isDark ? "#065F46" : "#A7F3D0" }]} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <View>
          <Text style={[styles.title, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>Medicine 💊</Text>
          <Text style={[styles.subtitle, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular" }]}>
            {activeCount} active schedule{activeCount !== 1 ? "s" : ""}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setShowModal(true)} activeOpacity={0.85}>
          <LinearGradient colors={["#7C3AED","#0077B6"]} style={styles.addBtn}>
            <Ionicons name="add" size={22} color="#FFF" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingWrap}><ActivityIndicator color={isDark ? "#38BDF8" : "#0077B6"} size="large" /></View>
      ) : schedules.length === 0 ? (
        <View style={styles.emptyWrap}>
          <LinearGradient colors={["rgba(124,58,237,0.25)","rgba(0,119,182,0.15)"]} style={styles.emptyIconBg}>
            <Ionicons name="medkit-outline" size={44} color={isDark ? "#A78BFA" : "#7C3AED"} />
          </LinearGradient>
          <Text style={[styles.emptyTitle, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>Koi medicine schedule nahi</Text>
          <Text style={[styles.emptyText, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular", textAlign: "center" }]}>
            Apni medicines add karein aur reminder set karein
          </Text>
          <TouchableOpacity onPress={() => setShowModal(true)} activeOpacity={0.85}>
            <LinearGradient colors={["#7C3AED","#0077B6"]} style={styles.emptyBtn}>
              <Ionicons name="add-circle-outline" size={18} color="#FFF" />
              <Text style={[styles.emptyBtnText, { fontFamily: "Inter_600SemiBold" }]}>Medicine Add Karein</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 90 }} showsVerticalScrollIndicator={false}>
          {schedules.map((s) => {
            const timing = MEAL_TIMING[s.mealTiming] || MEAL_TIMING.anytime;
            return (
              <GlassCard key={s.id} style={{ marginBottom: 14 }}>
                <View style={styles.scheduleCard}>
                  <LinearGradient colors={["rgba(124,58,237,0.3)","rgba(0,119,182,0.2)"]} style={styles.pillIconBg}>
                    <Ionicons name="medical" size={22} color={isDark ? "#A78BFA" : "#7C3AED"} />
                  </LinearGradient>
                  <View style={styles.scheduleInfo}>
                    <Text style={[styles.scheduleName, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>{s.medicineName}</Text>
                    {s.dosage ? <Text style={[styles.scheduleDose, { color: isDark ? "rgba(255,255,255,0.5)" : "rgba(10,22,40,0.5)", fontFamily: "Inter_400Regular" }]}>{s.dosage}</Text> : null}
                    <View style={styles.timingRow}>
                      <Ionicons name={timing.icon} size={12} color={timing.color} />
                      <Text style={[styles.scheduleTiming, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular" }]}>
                        {timing.label} · {s.reminderTimes.join(", ")}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: s.isActive ? "rgba(45,212,191,0.15)" : "rgba(255,255,255,0.06)" }]}>
                    <View style={[styles.statusDot, { backgroundColor: s.isActive ? (isDark ? "#2DD4BF" : "#1B998B") : (isDark ? "rgba(255,255,255,0.2)" : "rgba(10,22,40,0.2)") }]} />
                    <Text style={[styles.statusText, { color: s.isActive ? (isDark ? "#2DD4BF" : "#1B998B") : (isDark ? "rgba(255,255,255,0.35)" : "rgba(10,22,40,0.35)"), fontFamily: "Inter_500Medium" }]}>
                      {s.isActive ? "Active" : "Paused"}
                    </Text>
                  </View>
                </View>
              </GlassCard>
            );
          })}
        </ScrollView>
      )}

      {/* Add Medicine Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalRoot}>
          <LinearGradient colors={isDark ? ["#010814","#031628","#051E30"] : ["#C8E9FA","#D9F4EE","#E8F4FF"]} style={StyleSheet.absoluteFill} />
          <View style={[styles.modalHeader, { borderBottomColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,119,182,0.1)" }]}>
            <Text style={[styles.modalTitle, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>Medicine Add Karein 💊</Text>
            <TouchableOpacity onPress={() => { setShowModal(false); setMedicineName(""); setDosage(""); }} style={[styles.closeBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.07)" }]}>
              <Ionicons name="close" size={20} color={isDark ? "#F0F8FF" : "#0A1628"} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
            <Text style={[styles.modalLabel, { color: isDark ? "rgba(255,255,255,0.7)" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>Medicine ka naam *</Text>
            <TextInput style={[styles.input, { backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.8)", borderColor: isDark ? "rgba(255,255,255,0.14)" : "rgba(0,119,182,0.2)", color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_400Regular" }]} placeholder="e.g. Metformin, Vitamin D" placeholderTextColor={isDark ? "rgba(255,255,255,0.3)" : "rgba(10,22,40,0.35)"} value={medicineName} onChangeText={setMedicineName} autoFocus />

            <Text style={[styles.modalLabel, { color: isDark ? "rgba(255,255,255,0.7)" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>Dosage</Text>
            <TextInput style={[styles.input, { backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.8)", borderColor: isDark ? "rgba(255,255,255,0.14)" : "rgba(0,119,182,0.2)", color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_400Regular" }]} placeholder="e.g. 500mg, 1 tablet" placeholderTextColor={isDark ? "rgba(255,255,255,0.3)" : "rgba(10,22,40,0.35)"} value={dosage} onChangeText={setDosage} />

            <Text style={[styles.modalLabel, { color: isDark ? "rgba(255,255,255,0.7)" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>Kab lena hai</Text>
            <View style={styles.timingGrid}>
              {Object.entries(MEAL_TIMING).map(([k, v]) => (
                <TouchableOpacity key={k} onPress={() => setMealTiming(k)} activeOpacity={0.8} style={{ borderRadius: 14, overflow: "hidden" }}>
                  {mealTiming === k
                    ? <LinearGradient colors={["#7C3AED","#0077B6"]} style={styles.timingBtn}><Ionicons name={v.icon} size={15} color="#FFF" /><Text style={[styles.timingText, { color: "#FFF", fontFamily: "Inter_500Medium" }]}>{v.label}</Text></LinearGradient>
                    : <View style={[styles.timingBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.75)", borderWidth: 1, borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,119,182,0.15)" }]}><Ionicons name={v.icon} size={15} color={isDark ? "rgba(255,255,255,0.45)" : "#0077B6"} /><Text style={[styles.timingText, { color: isDark ? "rgba(255,255,255,0.6)" : "#0077B6", fontFamily: "Inter_400Regular" }]}>{v.label}</Text></View>
                  }
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.modalLabel, { color: isDark ? "rgba(255,255,255,0.7)" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>Reminder Time</Text>
            <TextInput style={[styles.input, { backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.8)", borderColor: isDark ? "rgba(255,255,255,0.14)" : "rgba(0,119,182,0.2)", color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_400Regular" }]} placeholder="08:00" placeholderTextColor={isDark ? "rgba(255,255,255,0.3)" : "rgba(10,22,40,0.35)"} value={reminderTime} onChangeText={setReminderTime} />

            <TouchableOpacity onPress={handleAdd} disabled={isSubmitting} activeOpacity={0.85}>
              <LinearGradient colors={["#7C3AED","#0077B6"]} style={styles.saveBtn}>
                {isSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={[styles.saveText, { fontFamily: "Inter_700Bold" }]}>Schedule Save Karein ✓</Text>}
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
  orb1: { position: "absolute", width: 260, height: 260, borderRadius: 130, top: -80, right: -60, opacity: 0.4 },
  orb2: { position: "absolute", width: 220, height: 220, borderRadius: 110, bottom: 120, left: -55, opacity: 0.35 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: 18, paddingBottom: 14 },
  title: { fontSize: 24 },
  subtitle: { fontSize: 12, marginTop: 3 },
  addBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, paddingHorizontal: 40 },
  emptyIconBg: { width: 90, height: 90, borderRadius: 45, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 18, textAlign: "center" },
  emptyText: { fontSize: 14 },
  emptyBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16 },
  emptyBtnText: { color: "#FFF", fontSize: 16 },
  scheduleCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16 },
  pillIconBg: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  scheduleInfo: { flex: 1 },
  scheduleName: { fontSize: 16, marginBottom: 4 },
  scheduleDose: { fontSize: 13, marginBottom: 4 },
  timingRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  scheduleTiming: { fontSize: 12 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12 },
  modalRoot: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, paddingTop: 56, borderBottomWidth: 1 },
  modalTitle: { fontSize: 20 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  modalLabel: { fontSize: 14, marginBottom: 10 },
  input: { borderWidth: 1, borderRadius: 14, height: 52, paddingHorizontal: 16, fontSize: 16, marginBottom: 20 },
  timingGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 },
  timingBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 14 },
  timingText: { fontSize: 13 },
  saveBtn: { height: 56, alignItems: "center", justifyContent: "center", borderRadius: 16 },
  saveText: { color: "#FFF", fontSize: 17 },
});
