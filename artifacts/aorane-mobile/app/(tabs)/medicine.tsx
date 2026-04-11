import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, TextInput,
  Alert, ActivityIndicator, Platform, useColorScheme, Dimensions, Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { router, useFocusEffect } from "expo-router";
import { api } from "@/lib/api";
import {
  scheduleMedicineReminders,
  requestNotificationPermissions,
  checkNotificationPermissions,
} from "@/lib/notifications";
import { exportMedicalReportPDF } from "@/lib/pdf";

const { width: W } = Dimensions.get("window");

type Schedule = { id: string; medicineName: string; dosage?: string; mealTiming: string; reminderTimes: string[]; isActive: boolean; };
type ReportFinding = { testName: string; value: string; normalRange: string; status: string; interpretation: string; };
type ScanAnalysis = {
  reportType: string; reportDate?: string; labName?: string;
  findings: ReportFinding[];
  criticalValues?: Array<{ testName: string; value: string; urgency: string }>;
  overallAssessment?: string; aiAdvice?: string;
  dietRecommendations?: string[]; urgencyLevel?: string;
};

const MEAL_TIMING: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  before_meal: { label: "Before meal", icon: "arrow-back-circle-outline", color: "#F59E0B" },
  after_meal:  { label: "After meal",  icon: "arrow-forward-circle-outline", color: "#10B981" },
  with_meal:   { label: "With meal",   icon: "restaurant-outline",           color: "#0EA5E9" },
  anytime:     { label: "Anytime",     icon: "time-outline",                 color: "#8B5CF6" },
};

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  normal:        { color: "#10B981", bg: "rgba(16,185,129,0.12)",  icon: "checkmark-circle-outline" },
  high:          { color: "#EF4444", bg: "rgba(239,68,68,0.12)",   icon: "arrow-up-circle-outline" },
  low:           { color: "#F59E0B", bg: "rgba(245,158,11,0.12)",  icon: "arrow-down-circle-outline" },
  critical_high: { color: "#DC2626", bg: "rgba(220,38,38,0.18)",   icon: "warning-outline" },
  critical_low:  { color: "#B45309", bg: "rgba(180,83,9,0.18)",    icon: "warning-outline" },
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
  const [notifPermission, setNotifPermission] = useState<boolean>(false);

  // Medical Report Scanner state
  const [showScanModal, setShowScanModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanAnalysis | null>(null);

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
    try {
      await api.createMedicineSchedule({
        medicineName: savedName,
        dosage,
        mealTiming,
        reminderTimes: [reminderTime],
        startDate: new Date().toISOString().slice(0, 10),
        frequency: "daily",
      });
      setShowModal(false); setMedicineName(""); setDosage("");
      await loadSchedules();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Schedule local notification reminder
      if (Platform.OS !== "web") {
        const granted = await requestNotificationPermissions();
        if (granted) {
          await scheduleMedicineReminders({
            medicineId: `medicine_${savedName.toLowerCase().replace(/\s+/g, "_")}`,
            medicineName: savedName,
            dosage,
            times: [reminderTime],
            mealTiming,
          });
          setNotifPermission(true);
          Alert.alert("✅ Reminder Set!", `Daily reminder set for ${savedName} at ${reminderTime}`, [{
            text: "OK", onPress: () => { setShowModal(false); loadSchedules(); },
          }]);
          setIsSubmitting(false);
          return;
        }
      }
      setShowModal(false); loadSchedules();
    } catch { Alert.alert("Error", "Could not save medicine schedule. Please try again."); }
    setIsSubmitting(false);
  };

  // Scroll ref + focus refresh
  const scrollRef = useRef<ScrollView>(null);
  useFocusEffect(
    useCallback(() => {
      loadSchedules();
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, [])
  );

  // ── Medical Report Scanner ─────────────────────────────
  const pickImage = async (fromCamera: boolean) => {
    try {
      let result;
      if (fromCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Alert.alert("Permission", "Camera permission is required"); return; }
        result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8, base64: true });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { Alert.alert("Permission", "Gallery permission is required"); return; }
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8, base64: true });
      }
      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
        setScanResult(null);
        if (result.assets[0].base64) {
          await analyseReport(result.assets[0].base64, result.assets[0].mimeType || "image/jpeg");
        }
      }
    } catch { Alert.alert("Error", "Could not select image. Please try again."); }
  };

  const analyseReport = async (base64: string, mimeType: string) => {
    setIsScanning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await api.scanMedicalReport({ imageBase64: base64, mimeType });
      setScanResult(res.analysis);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch { Alert.alert("AI Error", "Report analysis failed. Please ensure the image is clear and try again."); }
    setIsScanning(false);
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

      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <View>
          <Text style={[styles.title, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>Medicine 💊</Text>
          <Text style={[styles.subtitle, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular" }]}>
            {activeCount} active · {notifPermission ? "🔔 Reminders ON" : Platform.OS === "web" ? "💻 Web mode" : "🔕 Reminders OFF"}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setShowModal(true)} activeOpacity={0.85}>
          <LinearGradient colors={["#7C3AED","#0077B6"]} style={styles.addBtn}>
            <Ionicons name="add" size={22} color="#FFF" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Notification permission banner */}
      {!notifPermission && Platform.OS !== "web" && schedules.length > 0 && (
        <TouchableOpacity
          onPress={async () => {
            const granted = await requestNotificationPermissions();
            setNotifPermission(granted);
            if (granted) {
              for (const s of schedules) {
                await scheduleMedicineReminders({
                  medicineId: `medicine_${s.id}`,
                  medicineName: s.medicineName,
                  dosage: s.dosage,
                  times: s.reminderTimes,
                  mealTiming: s.mealTiming,
                });
              }
            }
          }}
          activeOpacity={0.85}
          style={{ marginHorizontal: 18, marginBottom: 12 }}
        >
          <LinearGradient colors={["rgba(245,158,11,0.15)","rgba(239,68,68,0.1)"]} style={{ borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: "rgba(245,158,11,0.3)" }}>
            <Ionicons name="notifications-off-outline" size={18} color="#F59E0B" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: isDark ? "#FBBF24" : "#B45309", fontSize: 13, fontFamily: "Inter_600SemiBold" }}>Reminders are off</Text>
              <Text style={{ color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontSize: 11, fontFamily: "Inter_400Regular" }}>Tap to allow notifications</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#F59E0B" />
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* AI Report Scanner Card */}
      <TouchableOpacity onPress={() => { setScanResult(null); setSelectedImage(null); setShowScanModal(true); }} activeOpacity={0.85} style={{ marginHorizontal: 18, marginBottom: 16 }}>
        <LinearGradient colors={["#7C3AED","#4F46E5","#0077B6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.scanBanner}>
          <View style={styles.scanBannerLeft}>
            <View style={styles.scanIconBg}>
              <Ionicons name="scan-outline" size={26} color="#FFF" />
            </View>
            <View>
              <Text style={[styles.scanBannerTitle, { fontFamily: "Inter_700Bold" }]}>Medical Report Scan</Text>
              <Text style={[styles.scanBannerSub, { fontFamily: "Inter_400Regular" }]}>Analyse blood test, thyroid & other reports with AI</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
        </LinearGradient>
      </TouchableOpacity>

      {isLoading ? (
        <View style={styles.loadingWrap}><ActivityIndicator color={isDark ? "#38BDF8" : "#0077B6"} size="large" /></View>
      ) : schedules.length === 0 ? (
        <View style={styles.emptyWrap}>
          <LinearGradient colors={["rgba(124,58,237,0.25)","rgba(0,119,182,0.15)"]} style={styles.emptyIconBg}>
            <Ionicons name="medkit-outline" size={44} color={isDark ? "#A78BFA" : "#7C3AED"} />
          </LinearGradient>
          <Text style={[styles.emptyTitle, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>No medicine schedule added</Text>
          <Text style={[styles.emptyText, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular", textAlign: "center" }]}>
            Add your medicines and set daily reminders
          </Text>
          <TouchableOpacity onPress={() => setShowModal(true)} activeOpacity={0.85}>
            <LinearGradient colors={["#7C3AED","#0077B6"]} style={styles.emptyBtn}>
              <Ionicons name="add-circle-outline" size={18} color="#FFF" />
              <Text style={[styles.emptyBtnText, { fontFamily: "Inter_600SemiBold" }]}>Medicine Add Karein</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView ref={scrollRef} contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 90 }} showsVerticalScrollIndicator={false}>
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

      {/* ═══════════════════════════════════════════════════ */}
      {/* Medical Report Scanner Modal */}
      {/* ═══════════════════════════════════════════════════ */}
      <Modal visible={showScanModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalRoot}>
          <LinearGradient colors={isDark ? ["#010814","#031628","#051E30"] : ["#C8E9FA","#D9F4EE","#E8F4FF"]} style={StyleSheet.absoluteFill} />
          <View style={[styles.orb1, { backgroundColor: isDark ? "#4C1D95" : "#DDD6FE", opacity: 0.35 }]} />

          <View style={[styles.modalHeader, { borderBottomColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,119,182,0.1)" }]}>
            <View>
              <Text style={[styles.modalTitle, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>Medical Report Scan 🔬</Text>
              <Text style={[styles.modalSub, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular" }]}>AI se instant analysis</Text>
            </View>
            <TouchableOpacity onPress={() => { setShowScanModal(false); setSelectedImage(null); setScanResult(null); }}
              style={[styles.closeBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.07)" }]}>
              <Ionicons name="close" size={20} color={isDark ? "#F0F8FF" : "#0A1628"} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>

            {/* Source picker */}
            {!selectedImage && !isScanning && (
              <>
                <View style={styles.sourceRow}>
                  <TouchableOpacity onPress={() => pickImage(true)} activeOpacity={0.85} style={{ flex: 1 }}>
                    <LinearGradient colors={["#7C3AED","#4F46E5"]} style={styles.sourceBtn}>
                      <Ionicons name="camera-outline" size={28} color="#FFF" />
                      <Text style={[styles.sourceBtnText, { fontFamily: "Inter_600SemiBold" }]}>Camera</Text>
                      <Text style={[styles.sourceBtnSub, { fontFamily: "Inter_400Regular" }]}>Take a photo now</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => pickImage(false)} activeOpacity={0.85} style={{ flex: 1 }}>
                    <LinearGradient colors={["#0077B6","#1B998B"]} style={styles.sourceBtn}>
                      <Ionicons name="images-outline" size={28} color="#FFF" />
                      <Text style={[styles.sourceBtnText, { fontFamily: "Inter_600SemiBold" }]}>Gallery</Text>
                      <Text style={[styles.sourceBtnSub, { fontFamily: "Inter_400Regular" }]}>Photo chunein</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>

                <GlassCard>
                  <View style={styles.tipsCard}>
                    <Text style={[styles.tipsTitle, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>For best results:</Text>
                    {["Report should be clear and readable", "Entire report must be visible", "Take photo in good lighting", "Works for blood test, thyroid, lipid panel and more"].map((tip, i) => (
                      <View key={i} style={styles.tipRow}>
                        <LinearGradient colors={["#7C3AED","#0077B6"]} style={styles.tipDot} />
                        <Text style={[styles.tipText, { color: isDark ? "rgba(255,255,255,0.55)" : "rgba(10,22,40,0.6)", fontFamily: "Inter_400Regular" }]}>{tip}</Text>
                      </View>
                    ))}
                  </View>
                </GlassCard>
              </>
            )}

            {/* Image preview */}
            {selectedImage && (
              <View style={styles.imagePreviewWrap}>
                <Image source={{ uri: selectedImage }} style={styles.imagePreview} resizeMode="contain" />
                {!isScanning && !scanResult && (
                  <TouchableOpacity onPress={() => { setSelectedImage(null); setScanResult(null); }} style={[styles.changePhotoBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)" }]}>
                    <Ionicons name="refresh-outline" size={16} color={isDark ? "#F0F8FF" : "#0A1628"} />
                    <Text style={[styles.changePhotoText, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_500Medium" }]}>Try again</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Scanning */}
            {isScanning && (
              <GlassCard style={{ marginTop: 16 }}>
                <View style={styles.scanningCard}>
                  <LinearGradient colors={["rgba(124,58,237,0.25)","rgba(0,119,182,0.15)"]} style={styles.scanningIconBg}>
                    <Ionicons name="scan-outline" size={32} color={isDark ? "#A78BFA" : "#7C3AED"} />
                  </LinearGradient>
                  <Text style={[styles.scanningTitle, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>AI is analysing your report...</Text>
                  <ActivityIndicator color={isDark ? "#A78BFA" : "#7C3AED"} size="large" style={{ marginTop: 8 }} />
                  <Text style={[styles.scanningText, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular" }]}>
                    Checking values and comparing against normal ranges...
                  </Text>
                </View>
              </GlassCard>
            )}

            {/* Results */}
            {scanResult && !isScanning && (
              <>
                {/* Report Header */}
                <GlassCard style={{ marginBottom: 14 }}>
                  <View style={{ padding: 16 }}>
                    <View style={styles.reportHeaderRow}>
                      <LinearGradient colors={["#7C3AED","#0077B6"]} style={styles.reportTypeBadge}>
                        <Ionicons name="document-text-outline" size={14} color="#FFF" />
                        <Text style={[styles.reportTypeText, { fontFamily: "Inter_600SemiBold" }]}>{scanResult.reportType?.replace(/_/g, " ").toUpperCase()}</Text>
                      </LinearGradient>
                      {scanResult.urgencyLevel && (
                        <View style={[styles.urgencyBadge, { backgroundColor: scanResult.urgencyLevel === "emergency" ? "rgba(220,38,38,0.2)" : scanResult.urgencyLevel === "urgent" ? "rgba(245,158,11,0.2)" : "rgba(16,185,129,0.15)" }]}>
                          <Text style={[styles.urgencyText, { color: scanResult.urgencyLevel === "emergency" ? "#DC2626" : scanResult.urgencyLevel === "urgent" ? "#F59E0B" : "#10B981", fontFamily: "Inter_600SemiBold" }]}>
                            {scanResult.urgencyLevel?.toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </View>
                    {scanResult.labName && <Text style={[styles.labName, { color: isDark ? "rgba(255,255,255,0.55)" : "rgba(10,22,40,0.55)", fontFamily: "Inter_400Regular" }]}>🏥 {scanResult.labName}</Text>}
                    {scanResult.reportDate && <Text style={[styles.reportDate, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular" }]}>📅 {scanResult.reportDate}</Text>}
                    {scanResult.overallAssessment && (
                      <Text style={[styles.assessment, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_400Regular" }]}>{scanResult.overallAssessment}</Text>
                    )}
                  </View>
                </GlassCard>

                {/* Critical Values Alert */}
                {scanResult.criticalValues && scanResult.criticalValues.length > 0 && (
                  <GlassCard style={{ marginBottom: 14 }}>
                    <View style={{ padding: 16 }}>
                      <View style={styles.criticalHeader}>
                        <Ionicons name="warning" size={18} color="#DC2626" />
                        <Text style={[styles.criticalTitle, { color: "#DC2626", fontFamily: "Inter_700Bold" }]}>Critical Values — Doctor se Milein</Text>
                      </View>
                      {scanResult.criticalValues.map((cv, i) => (
                        <View key={i} style={[styles.criticalRow, { backgroundColor: "rgba(220,38,38,0.1)", borderRadius: 10, padding: 10, marginTop: 8 }]}>
                          <Text style={[styles.criticalTest, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>{cv.testName}</Text>
                          <Text style={[styles.criticalVal, { color: "#DC2626", fontFamily: "Inter_700Bold" }]}>{cv.value}</Text>
                          <View style={[styles.urgencyBadge, { backgroundColor: "rgba(220,38,38,0.15)" }]}>
                            <Text style={[styles.urgencyText, { color: "#DC2626", fontFamily: "Inter_600SemiBold" }]}>{cv.urgency?.toUpperCase()}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </GlassCard>
                )}

                {/* Findings */}
                <Text style={[styles.sectionHeading, { color: isDark ? "rgba(255,255,255,0.6)" : "rgba(10,22,40,0.6)", fontFamily: "Inter_600SemiBold" }]}>Test Results</Text>
                {scanResult.findings?.map((f, i) => {
                  const cfg = STATUS_CONFIG[f.status] || STATUS_CONFIG.normal;
                  return (
                    <GlassCard key={i} style={{ marginBottom: 10 }}>
                      <View style={styles.findingCard}>
                        <View style={[styles.findingStatusBar, { backgroundColor: cfg.color }]} />
                        <View style={{ flex: 1, paddingLeft: 12, paddingVertical: 14, paddingRight: 14 }}>
                          <View style={styles.findingTopRow}>
                            <Text style={[styles.findingName, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_600SemiBold", flex: 1 }]}>{f.testName}</Text>
                            <View style={[styles.findingStatusBadge, { backgroundColor: cfg.bg }]}>
                              <Ionicons name={cfg.icon} size={12} color={cfg.color} />
                              <Text style={[styles.findingStatus, { color: cfg.color, fontFamily: "Inter_600SemiBold" }]}>{f.status?.replace(/_/g, " ").toUpperCase()}</Text>
                            </View>
                          </View>
                          <View style={styles.findingValRow}>
                            <Text style={[styles.findingValue, { color: cfg.color, fontFamily: "Inter_700Bold" }]}>{f.value}</Text>
                            <Text style={[styles.findingRange, { color: isDark ? "rgba(255,255,255,0.35)" : "rgba(10,22,40,0.4)", fontFamily: "Inter_400Regular" }]}>Normal: {f.normalRange}</Text>
                          </View>
                          {f.interpretation && (
                            <Text style={[styles.findingInterp, { color: isDark ? "rgba(255,255,255,0.45)" : "rgba(10,22,40,0.5)", fontFamily: "Inter_400Regular" }]}>{f.interpretation}</Text>
                          )}
                        </View>
                      </View>
                    </GlassCard>
                  );
                })}

                {/* AI Advice */}
                {scanResult.aiAdvice && (
                  <GlassCard style={{ marginTop: 6, marginBottom: 14 }}>
                    <View style={{ padding: 16 }}>
                      <View style={styles.adviceHeader}>
                        <LinearGradient colors={["#7C3AED","#0077B6"]} style={styles.adviceIconBg}>
                          <Ionicons name="sparkles" size={14} color="#FFF" />
                        </LinearGradient>
                        <Text style={[styles.adviceTitle, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>AI Health Advice</Text>
                      </View>
                      <Text style={[styles.adviceText, { color: isDark ? "rgba(255,255,255,0.6)" : "rgba(10,22,40,0.65)", fontFamily: "Inter_400Regular" }]}>{scanResult.aiAdvice}</Text>
                    </View>
                  </GlassCard>
                )}

                {/* Diet Tips */}
                {scanResult.dietRecommendations && scanResult.dietRecommendations.length > 0 && (
                  <GlassCard style={{ marginBottom: 14 }}>
                    <View style={{ padding: 16 }}>
                      <View style={styles.adviceHeader}>
                        <LinearGradient colors={["#10B981","#059669"]} style={styles.adviceIconBg}>
                          <Ionicons name="restaurant-outline" size={14} color="#FFF" />
                        </LinearGradient>
                        <Text style={[styles.adviceTitle, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>Diet Recommendations</Text>
                      </View>
                      {scanResult.dietRecommendations.map((tip, i) => (
                        <View key={i} style={styles.dietTipRow}>
                          <LinearGradient colors={["#10B981","#0077B6"]} style={styles.dietTipDot} />
                          <Text style={[styles.dietTipText, { color: isDark ? "rgba(255,255,255,0.55)" : "rgba(10,22,40,0.65)", fontFamily: "Inter_400Regular" }]}>{tip}</Text>
                        </View>
                      ))}
                    </View>
                  </GlassCard>
                )}

                {/* PDF Export button */}
                <TouchableOpacity
                  onPress={async () => {
                    try {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      await exportMedicalReportPDF(scanResult);
                    } catch {
                      Alert.alert("Error", "Could not export PDF. Please try again.");
                    }
                  }}
                  activeOpacity={0.85}
                  style={{ marginBottom: 10 }}
                >
                  <LinearGradient colors={["#0077B6","#1B998B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.retryWrap, { borderWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }]}>
                    <Ionicons name="document-text-outline" size={18} color="#FFF" />
                    <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>PDF Report Download / Share</Text>
                  </LinearGradient>
                </TouchableOpacity>

                {/* Retry button */}
                <TouchableOpacity onPress={() => { setSelectedImage(null); setScanResult(null); }} style={[styles.retryWrap, { backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)", borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)" }]}>
                  <Ionicons name="camera-outline" size={18} color={isDark ? "rgba(255,255,255,0.5)" : "rgba(10,22,40,0.5)"} />
                  <Text style={[styles.retryText, { color: isDark ? "rgba(255,255,255,0.5)" : "rgba(10,22,40,0.5)", fontFamily: "Inter_400Regular" }]}>Scan another report</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════ */}
      {/* Add Medicine Modal */}
      {/* ═══════════════════════════════════════════════════ */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalRoot}>
          <LinearGradient colors={isDark ? ["#010814","#031628","#051E30"] : ["#C8E9FA","#D9F4EE","#E8F4FF"]} style={StyleSheet.absoluteFill} />
          <View style={[styles.modalHeader, { borderBottomColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,119,182,0.1)" }]}>
            <Text style={[styles.modalTitle, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>Medicine Add Karein 💊</Text>
            <TouchableOpacity onPress={() => { setShowModal(false); setMedicineName(""); setDosage(""); }}
              style={[styles.closeBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.07)" }]}>
              <Ionicons name="close" size={20} color={isDark ? "#F0F8FF" : "#0A1628"} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
            <Text style={[styles.modalLabel, { color: isDark ? "rgba(255,255,255,0.7)" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>Medicine ka naam *</Text>
            <TextInput style={[styles.input, { backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.8)", borderColor: isDark ? "rgba(255,255,255,0.14)" : "rgba(0,119,182,0.2)", color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_400Regular" }]}
              placeholder="e.g. Metformin, Vitamin D" placeholderTextColor={isDark ? "rgba(255,255,255,0.3)" : "rgba(10,22,40,0.35)"}
              value={medicineName} onChangeText={setMedicineName} autoFocus />

            <Text style={[styles.modalLabel, { color: isDark ? "rgba(255,255,255,0.7)" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>Dosage</Text>
            <TextInput style={[styles.input, { backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.8)", borderColor: isDark ? "rgba(255,255,255,0.14)" : "rgba(0,119,182,0.2)", color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_400Regular" }]}
              placeholder="e.g. 500mg, 1 tablet" placeholderTextColor={isDark ? "rgba(255,255,255,0.3)" : "rgba(10,22,40,0.35)"}
              value={dosage} onChangeText={setDosage} />

            <Text style={[styles.modalLabel, { color: isDark ? "rgba(255,255,255,0.7)" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>When to take</Text>
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
            <TextInput style={[styles.input, { backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.8)", borderColor: isDark ? "rgba(255,255,255,0.14)" : "rgba(0,119,182,0.2)", color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_400Regular" }]}
              placeholder="08:00" placeholderTextColor={isDark ? "rgba(255,255,255,0.3)" : "rgba(10,22,40,0.35)"}
              value={reminderTime} onChangeText={setReminderTime} />

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
  scanBanner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderRadius: 18 },
  scanBannerLeft: { flexDirection: "row", alignItems: "center", gap: 14, flex: 1 },
  scanIconBg: { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  scanBannerTitle: { color: "#FFF", fontSize: 16 },
  scanBannerSub: { color: "rgba(255,255,255,0.65)", fontSize: 12, marginTop: 2 },
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
  // Scanner styles
  modalRoot: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 20, paddingTop: 56, borderBottomWidth: 1 },
  modalTitle: { fontSize: 20 },
  modalSub: { fontSize: 13, marginTop: 2 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  sourceRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  sourceBtn: { padding: 20, borderRadius: 18, alignItems: "center", gap: 8 },
  sourceBtnText: { color: "#FFF", fontSize: 16 },
  sourceBtnSub: { color: "rgba(255,255,255,0.65)", fontSize: 12 },
  tipsCard: { padding: 16, gap: 10 },
  tipsTitle: { fontSize: 15, marginBottom: 4 },
  tipRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  tipDot: { width: 6, height: 6, borderRadius: 3 },
  tipText: { fontSize: 13, flex: 1 },
  imagePreviewWrap: { borderRadius: 16, overflow: "hidden", marginBottom: 16 },
  imagePreview: { width: "100%", height: 220, backgroundColor: "rgba(0,0,0,0.1)" },
  changePhotoBtn: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, justifyContent: "center" },
  changePhotoText: { fontSize: 14 },
  scanningCard: { padding: 24, alignItems: "center", gap: 12 },
  scanningIconBg: { width: 70, height: 70, borderRadius: 35, alignItems: "center", justifyContent: "center" },
  scanningTitle: { fontSize: 17, textAlign: "center" },
  scanningText: { fontSize: 13, textAlign: "center" },
  reportHeaderRow: { flexDirection: "row", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" },
  reportTypeBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  reportTypeText: { color: "#FFF", fontSize: 12 },
  urgencyBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  urgencyText: { fontSize: 11 },
  labName: { fontSize: 13, marginBottom: 4 },
  reportDate: { fontSize: 12, marginBottom: 10 },
  assessment: { fontSize: 14, lineHeight: 20, marginTop: 6 },
  criticalHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  criticalTitle: { fontSize: 16 },
  criticalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  criticalTest: { fontSize: 14 },
  criticalVal: { fontSize: 16 },
  sectionHeading: { fontSize: 14, marginBottom: 10, marginTop: 4 },
  findingCard: { flexDirection: "row" },
  findingStatusBar: { width: 4, borderRadius: 2 },
  findingTopRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 6 },
  findingName: { fontSize: 15 },
  findingStatusBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  findingStatus: { fontSize: 11 },
  findingValRow: { flexDirection: "row", alignItems: "baseline", gap: 10, marginBottom: 6 },
  findingValue: { fontSize: 18 },
  findingRange: { fontSize: 12 },
  findingInterp: { fontSize: 12, lineHeight: 17 },
  adviceHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  adviceIconBg: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  adviceTitle: { fontSize: 16 },
  adviceText: { fontSize: 13, lineHeight: 20 },
  dietTipRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 8 },
  dietTipDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  dietTipText: { fontSize: 13, flex: 1, lineHeight: 18 },
  retryWrap: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 14, borderWidth: 1 },
  retryText: { fontSize: 14 },
  // Add medicine modal
  modalLabel: { fontSize: 14, marginBottom: 10 },
  input: { borderWidth: 1, borderRadius: 14, height: 52, paddingHorizontal: 16, fontSize: 16, marginBottom: 20 },
  timingGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 },
  timingBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 14 },
  timingText: { fontSize: 13 },
  saveBtn: { height: 56, alignItems: "center", justifyContent: "center", borderRadius: 16 },
  saveText: { color: "#FFF", fontSize: 17 },
});
