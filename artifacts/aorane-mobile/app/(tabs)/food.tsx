import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator, FlatList,
  Platform, useColorScheme, Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { api } from "@/lib/api";

const { width: W } = Dimensions.get("window");

type FoodLog = { id: string; foodNameEn: string; mealType: string; calories: string; proteinG?: string; carbsG?: string; fatG?: string; fiberG?: string; };
type AIScanResult = {
  foodNameEn: string; calories: number; proteinG: number; carbsG: number; fatG: number;
  fiberG: number; sodiumMg?: number; sugarG?: number; servingSizeG: number;
  servingDescription: string; category: string; dietaryTags: string[];
  vitamins?: { vitaminA_mcg?: number; vitaminC_mg?: number; vitaminD_mcg?: number; vitaminB12_mcg?: number; iron_mg?: number; calcium_mg?: number; potassium_mg?: number; zinc_mg?: number };
  glycemicIndex?: number; healthTip?: string;
};

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_LABELS: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; grad: [string, string] }> = {
  breakfast: { label: "Breakfast", icon: "sunny-outline",       color: "#F59E0B", grad: ["#F59E0B","#EF4444"] },
  lunch:     { label: "Lunch",     icon: "partly-sunny-outline", color: "#10B981", grad: ["#059669","#1B998B"] },
  dinner:    { label: "Dinner",    icon: "moon-outline",         color: "#7C3AED", grad: ["#7C3AED","#0077B6"] },
  snack:     { label: "Snack",     icon: "cafe-outline",         color: "#0EA5E9", grad: ["#0EA5E9","#38BDF8"] },
};
function todayDate() { return new Date().toISOString().slice(0, 10); }

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

function VitaminsPanel({ vitamins, isDark }: { vitamins: AIScanResult["vitamins"]; isDark: boolean }) {
  if (!vitamins) return null;
  const items = [
    { key: "vitaminA_mcg",   label: "Vit A",     unit: "mcg", icon: "🥕", value: vitamins.vitaminA_mcg },
    { key: "vitaminC_mg",    label: "Vit C",     unit: "mg",  icon: "🍋", value: vitamins.vitaminC_mg },
    { key: "vitaminD_mcg",   label: "Vit D",     unit: "mcg", icon: "☀️", value: vitamins.vitaminD_mcg },
    { key: "vitaminB12_mcg", label: "Vit B12",   unit: "mcg", icon: "🩸", value: vitamins.vitaminB12_mcg },
    { key: "iron_mg",        label: "Iron",      unit: "mg",  icon: "⚙️", value: vitamins.iron_mg },
    { key: "calcium_mg",     label: "Calcium",   unit: "mg",  icon: "🦴", value: vitamins.calcium_mg },
    { key: "potassium_mg",   label: "Potassium", unit: "mg",  icon: "🍌", value: vitamins.potassium_mg },
    { key: "zinc_mg",        label: "Zinc",      unit: "mg",  icon: "💊", value: vitamins.zinc_mg },
  ].filter(i => i.value !== undefined && i.value !== null);

  if (items.length === 0) return null;
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={[styles.vitaminsTitle, { color: isDark ? "rgba(255,255,255,0.6)" : "rgba(10,22,40,0.6)", fontFamily: "Inter_600SemiBold" }]}>Vitamins & Minerals</Text>
      <View style={styles.vitaminsGrid}>
        {items.map(item => (
          <View key={item.key} style={[styles.vitaminChip, { backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,119,182,0.07)" }]}>
            <Text style={styles.vitaminEmoji}>{item.icon}</Text>
            <Text style={[styles.vitaminLabel, { color: isDark ? "rgba(255,255,255,0.5)" : "rgba(10,22,40,0.5)", fontFamily: "Inter_400Regular" }]}>{item.label}</Text>
            <Text style={[styles.vitaminValue, { color: isDark ? "#2DD4BF" : "#1B998B", fontFamily: "Inter_600SemiBold" }]}>{Number(item.value).toFixed(1)}{item.unit}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function FoodScreen() {
  const scheme = useColorScheme(); const isDark = scheme === "dark";
  const insets = useSafeAreaInsets();
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [totalCalories, setTotalCalories] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeMealType, setActiveMealType] = useState("breakfast");
  const [foodText, setFoodText] = useState("");
  const [searchResults, setSearchResults] = useState<Array<Record<string, unknown>>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiResult, setAiResult] = useState<AIScanResult | null>(null);
  const [isAIScanning, setIsAIScanning] = useState(false);
  const [showNutritionDetail, setShowNutritionDetail] = useState<AIScanResult | null>(null);

  useEffect(() => { loadLogs(); }, []);

  const loadLogs = useCallback(async () => {
    try {
      const res = await api.getFoodLogs(todayDate());
      const l = res.logs as FoodLog[];
      setLogs(l);
      setTotalCalories(l.reduce((s, i) => s + Number(i.calories), 0));
    } catch { }
    setIsLoading(false);
  }, []);

  const searchFood = useCallback(async (query: string) => {
    setAiResult(null);
    if (query.length < 2) { setSearchResults([]); return; }
    setIsSearching(true);
    try { const res = await api.searchFood(query); setSearchResults(res.items as Array<Record<string, unknown>>); }
    catch { setSearchResults([]); }
    setIsSearching(false);
  }, []);

  const handleAIScan = async () => {
    if (!foodText.trim()) { Alert.alert("Food naam likhein"); return; }
    setIsAIScanning(true);
    try {
      const res = await api.scanFood({ foodName: foodText.trim() });
      setAiResult(res.result);
      setSearchResults([]);
    } catch { Alert.alert("AI Error", "Food analysis fail hua"); }
    setIsAIScanning(false);
  };

  const logFromAI = async () => {
    if (!aiResult) return;
    setIsSubmitting(true);
    try {
      await api.logFood({
        foodNameEn: aiResult.foodNameEn,
        mealType: activeMealType,
        calories: String(aiResult.calories),
        proteinG: String(aiResult.proteinG || 0),
        carbsG: String(aiResult.carbsG || 0),
        fatG: String(aiResult.fatG || 0),
        fiberG: String(aiResult.fiberG || 0),
        inputMethod: "text",
      });
      setFoodText(""); setAiResult(null); setShowAddModal(false);
      await loadLogs(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch { Alert.alert("Error", "Log nahi hua"); }
    setIsSubmitting(false);
  };

  const handleQuickLog = async (item: Record<string, unknown>) => {
    setIsSubmitting(true);
    try {
      await api.logFood({ foodNameEn: item.foodNameEn as string, mealType: activeMealType, calories: String(item.calories), proteinG: String(item.proteinG || 0), carbsG: String(item.carbsG || 0), fatG: String(item.fatG || 0), foodItemId: item.id as string, inputMethod: "text" });
      setFoodText(""); setSearchResults([]); setShowAddModal(false);
      await loadLogs(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch { Alert.alert("Error", "Food log nahi hua"); }
    setIsSubmitting(false);
  };

  const grouped = MEAL_TYPES.reduce((acc, mt) => { acc[mt] = logs.filter((l) => l.mealType === mt); return acc; }, {} as Record<string, FoodLog[]>);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const calPct = Math.min(100, (totalCalories / 2000) * 100);

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={isDark ? ["#010814","#031628","#051E30","#061A2A"] : ["#C8E9FA","#D9F4EE","#E8F4FF","#D4F0F7"]}
        locations={[0,0.3,0.65,1]} style={StyleSheet.absoluteFill}
      />
      <View style={[styles.orb1, { backgroundColor: isDark ? "#7C2D12" : "#FED7AA" }]} />
      <View style={[styles.orb2, { backgroundColor: isDark ? "#065F46" : "#A7F3D0" }]} />

      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <View>
          <Text style={[styles.title, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>Food Log 🍽️</Text>
          <Text style={[styles.dateText, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular" }]}>
            {new Date().toLocaleDateString("hi-IN", { weekday: "long", day: "numeric", month: "short" })}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setShowAddModal(true)} activeOpacity={0.85}>
          <LinearGradient colors={["#0077B6","#1B998B"]} style={styles.addBtn}>
            <Ionicons name="add" size={22} color="#FFF" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Calories Summary */}
      <GlassCard style={{ marginHorizontal: 18, marginBottom: 14 }}>
        <View style={styles.calCard}>
          {[
            { label: "Khaaye", value: Math.round(totalCalories), color: isDark ? "#FCD34D" : "#D97706" },
            { label: "Bacha", value: Math.max(0, 2000 - Math.round(totalCalories)), color: isDark ? "#2DD4BF" : "#1B998B" },
            { label: "Goal", value: 2000, color: isDark ? "#38BDF8" : "#0077B6" },
          ].map((s, i, arr) => (
            <React.Fragment key={s.label}>
              <View style={styles.calItem}>
                <Text style={[styles.calNum, { color: s.color, fontFamily: "Inter_700Bold" }]}>{s.value}</Text>
                <Text style={[styles.calLabel, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular" }]}>{s.label}</Text>
              </View>
              {i < arr.length - 1 && <View style={[styles.calDiv, { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)" }]} />}
            </React.Fragment>
          ))}
        </View>
        <View style={[styles.calBarTrack, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }]}>
          <LinearGradient colors={calPct >= 90 ? ["#EF4444","#F59E0B"] : ["#0077B6","#1B998B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={[styles.calBarFill, { width: `${calPct}%` }]} />
        </View>
      </GlassCard>

      {isLoading ? (
        <View style={styles.loadingWrap}><ActivityIndicator color={isDark ? "#38BDF8" : "#0077B6"} size="large" /></View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 90 }} showsVerticalScrollIndicator={false}>
          {MEAL_TYPES.map((mt) => {
            const ml = MEAL_LABELS[mt];
            const mLogs = grouped[mt];
            const mCal = Math.round(mLogs.reduce((s, l) => s + Number(l.calories), 0));
            return (
              <View key={mt} style={styles.mealSection}>
                <View style={styles.mealTitleRow}>
                  <LinearGradient colors={ml.grad} style={styles.mealIconBg}>
                    <Ionicons name={ml.icon} size={14} color="#FFF" />
                  </LinearGradient>
                  <Text style={[styles.mealTitle, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_600SemiBold", flex: 1 }]}>{ml.label}</Text>
                  {mCal > 0 && <View style={[styles.mealCalBadge, { backgroundColor: `${ml.color}18` }]}><Text style={[styles.mealCalText, { color: ml.color, fontFamily: "Inter_600SemiBold" }]}>{mCal} kcal</Text></View>}
                </View>
                {mLogs.length === 0 ? (
                  <TouchableOpacity onPress={() => { setActiveMealType(mt); setShowAddModal(true); }} activeOpacity={0.8}
                    style={[styles.emptyMeal, { borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,119,182,0.18)", backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.4)" }]}>
                    <Ionicons name="add-circle-outline" size={18} color={ml.color} />
                    <Text style={[styles.emptyText, { color: isDark ? "rgba(255,255,255,0.35)" : "rgba(10,22,40,0.4)", fontFamily: "Inter_400Regular" }]}>Food add karein</Text>
                  </TouchableOpacity>
                ) : (
                  mLogs.map((log) => (
                    <GlassCard key={log.id} style={{ marginBottom: 8 }}>
                      <View style={styles.logItem}>
                        <LinearGradient colors={ml.grad} style={styles.logDot} />
                        <View style={styles.logLeft}>
                          <Text style={[styles.logName, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_500Medium" }]}>{log.foodNameEn}</Text>
                          <Text style={[styles.logMacros, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular" }]}>
                            P:{Math.round(Number(log.proteinG || 0))}g · C:{Math.round(Number(log.carbsG || 0))}g · F:{Math.round(Number(log.fatG || 0))}g
                            {log.fiberG && Number(log.fiberG) > 0 ? ` · Fiber:${Math.round(Number(log.fiberG))}g` : ""}
                          </Text>
                        </View>
                        <Text style={[styles.logCal, { color: ml.color, fontFamily: "Inter_700Bold" }]}>{Math.round(Number(log.calories))}</Text>
                      </View>
                    </GlassCard>
                  ))
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Nutrition Detail Modal */}
      <Modal visible={!!showNutritionDetail} animationType="slide" transparent>
        <View style={styles.detailOverlay}>
          <GlassCard style={{ margin: 20 }}>
            <View style={{ padding: 20 }}>
              <View style={styles.detailHeader}>
                <Text style={[styles.detailName, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>
                  {showNutritionDetail?.foodNameEn}
                </Text>
                <TouchableOpacity onPress={() => setShowNutritionDetail(null)}>
                  <Ionicons name="close-circle" size={26} color={isDark ? "rgba(255,255,255,0.5)" : "rgba(10,22,40,0.4)"} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.detailServing, { color: isDark ? "rgba(255,255,255,0.45)" : "rgba(10,22,40,0.5)", fontFamily: "Inter_400Regular" }]}>
                Per {showNutritionDetail?.servingDescription || "100g"}
              </Text>
              {showNutritionDetail?.healthTip && (
                <View style={[styles.tipBox, { backgroundColor: isDark ? "rgba(45,212,191,0.1)" : "rgba(27,153,139,0.08)" }]}>
                  <Text style={[styles.tipText, { color: isDark ? "#2DD4BF" : "#1B998B", fontFamily: "Inter_400Regular" }]}>
                    💡 {showNutritionDetail.healthTip}
                  </Text>
                </View>
              )}
              <View style={styles.macroRow}>
                {[
                  { label: "Calories", value: showNutritionDetail?.calories, unit: "kcal", color: "#F59E0B" },
                  { label: "Protein", value: showNutritionDetail?.proteinG, unit: "g", color: "#EF4444" },
                  { label: "Carbs", value: showNutritionDetail?.carbsG, unit: "g", color: "#0077B6" },
                  { label: "Fat", value: showNutritionDetail?.fatG, unit: "g", color: "#8B5CF6" },
                  { label: "Fiber", value: showNutritionDetail?.fiberG, unit: "g", color: "#10B981" },
                  { label: "Sugar", value: showNutritionDetail?.sugarG, unit: "g", color: "#F97316" },
                ].map(m => m.value !== undefined && (
                  <View key={m.label} style={[styles.macroChip, { backgroundColor: `${m.color}12` }]}>
                    <Text style={[styles.macroVal, { color: m.color, fontFamily: "Inter_700Bold" }]}>{Number(m.value).toFixed(1)}</Text>
                    <Text style={[styles.macroUnit, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.4)", fontFamily: "Inter_400Regular" }]}>{m.unit}</Text>
                    <Text style={[styles.macroLabel, { color: isDark ? "rgba(255,255,255,0.35)" : "rgba(10,22,40,0.4)", fontFamily: "Inter_400Regular" }]}>{m.label}</Text>
                  </View>
                ))}
              </View>
              {showNutritionDetail && <VitaminsPanel vitamins={showNutritionDetail.vitamins} isDark={isDark} />}
              {showNutritionDetail?.glycemicIndex && (
                <View style={[styles.giBox, { backgroundColor: showNutritionDetail.glycemicIndex > 70 ? "rgba(239,68,68,0.12)" : showNutritionDetail.glycemicIndex > 55 ? "rgba(245,158,11,0.12)" : "rgba(16,185,129,0.12)" }]}>
                  <Text style={[styles.giText, { color: showNutritionDetail.glycemicIndex > 70 ? "#EF4444" : showNutritionDetail.glycemicIndex > 55 ? "#F59E0B" : "#10B981", fontFamily: "Inter_500Medium" }]}>
                    Glycemic Index: {showNutritionDetail.glycemicIndex} ({showNutritionDetail.glycemicIndex > 70 ? "High" : showNutritionDetail.glycemicIndex > 55 ? "Medium" : "Low"})
                  </Text>
                </View>
              )}
              <TouchableOpacity onPress={() => { logFromAI(); setShowNutritionDetail(null); }} activeOpacity={0.85} style={{ marginTop: 16 }}>
                <LinearGradient colors={["#0077B6","#1B998B"]} style={styles.logBtn}>
                  <Ionicons name="add-circle-outline" size={18} color="#FFF" />
                  <Text style={[styles.logBtnText, { fontFamily: "Inter_600SemiBold" }]}>Log {activeMealType === "breakfast" ? "Breakfast" : activeMealType === "lunch" ? "Lunch" : activeMealType === "dinner" ? "Dinner" : "Snack"}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </GlassCard>
        </View>
      </Modal>

      {/* Add Food Modal */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalRoot}>
          <LinearGradient colors={isDark ? ["#010814","#031628","#051E30"] : ["#C8E9FA","#D9F4EE","#E8F4FF"]} style={StyleSheet.absoluteFill} />
          <View style={[styles.modalHeader, { borderBottomColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,119,182,0.1)" }]}>
            <Text style={[styles.modalTitle, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>Food Add Karein 🍎</Text>
            <TouchableOpacity onPress={() => { setShowAddModal(false); setFoodText(""); setSearchResults([]); setAiResult(null); }}
              style={[styles.closeBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.07)" }]}>
              <Ionicons name="close" size={20} color={isDark ? "#F0F8FF" : "#0A1628"} />
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mealTabScroll} contentContainerStyle={{ paddingHorizontal: 18, gap: 8 }}>
            {MEAL_TYPES.map((mt) => {
              const ml = MEAL_LABELS[mt];
              return (
                <TouchableOpacity key={mt} onPress={() => setActiveMealType(mt)} activeOpacity={0.8}>
                  {activeMealType === mt
                    ? <LinearGradient colors={ml.grad} style={styles.mealTab}><Ionicons name={ml.icon} size={14} color="#FFF" /><Text style={[styles.mealTabTxt, { color: "#FFF", fontFamily: "Inter_600SemiBold" }]}>{ml.label}</Text></LinearGradient>
                    : <View style={[styles.mealTab, { backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.7)", borderWidth: 1, borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.9)" }]}><Ionicons name={ml.icon} size={14} color={isDark ? "rgba(255,255,255,0.5)" : "#0077B6"} /><Text style={[styles.mealTabTxt, { color: isDark ? "rgba(255,255,255,0.6)" : "#0077B6", fontFamily: "Inter_500Medium" }]}>{ml.label}</Text></View>
                  }
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <GlassCard style={{ marginHorizontal: 18, marginBottom: 12 }}>
            <View style={styles.searchRow}>
              <Ionicons name="search" size={18} color={isDark ? "rgba(255,255,255,0.4)" : "rgba(0,119,182,0.5)"} />
              <TextInput style={[styles.searchInput, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_400Regular" }]}
                placeholder="Food ka naam likhein..." placeholderTextColor={isDark ? "rgba(255,255,255,0.3)" : "rgba(10,22,40,0.35)"}
                value={foodText} onChangeText={(t) => { setFoodText(t); searchFood(t); }} autoFocus />
              {isSearching && <ActivityIndicator size="small" color={isDark ? "#38BDF8" : "#0077B6"} />}
            </View>
          </GlassCard>

          {searchResults.length > 0 && (
            <FlatList data={searchResults} keyExtractor={(i) => String(i.id)} style={{ paddingHorizontal: 18 }}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => handleQuickLog(item)} style={[styles.searchItem, { borderBottomColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)" }]}>
                  <View>
                    <Text style={[styles.searchName, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_500Medium" }]}>{item.foodNameEn as string}</Text>
                    <Text style={[styles.searchCal, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular" }]}>{Math.round(Number(item.calories))} kcal · DB</Text>
                  </View>
                  <LinearGradient colors={["#0077B6","#1B998B"]} style={styles.addCircle}><Ionicons name="add" size={18} color="#FFF" /></LinearGradient>
                </TouchableOpacity>
              )}
            />
          )}

          {/* AI Scan section */}
          {foodText.length > 1 && searchResults.length === 0 && !isSearching && !aiResult && (
            <View style={{ paddingHorizontal: 18 }}>
              <Text style={[styles.noResult, { color: isDark ? "rgba(255,255,255,0.35)" : "rgba(10,22,40,0.4)", fontFamily: "Inter_400Regular" }]}>
                Database mein nahi mila — AI se pura nutrition analysis karein
              </Text>
              <TouchableOpacity onPress={handleAIScan} disabled={isAIScanning} activeOpacity={0.85} style={styles.aiWrap}>
                <LinearGradient colors={["#7C3AED","#0077B6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.aiBtn}>
                  {isAIScanning ? <ActivityIndicator color="#FFF" /> : <><Ionicons name="sparkles" size={18} color="#FFF" /><Text style={[styles.aiBtnText, { fontFamily: "Inter_600SemiBold" }]}>AI Nutrition Analysis</Text></>}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {/* AI Result card */}
          {aiResult && (
            <ScrollView style={{ paddingHorizontal: 18 }} showsVerticalScrollIndicator={false}>
              <GlassCard>
                <View style={{ padding: 16 }}>
                  <View style={styles.aiResultHeader}>
                    <LinearGradient colors={["#7C3AED","#0077B6"]} style={styles.aiResultBadge}>
                      <Ionicons name="sparkles" size={12} color="#FFF" />
                      <Text style={[styles.aiBadgeText, { fontFamily: "Inter_600SemiBold" }]}>AI Analysis</Text>
                    </LinearGradient>
                    {aiResult.dietaryTags?.length > 0 && (
                      <View style={styles.tagsRow}>
                        {aiResult.dietaryTags.map(tag => (
                          <View key={tag} style={[styles.dietTag, { backgroundColor: isDark ? "rgba(45,212,191,0.15)" : "rgba(27,153,139,0.1)" }]}>
                            <Text style={[styles.dietTagText, { color: isDark ? "#2DD4BF" : "#1B998B", fontFamily: "Inter_500Medium" }]}>{tag}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                  <Text style={[styles.aiResultName, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>{aiResult.foodNameEn}</Text>
                  <Text style={[styles.aiResultServing, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular" }]}>Per {aiResult.servingDescription || "100g"}</Text>

                  {/* Main macros */}
                  <View style={styles.macroRow}>
                    {[
                      { label: "Calories", value: aiResult.calories, unit: "kcal", color: "#F59E0B" },
                      { label: "Protein", value: aiResult.proteinG, unit: "g", color: "#EF4444" },
                      { label: "Carbs", value: aiResult.carbsG, unit: "g", color: "#0077B6" },
                      { label: "Fat", value: aiResult.fatG, unit: "g", color: "#8B5CF6" },
                      { label: "Fiber", value: aiResult.fiberG, unit: "g", color: "#10B981" },
                    ].map(m => (
                      <View key={m.label} style={[styles.macroChip, { backgroundColor: `${m.color}12` }]}>
                        <Text style={[styles.macroVal, { color: m.color, fontFamily: "Inter_700Bold" }]}>{Number(m.value || 0).toFixed(1)}</Text>
                        <Text style={[styles.macroUnit, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.4)", fontFamily: "Inter_400Regular" }]}>{m.unit}</Text>
                        <Text style={[styles.macroLabel, { color: isDark ? "rgba(255,255,255,0.35)" : "rgba(10,22,40,0.4)", fontFamily: "Inter_400Regular" }]}>{m.label}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Vitamins */}
                  <VitaminsPanel vitamins={aiResult.vitamins} isDark={isDark} />

                  {aiResult.healthTip && (
                    <View style={[styles.tipBox, { backgroundColor: isDark ? "rgba(45,212,191,0.1)" : "rgba(27,153,139,0.08)", marginTop: 12 }]}>
                      <Text style={[styles.tipText, { color: isDark ? "#2DD4BF" : "#1B998B", fontFamily: "Inter_400Regular" }]}>💡 {aiResult.healthTip}</Text>
                    </View>
                  )}

                  <View style={styles.aiActionsRow}>
                    <TouchableOpacity onPress={logFromAI} disabled={isSubmitting} activeOpacity={0.85} style={{ flex: 1, borderRadius: 14, overflow: "hidden" }}>
                      <LinearGradient colors={["#0077B6","#1B998B"]} style={styles.logBtn}>
                        {isSubmitting ? <ActivityIndicator color="#FFF" size="small" /> : <><Ionicons name="add-circle-outline" size={16} color="#FFF" /><Text style={[styles.logBtnText, { fontFamily: "Inter_600SemiBold", fontSize: 14 }]}>Log karein</Text></>}
                      </LinearGradient>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setAiResult(null)} style={[styles.retryBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }]}>
                      <Ionicons name="refresh" size={18} color={isDark ? "rgba(255,255,255,0.5)" : "rgba(10,22,40,0.5)"} />
                    </TouchableOpacity>
                  </View>
                </View>
              </GlassCard>
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  orb1: { position: "absolute", width: 300, height: 300, borderRadius: 150, top: -100, right: -80, opacity: 0.45 },
  orb2: { position: "absolute", width: 250, height: 250, borderRadius: 125, bottom: 80, left: -70, opacity: 0.38 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: 18, paddingBottom: 12 },
  title: { fontSize: 24 },
  dateText: { fontSize: 12, marginTop: 3 },
  addBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  calCard: { flexDirection: "row", padding: 16, alignItems: "center" },
  calItem: { flex: 1, alignItems: "center" },
  calNum: { fontSize: 22 },
  calLabel: { fontSize: 12, marginTop: 2 },
  calDiv: { width: 1, height: 32 },
  calBarTrack: { marginHorizontal: 16, marginBottom: 14, height: 4, borderRadius: 2, overflow: "hidden" },
  calBarFill: { height: 4, borderRadius: 2 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  mealSection: { marginBottom: 18 },
  mealTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  mealIconBg: { width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  mealTitle: { fontSize: 15 },
  mealCalBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  mealCalText: { fontSize: 12 },
  emptyMeal: { flexDirection: "row", alignItems: "center", gap: 8, padding: 14, borderRadius: 14, borderWidth: 1, borderStyle: "dashed" },
  emptyText: { fontSize: 14 },
  logItem: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  logDot: { width: 4, height: 36, borderRadius: 2 },
  logLeft: { flex: 1 },
  logName: { fontSize: 14, marginBottom: 3 },
  logMacros: { fontSize: 11 },
  logCal: { fontSize: 16 },
  detailOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center" },
  detailHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 },
  detailName: { fontSize: 20, flex: 1, marginRight: 10 },
  detailServing: { fontSize: 13, marginBottom: 14 },
  tipBox: { borderRadius: 12, padding: 12, marginTop: 0, marginBottom: 4 },
  tipText: { fontSize: 13, lineHeight: 18 },
  macroRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  macroChip: { alignItems: "center", padding: 10, borderRadius: 12, minWidth: 60 },
  macroVal: { fontSize: 16 },
  macroUnit: { fontSize: 10 },
  macroLabel: { fontSize: 10, marginTop: 2 },
  giBox: { borderRadius: 10, padding: 10, marginTop: 12 },
  giText: { fontSize: 13 },
  logBtn: { flexDirection: "row", alignItems: "center", gap: 8, height: 48, justifyContent: "center", borderRadius: 14 },
  logBtnText: { color: "#FFF", fontSize: 16 },
  vitaminsTitle: { fontSize: 13, marginBottom: 8 },
  vitaminsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  vitaminChip: { alignItems: "center", padding: 8, borderRadius: 10, minWidth: 72 },
  vitaminEmoji: { fontSize: 18 },
  vitaminLabel: { fontSize: 10, marginTop: 2 },
  vitaminValue: { fontSize: 12, marginTop: 1 },
  modalRoot: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, paddingTop: 56, borderBottomWidth: 1 },
  modalTitle: { fontSize: 20 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  mealTabScroll: { paddingVertical: 14 },
  mealTab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
  mealTabTxt: { fontSize: 13 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  searchInput: { flex: 1, fontSize: 15 },
  searchItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1 },
  searchName: { fontSize: 15, marginBottom: 4 },
  searchCal: { fontSize: 13 },
  addCircle: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  noResult: { fontSize: 13, marginBottom: 14, textAlign: "center" },
  aiWrap: { borderRadius: 16, overflow: "hidden" },
  aiBtn: { flexDirection: "row", alignItems: "center", gap: 8, height: 52, justifyContent: "center" },
  aiBtnText: { color: "#FFF", fontSize: 16 },
  aiResultHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  aiResultBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  aiBadgeText: { color: "#FFF", fontSize: 11 },
  tagsRow: { flexDirection: "row", gap: 4 },
  dietTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  dietTagText: { fontSize: 11 },
  aiResultName: { fontSize: 18 },
  aiResultServing: { fontSize: 12, marginTop: 2, marginBottom: 4 },
  aiActionsRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  retryBtn: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
});
