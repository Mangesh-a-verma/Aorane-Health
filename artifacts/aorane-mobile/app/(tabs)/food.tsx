import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator, FlatList, Platform, useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { GlassCard } from "@/components/GlassCard";
import { GradientBackground } from "@/components/GradientBackground";
import { useColors } from "@/hooks/useColors";
import { api } from "@/lib/api";

type FoodLog = { id: string; foodNameEn: string; mealType: string; calories: string; proteinG?: string; carbsG?: string; fatG?: string; };
const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_LABELS: Record<string, { label: string; icon: string }> = {
  breakfast: { label: "Breakfast", icon: "sunny-outline" },
  lunch: { label: "Lunch", icon: "partly-sunny-outline" },
  dinner: { label: "Dinner", icon: "moon-outline" },
  snack: { label: "Snack", icon: "cafe-outline" },
};

function todayDate() { return new Date().toISOString().slice(0, 10); }

export default function FoodScreen() {
  const colors = useColors();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
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
    try {
      const res = await api.searchFood(query);
      setSearchResults(res.items as Array<Record<string, unknown>>);
    } catch { setSearchResults([]); }
    setIsSearching(false);
  }, []);

  const handleQuickLog = async (item: Record<string, unknown>) => {
    setIsSubmitting(true);
    try {
      await api.logFood({ foodNameEn: item.foodNameEn as string, mealType: activeMealType, calories: String(item.calories), proteinG: String(item.proteinG || 0), carbsG: String(item.carbsG || 0), fatG: String(item.fatG || 0), foodItemId: item.id as string, inputMethod: "text" });
      setFoodText(""); setSearchResults([]); setShowAddModal(false);
      await loadLogs();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch { Alert.alert("Error", "Failed to log food"); }
    setIsSubmitting(false);
  };

  const handleAIScan = async () => {
    if (!foodText.trim()) { Alert.alert("Food name likhein", "Please type food name"); return; }
    setIsSubmitting(true);
    try {
      const token = await (await import("@/lib/storage")).storage.getToken();
      const scan = await fetch(`${process.env.EXPO_PUBLIC_API_URL || "http://localhost:8080/api"}/food/scan`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ foodName: foodText.trim() }) });
      const scanData = await scan.json() as { result?: Record<string, unknown> };
      await api.logFood({ foodNameEn: foodText.trim(), mealType: activeMealType, calories: String(scanData.result?.calories || 100), proteinG: String(scanData.result?.proteinG || 0), carbsG: String(scanData.result?.carbsG || 0), fatG: String(scanData.result?.fatG || 0), inputMethod: "text" });
      setFoodText(""); setShowAddModal(false); await loadLogs();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch { Alert.alert("Error", "Failed to log food"); }
    setIsSubmitting(false);
  };

  const grouped = MEAL_TYPES.reduce((acc, mt) => { acc[mt] = logs.filter((l) => l.mealType === mt); return acc; }, {} as Record<string, FoodLog[]>);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <GradientBackground>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Text style={[styles.title, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>Food Log</Text>
        <TouchableOpacity onPress={() => setShowAddModal(true)} style={styles.addBtnWrap}>
          <LinearGradient colors={["#0077B6", "#1B998B"]} style={styles.addBtn}>
            <Ionicons name="add" size={22} color="#FFF" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <GlassCard style={styles.calCard}>
        {[
          { label: "Eaten", value: Math.round(totalCalories), color: isDark ? "#FCD34D" : "#D97706" },
          { label: "Left", value: Math.max(0, 2000 - Math.round(totalCalories)), color: isDark ? "#2DD4BF" : "#1B998B" },
          { label: "Goal", value: 2000, color: isDark ? "#38BDF8" : "#0077B6" },
        ].map((s, i, arr) => (
          <React.Fragment key={s.label}>
            <View style={styles.calItem}>
              <Text style={[styles.calNum, { color: s.color, fontFamily: "Inter_700Bold" }]}>{s.value}</Text>
              <Text style={[styles.calLabel, { color: isDark ? "rgba(255,255,255,0.45)" : "rgba(10,22,40,0.5)", fontFamily: "Inter_400Regular" }]}>{s.label}</Text>
            </View>
            {i < arr.length - 1 && <View style={[styles.calDiv, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }]} />}
          </React.Fragment>
        ))}
      </GlassCard>

      {isLoading ? <ActivityIndicator color={isDark ? "#38BDF8" : "#0077B6"} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 90 }} showsVerticalScrollIndicator={false}>
          {MEAL_TYPES.map((mt) => (
            <View key={mt} style={styles.mealSection}>
              <View style={styles.mealTitleRow}>
                <Ionicons name={MEAL_LABELS[mt].icon as keyof typeof Ionicons.glyphMap} size={16} color={isDark ? "rgba(255,255,255,0.5)" : "rgba(10,22,40,0.5)"} />
                <Text style={[styles.mealTitle, { color: isDark ? "rgba(255,255,255,0.75)" : "rgba(10,22,40,0.7)", fontFamily: "Inter_600SemiBold" }]}>
                  {MEAL_LABELS[mt].label} {grouped[mt].length > 0 ? `· ${Math.round(grouped[mt].reduce((s, l) => s + Number(l.calories), 0))} kcal` : ""}
                </Text>
              </View>
              {grouped[mt].length === 0 ? (
                <TouchableOpacity onPress={() => { setActiveMealType(mt); setShowAddModal(true); }} style={[styles.emptyMeal, { borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,119,182,0.15)" }]}>
                  <Ionicons name="add-circle-outline" size={18} color={isDark ? "rgba(255,255,255,0.3)" : "rgba(0,119,182,0.4)"} />
                  <Text style={[styles.emptyText, { color: isDark ? "rgba(255,255,255,0.3)" : "rgba(10,22,40,0.35)", fontFamily: "Inter_400Regular" }]}>Food add karein</Text>
                </TouchableOpacity>
              ) : (
                grouped[mt].map((log) => (
                  <GlassCard key={log.id} style={styles.logItem}>
                    <View style={styles.logLeft}>
                      <Text style={[styles.logName, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_500Medium" }]}>{log.foodNameEn}</Text>
                      <Text style={[styles.logMacros, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular" }]}>
                        P:{Math.round(Number(log.proteinG || 0))}g · C:{Math.round(Number(log.carbsG || 0))}g · F:{Math.round(Number(log.fatG || 0))}g
                      </Text>
                    </View>
                    <Text style={[styles.logCal, { color: isDark ? "#FCD34D" : "#D97706", fontFamily: "Inter_700Bold" }]}>{Math.round(Number(log.calories))} kcal</Text>
                  </GlassCard>
                ))
              )}
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modal, { backgroundColor: isDark ? "#040D1C" : "#EEF4FF" }]}>
          <LinearGradient colors={isDark ? ["#040D1C", "#062040"] : ["#E0F2FE", "#F0FDF9"]} style={StyleSheet.absoluteFill} />
          <View style={[styles.modalHeader, { borderBottomColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,119,182,0.1)" }]}>
            <Text style={[styles.modalTitle, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>Food Add Karein</Text>
            <TouchableOpacity onPress={() => { setShowAddModal(false); setFoodText(""); setSearchResults([]); }}>
              <Ionicons name="close" size={24} color={isDark ? "#F0F8FF" : "#0A1628"} />
            </TouchableOpacity>
          </View>
          <View style={styles.mealTypeRow}>
            {MEAL_TYPES.map((mt) => (
              <TouchableOpacity key={mt} onPress={() => setActiveMealType(mt)} style={[styles.mealTab, { backgroundColor: activeMealType === mt ? (isDark ? "#38BDF8" : "#0077B6") : (isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.7)"), borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,119,182,0.15)" }]}>
                <Text style={[styles.mealTabText, { color: activeMealType === mt ? "#FFF" : (isDark ? "rgba(255,255,255,0.65)" : "#0077B6"), fontFamily: "Inter_500Medium" }]}>{MEAL_LABELS[mt].label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <GlassCard style={styles.searchCard}>
            <Ionicons name="search" size={18} color={isDark ? "rgba(255,255,255,0.4)" : "rgba(0,119,182,0.5)"} />
            <TextInput style={[styles.searchInput, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_400Regular" }]} placeholder="Food ka naam likhein..." placeholderTextColor={isDark ? "rgba(255,255,255,0.3)" : "rgba(10,22,40,0.35)"} value={foodText} onChangeText={(t) => { setFoodText(t); searchFood(t); }} autoFocus />
            {isSearching && <ActivityIndicator size="small" color={isDark ? "#38BDF8" : "#0077B6"} />}
          </GlassCard>
          {searchResults.length > 0 && (
            <FlatList data={searchResults} keyExtractor={(i) => String(i.id)} style={{ paddingHorizontal: 18 }}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => handleQuickLog(item)} style={[styles.searchItem, { borderBottomColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)" }]}>
                  <View>
                    <Text style={[styles.searchName, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_500Medium" }]}>{item.foodNameEn as string}</Text>
                    <Text style={[styles.searchCal, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular" }]}>{Math.round(Number(item.calories))} kcal</Text>
                  </View>
                  <Ionicons name="add-circle" size={26} color={isDark ? "#38BDF8" : "#0077B6"} />
                </TouchableOpacity>
              )}
            />
          )}
          {foodText.length > 2 && searchResults.length === 0 && !isSearching && (
            <TouchableOpacity onPress={handleAIScan} disabled={isSubmitting} style={styles.aiWrap}>
              <LinearGradient colors={["#7C3AED", "#0077B6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.aiBtn}>
                {isSubmitting ? <ActivityIndicator color="#FFF" /> : <><Ionicons name="sparkles" size={18} color="#FFF" /><Text style={[styles.aiBtnText, { fontFamily: "Inter_600SemiBold" }]}>AI se analyse karein</Text></>}
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </Modal>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 18, paddingBottom: 14 },
  title: { fontSize: 24 },
  addBtnWrap: { borderRadius: 20, overflow: "hidden" },
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  calCard: { flexDirection: "row", marginHorizontal: 18, marginBottom: 16, padding: 16, alignItems: "center" },
  calItem: { flex: 1, alignItems: "center" },
  calNum: { fontSize: 22 },
  calLabel: { fontSize: 12, marginTop: 2 },
  calDiv: { width: 1, height: 30 },
  mealSection: { marginBottom: 20 },
  mealTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  mealTitle: { fontSize: 15 },
  emptyMeal: { flexDirection: "row", alignItems: "center", gap: 8, padding: 14, borderRadius: 14, borderWidth: 1, borderStyle: "dashed" },
  emptyText: { fontSize: 14 },
  logItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, marginBottom: 8 },
  logLeft: { flex: 1 },
  logName: { fontSize: 15, marginBottom: 4 },
  logMacros: { fontSize: 12 },
  logCal: { fontSize: 16 },
  modal: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 20 },
  mealTypeRow: { flexDirection: "row", gap: 8, paddingHorizontal: 18, paddingVertical: 14 },
  mealTab: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  mealTabText: { fontSize: 13 },
  searchCard: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 18, paddingHorizontal: 14, height: 50 },
  searchInput: { flex: 1, fontSize: 15 },
  searchItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1 },
  searchName: { fontSize: 15, marginBottom: 4 },
  searchCal: { fontSize: 13 },
  aiWrap: { margin: 18, borderRadius: 14, overflow: "hidden" },
  aiBtn: { flexDirection: "row", alignItems: "center", gap: 8, height: 52, justifyContent: "center" },
  aiBtnText: { color: "#FFF", fontSize: 16 },
});
