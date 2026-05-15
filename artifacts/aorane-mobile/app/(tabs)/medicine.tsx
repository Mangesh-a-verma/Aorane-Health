import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal,
  TextInput, Alert, ActivityIndicator, Platform, Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useFocusEffect } from "expo-router";
import { api } from "@/lib/api";
import { DS } from "@/lib/theme";
import { exportMedicalReportPDF } from "@/lib/pdfExport";
import { scheduleMedicineReminders, cancelMedicineReminders, requestNotificationPermissions, checkNotificationPermissions } from "@/lib/notifications";
import { Plus, X, ScanLine, Pill, Sparkles, Camera, Image as ImageIcon, FileText, AlertTriangle, ChevronRight, Trash2 } from "lucide-react-native";

const P = DS.color.primary;
const G = DS.color.green;
const PUR = DS.color.purple;

type Schedule = {
  id: string; medicineName: string; dosage: string;
  mealTiming: string; reminderTimes: string[]; isActive: boolean;
};
type Finding = { testName: string; value: string; normalRange: string; status: string; interpretation?: string };
type CriticalValue = { testName: string; value: string; urgency?: string };
type ScanAnalysis = {
  reportType?: string; reportDate?: string; labName?: string;
  overallAssessment?: string; urgencyLevel?: string;
  criticalValues?: CriticalValue[]; findings?: Finding[];
  aiAdvice?: string; dietRecommendations?: string[];
};

const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  normal:        { color: G,               bg: DS.color.greenSoft   },
  high:          { color: DS.color.red,    bg: DS.color.redSoft     },
  low:           { color: DS.color.orange, bg: DS.color.orangeSoft  },
  critical_high: { color: "#DC2626",       bg: "rgba(220,38,38,0.1)" },
  critical_low:  { color: "#B45309",       bg: DS.color.orangeSoft  },
};

const MEAL_TIMING: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  before_meal: { label: "Before Meal", icon: "time-outline",        color: DS.color.orange },
  after_meal:  { label: "After Meal",  icon: "restaurant-outline",  color: G               },
  with_meal:   { label: "With Meal",   icon: "fast-food-outline",   color: P               },
  empty_stomach:{ label: "Empty Stomach", icon: "sunny-outline",   color: DS.color.sky    },
  bedtime:     { label: "Bedtime",     icon: "moon-outline",        color: PUR             },
  anytime:     { label: "Anytime",     icon: "ellipse-outline",     color: DS.color.muted  },
};

export default function MedicineScreen() {
  const insets = useSafeAreaInsets();
  const topPad = insets.top;

  const [schedules,       setSchedules]       = useState<Schedule[]>([]);
  const [isLoading,       setIsLoading]       = useState(true);
  const [showModal,       setShowModal]       = useState(false);
  const [medicineName,    setMedicineName]    = useState("");
  const [dosage,          setDosage]          = useState("");
  const [mealTiming,      setMealTiming]      = useState("after_meal");
  const [reminderTime,    setReminderTime]    = useState("08:00");
  const [isSubmitting,    setIsSubmitting]    = useState(false);
  const [notifPermission, setNotifPermission] = useState(false);

  const [showScanModal, setShowScanModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedScanImage, setSelectedScanImage] = useState<string | null>(null);
  const [isScanning,    setIsScanning]    = useState(false);
  const [scanResult,    setScanResult]    = useState<ScanAnalysis | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadSchedules();
    checkNotificationPermissions().then(setNotifPermission);
  }, []);

  const loadSchedules = useCallback(async () => {
    try { const res = await api.getMedicineSchedules(); setSchedules(res.schedules as Schedule[]); } catch { }
    setIsLoading(false);
  }, []);

  const handleAdd = async () => {
    if (!medicineName.trim()) { Alert.alert("Required", "Please enter medicine name"); return; }
    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const savedName = medicineName.trim();

    // ── Step 1: Save to server (this is the critical step) ──
    let savedId: string | undefined;
    try {
      const res = await api.createMedicineSchedule({
        medicineName: savedName, dosage, mealTiming,
        reminderTimes: [reminderTime],
        startDate: new Date().toISOString().slice(0, 10),
        frequency: "daily",
      });
      savedId = (res.schedule as { id?: string })?.id;
    } catch (err) {
      console.error("[Medicine] API save error:", err);
      Alert.alert("Error", "Could not save medicine. Please check your connection and try again.");
      setIsSubmitting(false);
      return;
    }

    // ── Step 2: Close modal + optimistic list update (no wait) ──
    setShowModal(false);
    setMedicineName("");
    setDosage("");
    // Optimistically add to list so user sees it immediately
    setSchedules((prev) => [
      ...prev,
      {
        id: savedId || `temp-${Date.now()}`,
        medicineName: savedName,
        dosage,
        mealTiming: mealTiming as Schedule["mealTiming"],
        reminderTimes: [reminderTime],
        isActive: true,
      },
    ]);
    setIsSubmitting(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Refresh from server in background to get accurate data (non-blocking)
    loadSchedules();

    // ── Step 3: Schedule local notification (best-effort — don't block on failure) ──
    if (Platform.OS !== "web") {
      try {
        const granted = await requestNotificationPermissions();
        if (granted) {
          await scheduleMedicineReminders({
            medicineId: `medicine_${savedName.toLowerCase().replace(/\s+/g, "_")}`,
            medicineName: savedName, dosage, times: [reminderTime], mealTiming,
          });
          setNotifPermission(true);
          Alert.alert("✅ Medicine Added!", `Daily reminder for ${savedName} at ${reminderTime}`, [{ text: "OK" }]);
          setIsSubmitting(false);
          return;
        }
      } catch (notifErr) {
        console.warn("[Medicine] Notification scheduling failed (non-critical):", notifErr);
        // Medicine was saved — just show success without reminder confirmation
      }
    }

    Alert.alert("✅ Medicine Added!", `${savedName} has been added to your schedule.`, [{ text: "OK" }]);
    setIsSubmitting(false);
  };

  const handleDelete = (med: Schedule) => {
    Alert.alert(
      "Remove Medicine",
      `"${med.medicineName}" reminder hatana chahte hain?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await api.deleteMedicineSchedule(med.id);
              setSchedules((prev) => prev.filter((s) => s.id !== med.id));
              if (Platform.OS !== "web") {
                await cancelMedicineReminders(`medicine_${med.medicineName.toLowerCase().replace(/\s+/g, "_")}`);
              }
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch {
              Alert.alert("Error", "Could not remove medicine. Please try again.");
            }
          },
        },
      ]
    );
  };

  useFocusEffect(useCallback(() => {
    loadSchedules();
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []));

  const pickImage = async (fromCamera: boolean) => {
    try {
      let result;
      if (fromCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Alert.alert("Permission", "Camera permission is required"); return; }
        result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], allowsEditing: false, quality: 0.5, base64: true });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { Alert.alert("Permission", "Gallery permission is required"); return; }
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: false, quality: 0.5, base64: true });
      }
      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri); setSelectedScanImage(result.assets[0].uri); setScanResult(null);
        if (result.assets[0].base64) await analyseReport(result.assets[0].base64, result.assets[0].mimeType || "image/jpeg");
      }
    } catch (err) { Alert.alert("Error", (err instanceof Error ? err.message : "Could not select image. Please try again.")); }
  };

  const analyseReport = async (base64: string, mimeType: string) => {
    setIsScanning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await api.scanMedicalReport({ imageBase64: base64, mimeType });
      setScanResult(res.analysis);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) { Alert.alert("AI Error", (err instanceof Error ? err.message : "Report analysis failed.")); }
    setIsScanning(false); setSelectedScanImage(null);
  };

  const activeCount = schedules.filter((s) => s.isActive).length;

  return (
    <View style={s.root}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: DS.color.bgSoft }]} />

      {/* ── Glass Header ── */}
      <View style={[s.headerWrap, { paddingTop: topPad }]}>
        {Platform.OS === "ios"
          ? <BlurView intensity={80} tint="extraLight" style={StyleSheet.absoluteFill} />
          : <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(255,255,255,0.96)" }]} />
        }
        <View style={s.headerRow}>
          <View>
            <Text style={s.title}>Medicine 💊</Text>
            <Text style={s.subtitle}>
              {activeCount} active · {notifPermission ? "🔔 Reminders ON" : Platform.OS === "web" ? "💻 Web mode" : "🔕 Reminders OFF"}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setShowModal(true)} activeOpacity={0.85} style={s.addBtn}>
            <Plus size={22} color="#FFF" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Notification Banner ── */}
      {!notifPermission && Platform.OS !== "web" && schedules.length > 0 && (
        <TouchableOpacity
          onPress={async () => {
            const granted = await requestNotificationPermissions();
            setNotifPermission(granted);
            if (granted) {
              for (const med of schedules) {
                await scheduleMedicineReminders({ medicineId: `medicine_${med.id}`, medicineName: med.medicineName, dosage: med.dosage, times: med.reminderTimes, mealTiming: med.mealTiming });
              }
            }
          }}
          style={s.notifBanner}
          activeOpacity={0.85}
        >
          <Ionicons name="notifications-off-outline" size={18} color={DS.color.orange} />
          <View style={{ flex: 1 }}>
            <Text style={s.notifTitle}>Reminders are off</Text>
            <Text style={s.notifSub}>Tap to allow notifications</Text>
          </View>
          <ChevronRight size={16} color={DS.color.orange} strokeWidth={2} />
        </TouchableOpacity>
      )}

      {/* ── AI Report Scanner Banner ── */}
      <TouchableOpacity
        onPress={() => { setScanResult(null); setSelectedImage(null); setShowScanModal(true); }}
        activeOpacity={0.85}
        style={{ marginHorizontal: 16, marginBottom: 12 }}
      >
        <LinearGradient colors={[PUR, P]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.scanBanner}>
          <View style={s.scanBannerIcon}>
            <ScanLine size={24} color="#FFF" strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.scanBannerTitle}>Medical Report Scan 🔬</Text>
            <Text style={s.scanBannerSub}>Analyse blood test, thyroid & more with AI</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
        </LinearGradient>
      </TouchableOpacity>

      {/* ── Schedule List ── */}
      {isLoading ? (
        <ActivityIndicator color={P} size="large" style={{ marginTop: 40 }} />
      ) : schedules.length === 0 ? (
        <View style={s.empty}>
          <View style={[s.emptyIcon, { backgroundColor: DS.color.purpleSoft }]}>
            <Pill size={42} color={PUR} strokeWidth={1.5} />
          </View>
          <Text style={s.emptyTitle}>No medicine schedule added</Text>
          <Text style={s.emptySub}>Add your medicines and set daily reminders</Text>
          <TouchableOpacity onPress={() => setShowModal(true)} activeOpacity={0.85}>
            <LinearGradient colors={[PUR, P]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.emptyBtn}>
              <Pill size={18} color="#FFF" strokeWidth={2} />
              <Text style={s.emptyBtnText}>Add Medicine</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView ref={scrollRef} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 90 }} showsVerticalScrollIndicator={false}>
          {schedules.map((med) => {
            const timing = MEAL_TIMING[med.mealTiming] || MEAL_TIMING.anytime;
            return (
              <View key={med.id} style={s.medCard}>
                <View style={[s.medIcon, { backgroundColor: DS.color.purpleSoft }]}>
                  <Pill size={22} color={PUR} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.medName}>{med.medicineName}</Text>
                  {med.dosage ? <Text style={s.medDosage}>{med.dosage}</Text> : null}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                    <Ionicons name={timing.icon} size={12} color={timing.color} />
                    <Text style={s.medTiming}>{timing.label} · {med.reminderTimes.join(", ")}</Text>
                  </View>
                </View>
                <View style={[s.statusBadge, { backgroundColor: med.isActive ? DS.color.greenSoft : DS.color.bgSoft }]}>
                  <View style={[s.statusDot, { backgroundColor: med.isActive ? G : DS.color.muted }]} />
                  <Text style={[s.statusText, { color: med.isActive ? G : DS.color.muted }]}>
                    {med.isActive ? "Active" : "Paused"}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleDelete(med)}
                  activeOpacity={0.7}
                  style={s.deleteBtn}
                >
                  <Trash2 size={15} color={DS.color.red} strokeWidth={2} />
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ════════════════════════════════════════════════ */}
      {/* Medical Report Scanner Modal                    */}
      {/* ════════════════════════════════════════════════ */}
      <Modal visible={showScanModal} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modalRoot}>
          <View style={s.modalHeader}>
            <View>
              <Text style={s.modalTitle}>Medical Report Scan 🔬</Text>
              <Text style={s.modalSub}>AI instant analysis</Text>
            </View>
            <TouchableOpacity onPress={() => { setShowScanModal(false); setSelectedImage(null); setScanResult(null); }} style={s.closeBtn}>
              <X size={20} color={DS.color.text} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
            {!selectedImage && !isScanning && (
              <>
                <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
                  <TouchableOpacity onPress={() => pickImage(true)} activeOpacity={0.85} style={{ flex: 1 }}>
                    <LinearGradient colors={[PUR, P]} style={s.sourceBtn}>
                      <Camera size={28} color="#FFF" strokeWidth={2} />
                      <Text style={s.sourceBtnTitle}>Camera</Text>
                      <Text style={s.sourceBtnSub}>Take a photo now</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => pickImage(false)} activeOpacity={0.85} style={{ flex: 1 }}>
                    <LinearGradient colors={[P, G]} style={s.sourceBtn}>
                      <ImageIcon size={28} color="#FFF" strokeWidth={2} />
                      <Text style={s.sourceBtnTitle}>Gallery</Text>
                      <Text style={s.sourceBtnSub}>Select from photos</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
                <View style={s.tipsCard}>
                  <Text style={s.tipsTitle}>For best results:</Text>
                  {["Report should be clear and readable", "Entire report must be visible", "Take photo in good lighting", "Works for blood test, thyroid, lipid panel and more"].map((tip, i) => (
                    <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 }}>
                      <LinearGradient colors={[PUR, P]} style={{ width: 6, height: 6, borderRadius: 3 }} />
                      <Text style={s.tipText}>{tip}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {selectedImage && (
              <View style={{ borderRadius: 16, overflow: "hidden", marginBottom: 16 }}>
                <Image source={{ uri: selectedImage }} style={{ width: "100%", height: 220 }} resizeMode="contain" />
                {!isScanning && !scanResult && (
                  <TouchableOpacity onPress={() => { setSelectedImage(null); setScanResult(null); }} style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 12, justifyContent: "center", backgroundColor: DS.color.bgSoft }}>
                    <Ionicons name="refresh-outline" size={16} color={DS.color.text} />
                    <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: DS.color.text }}>Try again</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {isScanning && (
              <View style={[s.tipsCard, { alignItems: "center", paddingVertical: 28 }]}>
                <View style={[s.medIcon, { width: 70, height: 70, borderRadius: 35, backgroundColor: DS.color.purpleSoft }]}>
                  <ScanLine size={32} color={PUR} strokeWidth={2} />
                </View>
                <Text style={[s.tipsTitle, { textAlign: "center", marginBottom: 8 }]}>AI is analysing your report...</Text>
                <ActivityIndicator color={PUR} size="large" />
                <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: DS.color.muted, textAlign: "center", marginTop: 8 }}>Checking values against normal ranges...</Text>
              </View>
            )}

            {scanResult && !isScanning && (
              <>
                {/* Report header */}
                <View style={s.resultCard}>
                  <View style={{ flexDirection: "row", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                    <LinearGradient colors={[PUR, P]} style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 }}>
                      <FileText size={14} color="#FFF" strokeWidth={2} />
                      <Text style={{ color: "#FFF", fontSize: 12, fontFamily: "Inter_600SemiBold" }}>{scanResult.reportType?.replace(/_/g, " ").toUpperCase()}</Text>
                    </LinearGradient>
                    {scanResult.urgencyLevel && (
                      <View style={[s.urgencyBadge, { backgroundColor: scanResult.urgencyLevel === "emergency" ? DS.color.redSoft : scanResult.urgencyLevel === "urgent" ? DS.color.orangeSoft : DS.color.greenSoft }]}>
                        <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: scanResult.urgencyLevel === "emergency" ? DS.color.red : scanResult.urgencyLevel === "urgent" ? DS.color.orange : G }}>
                          {scanResult.urgencyLevel.toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>
                  {scanResult.labName && <Text style={s.reportMeta}>🏥 {scanResult.labName}</Text>}
                  {scanResult.reportDate && <Text style={s.reportMeta}>📅 {scanResult.reportDate}</Text>}
                  {scanResult.overallAssessment && <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: DS.color.text, lineHeight: 20, marginTop: 8 }}>{scanResult.overallAssessment}</Text>}
                </View>

                {/* Critical values */}
                {scanResult.criticalValues && scanResult.criticalValues.length > 0 && (
                  <View style={[s.resultCard, { borderLeftWidth: 4, borderLeftColor: DS.color.red }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <AlertTriangle size={18} color={DS.color.red} strokeWidth={2} />
                      <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: DS.color.red }}>Critical Values — Consult a Doctor</Text>
                    </View>
                    {scanResult.criticalValues.map((cv, i) => (
                      <View key={i} style={{ backgroundColor: DS.color.redSoft, borderRadius: 10, padding: 10, marginTop: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: DS.color.text }}>{cv.testName}</Text>
                        <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: DS.color.red }}>{cv.value}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Findings */}
                <Text style={s.sectionHeading}>Test Results</Text>
                {scanResult.findings?.map((f, i) => {
                  const cfg = STATUS_CONFIG[f.status] || STATUS_CONFIG.normal;
                  return (
                    <View key={i} style={[s.findingCard, { borderLeftColor: cfg.color }]}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                        <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: DS.color.text, flex: 1 }}>{f.testName}</Text>
                        <View style={[s.statusBadge, { backgroundColor: cfg.bg }]}>
                          <Text style={{ color: cfg.color, fontSize: 11, fontFamily: "Inter_600SemiBold" }}>{f.status.replace(/_/g, " ").toUpperCase()}</Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
                        <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: cfg.color }}>{f.value}</Text>
                        <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: DS.color.muted }}>Normal: {f.normalRange}</Text>
                      </View>
                      {f.interpretation && <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: DS.color.muted, lineHeight: 17 }}>{f.interpretation}</Text>}
                    </View>
                  );
                })}

                {/* AI Advice */}
                {scanResult.aiAdvice && (
                  <View style={s.resultCard}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <View style={[s.medIcon, { width: 30, height: 30, borderRadius: 9, backgroundColor: DS.color.purpleSoft }]}>
                        <Sparkles size={14} color={PUR} strokeWidth={2} />
                      </View>
                      <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: DS.color.text }}>AI Health Advice</Text>
                    </View>
                    <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: DS.color.textSub, lineHeight: 20 }}>{scanResult.aiAdvice}</Text>
                  </View>
                )}

                {/* Diet Recommendations */}
                {scanResult.dietRecommendations && scanResult.dietRecommendations.length > 0 && (
                  <View style={s.resultCard}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <View style={[s.medIcon, { width: 30, height: 30, borderRadius: 9, backgroundColor: DS.color.greenSoft }]}>
                        <Ionicons name="restaurant-outline" size={14} color={G} />
                      </View>
                      <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: DS.color.text }}>Diet Recommendations</Text>
                    </View>
                    {scanResult.dietRecommendations.map((tip, i) => (
                      <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 8 }}>
                        <LinearGradient colors={[G, P]} style={{ width: 6, height: 6, borderRadius: 3, marginTop: 6 }} />
                        <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: DS.color.textSub, flex: 1, lineHeight: 18 }}>{tip}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* PDF Export */}
                <TouchableOpacity onPress={async () => { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); await exportMedicalReportPDF(scanResult); } catch { Alert.alert("Error", "Could not export PDF."); } }} activeOpacity={0.85} style={{ marginBottom: 10 }}>
                  <LinearGradient colors={[P, G]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.pdfBtn}>
                    <FileText size={18} color="#FFF" strokeWidth={2} />
                    <Text style={s.pdfBtnText}>PDF Report Download / Share</Text>
                  </LinearGradient>
                </TouchableOpacity>

                {/* Retry */}
                <TouchableOpacity onPress={() => { setSelectedImage(null); setScanResult(null); }} style={s.retryBtn}>
                  <Camera size={18} color={DS.color.muted} strokeWidth={2} />
                  <Text style={s.retryText}>Scan another report</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* ════════════════════════════════════════════════ */}
      {/* Add Medicine Modal                              */}
      {/* ════════════════════════════════════════════════ */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modalRoot}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Add Medicine 💊</Text>
            <TouchableOpacity onPress={() => { setShowModal(false); setMedicineName(""); setDosage(""); }} style={s.closeBtn}>
              <X size={20} color={DS.color.text} strokeWidth={2} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
            <Text style={s.inputLabel}>Medicine Name *</Text>
            <TextInput style={s.input} placeholder="e.g. Metformin, Vitamin D" placeholderTextColor={DS.color.muted} value={medicineName} onChangeText={setMedicineName} autoFocus />

            <Text style={s.inputLabel}>Dosage</Text>
            <TextInput style={s.input} placeholder="e.g. 500mg, 1 tablet" placeholderTextColor={DS.color.muted} value={dosage} onChangeText={setDosage} />

            <Text style={s.inputLabel}>When to Take</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
              {Object.entries(MEAL_TIMING).map(([k, v]) => (
                <TouchableOpacity key={k} onPress={() => setMealTiming(k)} activeOpacity={0.8} style={{ borderRadius: 14, overflow: "hidden" }}>
                  {mealTiming === k ? (
                    <LinearGradient colors={[PUR, P]} style={s.timingChip}>
                      <Ionicons name={v.icon} size={14} color="#FFF" />
                      <Text style={[s.timingText, { color: "#FFF" }]}>{v.label}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={[s.timingChip, s.timingChipOff]}>
                      <Ionicons name={v.icon} size={14} color={v.color} />
                      <Text style={[s.timingText, { color: DS.color.text }]}>{v.label}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.inputLabel}>Reminder Time</Text>
            <TextInput style={s.input} placeholder="08:00" placeholderTextColor={DS.color.muted} value={reminderTime} onChangeText={setReminderTime} />

            <TouchableOpacity onPress={handleAdd} disabled={isSubmitting} activeOpacity={0.85}>
              <LinearGradient colors={[PUR, P]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.saveBtn}>
                {isSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={s.saveBtnText}>Save Schedule ✓</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },

  headerWrap: {
    overflow: "hidden", marginBottom: 12,
    borderBottomWidth: 0.5, borderBottomColor: "rgba(0,0,0,0.07)",
    ...Platform.select({ ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8 }, android: { elevation: 4 }, default: {} }),
  },
  headerRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8 },
  title:       { fontSize: 22, fontFamily: "Inter_700Bold", color: DS.color.text },
  subtitle:    { fontSize: 11, fontFamily: "Inter_400Regular", color: DS.color.muted, marginTop: 2 },
  addBtn:      { width: 42, height: 42, borderRadius: 21, backgroundColor: P, alignItems: "center", justifyContent: "center", ...DS.shadow.md },

  notifBanner:  { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginBottom: 12, backgroundColor: DS.color.orangeSoft, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: DS.color.orange + "30" },
  notifTitle:   { fontSize: 13, fontFamily: "Inter_600SemiBold", color: DS.color.orange },
  notifSub:     { fontSize: 11, fontFamily: "Inter_400Regular", color: DS.color.muted },

  scanBanner:     { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 18, gap: 14, ...DS.shadow.md },
  scanBannerIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  scanBannerTitle:{ color: "#FFF", fontSize: 16, fontFamily: "Inter_700Bold" },
  scanBannerSub:  { color: "rgba(255,255,255,0.65)", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },

  empty:      { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, paddingHorizontal: 40 },
  emptyIcon:  { width: 90, height: 90, borderRadius: 45, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: DS.color.text, textAlign: "center" },
  emptySub:   { fontSize: 14, fontFamily: "Inter_400Regular", color: DS.color.muted, textAlign: "center" },
  emptyBtn:   { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16, ...DS.shadow.md },
  emptyBtnText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_600SemiBold" },

  medCard:   { backgroundColor: "#FFF", borderRadius: DS.radius.lg, padding: 16, flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 12, borderWidth: 1, borderColor: DS.color.border, ...DS.shadow.sm },
  medIcon:   { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  medName:   { fontSize: 16, fontFamily: "Inter_600SemiBold", color: DS.color.text, marginBottom: 4 },
  medDosage: { fontSize: 13, fontFamily: "Inter_400Regular", color: DS.color.muted, marginBottom: 2 },
  medTiming: { fontSize: 12, fontFamily: "Inter_400Regular", color: DS.color.muted },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 5 },
  statusDot:   { width: 6, height: 6, borderRadius: 3 },
  statusText:  { fontSize: 12, fontFamily: "Inter_500Medium" },
  deleteBtn:   { width: 32, height: 32, borderRadius: 10, backgroundColor: DS.color.redSoft, alignItems: "center", justifyContent: "center", marginLeft: 6 },

  modalRoot:   { flex: 1, backgroundColor: "#FFF" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 20, paddingTop: 56, borderBottomWidth: 1, borderBottomColor: DS.color.borderLight },
  modalTitle:  { fontSize: 20, fontFamily: "Inter_700Bold", color: DS.color.text },
  modalSub:    { fontSize: 13, fontFamily: "Inter_400Regular", color: DS.color.muted, marginTop: 2 },
  closeBtn:    { width: 34, height: 34, borderRadius: 17, backgroundColor: DS.color.bgSoft, alignItems: "center", justifyContent: "center" },

  sourceBtn:      { padding: 20, borderRadius: 18, alignItems: "center", gap: 8, ...DS.shadow.sm },
  sourceBtnTitle: { color: "#FFF", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  sourceBtnSub:   { color: "rgba(255,255,255,0.65)", fontSize: 12, fontFamily: "Inter_400Regular" },

  tipsCard:  { backgroundColor: "#FFF", borderRadius: DS.radius.lg, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: DS.color.border, ...DS.shadow.sm },
  tipsTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: DS.color.text, marginBottom: 4 },
  tipText:   { fontSize: 13, fontFamily: "Inter_400Regular", color: DS.color.muted, flex: 1 },

  resultCard:    { backgroundColor: "#FFF", borderRadius: DS.radius.lg, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: DS.color.border, borderLeftWidth: 0, ...DS.shadow.sm },
  sectionHeading:{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: DS.color.muted, marginBottom: 10, marginTop: 4, letterSpacing: 0.5 },
  urgencyBadge:  { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  reportMeta:    { fontSize: 13, fontFamily: "Inter_400Regular", color: DS.color.muted, marginBottom: 4 },
  findingCard:   { backgroundColor: "#FFF", borderRadius: DS.radius.lg, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: DS.color.border, borderLeftWidth: 4, ...DS.shadow.sm },

  pdfBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 14 },
  pdfBtnText:{ color: "#FFF", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  retryBtn:  { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: DS.color.border, backgroundColor: DS.color.bgSoft },
  retryText: { fontSize: 14, fontFamily: "Inter_400Regular", color: DS.color.muted },

  inputLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: DS.color.text, marginBottom: 10 },
  input: { borderWidth: 1, borderRadius: 14, height: 52, paddingHorizontal: 16, fontSize: 16, fontFamily: "Inter_400Regular", backgroundColor: DS.color.bgSoft, borderColor: DS.color.border, color: DS.color.text, marginBottom: 20 },
  timingChip:    { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 14 },
  timingChipOff: { backgroundColor: DS.color.bgSoft, borderWidth: 1, borderColor: DS.color.border },
  timingText:    { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  saveBtn:       { height: 56, alignItems: "center", justifyContent: "center", borderRadius: 16 },
  saveBtnText:   { color: "#FFF", fontSize: 17, fontFamily: "Inter_700Bold" },
});
