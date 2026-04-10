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

type FoodLog = { id: string; foodNameEn: string; mealType: string; calories: string; proteinG?: string; carbsG?: string; fatG?: string; };
const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_LABELS: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; grad: [string, string] }> = {
  breakfast: { label: "Breakfast", icon: "sunny-outline", color: "#F59E0B", grad: ["#F59E0B", "#EF4444"] },
  lunch: { label: "Lunch", icon: "partly-sunny-outline", color: "#10B981", grad: ["#059669", "#1B998B"] },
  dinner: { label: "Dinner", icon: "moon-outline", color: "#7C3AED", grad: ["#7C3AED", "#0077B6"] },
  snack: { label: "Snack", icon: "cafe-outline", color: "#0EA5E9", grad: ["#0EA5E9", "#38BDF8"] },
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
    if (query.length < 2) { setSearchResults([]); return; }
    setIsSearching(true);
    try { const res = await api.searchFood(query); setSearchResults(res.items as Array<Record<string, unknown>>); }
    catch { setSearchResults([]); }
    setIsSearching(false);
  }, []);

  const handleQuickLog = async (item: Record<string, unknown>) => {
    setIsSubmitting(true);
    try {
      await api.logFood({ foodNameEn: item.foodNameEn as string, mealType: activeMealType, calories: String(item.calories), proteinG: String(item.proteinG || 0), carbsG: String(item.carbsG || 0), fatG: String(item.fatG || 0), foodItemId: item.id as string, inputMethod: "text" });
      setFoodText(""); setSearchResults([]); setShowAddModal(false);
      await loadLogs(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch { Alert.alert("Error", "Food log nahi hua"); }
    setIsSubmitting(false);
  };

  const handleAIScan = async () => {
    if (!foodText.trim()) { Alert.alert("Food naam likhein"); return; }
    setIsSubmitting(true);
    try {
      const token = await (await import("@/lib/storage")).storage.getToken();
      const scan = await fetch(`${process.env.EXPO_PUBLIC_API_URL || "http://localhost:8080/api"}/food/scan`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ foodName: foodText.trim() }) });
      const scanData = await scan.json() as { result?: Record<string, unknown> };
      await api.logFood({ foodNameEn: foodText.trim(), mealType: activeMealType, calories: String(scanData.result?.calories || 100), proteinG: String(scanData.result?.proteinG || 0), carbsG: String(scanData.result?.carbsG || 0), fatG: String(scanData.result?.fatG || 0), inputMethod: "text" });
      setFoodText(""); setShowAddModal(false); await loadLogs();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch { Alert.alert("Error", "AI analysis fail hua"); }
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

      {/* Header */}
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
      <View style={styles.calWrap}>
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
          {/* Progress bar */}
          <View style={[styles.calBarTrack, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }]}>
            <LinearGradient colors={calPct >= 90 ? ["#EF4444","#F59E0B"] : ["#0077B6","#1B998B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.calBarFill, { width: `${calPct}%` }]} />
          </View>
        </GlassCard>
      </View>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={isDark ? "#38BDF8" : "#0077B6"} size="large" />
        </View>
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
                  <Text style={[styles.mealTitle, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>
                    {ml.label}
                  </Text>
                  {mCal > 0 && (
                    <View style={[styles.mealCalBadge, { backgroundColor: `${ml.color}18` }]}>
                      <Text style={[styles.mealCalText, { color: ml.color, fontFamily: "Inter_600SemiBold" }]}>{mCal} kcal</Text>
                    </View>
                  )}
                </View>
                {mLogs.length === 0 ? (
                  <TouchableOpacity onPress={() => { setActiveMealType(mt); setShowAddModal(true); }} activeOpacity={0.8}
                    style={[styles.emptyMeal, { borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,119,182,0.18)", backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.4)" }]}>
                    <Ionicons name="add-circle-outline" size={18} color={ml.color} />
                    <Text style={[styles.emptyText, { color: isDark ? "rgba(255,255,255,0.35)" : "rgba(10,22,40,0.4)", fontFamily: "Inter_400Regular" }]}>Food add karein</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    {mLogs.map((log) => (
                      <GlassCard key={log.id} style={{ marginBottom: 8 }}>
                        <View style={styles.logItem}>
                          <LinearGradient colors={ml.grad} style={styles.logDot} />
                          <View style={styles.logLeft}>
                            <Text style={[styles.logName, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_500Medium" }]}>{log.foodNameEn}</Text>
                            <Text style={[styles.logMacros, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular" }]}>
                              P:{Math.round(Number(log.proteinG || 0))}g · C:{Math.round(Number(log.carbsG || 0))}g · F:{Math.round(Number(log.fatG || 0))}g
                            </Text>
                          </View>
                          <Text style={[styles.logCal, { color: ml.color, fontFamily: "Inter_700Bold" }]}>{Math.round(Number(log.calories))}</Text>
                        </View>
                      </GlassCard>
                    ))}
                    <TouchableOpacity onPress={() => { setActiveMealType(mt); setShowAddModal(true); }} style={[styles.addMoreBtn, { borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,119,182,0.15)" }]}>
                      <Ionicons name="add" size={14} color={isDark ? "rgba(255,255,255,0.4)" : "#0077B6"} />
                      <Text style={[styles.addMoreText, { color: isDark ? "rgba(255,255,255,0.4)" : "#0077B6", fontFamily: "Inter_400Regular" }]}>Aur add karein</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Add Food Modal */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalRoot}>
          <LinearGradient
            colors={isDark ? ["#010814","#031628","#051E30"] : ["#C8E9FA","#D9F4EE","#E8F4FF"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.orb1, { backgroundColor: isDark ? "#7C2D12" : "#FED7AA", opacity: 0.35 }]} />

          <View style={[styles.modalHeader, { borderBottomColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,119,182,0.1)" }]}>
            <Text style={[styles.modalTitle, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>Food Add Karein 🍎</Text>
            <TouchableOpacity onPress={() => { setShowAddModal(false); setFoodText(""); setSearchResults([]); }} style={[styles.closeBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.07)" }]}>
              <Ionicons name="close" size={20} color={isDark ? "#F0F8FF" : "#0A1628"} />
            </TouchableOpacity>
          </View>

          {/* Meal Type Selector */}
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

          {/* Search */}
          <GlassCard style={{ marginHorizontal: 18, marginBottom: 12 }}>
            <View style={styles.searchRow}>
              <Ionicons name="search" size={18} color={isDark ? "rgba(255,255,255,0.4)" : "rgba(0,119,182,0.5)"} />
              <TextInput style={[styles.searchInput, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_400Regular" }]} placeholder="Food ka naam likhein..." placeholderTextColor={isDark ? "rgba(255,255,255,0.3)" : "rgba(10,22,40,0.35)"} value={foodText} onChangeText={(t) => { setFoodText(t); searchFood(t); }} autoFocus />
              {isSearching && <ActivityIndicator size="small" color={isDark ? "#38BDF8" : "#0077B6"} />}
            </View>
          </GlassCard>

          {searchResults.length > 0 ? (
            <FlatList data={searchResults} keyExtractor={(i) => String(i.id)} style={{ paddingHorizontal: 18 }}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => handleQuickLog(item)} style={[styles.searchItem, { borderBottomColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)" }]}>
                  <View>
                    <Text style={[styles.searchName, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_500Medium" }]}>{item.foodNameEn as string}</Text>
                    <Text style={[styles.searchCal, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular" }]}>{Math.round(Number(item.calories))} kcal</Text>
                  </View>
                  <LinearGradient colors={["#0077B6","#1B998B"]} style={styles.addCircle}>
                    <Ionicons name="add" size={18} color="#FFF" />
                  </LinearGradient>
                </TouchableOpacity>
              )}
            />
          ) : foodText.length > 2 && !isSearching ? (
            <View style={{ paddingHorizontal: 18 }}>
              <Text style={[styles.noResult, { color: isDark ? "rgba(255,255,255,0.35)" : "rgba(10,22,40,0.4)", fontFamily: "Inter_400Regular" }]}>Database mein nahi mila — AI se try karein</Text>
              <TouchableOpacity onPress={handleAIScan} disabled={isSubmitting} style={styles.aiWrap}>
                <LinearGradient colors={["#7C3AED","#0077B6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.aiBtn}>
                  {isSubmitting ? <ActivityIndicator color="#FFF" /> : <><Ionicons name="sparkles" size={18} color="#FFF" /><Text style={[styles.aiBtnText, { fontFamily: "Inter_600SemiBold" }]}>AI se Analyse Karein</Text></>}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : null}
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
  calWrap: {},
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
  mealTitle: { fontSize: 15, flex: 1 },
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
  addMoreBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderStyle: "dashed", alignSelf: "flex-start", marginTop: 4 },
  addMoreText: { fontSize: 12 },
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
});
