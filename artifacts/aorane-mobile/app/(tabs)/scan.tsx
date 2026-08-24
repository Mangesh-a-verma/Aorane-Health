import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Animated, Dimensions, Image, Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { PremiumScoreRing } from "../../components/PremiumScoreRing";
import { BlurView } from "expo-blur";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useFocusEffect, router } from "expo-router";
import { api } from "@/lib/api";
import { APILimitError } from "@/lib/apiErrors";
import { useAIScanUsage } from "@/lib/useAIScanUsage";
import * as ImageManipulator from "expo-image-manipulator";
import { useAuth } from "@/context/AuthContext";
import { DS } from "@/lib/theme";
import { UpgradeModal, type UpgradeModalConfig } from "@/components/UpgradeModal";
import { AIUsageIndicator } from "@/components/AIUsageIndicator";
import { LimitWarningToast } from "@/components/LimitWarningToast";

const { width: W, height: H } = Dimensions.get("window");
const PRIMARY = DS.color.primary;
const SKY = DS.color.secondary;
const ACCENT = DS.color.green;
const C = {
  text: DS.color.text, muted: DS.color.textSub,
  glass: "rgba(255,255,255,0.88)", glassBorder: "rgba(255,255,255,0.96)",
};

type ScanResult =
  | { type: "food"; foodName: string; confidence: number; calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number; servingSize: string; healthScore: number; tags: string[]; tip: string; ingredients: string[] }
  | { type: "medical_report"; reportType: string; confidence: number; patientName: string | null; date: string | null; summary: string; urgencyLevel: "normal" | "attention" | "urgent"; keyFindings: { parameter: string; value: string; normalRange: string; status: "normal" | "high" | "low" }[]; recommendations: string[]; disclaimer: string }
  | { type: "medicine"; confidence: number; medicineName: string; genericName: string; uses: string; commonDosage: string; sideEffects: string[]; warnings: string[]; disclaimer: string }
  | { type: "unknown"; message: string };

const URGENCY_COLOR = { normal: ACCENT, attention: "#F59E0B", urgent: "#EF4444" };
const STATUS_COLOR = { normal: ACCENT, high: "#EF4444", low: "#F59E0B" };

function Glass({ children, style, padding = 16 }: {
  children: React.ReactNode; style?: object; padding?: number;
}) {
  return (
    <View style={[gc.wrap, style]}>
      {Platform.OS === "ios" && (
        <BlurView intensity={55} tint="extraLight" style={StyleSheet.absoluteFill} />
      )}
      <View style={[StyleSheet.absoluteFill, gc.fill]} />
      <View style={{ padding }}>{children}</View>
    </View>
  );
}
const gc = StyleSheet.create({
  wrap: {
    borderRadius: 22, overflow: "hidden",
    borderWidth: 1.2, borderColor: C.glassBorder,
    backgroundColor: Platform.OS === "ios" ? "transparent" : C.glass,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 14, elevation: 5, marginBottom: 14,
  },
  fill: { backgroundColor: C.glass, borderRadius: 22 },
});

// ── ANIMATED SCANNER ─────────────────────────────────────────────────────────
function ScannerFrame({ imageUri }: { imageUri: string | null }) {
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const cornerAnim = useRef(new Animated.Value(0)).current;

  const ND = Platform.OS !== "web";
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, { toValue: 1, duration: 1600, useNativeDriver: ND }),
        Animated.timing(scanLineAnim, { toValue: 0, duration: 1600, useNativeDriver: ND }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(cornerAnim, { toValue: 1, duration: 900, useNativeDriver: ND }),
        Animated.timing(cornerAnim, { toValue: 0.5, duration: 900, useNativeDriver: ND }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 800, useNativeDriver: ND }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: ND }),
      ])
    ).start();
  }, []);

  const FRAME = W * 0.72;
  const scanLineY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, FRAME - 4],
  });

  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={[sf.frame, { width: FRAME, height: FRAME, transform: [{ scale: pulseAnim }] }]}>
        {/* Image or placeholder */}
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={{ width: FRAME - 4, height: FRAME - 4, borderRadius: 16, resizeMode: "cover" }} />
        ) : (
          <LinearGradient
            colors={[DS.color.primarySoft, DS.color.secondarySoft]}
            style={{ width: FRAME - 4, height: FRAME - 4, borderRadius: 16, alignItems: "center", justifyContent: "center" }}
          >
            <View style={sf.centerIcon}>
              <Ionicons name="scan-outline" size={48} color={PRIMARY} style={{ opacity: 0.4 }} />
            </View>
          </LinearGradient>
        )}

        {/* Animated scan line */}
        <Animated.View style={[sf.scanLine, { transform: [{ translateY: scanLineY }] }]}>
          <LinearGradient
            colors={["transparent", SKY, ACCENT, SKY, "transparent"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ flex: 1, height: 2 }}
          />
        </Animated.View>

        {/* Corner brackets */}
        <Animated.View style={[sf.cornerTL, { opacity: cornerAnim }]} />
        <Animated.View style={[sf.cornerTR, { opacity: cornerAnim }]} />
        <Animated.View style={[sf.cornerBL, { opacity: cornerAnim }]} />
        <Animated.View style={[sf.cornerBR, { opacity: cornerAnim }]} />
      </Animated.View>
    </View>
  );
}

const CORNER = 20;
const BORDER = 3;
const sf = StyleSheet.create({
  frame: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: DS.color.border,
  },
  scanLine: {
    position: "absolute", left: 0, right: 0, height: 2,
  },
  centerIcon: { alignItems: "center", justifyContent: "center" },
  cornerTL: { position: "absolute", top: 0, left: 0, width: CORNER, height: CORNER, borderTopWidth: BORDER, borderLeftWidth: BORDER, borderColor: SKY, borderTopLeftRadius: 16 },
  cornerTR: { position: "absolute", top: 0, right: 0, width: CORNER, height: CORNER, borderTopWidth: BORDER, borderRightWidth: BORDER, borderColor: SKY, borderTopRightRadius: 16 },
  cornerBL: { position: "absolute", bottom: 0, left: 0, width: CORNER, height: CORNER, borderBottomWidth: BORDER, borderLeftWidth: BORDER, borderColor: ACCENT, borderBottomLeftRadius: 16 },
  cornerBR: { position: "absolute", bottom: 0, right: 0, width: CORNER, height: CORNER, borderBottomWidth: BORDER, borderRightWidth: BORDER, borderColor: ACCENT, borderBottomRightRadius: 16 },
});

// ─── PLAN GATE OVERLAY (Pro / Max only — free plan has ZERO scans) ────────────
function PlanGate() {
  return (
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(255,248,243,0.97)", zIndex: 100, alignItems: "center", justifyContent: "center", padding: 32 }}>
      <View style={{ backgroundColor: "#FFF", borderRadius: 28, padding: 28, alignItems: "center", gap: 14, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 20, elevation: 8, borderWidth: 1, borderColor: "#F0E6E0" }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: PRIMARY + "15", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 36 }}>✨</Text>
        </View>
        <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: "#1A1A1A", textAlign: "center" }}>AI Smart Scan</Text>
        <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: "#6B7280", textAlign: "center", lineHeight: 21 }}>
          Scan food, lab reports & medicines with AI. This is a Pro & Max plan feature — upgrade to unlock unlimited AI-powered scanning.
        </Text>
        <View style={{ backgroundColor: DS.color.primarySoft, borderRadius: 12, padding: 12, width: "100%" }}>
          <Text style={{ color: PRIMARY, fontFamily: "Inter_600SemiBold", fontSize: 12, textAlign: "center" }}>🔒 Available on Pro & Max plans</Text>
        </View>
        <TouchableOpacity activeOpacity={0.8} onPress={() => router.push("/upgrade" as never)} style={{ width: "100%", borderRadius: 16, overflow: "hidden" }}>
          <LinearGradient colors={[PRIMARY, SKY]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ padding: 16, alignItems: "center" }}>
            <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 16 }}>Upgrade to Pro / Max</Text>
            <Text style={{ color: "rgba(255,255,255,0.8)", fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>Powered by Google Gemini AI</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.8} onPress={() => router.push("/(tabs)/food" as never)} style={{ paddingVertical: 8 }}>
          <Text style={{ color: PRIMARY, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>Search Food by Name instead</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── MAIN SCREEN ─────────────────────────────────────────────────────────────
export default function SmartScanScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const userPlan = ((user as Record<string, unknown>)?.plan as string || "free").toLowerCase();
  const isPremium = userPlan !== "free";

  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const slideAnim = useRef(new Animated.Value(60)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const headerFade = useRef(new Animated.Value(0)).current;
  const [upgradeConfig, setUpgradeConfig] = useState<UpgradeModalConfig | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastRemaining, setToastRemaining] = useState(0);
  const scanUsage = useAIScanUsage("food_scan", userPlan.toUpperCase());

  const ND = Platform.OS !== "web";
  useEffect(() => {
    Animated.timing(headerFade, { toValue: 1, duration: 500, useNativeDriver: ND }).start();
  }, []);

  useFocusEffect(useCallback(() => {
    return () => {
      setResult(null);
      setImageUri(null);
      slideAnim.setValue(60);
      fadeAnim.setValue(0);
    };
  }, []));

  function showResult() {
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: ND, damping: 18 }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: ND }),
    ]).start();
  }

  async function pickAndScan(source: "camera" | "gallery") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      let pickerResult: ImagePicker.ImagePickerResult;
      // Step 1: Hum yahan base64 false kar rahe hain kyunki hum compress karne ke baad base64 nikalenge
      if (source === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Alert.alert("Permission needed", "Camera access is required."); return; }
        pickerResult = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], allowsEditing: false, quality: 1, base64: false });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { Alert.alert("Permission needed", "Gallery access is required."); return; }
        pickerResult = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: false, quality: 1, base64: false });
      }
      
      if (pickerResult.canceled || !pickerResult.assets?.[0]) return;
      const asset = pickerResult.assets[0];

      // UI update taaki user ko lage processing shuru ho gayi hai
      setResult(null);
      slideAnim.setValue(60);
      fadeAnim.setValue(0);
      setScanning(true);

      // --- THE AUTO-COMPRESSOR MAGIC ---
      // Image ki width ko max 800px kar dega aur quality 0.6 (JPEG)
      const compressedImage = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 800 } }], 
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      if (!compressedImage.base64) { 
        setScanning(false);
        Alert.alert("Error", "Could not process image."); 
        return; 
      }

      // UI par compressed image dikhayenge
      setImageUri(compressedImage.uri);
      
      // Server ko choti (compressed) file bhejenge
      const data = await api.smartScan({ imageBase64: compressedImage.base64, mimeType: "image/jpeg" });
      
      setScanning(false);
      setResult(data as unknown as ScanResult);
      showResult();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      const { remaining } = await scanUsage.increment();
      if (scanUsage.limit < 999 && remaining <= 2) {
        setToastRemaining(remaining);
        setToastVisible(true);
      }
    } catch (err: unknown) {
      setScanning(false);
      if (err instanceof APILimitError) {
        if (err.type === "plan_limit") {
          setUpgradeConfig({ type: "plan_limit", featureKey: "food_scan", featureLabel: "Food Photo Scan", currentPlan: userPlan.toUpperCase(), requiredPlan: err.requiredPlan || "PRO" });
        } else {
          setUpgradeConfig({ type: "daily_limit", featureKey: "food_scan", featureLabel: "Food Photo Scan", used: err.used ?? scanUsage.used, limit: err.limit ?? scanUsage.limit });
        }
        return;
      }
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("503") || msg.includes("Gemini") || msg.includes("service") || msg.includes("timeout")) {
        Alert.alert("AI Unavailable", msg || "Connection to AI Smart Scan failed. Please try again.");
      } else if (msg.includes("413") || msg.toLowerCase().includes("large")) {
         // Agar phir bhi galti se badi ho jaye (extremely rare now)
        Alert.alert("File Too Large", "Please try taking a photo from slightly further away.");
      } else {
        Alert.alert("Scan Failed", msg || "Could not analyse this image. Try with a clearer photo in good lighting.");
      }
    }
  }

  function reset() {
    setResult(null);
    setImageUri(null);
    slideAnim.setValue(60);
    fadeAnim.setValue(0);
  }

  const topPad = insets.top;

  return (
    <View style={s.root}>
      <LinearGradient colors={[DS.color.bg, DS.color.bgSoft, "#FFFFFF"]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <View style={s.blob1} /><View style={s.blob2} />
      {!isPremium && <PlanGate />}

      <ScrollView
        contentContainerStyle={{ paddingTop: topPad + 8, paddingBottom: insets.bottom + 96, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View style={[s.header, { opacity: headerFade }]}>
          <View>
            <Text style={s.headerTitle}>AI Smart Scan</Text>
            <Text style={s.headerSub}>Food • Lab Reports • Medicines</Text>
          </View>
          <LinearGradient colors={[PRIMARY, SKY]} style={s.headerBadge}>
            <Ionicons name="scan-outline" size={18} color="#FFF" />
          </LinearGradient>
        </Animated.View>

        {/* What can I scan chips */}
        {!result && !scanning && (
          <Animated.View style={{ opacity: headerFade }}>
            <View style={s.hintsRow}>
              {[
                { icon: "restaurant", label: "Food & Meals", color: "#F59E0B", sub: "Calories + macros" },
                { icon: "document-text", label: "Lab Reports", color: "#EF4444", sub: "CBC, thyroid, etc." },
                { icon: "medkit", label: "Medicines", color: "#8B5CF6", sub: "Drug info + dose" },
              ].map((h) => (
                <View key={h.label} style={[s.hintCard, { borderColor: h.color + "30" }]}>
                  <View style={[s.hintIcon, { backgroundColor: h.color + "15" }]}>
                    <Ionicons name={h.icon as "scan"} size={20} color={h.color} />
                  </View>
                  <Text style={s.hintLabel}>{h.label}</Text>
                  <Text style={s.hintSub}>{h.sub}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Scanner frame — always visible */}
        <Animated.View style={[s.scanArea, { opacity: headerFade }]}>
          <ScannerFrame imageUri={imageUri} />
          {scanning && (
            <View style={s.scanningOverlay}>
              <ActivityIndicator color={SKY} size="small" />
              <Text style={s.scanningText}>AI Analyzing...</Text>
            </View>
          )}
        </Animated.View>

        {/* CTA Buttons */}
        {!result && !scanning && (
          <Animated.View style={[s.btnGroup, { opacity: headerFade }]}>
            {isPremium && (
              <>
                <TouchableOpacity activeOpacity={0.8} style={s.cameraBtnWrap} onPress={() => pickAndScan("camera")}>
                  <LinearGradient colors={[PRIMARY, SKY, ACCENT]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.cameraBtn}>
                    <Ionicons name="camera" size={22} color="#FFF" />
                    <Text style={s.cameraBtnText}>Open Camera</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.8} style={s.galleryBtn} onPress={() => pickAndScan("gallery")}>
                  <Ionicons name="images-outline" size={20} color={PRIMARY} />
                  <Text style={s.galleryText}>Pick from Gallery</Text>
                </TouchableOpacity>
                <AIUsageIndicator
                  used={scanUsage.used}
                  limit={scanUsage.limit}
                  label="scans"
                  iconName="scan-outline"
                />
              </>
            )}
          </Animated.View>
        )}

        {scanning && (
          <View style={s.scanningStatus}>
            <Text style={s.scanningTitle}>Analyzing with AI...</Text>
            <Text style={s.scanningSub}>Detecting content type + extracting health insights</Text>
          </View>
        )}

        {/* Results */}
        {result && (
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            {result.type === "food" && <FoodResult r={result} onReset={reset} />}
            {result.type === "medical_report" && <MedicalResult r={result} onReset={reset} />}
            {result.type === "medicine" && <MedicineResult r={result} onReset={reset} />}
            {result.type === "unknown" && (
              <Glass>
                <View style={{ alignItems: "center", paddingVertical: 20 }}>
                  <Ionicons name="help-circle-outline" size={52} color="#9CA3AF" />
                  <Text style={s.unknownTitle}>Could not identify</Text>
                  <Text style={s.unknownSub}>{result.message}</Text>
                  <TouchableOpacity activeOpacity={0.8} style={s.retryBtn} onPress={reset}>
                    <Text style={s.retryText}>Try Again</Text>
                  </TouchableOpacity>
                </View>
              </Glass>
            )}
          </Animated.View>
        )}
      </ScrollView>
      <LimitWarningToast
        visible={toastVisible}
        remaining={toastRemaining}
        featureLabel="scan"
        onDismiss={() => setToastVisible(false)}
      />
      <UpgradeModal config={upgradeConfig} onClose={() => setUpgradeConfig(null)} />
    </View>
  );
}

const LOW_CONFIDENCE_THRESHOLD = 0.6;

function LowConfidenceBanner({ confidence }: { confidence: number }) {
  if (confidence >= LOW_CONFIDENCE_THRESHOLD) return null;
  return (
    <View style={rs.lowConfBanner}>
      <Ionicons name="alert-circle" size={16} color="#B45309" />
      <Text style={rs.lowConfText}>
        AI isn't fully sure about this scan — please double-check these details before relying on them.
      </Text>
    </View>
  );
}

function FoodResult({ r, onReset }: { r: Extract<ScanResult, { type: "food" }>; onReset: () => void }) {
  const scoreColor = r.healthScore >= 7 ? ACCENT : r.healthScore >= 4 ? "#F59E0B" : "#EF4444";
  return (
    <Glass>
      <View style={rs.header}>
        <View style={[rs.chip, { backgroundColor: "#FEF3C7" }]}>
          <Ionicons name="restaurant" size={13} color="#F59E0B" />
          <Text style={[rs.chipText, { color: "#F59E0B" }]}>Food Detected</Text>
        </View>
        <Text style={[rs.conf, { color: ACCENT }]}>{Math.round((r.confidence || 0.9) * 100)}% confident</Text>
      </View>
      <LowConfidenceBanner confidence={r.confidence ?? 0.9} />
      <Text style={rs.title}>{r.foodName}</Text>
      <Text style={rs.serving}>{r.servingSize}</Text>
      <View style={rs.macroRow}>
        {[
          { label: "Calories", val: r.calories, unit: "kcal", color: "#EF4444" },
          { label: "Protein", val: r.proteinG, unit: "g", color: PRIMARY },
          { label: "Carbs", val: r.carbsG, unit: "g", color: "#F59E0B" },
          { label: "Fat", val: r.fatG, unit: "g", color: "#8B5CF6" },
        ].map((m) => (
          <View key={m.label} style={[rs.macroCard, { borderColor: m.color + "28" }]}>
            <Text style={[rs.macroVal, { color: m.color }]}>{m.val}</Text>
            <Text style={rs.macroUnit}>{m.unit}</Text>
            <Text style={rs.macroLabel}>{m.label}</Text>
          </View>
        ))}
      </View>
      <View style={rs.scoreRow}>
        <Text style={rs.scoreLabel}>Health Score</Text>
        <View style={[rs.scoreBadge, { backgroundColor: scoreColor + "18" }]}>
          <Text style={[rs.scoreVal, { color: scoreColor }]}>{r.healthScore}/10</Text>
        </View>
      </View>
      {r.tags?.length > 0 && (
        <View style={rs.tagsRow}>
          {r.tags.map((t) => (
            <View key={t} style={rs.tag}><Text style={rs.tagText}>{t}</Text></View>
          ))}
        </View>
      )}
      <View style={rs.tipBox}>
        <Ionicons name="bulb-outline" size={16} color={ACCENT} />
        <Text style={rs.tipText}>{r.tip}</Text>
      </View>
      <TouchableOpacity activeOpacity={0.8} style={rs.scanAgain} onPress={onReset}>
        <LinearGradient colors={[PRIMARY, SKY]} style={rs.scanAgainGrad}>
          <Ionicons name="scan-outline" size={16} color="#FFF" />
          <Text style={rs.scanAgainText}>Scan Another</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Glass>
  );
}

function MedicalResult({ r, onReset }: { r: Extract<ScanResult, { type: "medical_report" }>; onReset: () => void }) {
  const urgencyColor = URGENCY_COLOR[r.urgencyLevel] || ACCENT;
  return (
    <Glass>
      <View style={rs.header}>
        <View style={[rs.chip, { backgroundColor: "#FEE2E2" }]}>
          <Ionicons name="document-text" size={13} color="#EF4444" />
          <Text style={[rs.chipText, { color: "#EF4444" }]}>Medical Report</Text>
        </View>
        <View style={[rs.urgencyBadge, { backgroundColor: urgencyColor + "18" }]}>
          <View style={[rs.urgencyDot, { backgroundColor: urgencyColor }]} />
          <Text style={[rs.urgencyText, { color: urgencyColor }]}>{r.urgencyLevel.toUpperCase()}</Text>
        </View>
      </View>
      <LowConfidenceBanner confidence={r.confidence ?? 0.9} />
      <Text style={rs.title}>{r.reportType}</Text>
      {r.date && <Text style={rs.serving}>Date: {r.date}</Text>}
      <View style={rs.summBox}><Text style={rs.summText}>{r.summary}</Text></View>
      {r.keyFindings?.length > 0 && (
        <View style={{ marginBottom: 12 }}>
          <Text style={rs.sectionTitle}>Key Findings</Text>
          {r.keyFindings.map((f, i) => (
            <View key={i} style={rs.findRow}>
              <View style={{ flex: 1 }}>
                <Text style={rs.findParam}>{f.parameter}</Text>
                <Text style={rs.findRange}>Normal: {f.normalRange}</Text>
              </View>
              <View style={[rs.findBadge, { backgroundColor: STATUS_COLOR[f.status] + "18" }]}>
                <Text style={[rs.findVal, { color: STATUS_COLOR[f.status] }]}>{f.value}</Text>
                <Text style={[rs.findStatus, { color: STATUS_COLOR[f.status] }]}>{f.status}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
      {r.recommendations?.length > 0 && (
        <View style={{ marginBottom: 12 }}>
          <Text style={rs.sectionTitle}>Recommendations</Text>
          {r.recommendations.map((rec, i) => (
            <View key={i} style={rs.recRow}>
              <Ionicons name="checkmark-circle" size={15} color={ACCENT} />
              <Text style={rs.recText}>{rec}</Text>
            </View>
          ))}
        </View>
      )}
      <View style={[rs.tipBox, { backgroundColor: "#FEF9C3" }]}>
        <Ionicons name="warning-outline" size={15} color="#F59E0B" />
        <Text style={[rs.tipText, { color: "#78350F" }]}>{r.disclaimer}</Text>
      </View>
      <TouchableOpacity activeOpacity={0.8} style={rs.scanAgain} onPress={onReset}>
        <LinearGradient colors={[PRIMARY, SKY]} style={rs.scanAgainGrad}>
          <Ionicons name="scan-outline" size={16} color="#FFF" />
          <Text style={rs.scanAgainText}>Scan Another</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Glass>
  );
}

function MedicineResult({ r, onReset }: { r: Extract<ScanResult, { type: "medicine" }>; onReset: () => void }) {
  return (
    <Glass>
      <View style={rs.header}>
        <View style={[rs.chip, { backgroundColor: "#EDE9FE" }]}>
          <Ionicons name="medkit" size={13} color="#8B5CF6" />
          <Text style={[rs.chipText, { color: "#8B5CF6" }]}>Medicine Detected</Text>
        </View>
        <Text style={[rs.conf, { color: ACCENT }]}>{Math.round((r.confidence || 0.85) * 100)}% confident</Text>
      </View>
      <LowConfidenceBanner confidence={r.confidence ?? 0.85} />
      <Text style={rs.title}>{r.medicineName}</Text>
      {r.genericName && <Text style={rs.serving}>Generic: {r.genericName}</Text>}
      <View style={rs.summBox}><Text style={rs.sectionSmall}>Used For</Text><Text style={rs.summText}>{r.uses}</Text></View>
      {r.commonDosage && (
        <View style={[rs.summBox, { backgroundColor: DS.color.primarySoft }]}>
          <Text style={rs.sectionSmall}>Typical Dosage</Text>
          <Text style={[rs.summText, { color: PRIMARY }]}>{r.commonDosage}</Text>
        </View>
      )}
      {r.sideEffects?.length > 0 && (
        <View style={{ marginBottom: 12 }}>
          <Text style={rs.sectionTitle}>Side Effects</Text>
          {r.sideEffects.map((se, i) => (
            <View key={i} style={rs.recRow}>
              <Ionicons name="alert-circle-outline" size={14} color="#F59E0B" />
              <Text style={rs.recText}>{se}</Text>
            </View>
          ))}
        </View>
      )}
      <View style={[rs.tipBox, { backgroundColor: "#FEF9C3" }]}>
        <Ionicons name="warning-outline" size={15} color="#F59E0B" />
        <Text style={[rs.tipText, { color: "#78350F" }]}>{r.disclaimer}</Text>
      </View>
      <TouchableOpacity activeOpacity={0.8} style={rs.scanAgain} onPress={onReset}>
        <LinearGradient colors={[PRIMARY, SKY]} style={rs.scanAgainGrad}>
          <Ionicons name="scan-outline" size={16} color="#FFF" />
          <Text style={rs.scanAgainText}>Scan Another</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Glass>
  );
}

const rs = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  chipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  conf: { fontSize: 12, fontFamily: "Inter_500Medium" },
  lowConfBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#FEF3C7", borderRadius: 12, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: "#FDE68A" },
  lowConfText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", color: "#78350F", lineHeight: 17 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", color: C.text, marginBottom: 4 },
  serving: { fontSize: 13, color: C.muted, marginBottom: 14 },
  macroRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  macroCard: { flex: 1, backgroundColor: "#F9FAFB", borderRadius: 14, padding: 10, alignItems: "center", borderWidth: 1 },
  macroVal: { fontSize: 18, fontFamily: "Inter_700Bold" },
  macroUnit: { fontSize: 9.5, color: "#9CA3AF" },
  macroLabel: { fontSize: 10.5, color: "#6B7280", marginTop: 2 },
  scoreRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  scoreLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text },
  scoreBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  scoreVal: { fontSize: 14, fontFamily: "Inter_700Bold" },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  tag: { backgroundColor: DS.color.primarySoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  tagText: { fontSize: 11, color: PRIMARY, fontFamily: "Inter_500Medium" },
  tipBox: { flexDirection: "row", gap: 8, backgroundColor: DS.color.greenSoft, borderRadius: 14, padding: 12, alignItems: "flex-start", marginBottom: 14 },
  tipText: { flex: 1, fontSize: 12.5, color: "#1A5C33", lineHeight: 18 },
  urgencyBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  urgencyDot: { width: 6, height: 6, borderRadius: 3 },
  urgencyText: { fontSize: 10.5, fontFamily: "Inter_700Bold" },
  summBox: { backgroundColor: "#F9FAFB", borderRadius: 14, padding: 14, marginBottom: 12 },
  summText: { fontSize: 13.5, color: "#374151", lineHeight: 20 },
  sectionSmall: { fontSize: 10.5, color: "#9CA3AF", marginBottom: 4, fontFamily: "Inter_500Medium" },
  sectionTitle: { fontSize: 13.5, fontFamily: "Inter_600SemiBold", color: C.text, marginBottom: 8 },
  findRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  findParam: { fontSize: 12.5, fontFamily: "Inter_600SemiBold", color: C.text },
  findRange: { fontSize: 10.5, color: "#9CA3AF" },
  findBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignItems: "flex-end" },
  findVal: { fontSize: 12.5, fontFamily: "Inter_700Bold" },
  findStatus: { fontSize: 10, fontFamily: "Inter_500Medium" },
  recRow: { flexDirection: "row", gap: 8, alignItems: "flex-start", marginBottom: 5 },
  recText: { flex: 1, fontSize: 12.5, color: "#374151", lineHeight: 18 },
  scanAgain: { borderRadius: 14, overflow: "hidden" },
  scanAgainGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13 },
  scanAgainText: { color: "#FFF", fontSize: 14.5, fontFamily: "Inter_600SemiBold" },
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: DS.color.bg },
  blob1: { position: "absolute", width: 300, height: 300, borderRadius: 150, backgroundColor: DS.color.primarySoft, opacity: 0.6, top: -100, right: -100 },
  blob2: { position: "absolute", width: 240, height: 240, borderRadius: 120, backgroundColor: DS.color.secondarySoft, opacity: 0.5, bottom: 180, left: -80 },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  headerTitle: { fontSize: 24, fontFamily: "Inter_700Bold", color: C.text },
  headerSub: { fontSize: 12.5, fontFamily: "Inter_400Regular", color: C.muted, marginTop: 2 },
  headerBadge: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", shadowColor: PRIMARY, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },

  hintsRow: { flexDirection: "row", gap: 8, marginBottom: 18 },
  hintCard: { flex: 1, backgroundColor: C.glass, borderRadius: 18, padding: 12, alignItems: "center", borderWidth: 1.2, shadowColor: PRIMARY, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3 },
  hintIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 7 },
  hintLabel: { fontSize: 10.5, fontFamily: "Inter_600SemiBold", color: C.text, textAlign: "center", marginBottom: 2 },
  hintSub: { fontSize: 9.5, color: C.muted, textAlign: "center" },

  scanArea: { alignItems: "center", marginBottom: 20 },
  scanningOverlay: { marginTop: 14, flexDirection: "row", alignItems: "center", gap: 8 },
  scanningText: { fontSize: 13, fontFamily: "Inter_500Medium", color: SKY },

  btnGroup: { gap: 10, marginBottom: 14 },
  cameraBtnWrap: { borderRadius: 18, overflow: "hidden", shadowColor: PRIMARY, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 7 },
  cameraBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 17 },
  cameraBtnText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  galleryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, backgroundColor: C.glass, borderRadius: 18, borderWidth: 1.5, borderColor: PRIMARY + "28" },
  galleryText: { color: PRIMARY, fontSize: 15, fontFamily: "Inter_500Medium" },

  scanningStatus: { alignItems: "center", paddingVertical: 8 },
  scanningTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: C.text, marginBottom: 6 },
  scanningSub: { fontSize: 12.5, color: C.muted, textAlign: "center" },

  unknownTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: C.text, marginTop: 12 },
  unknownSub: { fontSize: 13.5, color: C.muted, textAlign: "center", marginTop: 6, marginBottom: 20 },
  retryBtn: { backgroundColor: PRIMARY, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 },
  retryText: { color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 14 },
});