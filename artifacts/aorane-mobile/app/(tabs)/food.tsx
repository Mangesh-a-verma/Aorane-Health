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
import { api } from "@/lib/api";

const { width: W } = Dimensions.get("window");

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: "#F0FAFB", card: "#FFFFFF", primary: "#0077B6", accent: "#00B896",
  text: "#0D1F33", muted: "#7A90A4", border: "#E2EFF5",
  amber: "#F59E0B", red: "#EF4444", purple: "#8B5CF6", green: "#10B981",
};

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
type MealType = typeof MEAL_TYPES[number];
const MEAL_META: Record<MealType, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; grad: [string, string] }> = {
  breakfast: { label: "Breakfast",  icon: "sunny-outline",        color: "#F59E0B", grad: ["#F59E0B","#EF4444"] },
  lunch:     { label: "Lunch",      icon: "partly-sunny-outline", color: "#10B981", grad: ["#059669","#1B998B"] },
  dinner:    { label: "Dinner",     icon: "moon-outline",         color: "#7C3AED", grad: ["#7C3AED","#0077B6"] },
  snack:     { label: "Snack",      icon: "cafe-outline",         color: "#0EA5E9", grad: ["#0EA5E9","#38BDF8"] },
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
  vitamins?: Record<string, number>;
  glycemicIndex?: number; healthTip?: string;
};
type ScanMeta = { fromHistory: boolean; fromDb: boolean; fromCache: boolean; historyCount?: number };

function today() { return new Date().toISOString().slice(0, 10); }

// Source badge helpers
function SourceBadge({ fromHistory, fromDb, fromCache }: { fromHistory: boolean; fromDb: boolean; fromCache: boolean }) {
  const text = fromHistory ? "⏱️ History" : fromDb ? "📚 DB" : fromCache ? "💾 Cache" : "🤖 AI";
  const bg = fromHistory ? "#10B98115" : fromDb ? "#0077B615" : fromCache ? "#F59E0B15" : "#8B5CF615";
  const col = fromHistory ? C.green : fromDb ? C.primary : fromCache ? C.amber : C.purple;
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: bg }}>
      <Text style={{ color: col, fontSize: 10, fontFamily: "Inter_600SemiBold" }}>{text}</Text>
    </View>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View style={[{ backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.border, overflow: "hidden" }, style]}>
      {children}
    </View>
  );
}

// ── Voice recognition (Web Speech API — Chrome + Android Chrome) ─────────────
interface SpeechRecognitionEvent { results: Array<Array<{ transcript: string }>> }
interface SpeechRecognitionInstance {
  lang: string; interimResults: boolean; maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  start(): void; stop(): void;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function useVoice(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionInstance | null>(null);

  const start = useCallback(() => {
    if (Platform.OS !== "web") {
      Alert.alert("Voice Search", "Voice input works best in Android Chrome browser");
      return;
    }
    const win = window as unknown as Record<string, unknown>;
    const Ctor = (win["SpeechRecognition"] || win["webkitSpeechRecognition"]) as SpeechRecognitionConstructor | undefined;
    if (!Ctor) {
      Alert.alert("Voice not supported", "Please update your browser or type the food name");
      return;
    }
    const rec = new Ctor();
    rec.lang = "hi-IN";
    rec.interimResults = false;
    rec.maxAlternatives = 3;
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const t = e.results[0]?.[0]?.transcript || "";
      if (t) onResult(t);
    };
    rec.onerror = () => setListening(false);
    rec.start();
    recRef.current = rec;
  }, [onResult]);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  return { listening, start, stop };
}

// ── Macro donut ────────────────────────────────────────────────────────────────
function MacroBars({ cal, protein, carbs, fat }: { cal: number; protein: number; carbs: number; fat: number }) {
  const total = protein * 4 + carbs * 4 + fat * 9 || 1;
  return (
    <View style={{ gap: 4 }}>
      {[
        { label: "Protein", val: protein, unit: "g", pct: (protein * 4) / total, color: "#EF4444" },
        { label: "Carbs",   val: carbs,   unit: "g", pct: (carbs * 4) / total,   color: C.primary },
        { label: "Fat",     val: fat,     unit: "g", pct: (fat * 9) / total,     color: C.purple },
      ].map(m => (
        <View key={m.label} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ color: C.muted, fontSize: 10, fontFamily: "Inter_400Regular", width: 42 }}>{m.label}</Text>
          <View style={{ flex: 1, height: 5, backgroundColor: C.border, borderRadius: 3, overflow: "hidden" }}>
            <View style={{ height: "100%", width: `${Math.round(m.pct * 100)}%`, backgroundColor: m.color, borderRadius: 3 }} />
          </View>
          <Text style={{ color: C.text, fontSize: 10, fontFamily: "Inter_600SemiBold", width: 30, textAlign: "right" }}>{Math.round(m.val)}{m.unit}</Text>
        </View>
      ))}
    </View>
  );
}

export default function FoodScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [totalCal, setTotalCal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [activeMeal, setActiveMeal] = useState<MealType>("breakfast");

  // Modal state
  const [text, setText] = useState("");
  const [histResults, setHistResults] = useState<FavItem[]>([]);
  const [dbResults, setDbResults] = useState<Array<Record<string, unknown>>>([]);
  const [searching, setSearching] = useState(false);
  const [favorites, setFavorites] = useState<FavItem[]>([]);
  const [favsLoaded, setFavsLoaded] = useState(false);

  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanMeta, setScanMeta] = useState<ScanMeta | null>(null);
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ── Load data ────────────────────────────────────────────────────────────────
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
    try {
      const res = await api.getFoodFavorites();
      setFavorites(res.favorites as FavItem[]);
      setFavsLoaded(true);
    } catch { }
  }, [favsLoaded]);

  useEffect(() => { loadLogs(); }, []);

  // ── Voice ────────────────────────────────────────────────────────────────────
  const { listening, start: startVoice, stop: stopVoice } = useVoice((spoken) => {
    setText(spoken);
    triggerSearch(spoken);
  });

  useEffect(() => {
    if (listening) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [listening]);

  // ── Search (debounced) ───────────────────────────────────────────────────────
  const triggerSearch = useCallback((q: string) => {
    setScanResult(null); setScanMeta(null);
    if (q.length < 2) { setHistResults([]); setDbResults([]); return; }
    setSearching(true);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      try {
        const [histRes, dbRes] = await Promise.allSettled([
          api.searchFoodHistory(q),
          api.searchFood(q),
        ]);
        if (histRes.status === "fulfilled") setHistResults(histRes.value.items as FavItem[]);
        if (dbRes.status === "fulfilled") setDbResults(dbRes.value.items as Array<Record<string, unknown>>);
      } catch { }
      setSearching(false);
    }, 350);
  }, []);

  const handleTextChange = (t: string) => {
    setText(t);
    triggerSearch(t);
  };

  // ── Photo ────────────────────────────────────────────────────────────────────
  const pickPhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert("Permission", "Gallery access is required"); return; }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, quality: 0.7, base64: true,
      });
      if (!result.canceled && result.assets[0]?.base64) {
        await runScan({ imageBase64: result.assets[0].base64, mimeType: "image/jpeg" });
      }
    } catch { Alert.alert("Error", "Could not select photo. Please try again."); }
  };

  const takePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { Alert.alert("Permission", "Camera access is required"); return; }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true, quality: 0.7, base64: true,
      });
      if (!result.canceled && result.assets[0]?.base64) {
        await runScan({ imageBase64: result.assets[0].base64, mimeType: "image/jpeg" });
      }
    } catch { Alert.alert("Error", "Could not open camera. Please try again."); }
  };

  // ── AI Scan ──────────────────────────────────────────────────────────────────
  const runScan = async (data: { foodName?: string; imageBase64?: string; mimeType?: string }) => {
    setScanning(true); setHistResults([]); setDbResults([]);
    try {
      const res = await api.scanFood(data);
      setScanResult(res.result);
      setScanMeta({ fromHistory: res.fromHistory, fromDb: res.fromDb, fromCache: res.fromCache, historyCount: res.historyCount });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) {
      Alert.alert("AI Error", (e as Error).message || "Food analysis failed. Please try again.");
    }
    setScanning(false);
  };

  // ── Log food ──────────────────────────────────────────────────────────────────
  const logItem = async (item: { foodNameEn: string; calories: number; proteinG?: number; carbsG?: number; fatG?: number; fiberG?: number }, method: string = "text") => {
    setSubmitting(true);
    try {
      await api.logFood({
        foodNameEn: item.foodNameEn,
        mealType: activeMeal,
        calories: String(Math.round(item.calories)),
        proteinG: String(Math.round((item.proteinG || 0) * 10) / 10),
        carbsG: String(Math.round((item.carbsG || 0) * 10) / 10),
        fatG: String(Math.round((item.fatG || 0) * 10) / 10),
        fiberG: String(Math.round((item.fiberG || 0) * 10) / 10),
        inputMethod: method,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      closeModal();
      await loadLogs();
      setFavsLoaded(false); // refresh favs next time
    } catch (e: unknown) {
      Alert.alert("Error", (e as Error).message || "Could not log food. Please try again.");
    }
    setSubmitting(false);
  };

  const deleteLog = async (id: string, name: string) => {
    Alert.alert("Remove entry?", `Remove "${name}" from your food log?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          await api.deleteFoodLog(id);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await loadLogs();
        } catch { Alert.alert("Error", "Could not delete entry. Please try again."); }
      }},
    ]);
  };

  const closeModal = () => {
    setShowModal(false); setText(""); setHistResults([]); setDbResults([]);
    setScanResult(null); setScanMeta(null);
  };

  const openModal = (meal: MealType) => {
    setActiveMeal(meal);
    setShowModal(true);
    loadFavs();
  };

  // ── Grouped logs ──────────────────────────────────────────────────────────────
  const grouped = MEAL_TYPES.reduce((acc, mt) => {
    acc[mt] = logs.filter(l => l.mealType === mt);
    return acc;
  }, {} as Record<MealType, FoodLog[]>);

  const calPct = Math.min(100, (totalCal / 2000) * 100);
  const totalP = logs.reduce((s, l) => s + Number(l.proteinG || 0), 0);
  const totalC = logs.reduce((s, l) => s + Number(l.carbsG || 0), 0);
  const totalF = logs.reduce((s, l) => s + Number(l.fatG || 0), 0);

  const noResults = text.length > 1 && !searching && histResults.length === 0 && dbResults.length === 0 && !scanResult;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <LinearGradient colors={["#C8E9FA","#D9F4EE","#F0FAFB"]} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={{ paddingTop: topPad + 10, paddingHorizontal: 18, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View>
          <Text style={{ color: C.text, fontFamily: "Inter_700Bold", fontSize: 22 }}>Food Log 🍽️</Text>
          <Text style={{ color: C.muted, fontSize: 12, fontFamily: "Inter_400Regular" }}>
            {new Date().toLocaleDateString("hi-IN", { weekday: "long", day: "numeric", month: "short" })}
          </Text>
        </View>
        <TouchableOpacity onPress={() => openModal("breakfast")} activeOpacity={0.85}>
          <LinearGradient colors={[C.primary, C.accent]} style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="add" size={24} color="#FFF" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Calories summary */}
      <Card style={{ marginHorizontal: 18, marginBottom: 12 }}>
        <View style={{ padding: 14 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
            {[
              { label: "Khaaye",  val: Math.round(totalCal),           color: C.amber },
              { label: "Bacha",   val: Math.max(0, 2000 - Math.round(totalCal)), color: C.accent },
              { label: "Goal",    val: 2000,                           color: C.primary },
            ].map((s, i, arr) => (
              <React.Fragment key={s.label}>
                <View style={{ alignItems: "center" }}>
                  <Text style={{ color: s.color, fontFamily: "Inter_700Bold", fontSize: 24 }}>{s.val}</Text>
                  <Text style={{ color: C.muted, fontSize: 11, fontFamily: "Inter_400Regular" }}>{s.label}</Text>
                </View>
                {i < arr.length - 1 && <View style={{ width: 1, backgroundColor: C.border, height: 36, alignSelf: "center" }} />}
              </React.Fragment>
            ))}
          </View>
          <View style={{ height: 6, backgroundColor: C.border, borderRadius: 3, overflow: "hidden", marginBottom: 10 }}>
            <LinearGradient
              colors={calPct >= 90 ? ["#EF4444","#F59E0B"] : [C.primary, C.accent]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ height: "100%", width: `${calPct}%`, borderRadius: 3 }}
            />
          </View>
          <MacroBars cal={totalCal} protein={totalP} carbs={totalC} fat={totalF} />
        </View>
      </Card>

      {loading ? (
        <ActivityIndicator color={C.primary} size="large" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 90 }}>
          {MEAL_TYPES.map(mt => {
            const ml = MEAL_META[mt];
            const mLogs = grouped[mt];
            const mCal = Math.round(mLogs.reduce((s, l) => s + Number(l.calories), 0));
            return (
              <View key={mt} style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <LinearGradient colors={ml.grad} style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={ml.icon} size={14} color="#FFF" />
                  </LinearGradient>
                  <Text style={{ color: C.text, fontFamily: "Inter_600SemiBold", fontSize: 15, flex: 1 }}>{ml.label}</Text>
                  {mCal > 0 && (
                    <View style={{ backgroundColor: ml.color + "18", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 }}>
                      <Text style={{ color: ml.color, fontSize: 12, fontFamily: "Inter_600SemiBold" }}>{mCal} kcal</Text>
                    </View>
                  )}
                </View>

                {mLogs.length === 0 ? (
                  <TouchableOpacity onPress={() => openModal(mt)} activeOpacity={0.8}
                    style={{ borderWidth: 1.5, borderColor: C.border, borderStyle: "dashed", borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fff8" }}>
                    <Ionicons name="add-circle-outline" size={18} color={ml.color} />
                    <Text style={{ color: C.muted, fontFamily: "Inter_400Regular", fontSize: 13 }}>Add food</Text>
                  </TouchableOpacity>
                ) : (
                  <Card>
                    {mLogs.map((log, i) => (
                      <View key={log.id} style={{ paddingHorizontal: 14, paddingVertical: 11, flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: C.border }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ml.color }} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: C.text, fontFamily: "Inter_500Medium", fontSize: 13 }}>{log.foodNameEn}</Text>
                          <Text style={{ color: C.muted, fontSize: 11, fontFamily: "Inter_400Regular" }}>
                            P:{Math.round(Number(log.proteinG||0))}g · C:{Math.round(Number(log.carbsG||0))}g · F:{Math.round(Number(log.fatG||0))}g
                          </Text>
                        </View>
                        <Text style={{ color: ml.color, fontFamily: "Inter_700Bold", fontSize: 14 }}>{Math.round(Number(log.calories))}</Text>
                        <TouchableOpacity onPress={() => deleteLog(log.id, log.foodNameEn)} style={{ padding: 4 }}>
                          <Ionicons name="close-circle-outline" size={18} color={C.muted} />
                        </TouchableOpacity>
                      </View>
                    ))}
                    <TouchableOpacity onPress={() => openModal(mt)} style={{ flexDirection: "row", alignItems: "center", gap: 6, padding: 12, borderTopWidth: 1, borderTopColor: C.border }}>
                      <Ionicons name="add-circle-outline" size={16} color={ml.color} />
                      <Text style={{ color: ml.color, fontSize: 12, fontFamily: "Inter_500Medium" }}>Add more</Text>
                    </TouchableOpacity>
                  </Card>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ── ADD FOOD MODAL ───────────────────────────────────────────────────── */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          <LinearGradient colors={["#C8E9FA","#D9F4EE","#F0FAFB"]} style={StyleSheet.absoluteFill} />

          {/* Modal header */}
          <View style={{ flexDirection: "row", alignItems: "center", padding: 18, paddingTop: 20, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <Text style={{ flex: 1, color: C.text, fontFamily: "Inter_700Bold", fontSize: 18 }}>Food Add Karein 🍎</Text>
            <TouchableOpacity onPress={closeModal} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.border, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="close" size={18} color={C.text} />
            </TouchableOpacity>
          </View>

          {/* Meal type selector */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}>
            {MEAL_TYPES.map(mt => {
              const ml = MEAL_META[mt];
              return activeMeal === mt ? (
                <LinearGradient key={mt} colors={ml.grad} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 }}>
                  <Ionicons name={ml.icon} size={14} color="#FFF" />
                  <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>{ml.label}</Text>
                </LinearGradient>
              ) : (
                <TouchableOpacity key={mt} onPress={() => setActiveMeal(mt)} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border }}>
                  <Ionicons name={ml.icon} size={14} color={C.muted} />
                  <Text style={{ color: C.muted, fontFamily: "Inter_500Medium", fontSize: 13 }}>{ml.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>

            {/* Favorites section */}
            {favorites.length > 0 && !scanResult && (
              <View style={{ marginBottom: 14 }}>
                <Text style={{ color: C.muted, fontSize: 11, fontFamily: "Inter_600SemiBold", marginBottom: 8 }}>
                  ⭐ FAVOURITES — ONE TAP ADD
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {favorites.slice(0, 10).map(fav => (
                    <TouchableOpacity key={fav.foodNameEn} onPress={() => logItem(fav, "text")} disabled={submitting} activeOpacity={0.8}
                      style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 }}>
                      <Text style={{ fontSize: 13 }}>⭐</Text>
                      <View>
                        <Text style={{ color: C.text, fontFamily: "Inter_500Medium", fontSize: 12 }} numberOfLines={1}>{fav.foodNameEn}</Text>
                        <Text style={{ color: C.muted, fontSize: 10 }}>{Math.round(fav.calories)} kcal · eaten {fav.count}x</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Search bar + voice + photo */}
            <Card style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 2, gap: 8 }}>
                <Ionicons name="search" size={18} color={C.muted} />
                <TextInput
                  style={{ flex: 1, color: C.text, fontFamily: "Inter_400Regular", fontSize: 14, paddingVertical: 12 }}
                  placeholder="Food name — Hindi, English, any language..."
                  placeholderTextColor={C.muted}
                  value={text}
                  onChangeText={handleTextChange}
                  autoFocus
                />
                {searching && <ActivityIndicator size="small" color={C.primary} />}

                {/* Voice button */}
                <TouchableOpacity onPress={listening ? stopVoice : startVoice} style={{ padding: 6 }}>
                  <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                    <Ionicons name={listening ? "mic" : "mic-outline"} size={22} color={listening ? "#EF4444" : C.muted} />
                  </Animated.View>
                </TouchableOpacity>
              </View>

              {/* Photo/camera row */}
              <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: C.border }}>
                <TouchableOpacity onPress={takePhoto} style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10 }}>
                  <Ionicons name="camera-outline" size={18} color={C.primary} />
                  <Text style={{ color: C.primary, fontFamily: "Inter_500Medium", fontSize: 12 }}>Take Photo</Text>
                </TouchableOpacity>
                <View style={{ width: 1, backgroundColor: C.border }} />
                <TouchableOpacity onPress={pickPhoto} style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10 }}>
                  <Ionicons name="images-outline" size={18} color={C.primary} />
                  <Text style={{ color: C.primary, fontFamily: "Inter_500Medium", fontSize: 12 }}>From Gallery</Text>
                </TouchableOpacity>
              </View>
            </Card>

            {listening && (
              <View style={{ backgroundColor: "#EF444415", borderRadius: 12, padding: 12, marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Animated.View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#EF4444", transform: [{ scale: pulseAnim }] }} />
                <Text style={{ color: "#EF4444", fontFamily: "Inter_500Medium", fontSize: 13 }}>Listening… say your food name</Text>
              </View>
            )}

            {/* History results */}
            {histResults.length > 0 && !scanResult && (
              <View style={{ marginBottom: 12 }}>
                <Text style={{ color: C.muted, fontSize: 11, fontFamily: "Inter_600SemiBold", marginBottom: 6 }}>⏱️ YOUR HISTORY</Text>
                <Card>
                  {histResults.map((item, i) => (
                    <TouchableOpacity key={item.foodNameEn} onPress={() => logItem(item, "text")} disabled={submitting}
                      style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: C.border }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: C.text, fontFamily: "Inter_500Medium", fontSize: 13 }}>{item.foodNameEn}</Text>
                        <Text style={{ color: C.muted, fontSize: 11 }}>{Math.round(item.calories)} kcal · eaten {item.count}x</Text>
                      </View>
                      <SourceBadge fromHistory={true} fromDb={false} fromCache={false} />
                      <Ionicons name="add-circle" size={24} color={C.green} />
                    </TouchableOpacity>
                  ))}
                </Card>
              </View>
            )}

            {/* DB results */}
            {dbResults.length > 0 && !scanResult && (
              <View style={{ marginBottom: 12 }}>
                <Text style={{ color: C.muted, fontSize: 11, fontFamily: "Inter_600SemiBold", marginBottom: 6 }}>📚 DATABASE</Text>
                <Card>
                  {dbResults.slice(0, 8).map((item, i) => (
                    <TouchableOpacity key={String(item.id)} onPress={() => logItem({ foodNameEn: String(item.foodNameEn), calories: Number(item.calories), proteinG: Number(item.proteinG || 0), carbsG: Number(item.carbsG || 0), fatG: Number(item.fatG || 0), fiberG: Number(item.fiberG || 0) }, "text")} disabled={submitting}
                      style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: C.border }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: C.text, fontFamily: "Inter_500Medium", fontSize: 13 }}>{String(item.foodNameEn)}</Text>
                        <Text style={{ color: C.muted, fontSize: 11 }}>{Math.round(Number(item.calories))} kcal per 100g</Text>
                      </View>
                      <SourceBadge fromHistory={false} fromDb={true} fromCache={false} />
                      <Ionicons name="add-circle" size={24} color={C.primary} />
                    </TouchableOpacity>
                  ))}
                </Card>
              </View>
            )}

            {/* "Not found — use AI" */}
            {noResults && !scanning && (
              <Card style={{ padding: 16, marginBottom: 12 }}>
                <Text style={{ color: C.muted, fontFamily: "Inter_400Regular", fontSize: 13, marginBottom: 12, textAlign: "center" }}>
                  "{text}" not found in history or database
                </Text>
                <TouchableOpacity onPress={() => runScan({ foodName: text })} activeOpacity={0.85}>
                  <LinearGradient colors={[C.purple, C.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={{ borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <Ionicons name="sparkles" size={18} color="#FFF" />
                    <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>Analyse Nutrition with AI</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <Text style={{ color: C.muted, fontSize: 10, textAlign: "center", marginTop: 8 }}>
                  AI result will be saved — no AI call needed next time
                </Text>
              </Card>
            )}

            {scanning && (
              <Card style={{ padding: 30, alignItems: "center", marginBottom: 12 }}>
                <ActivityIndicator color={C.purple} size="large" />
                <Text style={{ color: C.text, fontFamily: "Inter_500Medium", fontSize: 14, marginTop: 12 }}>AI is analysing...</Text>
                <Text style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>History → DB → Cache → Gemini AI</Text>
              </Card>
            )}

            {/* AI / Scan result */}
            {scanResult && scanMeta && (
              <Card style={{ marginBottom: 12, overflow: "hidden" }}>
                <LinearGradient colors={[C.purple + "12", C.primary + "08"]} style={{ padding: 16 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <Text style={{ color: C.text, fontFamily: "Inter_700Bold", fontSize: 16, flex: 1 }} numberOfLines={2}>
                      {scanResult.foodNameEn}
                    </Text>
                    <SourceBadge fromHistory={scanMeta.fromHistory} fromDb={scanMeta.fromDb} fromCache={scanMeta.fromCache} />
                  </View>

                  {scanMeta.fromHistory && scanMeta.historyCount && (
                    <View style={{ backgroundColor: C.green + "15", borderRadius: 10, padding: 8, marginBottom: 10 }}>
                      <Text style={{ color: C.green, fontSize: 11, fontFamily: "Inter_500Medium" }}>
                        ✅ You've eaten this {scanMeta.historyCount} times before — data loaded from history, no AI call made!
                      </Text>
                    </View>
                  )}

                  {/* Macros grid */}
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                    {[
                      { label: "Calories", val: scanResult.calories,  unit: "kcal", color: C.amber },
                      { label: "Protein",  val: scanResult.proteinG,  unit: "g",    color: "#EF4444" },
                      { label: "Carbs",    val: scanResult.carbsG,    unit: "g",    color: C.primary },
                      { label: "Fat",      val: scanResult.fatG,      unit: "g",    color: C.purple },
                      { label: "Fiber",    val: scanResult.fiberG,    unit: "g",    color: C.green },
                      ...(scanResult.sugarG != null ? [{ label: "Sugar", val: scanResult.sugarG, unit: "g", color: "#F97316" }] : []),
                    ].map(m => (
                      <View key={m.label} style={{ backgroundColor: m.color + "12", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, alignItems: "center", minWidth: 70 }}>
                        <Text style={{ color: m.color, fontFamily: "Inter_700Bold", fontSize: 18 }}>{Number(m.val).toFixed(1)}</Text>
                        <Text style={{ color: C.muted, fontSize: 9, fontFamily: "Inter_400Regular" }}>{m.unit}</Text>
                        <Text style={{ color: C.muted, fontSize: 10, fontFamily: "Inter_500Medium" }}>{m.label}</Text>
                      </View>
                    ))}
                  </View>

                  {scanResult.healthTip && (
                    <View style={{ backgroundColor: C.accent + "15", borderRadius: 10, padding: 10, marginBottom: 12 }}>
                      <Text style={{ color: C.accent, fontSize: 12, fontFamily: "Inter_400Regular" }}>💡 {scanResult.healthTip}</Text>
                    </View>
                  )}

                  {scanResult.servingDescription && (
                    <Text style={{ color: C.muted, fontSize: 11, marginBottom: 12 }}>Per serving: {scanResult.servingDescription}</Text>
                  )}

                  {scanResult.dietaryTags?.length > 0 && (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                      {scanResult.dietaryTags.map(tag => (
                        <View key={tag} style={{ backgroundColor: C.accent + "18", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                          <Text style={{ color: C.accent, fontSize: 10, fontFamily: "Inter_500Medium" }}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <TouchableOpacity onPress={() => logItem(scanResult, "text")} disabled={submitting} activeOpacity={0.85}>
                    <LinearGradient colors={[C.primary, C.accent]} style={{ borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      {submitting
                        ? <ActivityIndicator color="#FFF" />
                        : <>
                            <Ionicons name="add-circle-outline" size={18} color="#FFF" />
                            <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 14 }}>
                              Log to {MEAL_META[activeMeal].label} ✓
                            </Text>
                          </>
                      }
                    </LinearGradient>
                  </TouchableOpacity>
                </LinearGradient>
              </Card>
            )}

          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({});
