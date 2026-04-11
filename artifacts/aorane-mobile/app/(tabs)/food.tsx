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
import { api } from "@/lib/api";
import { DS } from "@/lib/theme";
import { Plus, Utensils, X, Search, Mic, Camera, Image as ImageIcon, Sparkles } from "lucide-react-native";

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
};
type FavItem = { foodNameEn: string; calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number; count: number };
type ScanResult = {
  foodNameEn: string; calories: number; proteinG: number; carbsG: number; fatG: number;
  fiberG: number; servingSizeG: number; servingDescription: string; category: string;
  dietaryTags: string[]; sodiumMg?: number; sugarG?: number;
  vitamins?: Record<string, number>; glycemicIndex?: number; healthTip?: string;
};
type ScanMeta = { fromHistory: boolean; fromDb: boolean; fromCache: boolean; historyCount?: number };

function today() { return new Date().toISOString().slice(0, 10); }

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
  const topPad = Platform.OS === "web" ? 67 : insets.top;

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
  const [scanning,     setScanning]     = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseAnim   = useRef(new Animated.Value(1)).current;

  const loadLogs = useCallback(async () => {
    try {
      const res = await api.getFoodLogs(today());
      const l = res.logs as FoodLog[];
      setLogs(l);
      setTotalCal(l.reduce((s, i) => s + Number(i.calories), 0));
    } catch { }
    setLoading(false);
  }, []);

  const loadFavs = useCallback(async () => {
    if (favsLoaded) return;
    try { const res = await api.getFoodFavorites(); setFavorites(res.favorites as FavItem[]); setFavsLoaded(true); } catch { }
  }, [favsLoaded]);

  useEffect(() => { loadLogs(); }, []);

  const { listening, start: startVoice, stop: stopVoice } = useVoice((spoken) => { setText(spoken); triggerSearch(spoken); });

  useEffect(() => {
    if (listening) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
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
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert("Permission", "Gallery access is required"); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.7, base64: true });
      if (!result.canceled && result.assets[0]?.base64) {
        await runScan({ imageBase64: result.assets[0].base64, mimeType: "image/jpeg" });
      }
    } catch { Alert.alert("Error", "Could not select photo. Please try again."); }
  };

  const takePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { Alert.alert("Permission", "Camera access is required"); return; }
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.7, base64: true });
      if (!result.canceled && result.assets[0]?.base64) {
        await runScan({ imageBase64: result.assets[0].base64, mimeType: "image/jpeg" });
      }
    } catch { Alert.alert("Error", "Could not open camera. Please try again."); }
  };

  const runScan = async (data: { foodName?: string; imageBase64?: string; mimeType?: string }) => {
    setScanning(true); setHistResults([]); setDbResults([]);
    try {
      const res = await api.scanFood(data);
      setScanResult(res.result);
      setScanMeta({ fromHistory: res.fromHistory, fromDb: res.fromDb, fromCache: res.fromCache, historyCount: res.historyCount });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) { Alert.alert("AI Error", (e as Error).message || "Food analysis failed. Please try again."); }
    setScanning(false);
  };

  useFocusEffect(useCallback(() => { loadLogs(); }, []));

  const logItem = async (item: { foodNameEn: string; calories: number; proteinG?: number; carbsG?: number; fatG?: number; fiberG?: number }, method = "text") => {
    setSubmitting(true);
    try {
      await api.logFood({
        foodNameEn: item.foodNameEn, mealType: activeMeal,
        calories: String(Math.round(item.calories)),
        proteinG: String(Math.round((item.proteinG || 0) * 10) / 10),
        carbsG:   String(Math.round((item.carbsG || 0) * 10) / 10),
        fatG:     String(Math.round((item.fatG || 0) * 10) / 10),
        fiberG:   String(Math.round((item.fiberG || 0) * 10) / 10),
        inputMethod: method,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      closeModal(); setFavsLoaded(false);
      setTimeout(() => router.back(), 400);
    } catch (e: unknown) { Alert.alert("Error", (e as Error).message || "Could not log food."); setSubmitting(false); }
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
    setShowModal(false); setText(""); setHistResults([]); setDbResults([]);
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
          <View>
            <Text style={s.title}>Food Log 🍽️</Text>
            <Text style={s.subtitle}>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}</Text>
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
      </View>

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
                        <View style={[s.foodDot, { backgroundColor: ml.color }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={s.foodName}>{log.foodNameEn}</Text>
                          <Text style={s.foodMacros}>
                            P:{Math.round(Number(log.proteinG||0))}g · C:{Math.round(Number(log.carbsG||0))}g · F:{Math.round(Number(log.fatG||0))}g
                          </Text>
                        </View>
                        <Text style={[s.foodCal, { color: ml.color }]}>{Math.round(Number(log.calories))}</Text>
                        <TouchableOpacity onPress={() => deleteLog(log.id, log.foodNameEn)} style={{ padding: 4 }}>
                          <Ionicons name="close-circle-outline" size={18} color={DS.color.muted} />
                        </TouchableOpacity>
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
                      onPress={() => logItem(fav, "text")}
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
                <TouchableOpacity onPress={listening ? stopVoice : startVoice} style={{ padding: 6 }}>
                  <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                    <Ionicons name={listening ? "mic" : "mic-outline"} size={22} color={listening ? DS.color.red : DS.color.muted} />
                  </Animated.View>
                </TouchableOpacity>
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
                      onPress={() => logItem(item, "text")}
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
                      onPress={() => logItem({ foodNameEn: String(item.foodNameEn), calories: Number(item.calories), proteinG: Number(item.proteinG||0), carbsG: Number(item.carbsG||0), fatG: Number(item.fatG||0), fiberG: Number(item.fiberG||0) }, "text")}
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

                  <TouchableOpacity onPress={() => logItem(scanResult, "text")} disabled={submitting} activeOpacity={0.85}>
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
});
