import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator, FlatList,
  Platform, Dimensions, Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { router, useFocusEffect } from "expo-router";
import { api, cachedGet } from "@/lib/api";
import { APILimitError } from "@/lib/apiErrors";
import { useAuth } from "@/context/AuthContext";
import { useAIScanUsage } from "@/lib/useAIScanUsage";
import { DS } from "@/lib/theme";
import { UpgradeModal, type UpgradeModalConfig } from "@/components/UpgradeModal";
import { AIUsageIndicator } from "@/components/AIUsageIndicator";
import { LimitWarningToast } from "@/components/LimitWarningToast";
import { ScanningOverlay } from "@/components/ScanningOverlay";
import { Plus, Utensils, X, Search, Mic, Camera, Image as ImageIcon, Sparkles } from "lucide-react-native";
import { useOfflineLog } from "@/hooks/useOfflineLog";

const { width: W } = Dimensions.get("window");
const P = DS.color.primary;
const G = DS.color.green;

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
type MealType = typeof MEAL_TYPES[number];
const MEAL_META: Record<MealType, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; grad: [string, string] }> = {
  breakfast: { label: "Breakfast", icon: "sunny-outline",        color: DS.color.orange, grad: ["#FF9500", "#FF3B30"] },
  lunch:     { label: "Lunch",     icon: "partly-sunny-outline", color: G,               grad: [G, "#059669"]         },
  dinner:    { label: "Dinner",    icon: "moon-outline",         color: DS.color.purple, grad: [DS.color.purple, P]   },
  snack:     { label: "Snack",     icon: "cafe-outline",         color: DS.color.sky,    grad: [DS.color.sky, "#0EA5E9"] },
};

type FoodLog = {
  id: string; foodNameEn: string; mealType: string;
  calories: string; proteinG?: string; carbsG?: string; fatG?: string; fiberG?: string;
  calciumMg?: string; vitaminB12Mcg?: string; vitaminCMg?: string; ironMg?: string;
  _offline?: boolean;
};
type FavItem = { foodNameEn: string; calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number; count: number };
type ScanResult = {
  foodNameEn: string; calories: number; proteinG: number; carbsG: number; fatG: number;
  fiberG: number; servingSizeG: number; servingDescription: string; category: string;
  dietaryTags: string[]; sodiumMg?: number; sugarG?: number;
  vitamins?: { vitaminC_mg?: number; vitaminD_mcg?: number; vitaminB12_mcg?: number; calcium_mg?: number; iron_mg?: number; potassium_mg?: number; zinc_mg?: number; vitaminA_mcg?: number };
  glycemicIndex?: number; healthTip?: string;
};
type ScanMeta = { fromHistory: boolean; fromDb: boolean; fromCache: boolean; historyCount?: number };

function today() { return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); }

function SourceBadge({ fromHistory, fromDb, fromCache }: { fromHistory: boolean; fromDb: boolean; fromCache: boolean }) {
  const text = fromHistory ? "⏱️ History" : fromDb ? "📚 DB" : fromCache ? "💾 Cache" : "🤖 AI";
  const bg   = fromHistory ? DS.color.greenSoft  : fromDb ? DS.color.primarySoft : fromCache ? DS.color.orangeSoft : DS.color.purpleSoft;
  const col  = fromHistory ? G : fromDb ? P : fromCache ? DS.color.orange : DS.color.purple;
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: bg }}>
      <Text style={{ color: col, fontSize: 10, fontFamily: "Inter_600SemiBold" }}>{text}</Text>
    </View>
  );
}

function MacroBars({ cal, protein, carbs, fat }: { cal: number; protein: number; carbs: number; fat: number }) {
  const total = protein * 4 + carbs * 4 + fat * 9 || 1;
  return (
    <View style={{ gap: 4 }}>
      {[
        { label: "Protein", val: protein, pct: (protein * 4) / total, color: DS.color.red    },
        { label: "Carbs",   val: carbs,   pct: (carbs * 4) / total,   color: P               },
        { label: "Fat",     val: fat,     pct: (fat * 9) / total,     color: DS.color.purple },
      ].map((m) => (
        <View key={m.label} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ color: DS.color.muted, fontSize: 10, fontFamily: "Inter_400Regular", width: 42 }}>{m.label}</Text>
          <View style={{ flex: 1, height: 5, backgroundColor: DS.color.bgSoft, borderRadius: 3, overflow: "hidden" }}>
            <View style={{ height: "100%", width: `${Math.round(m.pct * 100)}%`, backgroundColor: m.color, borderRadius: 3 }} />
          </View>
          <Text style={{ color: DS.color.text, fontSize: 10, fontFamily: "Inter_600SemiBold", width: 30, textAlign: "right" }}>{Math.round(m.val)}g</Text>
        </View>
      ))}
    </View>
  );
}

// ── Voice recognition ─────────────────────────────────────────────────────────
interface SpeechRecognitionEvent { results: Array<Array<{ transcript: string }>> }
interface SpeechRecognitionInstance {
  lang: string; interimResults: boolean; maxAlternatives: number;
  onstart: (() => void) | null; onend: (() => void) | null;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  start(): void; stop(): void;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function useVoice(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionInstance | null>(null);
  const start = useCallback(() => {
    if (Platform.OS !== "web") { Alert.alert("Voice Search", "Voice input works best in Android Chrome browser"); return; }
    const win = window as unknown as Record<string, unknown>;
    const Ctor = (win["SpeechRecognition"] || win["webkitSpeechRecognition"]) as SpeechRecognitionConstructor | undefined;
    if (!Ctor) { Alert.alert("Voice not supported", "Please update your browser or type the food name"); return; }
    const rec = new Ctor();
    rec.lang = "hi-IN"; rec.interimResults = false; rec.maxAlternatives = 3;
    rec.onstart  = () => setListening(true);
    rec.onend    = () => setListening(false);
    rec.onresult = (e: SpeechRecognitionEvent) => { const t = e.results[0]?.[0]?.transcript || ""; if (t) onResult(t); };
    rec.onerror  = () => setListening(false);
    rec.start(); recRef.current = rec;
  }, [onResult]);
  const stop = useCallback(() => { recRef.current?.stop(); setListening(false); }, []);
  return { listening, start, stop };
}

export default function FoodScreen() {
  const insets = useSafeAreaInsets();
  const topPad = insets.top;

  const [logs,         setLogs]         = useState<FoodLog[]>([]);
  const [totalCal,     setTotalCal]     = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [showModal,    setShowModal]    = useState(false);
  const [activeMeal,   setActiveMeal]   = useState<MealType>("breakfast");
  const [text,         setText]         = useState("");
  const [histResults,  setHistResults]  = useState<FavItem[]>([]);
  const [dbResults,    setDbResults]    = useState<Array<Record<string, unknown>>>([]);
  const [searching,    setSearching]    = useState(false);
  const [favorites,    setFavorites]    = useState<FavItem[]>([]);
  const [favsLoaded,   setFavsLoaded]   = useState(false);
  const [scanResult,   setScanResult]   = useState<ScanResult | null>(null);
  const [scanMeta,     setScanMeta]     = useState<ScanMeta | null>(null);
  const { user } = useAuth();
  const userPlan = ((user as Record<string, unknown>)?.plan as string || "FREE").toUpperCase();
  const [upgradeConfig, setUpgradeConfig] = useState<UpgradeModalConfig | null>(null);
  const [foodToastVisible, setFoodToastVisible] = useState(false);
  const [foodToastRemaining, setFoodToastRemaining] = useState(0);
  const foodScanUsage = useAIScanUsage("food_scan", userPlan);
  const [scanning,     setScanning]     = useState(false);
  const [selectedScanImage, setSelectedScanImage] = useState<string | null>(null);
  const [submitting,   setSubmitting]   = useState(false);
  const [pendingFoodItem, setPendingFoodItem] = useState<any | null>(null);
  const [quantity, setQuantity] = useState<string>("1");
  const [weatherData,  setWeatherData]  = useState<{
    weatherContext?: string; season?: string; weatherTip?: string;
    suggestions?: Array<{ name: string; nameHindi: string; emoji: string; reason: string; calories: number; benefit: string; category: string; isSeasonalSpecial: boolean }>;
  } | null>(null);
  const [showNutriReport, setShowNutriReport] = useState(false);
  const [nutriTab, setNutriTab] = useState<"weekly" | "monthly">("weekly");
  const [weeklyData, setWeeklyData] = useState<{
    days: Array<{ date: string; totalCalories: number; totalProteinG: number; totalCarbsG: number; totalFatG: number; totalCalciumMg: number; totalVitaminB12Mcg: number; totalVitaminCMg: number; totalIronMg: number; mealCount: number }>;
    weeklyTotals: { totalCalories: number; totalProteinG: number; totalCarbsG: number; totalFatG: number; totalCalciumMg: number; totalVitaminB12Mcg: number; totalVitaminCMg: number; totalIronMg: number };
    weeklyAverages: Record<string, number>;
  } | null>(null);
  const [monthlyData, setMonthlyData] = useState<{
    weeks: Array<{ weekLabel: string; startDate: string; endDate: string; totalCalories: number; totalProteinG: number; totalCarbsG: number; totalFatG: number; totalCalciumMg: number; totalVitaminB12Mcg: number; totalVitaminCMg: number; totalIronMg: number; mealCount: number }>;
    monthlyTotals: { totalCalories: number; totalProteinG: number; totalCarbsG: number; totalFatG: number; totalCalciumMg: number; totalVitaminB12Mcg: number; totalVitaminCMg: number; totalIronMg: number };
    monthlyAverages: Record<string, number>;
  } | null>(null);
  const [nutriLoading, setNutriLoading] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseAnim   = useRef(new Animated.Value(1)).current;

  const { logEntry, onSync } = useOfflineLog();

  const loadLogs = useCallback(async () => {
    try {
      const { data } = await cachedGet<{ logs: Array<Record<string, unknown>> }>(`/food/logs?date=${today()}`);
      const l = data.logs as FoodLog[];
      setLogs(l);
      setTotalCal(l.reduce((s, i) => s + Number(i.calories), 0));
    } catch { }
    setLoading(false);
  }, []);

  const loadFavs = useCallback(async () => {
    if (favsLoaded) return;
    try { const res = await api.getFoodFavorites(); setFavorites(res.favorites as FavItem[]); setFavsLoaded(true); } catch { }
  }, [favsLoaded]);

  const openNutriReport = useCallback(async (tab: "weekly" | "monthly") => {
    setNutriTab(tab);
    setShowNutriReport(true);
    setNutriLoading(true);
    try {
      if (tab === "weekly") {
        const res = await api.getWeeklyFoodNutrition();
        setWeeklyData(res);
      } else {
        const res = await api.getMonthlyFoodNutrition();
        setMonthlyData(res);
      }
    } catch { }
    setNutriLoading(false);
  }, []);

  useEffect(() => { loadLogs(); }, []);

  // Refresh food logs when offline queue syncs to server
  useEffect(() => onSync(loadLogs), [onSync, loadLogs]);

  useEffect(() => {
    api.getWeatherFoodSuggestions()
      .then((data) => setWeatherData(data))
      .catch(() => {});
  }, []);

  const { listening, start: startVoice, stop: stopVoice } = useVoice((spoken) => { setText(spoken); triggerSearch(spoken); });

  useEffect(() => {
    if (listening) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 500, useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: Platform.OS !== "web" }),
      ])).start();
    } else { pulseAnim.setValue(1); }
  }, [listening]);

  const triggerSearch = useCallback((q: string) => {
    setScanResult(null); setScanMeta(null);
    if (q.length < 2) { setHistResults([]); setDbResults([]); return; }
    setSearching(true);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      try {
        const [histRes, dbRes] = await Promise.allSettled([api.searchFoodHistory(q), api.searchFood(q)]);
        if (histRes.status === "fulfilled") setHistResults(histRes.value.items as FavItem[]);
        if (dbRes.status === "fulfilled") setDbResults(dbRes.value.items as Array<Record<string, unknown>>);
      } catch { }
      setSearching(false);
    }, 350);
  }, []);

  const handleTextChange = (t: string) => { setText(t); triggerSearch(t); };

  const pickPhoto = async () => {
    if (userPlan === "FREE") {
      setUpgradeConfig({ type: "plan_limit", featureKey: "food_scan", featureLabel: "Food Photo Scan", currentPlan: userPlan, requiredPlan: "PRO" });
      return;
    }
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert("Permission", "Gallery access is required"); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 0.5, base64: true });
      if (!result.canceled && result.assets[0]?.base64) {
        setSelectedScanImage(result.assets[0].uri);
        await runScan({ imageBase64: result.assets[0].base64, mimeType: "image/jpeg" });
      }
    } catch (err) { Alert.alert("Gallery Error", (err instanceof Error ? err.message : "Could not select photo. Please try again.")); }
  };

  const takePhoto = async () => {
    if (userPlan === "FREE") {
      setUpgradeConfig({ type: "plan_limit", featureKey: "food_scan", featureLabel: "Food Photo Scan", currentPlan: userPlan, requiredPlan: "PRO" });
      return;
    }
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { Alert.alert("Permission", "Camera access is required"); return; }
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.5, base64: true });
      if (!result.canceled && result.assets[0]?.base64) {
        setSelectedScanImage(result.assets[0].uri);
        await runScan({ imageBase64: result.assets[0].base64, mimeType: "image/jpeg" });
      }
    } catch (err) { Alert.alert("Camera Error", (err instanceof Error ? err.message : "Could not open camera. Please try again.")); }
  };

  const runScan = async (data: { foodName?: string; imageBase64?: string; mimeType?: string }) => {
    setScanning(true); setHistResults([]); setDbResults([]);
    try {
      const res = await api.scanFood(data);
      setScanResult(res.result);
      setScanMeta({ fromHistory: res.fromHistory, fromDb: res.fromDb, fromCache: res.fromCache, historyCount: res.historyCount });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const { remaining } = await foodScanUsage.increment();
      if (foodScanUsage.limit < 999 && remaining <= 2) {
        setFoodToastRemaining(remaining);
        setFoodToastVisible(true);
      }
    } catch (e: unknown) {
      if (e instanceof APILimitError) {
        if (e.type === "plan_limit") {
          setUpgradeConfig({ type: "plan_limit", featureKey: "food_scan", featureLabel: "Food Photo Scan", currentPlan: userPlan, requiredPlan: e.requiredPlan || "PRO" });
        } else {
          setUpgradeConfig({ type: "daily_limit", featureKey: "food_scan", featureLabel: "Food Photo Scan", used: e.used ?? foodScanUsage.used, limit: e.limit ?? foodScanUsage.limit });
        }
        return;
      }
      Alert.alert("AI Error", (e as Error).message || "Food analysis failed. Please try again.");
    }
    setScanning(false); setSelectedScanImage(null);
  };

  useFocusEffect(useCallback(() => { loadLogs(); }, []));

  const logItem = async (item: { foodNameEn: string; calories: number; proteinG?: number; carbsG?: number; fatG?: number; fiberG?: number; sodiumMg?: number; vitamins?: { vitaminC_mg?: number; vitaminD_mcg?: number; vitaminB12_mcg?: number; calcium_mg?: number; iron_mg?: number } }, method = "text", qtyMultiplier: number = 1) => {
    setSubmitting(true);
    const v = item.vitamins || {};

    // Apply quantity multiplier
    const calc = (val?: number) => String(Math.round(((val || 0) * qtyMultiplier) * 10) / 10);
    const calc100 = (val?: number) => String(Math.round(((val || 0) * qtyMultiplier) * 100) / 100);
    const calcCal = (val?: number) => String(Math.round((val || 0) * qtyMultiplier));

    const logBody = {
      foodNameEn: item.foodNameEn, mealType: activeMeal,
      calories: calcCal(item.calories),
      proteinG: calc(item.proteinG),
      carbsG:   calc(item.carbsG),
      fatG:     calc(item.fatG),
      fiberG:   calc(item.fiberG),
      quantityG: String(qtyMultiplier),
      quantityDescription: `${qtyMultiplier} serving${qtyMultiplier !== 1 ? 's' : ''}`,
      ...(item.sodiumMg != null   ? { sodiumMg:     calc(item.sodiumMg) }    : {}),
      ...(v.calcium_mg != null    ? { calciumMg:    calc(v.calcium_mg) }   : {}),
      ...(v.vitaminB12_mcg != null ? { vitaminB12Mcg: calc100(v.vitaminB12_mcg) } : {}),
      ...(v.vitaminC_mg != null   ? { vitaminCMg:   calc(v.vitaminC_mg) }   : {}),
      ...(v.iron_mg != null       ? { ironMg:       calc(v.iron_mg) }       : {}),
      ...(v.vitaminD_mcg != null  ? { vitaminDMcg:  calc(v.vitaminD_mcg) }  : {}),
      inputMethod: method,
    };
    try {
      const result = await logEntry({
        path: "/food/log",
        body: logBody,
        category: "food",
        onSynced: loadLogs,
        onOptimistic: (temp) => {
          // Show immediately in logs
          const tempLog: FoodLog = {
            id: temp.id as string,
            foodNameEn: item.foodNameEn,
            mealType: activeMeal,
            calories: calcCal(item.calories),
            proteinG: calc(item.proteinG),
            carbsG: calc(item.carbsG),
            fatG: calc(item.fatG),
            fiberG: calc(item.fiberG),
            _offline: true,
          };
          setLogs((prev) => [...prev, tempLog]);
          setTotalCal((c) => c + Number(calcCal(item.calories)));
        },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      closeModal(); setFavsLoaded(false);
      if (!result.offline) loadLogs();
    } catch (e: unknown) {
      Alert.alert("Error", (e as Error).message || "Could not log food.");
    } finally {
      setSubmitting(false);
    }
  };


  const handlePendingLog = (item: any) => {
    setPendingFoodItem(item);
    setQuantity("1");
  };

  const confirmLog = () => {
    if (!pendingFoodItem) return;
    const qty = parseFloat(quantity) || 1;
    logItem(pendingFoodItem, "text", qty);
    setPendingFoodItem(null);
  };

  const deleteLog = async (id: string, name: string) => {
    Alert.alert("Remove entry?", `Remove "${name}" from your food log?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try { await api.deleteFoodLog(id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); await loadLogs(); }
        catch { Alert.alert("Error", "Could not delete entry."); }
      }},
    ]);
  };

  const closeModal = () => {
    setShowModal(false); setText(""); setPendingFoodItem(null); setHistResults([]); setDbResults([]);
    setScanResult(null); setScanMeta(null);
  };
  const openModal = (meal: MealType) => { setActiveMeal(meal); setShowModal(true); loadFavs(); };

  const grouped = MEAL_TYPES.reduce((acc, mt) => {
    acc[mt] = logs.filter((l) => l.mealType === mt);
    return acc;
  }, {} as Record<MealType, FoodLog[]>);

  const calPct = Math.min(100, (totalCal / 2000) * 100);
  const totalP = logs.reduce((s, l) => s + Number(l.proteinG || 0), 0);
  const totalC = logs.reduce((s, l) => s + Number(l.carbsG || 0), 0);
  const totalF = logs.reduce((s, l) => s + Number(l.fatG || 0), 0);
  const totalCalcium = logs.reduce((s, l) => s + Number(l.calciumMg || 0), 0);
  const totalVitB12 = logs.reduce((s, l) => s + Number(l.vitaminB12Mcg || 0), 0);
  const totalVitC = logs.reduce((s, l) => s + Number(l.vitaminCMg || 0), 0);
  const totalIron = logs.reduce((s, l) => s + Number(l.ironMg || 0), 0);
  const hasMicros = totalCalcium > 0 || totalVitB12 > 0 || totalVitC > 0 || totalIron > 0;
  const noResults = text.length > 1 && !searching && histResults.length === 0 && dbResults.length === 0 && !scanResult;

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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: DS.color.primarySoft, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="arrow-back" size={19} color={P} />
            </TouchableOpacity>
            <View>
              <Text style={s.title}>Food Log 🍽️</Text>
              <Text style={s.subtitle}>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => openModal("breakfast")} activeOpacity={0.85} style={s.addBtn}>
            <Plus size={22} color="#FFF" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
        <View style={s.headerBorder} />
      </View>

      {/* ── Calorie Summary Card ── */}
      <View style={[s.summaryCard, { marginHorizontal: 16, marginTop: 12, marginBottom: 4 }]}>
        <View style={s.calRow}>
          {[
            { label: "Consumed", val: Math.round(totalCal),           color: DS.color.orange },
            { label: "Remaining",val: Math.max(0, 2000 - Math.round(totalCal)), color: G },
            { label: "Goal",     val: 2000,                           color: P },
          ].map((item, i, arr) => (
            <React.Fragment key={item.label}>
              <View style={s.calPill}>
                <Text style={[s.calVal, { color: item.color }]}>{item.val}</Text>
                <Text style={s.calLabel}>{item.label}</Text>
              </View>
              {i < arr.length - 1 && <View style={s.calDivider} />}
            </React.Fragment>
          ))}
        </View>
        <View style={s.progressTrack}>
          <LinearGradient
            colors={calPct >= 90 ? [DS.color.red, DS.color.orange] : [P, G]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={[s.progressFill, { width: `${calPct}%` as any }]}
          />
        </View>
        <MacroBars cal={totalCal} protein={totalP} carbs={totalC} fat={totalF} />
        {hasMicros && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            <Text style={{ color: DS.color.muted, fontSize: 9, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5, width: "100%", marginBottom: 2 }}>
              Today's Micronutrients
            </Text>
            {totalCalcium > 0 && (
              <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: "#0ea5e920" }}>
                <Text style={{ color: "#0ea5e9", fontSize: 10, fontFamily: "Inter_600SemiBold" }}>
                  Ca {Math.round(totalCalcium * 10) / 10}mg
                </Text>
              </View>
            )}
            {totalVitC > 0 && (
              <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: "#f59e0b20" }}>
                <Text style={{ color: "#f59e0b", fontSize: 10, fontFamily: "Inter_600SemiBold" }}>
                  Vit C {Math.round(totalVitC * 10) / 10}mg
                </Text>
              </View>
            )}
            {totalVitB12 > 0 && (
              <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: "#8b5cf620" }}>
                <Text style={{ color: "#8b5cf6", fontSize: 10, fontFamily: "Inter_600SemiBold" }}>
                  B12 {Math.round(totalVitB12 * 100) / 100}mcg
                </Text>
              </View>
            )}
            {totalIron > 0 && (
              <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: "#ef444420" }}>
                <Text style={{ color: "#ef4444", fontSize: 10, fontFamily: "Inter_600SemiBold" }}>
                  Fe {Math.round(totalIron * 10) / 10}mg
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* ── Nutrition Report Buttons ── */}
      <View style={{ flexDirection: "row", gap: 8, marginHorizontal: 16, marginTop: 8 }}>
        <TouchableOpacity onPress={() => openNutriReport("weekly")} activeOpacity={0.82} style={s.reportBtn}>
          <Text style={s.reportBtnIcon}>📊</Text>
          <Text style={s.reportBtnText}>Weekly Report</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => openNutriReport("monthly")} activeOpacity={0.82} style={s.reportBtn}>
          <Text style={s.reportBtnIcon}>📅</Text>
          <Text style={s.reportBtnText}>Monthly Report</Text>
        </TouchableOpacity>
      </View>

      {/* ── Weather Food Suggestions ── */}
      {weatherData?.suggestions && weatherData.suggestions.length > 0 && (
        <View style={{ marginTop: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, marginBottom: 8, gap: 6 }}>
            <Text style={{ fontSize: 14 }}>🌤️</Text>
            <Text style={{ color: DS.color.text, fontSize: 12, fontFamily: "Inter_600SemiBold", flex: 1 }}>
              {weatherData.season ? `Best for ${weatherData.season}` : "Seasonal picks for you"}
            </Text>
            {weatherData.weatherTip && (
              <Text style={{ color: DS.color.muted, fontSize: 10, fontFamily: "Inter_400Regular", maxWidth: 180 }} numberOfLines={1}>
                {weatherData.weatherTip}
              </Text>
            )}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
            {weatherData.suggestions.slice(0, 8).map((s) => (
              <TouchableOpacity
                key={s.name}
                activeOpacity={0.8}
                onPress={() => {
                  setText(s.name);
                  openModal("snack");
                  triggerSearch(s.name);
                }}
                style={{
                  backgroundColor: DS.color.bgSoft,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  alignItems: "center",
                  minWidth: 90,
                  borderWidth: s.isSeasonalSpecial ? 1 : 0,
                  borderColor: s.isSeasonalSpecial ? P + "40" : "transparent",
                }}
              >
                <Text style={{ fontSize: 22 }}>{s.emoji}</Text>
                <Text style={{ color: DS.color.text, fontSize: 11, fontFamily: "Inter_600SemiBold", textAlign: "center", marginTop: 2 }} numberOfLines={2}>
                  {s.name}
                </Text>
                <Text style={{ color: DS.color.muted, fontSize: 10, fontFamily: "Inter_400Regular" }}>{s.calories} kcal</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

        </View>
      )}

      {/* ── Meal Sections ── */}
      {loading ? (
        <ActivityIndicator color={P} size="large" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 90, paddingTop: 12 }} showsVerticalScrollIndicator={false}>
          {MEAL_TYPES.map((mt) => {
            const ml   = MEAL_META[mt];
            const mLogs = grouped[mt];
            const mCal  = Math.round(mLogs.reduce((s, l) => s + Number(l.calories), 0));
            return (
              <View key={mt} style={{ marginBottom: 14 }}>
                {/* Meal header */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <LinearGradient colors={ml.grad} style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={ml.icon} size={14} color="#FFF" />
                  </LinearGradient>
                  <Text style={s.mealTitle}>{ml.label}</Text>
                  {mCal > 0 && (
                    <View style={[s.mealBadge, { backgroundColor: ml.color + "18" }]}>
                      <Text style={[s.mealBadgeText, { color: ml.color }]}>{mCal} kcal</Text>
                    </View>
                  )}
                </View>

                {mLogs.length === 0 ? (
                  <TouchableOpacity onPress={() => openModal(mt)} activeOpacity={0.8} style={s.emptyMeal}>
                    <Ionicons name="add-circle-outline" size={18} color={ml.color} />
                    <Text style={[s.emptyMealText, { color: ml.color }]}>Add {ml.label}</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={s.mealCard}>
                    {mLogs.map((log, i) => (
                      <View key={log.id} style={[s.foodRow, i > 0 && s.foodRowBorder]}>
                        <View style={[s.foodDot, { backgroundColor: log._offline ? "#F59E0B" : ml.color }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={s.foodName}>{log.foodNameEn}</Text>
                          <Text style={s.foodMacros}>
                            {log._offline
                              ? "⏳ Saved offline — syncing when online"
                              : `P:${Math.round(Number(log.proteinG||0))}g · C:${Math.round(Number(log.carbsG||0))}g · F:${Math.round(Number(log.fatG||0))}g`}
                          </Text>
                        </View>
                        <Text style={[s.foodCal, { color: log._offline ? "#F59E0B" : ml.color }]}>{Math.round(Number(log.calories))}</Text>
                        {!log._offline && (
                          <TouchableOpacity onPress={() => deleteLog(log.id, log.foodNameEn)} style={{ padding: 4 }}>
                            <Ionicons name="close-circle-outline" size={18} color={DS.color.muted} />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                    <TouchableOpacity onPress={() => openModal(mt)} style={s.addMoreBtn}>
                      <Ionicons name="add-circle-outline" size={16} color={ml.color} />
                      <Text style={[s.addMoreText, { color: ml.color }]}>Add more</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>

      )}

      {/* ── NUTRITION REPORT MODAL ── */}
      <Modal visible={showNutriReport} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modalRoot}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{nutriTab === "weekly" ? "📊 Weekly Nutrition" : "📅 Monthly Nutrition"}</Text>
            <TouchableOpacity onPress={() => setShowNutriReport(false)} style={s.closeBtn}>
              <X size={20} color={DS.color.text} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {/* Tab switch */}
          <View style={{ flexDirection: "row", paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}>
            {(["weekly", "monthly"] as const).map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => openNutriReport(t)}
                style={[s.nutriTabBtn, nutriTab === t && s.nutriTabBtnActive]}
              >
                <Text style={[s.nutriTabBtnText, nutriTab === t && { color: "#FFF" }]}>
                  {t === "weekly" ? "7 Days" : "This Month"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {nutriLoading ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator color={P} size="large" />
              <Text style={{ color: DS.color.muted, fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 12 }}>Loading nutrition data...</Text>
            </View>
          ) : nutriTab === "weekly" && weeklyData ? (
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
              {/* Weekly totals summary */}
              <View style={s.nutriSummaryCard}>
                <Text style={s.nutriSummaryTitle}>7-Day Totals</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  {[
                    { label: "Calories", val: Math.round(weeklyData.weeklyTotals.totalCalories), unit: "kcal", color: DS.color.orange },
                    { label: "Protein",  val: Math.round(weeklyData.weeklyTotals.totalProteinG),  unit: "g",    color: DS.color.red    },
                    { label: "Carbs",    val: Math.round(weeklyData.weeklyTotals.totalCarbsG),    unit: "g",    color: P               },
                    { label: "Fat",      val: Math.round(weeklyData.weeklyTotals.totalFatG),      unit: "g",    color: DS.color.purple },
                    { label: "Calcium",  val: Math.round(weeklyData.weeklyTotals.totalCalciumMg), unit: "mg",   color: "#0ea5e9"       },
                    { label: "Vit C",    val: Math.round(weeklyData.weeklyTotals.totalVitaminCMg), unit: "mg",  color: "#f59e0b"       },
                    { label: "B12",      val: (weeklyData.weeklyTotals.totalVitaminB12Mcg).toFixed(1), unit: "mcg", color: "#8b5cf6"  },
                    { label: "Iron",     val: Math.round(weeklyData.weeklyTotals.totalIronMg),    unit: "mg",   color: DS.color.red    },
                  ].map((m) => (
                    <View key={m.label} style={[s.macroChip, { backgroundColor: m.color + "12" }]}>
                      <Text style={[s.macroChipVal, { color: m.color, fontSize: 15 }]}>{m.val}</Text>
                      <Text style={s.macroChipUnit}>{m.unit}</Text>
                      <Text style={s.macroChipLabel}>{m.label}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Daily breakdown */}
              <Text style={[s.sectionLabel, { marginTop: 16, marginBottom: 8 }]}>DAILY BREAKDOWN</Text>
              {weeklyData.days.map((day) => {
                const d = new Date(day.date);
                const dayLabel = d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
                const hasMicroData = day.totalCalciumMg > 0 || day.totalVitaminCMg > 0 || day.totalVitaminB12Mcg > 0 || day.totalIronMg > 0;
                return (
                  <View key={day.date} style={s.nutriDayCard}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: DS.color.text }}>{dayLabel}</Text>
                      <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                        {day.mealCount > 0 && (
                          <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: DS.color.muted }}>{day.mealCount} meals</Text>
                        )}
                        <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: DS.color.orange }}>{Math.round(day.totalCalories)} kcal</Text>
                      </View>
                    </View>
                    {day.totalCalories > 0 && (
                      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                        {[
                          { label: "P", val: day.totalProteinG, unit: "g", color: DS.color.red },
                          { label: "C", val: day.totalCarbsG,   unit: "g", color: P },
                          { label: "F", val: day.totalFatG,     unit: "g", color: DS.color.purple },
                        ].map((m) => (
                          <View key={m.label} style={{ flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: m.color + "12", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 }}>
                            <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: m.color }}>{m.label}:{Math.round(m.val)}{m.unit}</Text>
                          </View>
                        ))}
                        {hasMicroData && <>
                          {day.totalCalciumMg > 0 && <View style={{ flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: "#0ea5e912", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 }}><Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#0ea5e9" }}>Ca:{Math.round(day.totalCalciumMg)}mg</Text></View>}
                          {day.totalVitaminCMg > 0 && <View style={{ flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: "#f59e0b12", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 }}><Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#f59e0b" }}>C:{Math.round(day.totalVitaminCMg)}mg</Text></View>}
                          {day.totalVitaminB12Mcg > 0 && <View style={{ flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: "#8b5cf612", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 }}><Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#8b5cf6" }}>B12:{day.totalVitaminB12Mcg.toFixed(1)}mcg</Text></View>}
                          {day.totalIronMg > 0 && <View style={{ flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: "#ef444412", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 }}><Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#ef4444" }}>Fe:{Math.round(day.totalIronMg)}mg</Text></View>}
                        </>}
                      </View>
                    )}
                    {day.totalCalories === 0 && (
                      <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: DS.color.muted }}>No food logged this day</Text>
                    )}
                  </View>
                );
              })}
            </ScrollView>

          ) : nutriTab === "monthly" && monthlyData ? (
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
              {/* Monthly totals summary */}
              <View style={s.nutriSummaryCard}>
                <Text style={s.nutriSummaryTitle}>Monthly Totals</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  {[
                    { label: "Calories", val: Math.round(monthlyData.monthlyTotals.totalCalories), unit: "kcal", color: DS.color.orange },
                    { label: "Protein",  val: Math.round(monthlyData.monthlyTotals.totalProteinG),  unit: "g",    color: DS.color.red    },
                    { label: "Carbs",    val: Math.round(monthlyData.monthlyTotals.totalCarbsG),    unit: "g",    color: P               },
                    { label: "Fat",      val: Math.round(monthlyData.monthlyTotals.totalFatG),      unit: "g",    color: DS.color.purple },
                    { label: "Calcium",  val: Math.round(monthlyData.monthlyTotals.totalCalciumMg), unit: "mg",   color: "#0ea5e9"       },
                    { label: "Vit C",    val: Math.round(monthlyData.monthlyTotals.totalVitaminCMg), unit: "mg",  color: "#f59e0b"       },
                    { label: "B12",      val: (monthlyData.monthlyTotals.totalVitaminB12Mcg).toFixed(1), unit: "mcg", color: "#8b5cf6"  },
                    { label: "Iron",     val: Math.round(monthlyData.monthlyTotals.totalIronMg),    unit: "mg",   color: DS.color.red    },
                  ].map((m) => (
                    <View key={m.label} style={[s.macroChip, { backgroundColor: m.color + "12" }]}>
                      <Text style={[s.macroChipVal, { color: m.color, fontSize: 15 }]}>{m.val}</Text>
                      <Text style={s.macroChipUnit}>{m.unit}</Text>
                      <Text style={s.macroChipLabel}>{m.label}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Weekly breakdown */}
              <Text style={[s.sectionLabel, { marginTop: 16, marginBottom: 8 }]}>WEEK-BY-WEEK BREAKDOWN</Text>
              {monthlyData.weeks.map((wk) => {
                const hasMicroData = wk.totalCalciumMg > 0 || wk.totalVitaminCMg > 0 || wk.totalVitaminB12Mcg > 0 || wk.totalIronMg > 0;
                return (
                  <View key={wk.weekLabel} style={s.nutriDayCard}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <View>
                        <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: DS.color.text }}>{wk.weekLabel}</Text>
                        <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: DS.color.muted }}>{wk.mealCount} meals logged</Text>
                      </View>
                      <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: DS.color.orange }}>{Math.round(wk.totalCalories)} kcal</Text>
                    </View>
                    {wk.totalCalories > 0 && (
                      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                        {[
                          { label: "P", val: wk.totalProteinG, unit: "g", color: DS.color.red },
                          { label: "C", val: wk.totalCarbsG,   unit: "g", color: P },
                          { label: "F", val: wk.totalFatG,     unit: "g", color: DS.color.purple },
                        ].map((m) => (
                          <View key={m.label} style={{ flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: m.color + "12", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 }}>
                            <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: m.color }}>{m.label}:{Math.round(m.val)}{m.unit}</Text>
                          </View>
                        ))}
                        {hasMicroData && <>
                          {wk.totalCalciumMg > 0 && <View style={{ flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: "#0ea5e912", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 }}><Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#0ea5e9" }}>Ca:{Math.round(wk.totalCalciumMg)}mg</Text></View>}
                          {wk.totalVitaminCMg > 0 && <View style={{ flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: "#f59e0b12", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 }}><Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#f59e0b" }}>C:{Math.round(wk.totalVitaminCMg)}mg</Text></View>}
                          {wk.totalVitaminB12Mcg > 0 && <View style={{ flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: "#8b5cf612", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 }}><Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#8b5cf6" }}>B12:{wk.totalVitaminB12Mcg.toFixed(1)}mcg</Text></View>}
                          {wk.totalIronMg > 0 && <View style={{ flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: "#ef444412", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 }}><Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#ef4444" }}>Fe:{Math.round(wk.totalIronMg)}mg</Text></View>}
                        </>}
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>

          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 32, marginBottom: 12 }}>📭</Text>
              <Text style={{ color: DS.color.muted, fontFamily: "Inter_400Regular", fontSize: 14 }}>No data found</Text>
            </View>
          )}
        </View>
      </Modal>

      {/* ── ADD FOOD MODAL ── */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modalRoot}>
          {/* Modal Header */}
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Add Food 🍎</Text>
            <TouchableOpacity onPress={closeModal} style={s.closeBtn}>
              <X size={20} color={DS.color.text} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {/* Meal type tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}>
            {MEAL_TYPES.map((mt) => {
              const ml = MEAL_META[mt];
              return activeMeal === mt ? (
                <LinearGradient key={mt} colors={ml.grad} style={s.mealTab}>
                  <Ionicons name={ml.icon} size={14} color="#FFF" />
                  <Text style={[s.mealTabText, { color: "#FFF" }]}>{ml.label}</Text>
                </LinearGradient>
              ) : (
                <TouchableOpacity key={mt} onPress={() => setActiveMeal(mt)} style={s.mealTabOff}>
                  <Ionicons name={ml.icon} size={14} color={DS.color.muted} />
                  <Text style={[s.mealTabText, { color: DS.color.muted }]}>{ml.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>


          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
            {/* Favourites */}
            {favorites.length > 0 && !scanResult && (
              <View style={{ marginBottom: 14 }}>
                <Text style={s.sectionLabel}>⭐ FAVOURITES — ONE TAP ADD</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {favorites.slice(0, 10).map((fav) => (
                    <TouchableOpacity
                      key={fav.foodNameEn}
                      onPress={() => handlePendingLog(fav)}
                      disabled={submitting}
                      activeOpacity={0.8}
                      style={s.favChip}
                    >
                      <Text style={{ fontSize: 12 }}>⭐</Text>
                      <View>
                        <Text style={s.favName} numberOfLines={1}>{fav.foodNameEn}</Text>
                        <Text style={s.favCal}>{Math.round(fav.calories)} kcal · {fav.count}x</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Search bar */}
            <View style={s.searchCard}>
              <View style={s.searchRow}>
                <Search size={18} color={DS.color.muted} strokeWidth={2} />
                <TextInput
                  style={s.searchInput}
                  placeholder="Food name — Hindi, English, any language..."
                  placeholderTextColor={DS.color.muted}
                  value={text}
                  onChangeText={handleTextChange}
                  autoFocus
                />
                {searching && <ActivityIndicator size="small" color={P} />}
                {Platform.OS === "web" && (
                  <TouchableOpacity onPress={listening ? stopVoice : startVoice} style={{ padding: 6 }}>
                    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                      <Ionicons name={listening ? "mic" : "mic-outline"} size={22} color={listening ? DS.color.red : DS.color.muted} />
                    </Animated.View>
                  </TouchableOpacity>
                )}
              </View>
              <View style={s.cameraRow}>
                <TouchableOpacity onPress={takePhoto} style={s.cameraBtn}>
                  <Camera size={18} color={P} strokeWidth={2} />
                  <Text style={s.cameraBtnText}>Take Photo</Text>
                </TouchableOpacity>
                <View style={{ width: 1, backgroundColor: DS.color.borderLight }} />
                <TouchableOpacity onPress={pickPhoto} style={s.cameraBtn}>
                  <ImageIcon size={18} color={P} strokeWidth={2} />
                  <Text style={s.cameraBtnText}>From Gallery</Text>
                </TouchableOpacity>
              </View>
              <AIUsageIndicator
                used={foodScanUsage.used}
                limit={foodScanUsage.limit}
                label="scans"
                iconName="camera-outline"
                compact
              />
            </View>

            {/* Listening indicator */}
            {listening && (
              <View style={s.listeningBanner}>
                <Animated.View style={[s.listeningDot, { transform: [{ scale: pulseAnim }] }]} />
                <Text style={s.listeningText}>Listening… say your food name</Text>
              </View>
            )}

            {/* History results */}
            {histResults.length > 0 && !scanResult && (
              <View style={{ marginBottom: 12 }}>
                <Text style={s.sectionLabel}>⏱️ YOUR HISTORY</Text>
                <View style={s.resultCard}>
                  {histResults.map((item, i) => (
                    <TouchableOpacity
                      key={item.foodNameEn}
                      onPress={() => handlePendingLog(item)}
                      disabled={submitting}
                      style={[s.resultRow, i > 0 && s.resultRowBorder]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={s.resultName}>{item.foodNameEn}</Text>
                        <Text style={s.resultCal}>{Math.round(item.calories)} kcal · eaten {item.count}x</Text>
                      </View>
                      <SourceBadge fromHistory={true} fromDb={false} fromCache={false} />
                      <Ionicons name="add-circle" size={24} color={G} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* DB results */}
            {dbResults.length > 0 && !scanResult && (
              <View style={{ marginBottom: 12 }}>
                <Text style={s.sectionLabel}>📚 DATABASE</Text>
                <View style={s.resultCard}>
                  {dbResults.slice(0, 8).map((item, i) => (
                    <TouchableOpacity
                      key={String(item.id)}
                      onPress={() => handlePendingLog({ foodNameEn: String(item.foodNameEn), calories: Number(item.calories), proteinG: Number(item.proteinG||0), carbsG: Number(item.carbsG||0), fatG: Number(item.fatG||0), fiberG: Number(item.fiberG||0) })}
                      disabled={submitting}
                      style={[s.resultRow, i > 0 && s.resultRowBorder]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={s.resultName}>{String(item.foodNameEn)}</Text>
                        <Text style={s.resultCal}>{Math.round(Number(item.calories))} kcal per 100g</Text>
                      </View>
                      <SourceBadge fromHistory={false} fromDb={true} fromCache={false} />
                      <Ionicons name="add-circle" size={24} color={P} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Not found — use AI */}
            {noResults && !scanning && (
              <View style={[s.resultCard, { padding: 16 }]}>
                <Text style={s.notFoundText}>"{text}" not found in history or database</Text>
                <TouchableOpacity onPress={() => runScan({ foodName: text })} activeOpacity={0.85}>
                  <LinearGradient colors={[DS.color.purple, P]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.aiBtn}>
                    <Sparkles size={18} color="#FFF" strokeWidth={2} />
                    <Text style={s.aiBtnText}>Analyse with AI</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <Text style={s.aiNote}>AI result will be saved — no call needed next time</Text>
              </View>
            )}

            {/* Scanning loader */}
            {scanning && (
              <View style={[s.resultCard, { padding: 30, alignItems: "center" }]}>
                <ActivityIndicator color={DS.color.purple} size="large" />
                <Text style={s.scanningText}>AI is analysing...</Text>
                <Text style={s.scanningNote}>History → DB → Cache → Gemini AI</Text>
              </View>
            )}

            {/* Scan result */}
            {scanResult && scanMeta && (
              <View style={[s.resultCard, { overflow: "hidden" }]}>
                <LinearGradient colors={[DS.color.purple + "10", P + "06"]} style={{ padding: 16 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <Text style={s.resultName} numberOfLines={2}>{scanResult.foodNameEn}</Text>
                    <SourceBadge fromHistory={scanMeta.fromHistory} fromDb={scanMeta.fromDb} fromCache={scanMeta.fromCache} />
                  </View>

                  {scanMeta.fromHistory && scanMeta.historyCount && (
                    <View style={[s.historyBadge]}>
                      <Text style={s.historyBadgeText}>✅ You've eaten this {scanMeta.historyCount}× before — loaded from history!</Text>
                    </View>
                  )}

                  {/* Macro grid */}
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                    {[
                      { label: "Calories", val: scanResult.calories, unit: "kcal", color: DS.color.orange },
                      { label: "Protein",  val: scanResult.proteinG, unit: "g",    color: DS.color.red    },
                      { label: "Carbs",    val: scanResult.carbsG,   unit: "g",    color: P               },
                      { label: "Fat",      val: scanResult.fatG,     unit: "g",    color: DS.color.purple },
                      { label: "Fiber",    val: scanResult.fiberG,   unit: "g",    color: G               },
                      ...(scanResult.sugarG != null ? [{ label: "Sugar", val: scanResult.sugarG, unit: "g", color: DS.color.orange }] : []),
                      ...(scanResult.vitamins?.calcium_mg != null ? [{ label: "Calcium", val: scanResult.vitamins.calcium_mg, unit: "mg", color: "#0ea5e9" }] : []),
                      ...(scanResult.vitamins?.vitaminC_mg != null ? [{ label: "Vit C", val: scanResult.vitamins.vitaminC_mg, unit: "mg", color: "#f59e0b" }] : []),
                      ...(scanResult.vitamins?.vitaminB12_mcg != null ? [{ label: "B12", val: scanResult.vitamins.vitaminB12_mcg, unit: "mcg", color: "#8b5cf6" }] : []),
                      ...(scanResult.vitamins?.iron_mg != null ? [{ label: "Iron", val: scanResult.vitamins.iron_mg, unit: "mg", color: "#ef4444" }] : []),
                    ].map((m) => (
                      <View key={m.label} style={[s.macroChip, { backgroundColor: m.color + "12" }]}>
                        <Text style={[s.macroChipVal, { color: m.color }]}>{Number(m.val).toFixed(1)}</Text>
                        <Text style={s.macroChipUnit}>{m.unit}</Text>
                        <Text style={s.macroChipLabel}>{m.label}</Text>
                      </View>
                    ))}
                  </View>

                  {scanResult.healthTip && (
                    <View style={s.healthTip}>
                      <Text style={s.healthTipText}>💡 {scanResult.healthTip}</Text>
                    </View>
                  )}

                  {scanResult.dietaryTags?.length > 0 && (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                      {scanResult.dietaryTags.map((tag) => (
                        <View key={tag} style={s.dietTag}>
                          <Text style={s.dietTagText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <TouchableOpacity onPress={() => handlePendingLog(scanResult)} disabled={submitting} activeOpacity={0.85}>
                    <LinearGradient colors={[P, G]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.logBtn}>
                      {submitting
                        ? <ActivityIndicator color="#FFF" />
                        : <>
                            <Ionicons name="add-circle-outline" size={18} color="#FFF" />
                            <Text style={s.logBtnText}>Log to {MEAL_META[activeMeal].label} ✓</Text>
                          </>
                      }
                    </LinearGradient>
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            )}
          </ScrollView>

        </View>
      </Modal>

      {/* ── QUANTITY MODAL ── */}
      <Modal visible={!!pendingFoodItem} animationType="fade" transparent presentationStyle="overFullScreen">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#FFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: insets.bottom + 24 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: DS.color.text }} numberOfLines={1}>{pendingFoodItem?.foodNameEn}</Text>
              <TouchableOpacity onPress={() => setPendingFoodItem(null)} style={s.closeBtn}>
                <X size={20} color={DS.color.text} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginVertical: 20, gap: 16 }}>
              <TouchableOpacity onPress={() => setQuantity(String(Math.max(0.5, (parseFloat(quantity) || 1) - 0.5)))} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: DS.color.bgSoft, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 24, color: DS.color.text }}>-</Text>
              </TouchableOpacity>
              <View style={{ alignItems: "center" }}>
                <TextInput
                  style={{ fontSize: 32, fontFamily: "Inter_700Bold", color: P, textAlign: "center", minWidth: 80 }}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="numeric"
                  maxLength={4}
                />
                <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: DS.color.muted }}>Servings / Multiplier</Text>
              </View>
              <TouchableOpacity onPress={() => setQuantity(String((parseFloat(quantity) || 1) + 0.5))} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: DS.color.bgSoft, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 24, color: DS.color.text }}>+</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: "row", justifyContent: "space-around", marginBottom: 24, backgroundColor: DS.color.bgSoft, padding: 12, borderRadius: 16 }}>
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: DS.color.orange }}>{Math.round((pendingFoodItem?.calories || 0) * (parseFloat(quantity) || 1))}</Text>
                <Text style={{ fontSize: 10, fontFamily: "Inter_500Medium", color: DS.color.muted }}>kcal</Text>
              </View>
              <View style={{ width: 1, backgroundColor: DS.color.borderLight }} />
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: DS.color.red }}>{Math.round((pendingFoodItem?.proteinG || 0) * (parseFloat(quantity) || 1) * 10) / 10}g</Text>
                <Text style={{ fontSize: 10, fontFamily: "Inter_500Medium", color: DS.color.muted }}>Protein</Text>
              </View>
              <View style={{ width: 1, backgroundColor: DS.color.borderLight }} />
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: P }}>{Math.round((pendingFoodItem?.carbsG || 0) * (parseFloat(quantity) || 1) * 10) / 10}g</Text>
                <Text style={{ fontSize: 10, fontFamily: "Inter_500Medium", color: DS.color.muted }}>Carbs</Text>
              </View>
              <View style={{ width: 1, backgroundColor: DS.color.borderLight }} />
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: DS.color.purple }}>{Math.round((pendingFoodItem?.fatG || 0) * (parseFloat(quantity) || 1) * 10) / 10}g</Text>
                <Text style={{ fontSize: 10, fontFamily: "Inter_500Medium", color: DS.color.muted }}>Fat</Text>
              </View>
            </View>

            <TouchableOpacity onPress={confirmLog} disabled={submitting || (parseFloat(quantity) || 0) <= 0}>
              <LinearGradient colors={[P, G]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.logBtn}>
                {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={s.logBtnText}>Confirm Logging</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <LimitWarningToast
        visible={foodToastVisible}
        remaining={foodToastRemaining}
        featureLabel="scan"
        onDismiss={() => setFoodToastVisible(false)}
      />
      <UpgradeModal config={upgradeConfig} onClose={() => setUpgradeConfig(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },

  headerWrap: {
    overflow: "hidden",
    borderBottomWidth: 0.5, borderBottomColor: "rgba(0,0,0,0.07)",
    ...Platform.select({ ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8 }, android: { elevation: 4 }, default: {} }),
  },
  headerRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8 },
  headerBorder:{ position: "absolute", bottom: 0, left: 0, right: 0, height: 0.5, backgroundColor: "rgba(0,0,0,0.06)" },
  title:       { fontSize: 22, fontFamily: "Inter_700Bold", color: DS.color.text },
  subtitle:    { fontSize: 11, fontFamily: "Inter_400Regular", color: DS.color.muted, marginTop: 2 },
  addBtn:      { width: 42, height: 42, borderRadius: 21, backgroundColor: P, alignItems: "center", justifyContent: "center", ...DS.shadow.md },

  // Summary card
  summaryCard:{ backgroundColor: "#FFF", borderRadius: DS.radius.xl, padding: 14, borderWidth: 1, borderColor: DS.color.border, ...DS.shadow.sm },
  calRow:     { flexDirection: "row", justifyContent: "space-around", marginBottom: 10 },
  calPill:    { alignItems: "center" },
  calVal:     { fontSize: 24, fontFamily: "Inter_700Bold" },
  calLabel:   { fontSize: 11, fontFamily: "Inter_400Regular", color: DS.color.muted },
  calDivider: { width: 1, backgroundColor: DS.color.borderLight, alignSelf: "stretch" },
  progressTrack:{ height: 6, borderRadius: 3, backgroundColor: DS.color.bgSoft, overflow: "hidden", marginBottom: 10 },
  progressFill: { height: 6, borderRadius: 3 },

  // Meal sections
  mealTitle:    { fontSize: 15, fontFamily: "Inter_600SemiBold", color: DS.color.text, flex: 1 },
  mealBadge:    { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  mealBadgeText:{ fontSize: 12, fontFamily: "Inter_600SemiBold" },
  emptyMeal:    { borderWidth: 1.5, borderColor: DS.color.border, borderStyle: "dashed", borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFF" },
  emptyMealText:{ fontFamily: "Inter_500Medium", fontSize: 13 },
  mealCard:     { backgroundColor: "#FFF", borderRadius: DS.radius.lg, borderWidth: 1, borderColor: DS.color.border, overflow: "hidden", ...DS.shadow.sm },
  foodRow:      { paddingHorizontal: 14, paddingVertical: 11, flexDirection: "row", alignItems: "center", gap: 10 },
  foodRowBorder:{ borderTopWidth: 1, borderTopColor: DS.color.borderLight },
  foodDot:      { width: 6, height: 6, borderRadius: 3 },
  foodName:     { fontSize: 13, fontFamily: "Inter_500Medium", color: DS.color.text, marginBottom: 1 },
  foodMacros:   { fontSize: 11, fontFamily: "Inter_400Regular", color: DS.color.muted },
  foodCal:      { fontFamily: "Inter_700Bold", fontSize: 14 },
  addMoreBtn:   { flexDirection: "row", alignItems: "center", gap: 6, padding: 12, borderTopWidth: 1, borderTopColor: DS.color.borderLight },
  addMoreText:  { fontSize: 12, fontFamily: "Inter_500Medium" },

  // Modal
  modalRoot:   { flex: 1, backgroundColor: "#FFF" },
  modalHeader: { flexDirection: "row", alignItems: "center", padding: 18, paddingTop: 20, borderBottomWidth: 1, borderBottomColor: DS.color.borderLight },
  modalTitle:  { flex: 1, fontSize: 18, fontFamily: "Inter_700Bold", color: DS.color.text },
  closeBtn:    { width: 34, height: 34, borderRadius: 17, backgroundColor: DS.color.bgSoft, alignItems: "center", justifyContent: "center" },

  mealTab:    { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  mealTabOff: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "#FFF", borderWidth: 1, borderColor: DS.color.border },
  mealTabText:{ fontSize: 13, fontFamily: "Inter_600SemiBold" },

  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: DS.color.muted, letterSpacing: 0.5, marginBottom: 6 },

  favChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FFF", borderWidth: 1, borderColor: DS.color.border, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 7 },
  favName: { fontSize: 12, fontFamily: "Inter_500Medium", color: DS.color.text },
  favCal:  { fontSize: 10, fontFamily: "Inter_400Regular", color: DS.color.muted },

  searchCard:  { backgroundColor: "#FFF", borderRadius: DS.radius.lg, borderWidth: 1, borderColor: DS.color.border, overflow: "hidden", marginBottom: 12, ...DS.shadow.sm },
  searchRow:   { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 2, gap: 8 },
  searchInput: { flex: 1, color: DS.color.text, fontFamily: "Inter_400Regular", fontSize: 14, paddingVertical: 12 },
  cameraRow:   { flexDirection: "row", borderTopWidth: 1, borderTopColor: DS.color.borderLight },
  cameraBtn:   { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10 },
  cameraBtnText: { color: P, fontFamily: "Inter_500Medium", fontSize: 12 },

  listeningBanner: { backgroundColor: DS.color.redSoft, borderRadius: 12, padding: 12, marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  listeningDot:    { width: 10, height: 10, borderRadius: 5, backgroundColor: DS.color.red },
  listeningText:   { color: DS.color.red, fontFamily: "Inter_500Medium", fontSize: 13 },

  resultCard:    { backgroundColor: "#FFF", borderRadius: DS.radius.lg, borderWidth: 1, borderColor: DS.color.border, overflow: "hidden", marginBottom: 12, ...DS.shadow.sm },
  resultRow:     { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  resultRowBorder: { borderTopWidth: 1, borderTopColor: DS.color.borderLight },
  resultName:    { fontSize: 13, fontFamily: "Inter_500Medium", color: DS.color.text },
  resultCal:     { fontSize: 11, fontFamily: "Inter_400Regular", color: DS.color.muted },

  notFoundText:  { fontSize: 13, fontFamily: "Inter_400Regular", color: DS.color.muted, marginBottom: 12, textAlign: "center" },
  aiBtn:         { borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  aiBtnText:     { color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  aiNote:        { color: DS.color.muted, fontSize: 10, textAlign: "center", marginTop: 8 },

  scanningText: { fontSize: 14, fontFamily: "Inter_500Medium", color: DS.color.text, marginTop: 12 },
  scanningNote: { fontSize: 11, fontFamily: "Inter_400Regular", color: DS.color.muted, marginTop: 4 },

  historyBadge:     { backgroundColor: DS.color.greenSoft, borderRadius: 10, padding: 8, marginBottom: 10 },
  historyBadgeText: { color: G, fontSize: 11, fontFamily: "Inter_500Medium" },
  macroChip:        { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, alignItems: "center", minWidth: 70 },
  macroChipVal:     { fontFamily: "Inter_700Bold", fontSize: 18 },
  macroChipUnit:    { fontSize: 9, fontFamily: "Inter_400Regular", color: DS.color.muted },
  macroChipLabel:   { fontSize: 10, fontFamily: "Inter_500Medium", color: DS.color.muted },
  healthTip:        { backgroundColor: DS.color.greenSoft, borderRadius: 10, padding: 10, marginBottom: 12 },
  healthTipText:    { color: G, fontSize: 12, fontFamily: "Inter_400Regular" },
  dietTag:          { backgroundColor: DS.color.greenSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  dietTagText:      { color: G, fontSize: 10, fontFamily: "Inter_500Medium" },
  logBtn:           { borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  logBtnText:       { color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 14 },

  // Nutrition report
  reportBtn:        { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#FFF", borderRadius: DS.radius.lg, paddingVertical: 10, borderWidth: 1, borderColor: DS.color.border, ...DS.shadow.sm },
  reportBtnIcon:    { fontSize: 14 },
  reportBtnText:    { fontSize: 12, fontFamily: "Inter_600SemiBold", color: DS.color.text },
  nutriTabBtn:      { flex: 1, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: DS.color.border, alignItems: "center", backgroundColor: "#FFF" },
  nutriTabBtnActive:{ backgroundColor: P, borderColor: P },
  nutriTabBtnText:  { fontSize: 13, fontFamily: "Inter_600SemiBold", color: DS.color.muted },
  nutriSummaryCard: { backgroundColor: "#FFF", borderRadius: DS.radius.xl, padding: 14, borderWidth: 1, borderColor: DS.color.border, ...DS.shadow.sm },
  nutriSummaryTitle:{ fontSize: 13, fontFamily: "Inter_700Bold", color: DS.color.text },
  nutriDayCard:     { backgroundColor: "#FFF", borderRadius: DS.radius.lg, padding: 12, borderWidth: 1, borderColor: DS.color.border, marginBottom: 8, ...DS.shadow.sm },
});
