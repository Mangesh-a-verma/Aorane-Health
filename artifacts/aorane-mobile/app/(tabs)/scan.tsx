import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { api } from "../../lib/api";

const { width } = Dimensions.get("window");
const PRIMARY = "#0077B6";
const ACCENT = "#00B896";
const SKY = "#0EA5E9";

type ScanResult =
  | { type: "food"; foodName: string; confidence: number; calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number; servingSize: string; healthScore: number; tags: string[]; tip: string; ingredients: string[] }
  | { type: "medical_report"; reportType: string; confidence: number; patientName: string | null; date: string | null; summary: string; urgencyLevel: "normal" | "attention" | "urgent"; keyFindings: { parameter: string; value: string; normalRange: string; status: "normal" | "high" | "low" }[]; recommendations: string[]; disclaimer: string }
  | { type: "medicine"; confidence: number; medicineName: string; genericName: string; uses: string; commonDosage: string; sideEffects: string[]; warnings: string[]; disclaimer: string }
  | { type: "unknown"; message: string };

const URGENCY_COLOR = { normal: "#00B896", attention: "#F59E0B", urgent: "#EF4444" };
const STATUS_COLOR = { normal: "#00B896", high: "#EF4444", low: "#F59E0B" };

export default function SmartScanScreen() {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(60)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  function startPulse() {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }

  function showResult() {
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 18 }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();
  }

  async function pickAndScan(source: "camera" | "gallery") {
    try {
      let pickerResult: ImagePicker.ImagePickerResult;
      if (source === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Alert.alert("Permission needed", "Camera access is required."); return; }
        pickerResult = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8, base64: true });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { Alert.alert("Permission needed", "Gallery access is required."); return; }
        pickerResult = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8, base64: true });
      }
      if (pickerResult.canceled || !pickerResult.assets?.[0]) return;

      const asset = pickerResult.assets[0];
      if (!asset.base64) { Alert.alert("Error", "Could not read image."); return; }

      setImageUri(asset.uri);
      setResult(null);
      slideAnim.setValue(60);
      fadeAnim.setValue(0);
      setScanning(true);
      startPulse();

      const ext = asset.uri.split(".").pop()?.toLowerCase() || "jpg";
      const mimeType = ext === "png" ? "image/png" : "image/jpeg";

      const data = await api.smartScan({ imageBase64: asset.base64, mimeType });

      setScanning(false);
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
      setResult(data as unknown as ScanResult);
      showResult();
    } catch {
      setScanning(false);
      pulseAnim.setValue(1);
      Alert.alert("Scan failed", "Please try again with a clearer image.");
    }
  }

  function reset() {
    setResult(null);
    setImageUri(null);
    slideAnim.setValue(60);
    fadeAnim.setValue(0);
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        <LinearGradient colors={["#E8F6FF", "#F0FBF8"]} style={s.header}>
          <Text style={s.headerTitle}>AI Smart Scan</Text>
          <Text style={s.headerSub}>Point at food, lab reports, or medicines</Text>
        </LinearGradient>

        {!result && !scanning && (
          <>
            <View style={s.heroArea}>
              <LinearGradient
                colors={[PRIMARY, SKY, ACCENT]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={s.scanCircle}
              >
                <Ionicons name="scan" size={52} color="#FFF" />
              </LinearGradient>
              <Text style={s.heroText}>What can I scan?</Text>
            </View>

            <View style={s.hintsRow}>
              {[
                { icon: "restaurant", label: "Food & Meals", color: "#F59E0B", sub: "Calories + nutrition" },
                { icon: "document-text", label: "Lab Reports", color: "#EF4444", sub: "Blood test, CBC, etc." },
                { icon: "medkit", label: "Medicines", color: "#8B5CF6", sub: "Drug info + dosage" },
              ].map((h) => (
                <View key={h.label} style={s.hintCard}>
                  <View style={[s.hintIcon, { backgroundColor: h.color + "18" }]}>
                    <Ionicons name={h.icon as "scan"} size={22} color={h.color} />
                  </View>
                  <Text style={s.hintLabel}>{h.label}</Text>
                  <Text style={s.hintSub}>{h.sub}</Text>
                </View>
              ))}
            </View>

            <View style={s.btnGroup}>
              <TouchableOpacity style={s.cameraBtn} onPress={() => pickAndScan("camera")}>
                <LinearGradient colors={[PRIMARY, SKY]} style={s.btnGrad}>
                  <Ionicons name="camera" size={22} color="#FFF" />
                  <Text style={s.btnText}>Open Camera</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={s.galleryBtn} onPress={() => pickAndScan("gallery")}>
                <Ionicons name="images" size={20} color={PRIMARY} />
                <Text style={s.galleryText}>Pick from Gallery</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {scanning && (
          <View style={s.scanningBox}>
            {imageUri && <Image source={{ uri: imageUri }} style={s.previewImg} />}
            <Animated.View style={[s.scanRing, { transform: [{ scale: pulseAnim }] }]}>
              <LinearGradient colors={[PRIMARY, SKY, ACCENT]} style={s.scanRingInner}>
                <Ionicons name="scan" size={38} color="#FFF" />
              </LinearGradient>
            </Animated.View>
            <Text style={s.scanningTitle}>Analyzing with AI...</Text>
            <Text style={s.scanningSubtitle}>Detecting content type + extracting health insights</Text>
            <ActivityIndicator color={PRIMARY} style={{ marginTop: 12 }} />
          </View>
        )}

        {result && (
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            {imageUri && <Image source={{ uri: imageUri }} style={s.resultImg} />}
            {result.type === "food" && <FoodResult r={result} onReset={reset} />}
            {result.type === "medical_report" && <MedicalResult r={result} onReset={reset} />}
            {result.type === "medicine" && <MedicineResult r={result} onReset={reset} />}
            {result.type === "unknown" && (
              <View style={s.unknownBox}>
                <Ionicons name="help-circle" size={48} color="#9CA3AF" />
                <Text style={s.unknownTitle}>Could not identify</Text>
                <Text style={s.unknownSub}>{result.message}</Text>
                <TouchableOpacity style={s.retryBtn} onPress={reset}>
                  <Text style={s.retryText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function FoodResult({ r, onReset }: { r: Extract<ScanResult, { type: "food" }>; onReset: () => void }) {
  const scoreColor = r.healthScore >= 7 ? ACCENT : r.healthScore >= 4 ? "#F59E0B" : "#EF4444";
  return (
    <View style={s.resultCard}>
      <View style={s.resultHeader}>
        <View style={[s.typeChip, { backgroundColor: "#FEF3C7" }]}>
          <Ionicons name="restaurant" size={14} color="#F59E0B" />
          <Text style={[s.typeChipText, { color: "#F59E0B" }]}>Food Detected</Text>
        </View>
        <Text style={[s.confidence, { color: ACCENT }]}>{Math.round((r.confidence || 0.9) * 100)}% confident</Text>
      </View>
      <Text style={s.resultTitle}>{r.foodName}</Text>
      <Text style={s.servingText}>{r.servingSize}</Text>

      <View style={s.macroRow}>
        {[
          { label: "Calories", val: r.calories, unit: "kcal", color: "#EF4444" },
          { label: "Protein", val: r.proteinG, unit: "g", color: PRIMARY },
          { label: "Carbs", val: r.carbsG, unit: "g", color: "#F59E0B" },
          { label: "Fat", val: r.fatG, unit: "g", color: "#8B5CF6" },
        ].map((m) => (
          <View key={m.label} style={[s.macroCard, { borderColor: m.color + "30" }]}>
            <Text style={[s.macroVal, { color: m.color }]}>{m.val}</Text>
            <Text style={s.macroUnit}>{m.unit}</Text>
            <Text style={s.macroLabel}>{m.label}</Text>
          </View>
        ))}
      </View>

      <View style={s.scoreRow}>
        <Text style={s.scoreLabel}>Health Score</Text>
        <View style={[s.scoreBadge, { backgroundColor: scoreColor + "18" }]}>
          <Text style={[s.scoreVal, { color: scoreColor }]}>{r.healthScore}/10</Text>
        </View>
      </View>

      {r.tags?.length > 0 && (
        <View style={s.tagsRow}>
          {r.tags.map((t) => (
            <View key={t} style={s.tag}><Text style={s.tagText}>{t}</Text></View>
          ))}
        </View>
      )}

      <View style={s.tipBox}>
        <Ionicons name="bulb" size={16} color={ACCENT} />
        <Text style={s.tipText}>{r.tip}</Text>
      </View>

      <TouchableOpacity style={s.scanAgainBtn} onPress={onReset}>
        <Ionicons name="scan" size={16} color={PRIMARY} />
        <Text style={s.scanAgainText}>Scan Another</Text>
      </TouchableOpacity>
    </View>
  );
}

function MedicalResult({ r, onReset }: { r: Extract<ScanResult, { type: "medical_report" }>; onReset: () => void }) {
  const urgencyColor = URGENCY_COLOR[r.urgencyLevel] || ACCENT;
  return (
    <View style={s.resultCard}>
      <View style={s.resultHeader}>
        <View style={[s.typeChip, { backgroundColor: "#FEE2E2" }]}>
          <Ionicons name="document-text" size={14} color="#EF4444" />
          <Text style={[s.typeChipText, { color: "#EF4444" }]}>Medical Report</Text>
        </View>
        <View style={[s.urgencyBadge, { backgroundColor: urgencyColor + "20" }]}>
          <View style={[s.urgencyDot, { backgroundColor: urgencyColor }]} />
          <Text style={[s.urgencyText, { color: urgencyColor }]}>{r.urgencyLevel.toUpperCase()}</Text>
        </View>
      </View>

      <Text style={s.resultTitle}>{r.reportType}</Text>
      {r.date && <Text style={s.servingText}>Date: {r.date}</Text>}

      <View style={s.summaryBox}>
        <Text style={s.summaryText}>{r.summary}</Text>
      </View>

      {r.keyFindings?.length > 0 && (
        <View style={s.findingsSection}>
          <Text style={s.sectionTitle}>Key Findings</Text>
          {r.keyFindings.map((f, i) => (
            <View key={i} style={s.findingRow}>
              <View style={s.findingLeft}>
                <Text style={s.findingParam}>{f.parameter}</Text>
                <Text style={s.findingRange}>Normal: {f.normalRange}</Text>
              </View>
              <View style={[s.findingBadge, { backgroundColor: STATUS_COLOR[f.status] + "18" }]}>
                <Text style={[s.findingVal, { color: STATUS_COLOR[f.status] }]}>{f.value}</Text>
                <Text style={[s.findingStatus, { color: STATUS_COLOR[f.status] }]}>{f.status}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {r.recommendations?.length > 0 && (
        <View style={s.recSection}>
          <Text style={s.sectionTitle}>Recommendations</Text>
          {r.recommendations.map((rec, i) => (
            <View key={i} style={s.recRow}>
              <Ionicons name="checkmark-circle" size={16} color={ACCENT} />
              <Text style={s.recText}>{rec}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={[s.tipBox, { backgroundColor: "#FEF3C7" }]}>
        <Ionicons name="warning" size={16} color="#F59E0B" />
        <Text style={[s.tipText, { color: "#92400E" }]}>{r.disclaimer}</Text>
      </View>

      <TouchableOpacity style={s.scanAgainBtn} onPress={onReset}>
        <Ionicons name="scan" size={16} color={PRIMARY} />
        <Text style={s.scanAgainText}>Scan Another</Text>
      </TouchableOpacity>
    </View>
  );
}

function MedicineResult({ r, onReset }: { r: Extract<ScanResult, { type: "medicine" }>; onReset: () => void }) {
  return (
    <View style={s.resultCard}>
      <View style={s.resultHeader}>
        <View style={[s.typeChip, { backgroundColor: "#EDE9FE" }]}>
          <Ionicons name="medkit" size={14} color="#8B5CF6" />
          <Text style={[s.typeChipText, { color: "#8B5CF6" }]}>Medicine Detected</Text>
        </View>
        <Text style={[s.confidence, { color: ACCENT }]}>{Math.round((r.confidence || 0.85) * 100)}% confident</Text>
      </View>

      <Text style={s.resultTitle}>{r.medicineName}</Text>
      {r.genericName && <Text style={s.servingText}>Generic: {r.genericName}</Text>}

      <View style={s.summaryBox}>
        <Text style={s.sectionSmall}>Used For</Text>
        <Text style={s.summaryText}>{r.uses}</Text>
      </View>

      {r.commonDosage && (
        <View style={[s.summaryBox, { backgroundColor: "#E0F2FE" }]}>
          <Text style={s.sectionSmall}>Typical Dosage</Text>
          <Text style={[s.summaryText, { color: PRIMARY }]}>{r.commonDosage}</Text>
        </View>
      )}

      {r.sideEffects?.length > 0 && (
        <View style={s.recSection}>
          <Text style={s.sectionTitle}>Common Side Effects</Text>
          {r.sideEffects.map((se, i) => (
            <View key={i} style={s.recRow}>
              <Ionicons name="alert-circle" size={14} color="#F59E0B" />
              <Text style={s.recText}>{se}</Text>
            </View>
          ))}
        </View>
      )}

      {r.warnings?.length > 0 && (
        <View style={s.recSection}>
          <Text style={[s.sectionTitle, { color: "#EF4444" }]}>Warnings</Text>
          {r.warnings.map((w, i) => (
            <View key={i} style={s.recRow}>
              <Ionicons name="warning" size={14} color="#EF4444" />
              <Text style={[s.recText, { color: "#EF4444" }]}>{w}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={[s.tipBox, { backgroundColor: "#FEF3C7" }]}>
        <Ionicons name="warning" size={16} color="#F59E0B" />
        <Text style={[s.tipText, { color: "#92400E" }]}>{r.disclaimer}</Text>
      </View>

      <TouchableOpacity style={s.scanAgainBtn} onPress={onReset}>
        <Ionicons name="scan" size={16} color={PRIMARY} />
        <Text style={s.scanAgainText}>Scan Another</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#E8F6FF" },
  scroll: { paddingBottom: 24 },
  header: { paddingTop: 12, paddingBottom: 20, paddingHorizontal: 20 },
  headerTitle: { fontSize: 24, fontFamily: "Inter_700Bold", color: "#0D1F33", marginBottom: 4 },
  headerSub: { fontSize: 13, color: "#5B7FA6" },
  heroArea: { alignItems: "center", paddingVertical: 28 },
  scanCircle: { width: 110, height: 110, borderRadius: 55, alignItems: "center", justifyContent: "center", shadowColor: PRIMARY, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 12, marginBottom: 14 },
  heroText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#5B7FA6" },
  hintsRow: { flexDirection: "row", paddingHorizontal: 16, gap: 10, marginBottom: 24 },
  hintCard: { flex: 1, backgroundColor: "#FFF", borderRadius: 16, padding: 12, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3 },
  hintIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  hintLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#0D1F33", textAlign: "center" },
  hintSub: { fontSize: 10, color: "#9CA3AF", textAlign: "center", marginTop: 2 },
  btnGroup: { paddingHorizontal: 20, gap: 12 },
  cameraBtn: { borderRadius: 16, overflow: "hidden", shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  btnGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16 },
  btnText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  galleryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, backgroundColor: "#FFF", borderRadius: 16, borderWidth: 1.5, borderColor: PRIMARY + "30" },
  galleryText: { color: PRIMARY, fontSize: 15, fontFamily: "Inter_500Medium" },
  scanningBox: { alignItems: "center", paddingVertical: 32, paddingHorizontal: 24 },
  previewImg: { width: width - 48, height: 200, borderRadius: 16, marginBottom: 24, resizeMode: "cover" },
  scanRing: { width: 100, height: 100, borderRadius: 50, marginBottom: 20 },
  scanRingInner: { width: 100, height: 100, borderRadius: 50, alignItems: "center", justifyContent: "center" },
  scanningTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#0D1F33", marginBottom: 6 },
  scanningSubtitle: { fontSize: 13, color: "#5B7FA6", textAlign: "center" },
  resultImg: { width: width - 32, height: 200, borderRadius: 16, marginHorizontal: 16, marginBottom: 16, resizeMode: "cover" },
  resultCard: { marginHorizontal: 16, backgroundColor: "#FFF", borderRadius: 20, padding: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 5 },
  resultHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  typeChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  typeChipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  confidence: { fontSize: 12, fontFamily: "Inter_500Medium" },
  resultTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#0D1F33", marginBottom: 4 },
  servingText: { fontSize: 13, color: "#5B7FA6", marginBottom: 16 },
  macroRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  macroCard: { flex: 1, backgroundColor: "#F9FAFB", borderRadius: 12, padding: 10, alignItems: "center", borderWidth: 1 },
  macroVal: { fontSize: 18, fontFamily: "Inter_700Bold" },
  macroUnit: { fontSize: 10, color: "#9CA3AF" },
  macroLabel: { fontSize: 11, color: "#6B7280", marginTop: 2 },
  scoreRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  scoreLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#0D1F33" },
  scoreBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  scoreVal: { fontSize: 14, fontFamily: "Inter_700Bold" },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 },
  tag: { backgroundColor: "#E0F2FE", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  tagText: { fontSize: 11, color: PRIMARY, fontFamily: "Inter_500Medium" },
  tipBox: { flexDirection: "row", gap: 8, backgroundColor: "#F0FBF8", borderRadius: 12, padding: 12, alignItems: "flex-start", marginBottom: 16 },
  tipText: { flex: 1, fontSize: 13, color: "#065F46", lineHeight: 18 },
  urgencyBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  urgencyDot: { width: 6, height: 6, borderRadius: 3 },
  urgencyText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  summaryBox: { backgroundColor: "#F9FAFB", borderRadius: 12, padding: 14, marginBottom: 14 },
  summaryText: { fontSize: 14, color: "#374151", lineHeight: 20 },
  sectionSmall: { fontSize: 11, color: "#9CA3AF", marginBottom: 4, fontFamily: "Inter_500Medium" },
  findingsSection: { marginBottom: 14 },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#0D1F33", marginBottom: 8 },
  findingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  findingLeft: { flex: 1 },
  findingParam: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#0D1F33" },
  findingRange: { fontSize: 11, color: "#9CA3AF" },
  findingBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignItems: "flex-end" },
  findingVal: { fontSize: 13, fontFamily: "Inter_700Bold" },
  findingStatus: { fontSize: 10, fontFamily: "Inter_500Medium" },
  recSection: { marginBottom: 14 },
  recRow: { flexDirection: "row", gap: 8, alignItems: "flex-start", marginBottom: 6 },
  recText: { flex: 1, fontSize: 13, color: "#374151", lineHeight: 18 },
  unknownBox: { alignItems: "center", padding: 40 },
  unknownTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#0D1F33", marginTop: 12 },
  unknownSub: { fontSize: 14, color: "#6B7280", textAlign: "center", marginTop: 6, marginBottom: 20 },
  retryBtn: { backgroundColor: PRIMARY, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  retryText: { color: "#FFF", fontFamily: "Inter_600SemiBold" },
  scanAgainBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderWidth: 1.5, borderColor: PRIMARY + "30", borderRadius: 12 },
  scanAgainText: { color: PRIMARY, fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
