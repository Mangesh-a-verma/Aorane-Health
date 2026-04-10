import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator, FlatList, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { api } from "@/lib/api";

type FoodLog = {
  id: string;
  foodNameEn: string;
  mealType: string;
  calories: string;
  proteinG?: string;
  carbsG?: string;
  fatG?: string;
  loggedAt: string;
};

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_LABELS: Record<string, string> = {
  breakfast: "Breakfast 🌅",
  lunch: "Lunch ☀️",
  dinner: "Dinner 🌙",
  snack: "Snack 🍎",
};

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function FoodScreen() {
  const colors = useColors();
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
      setTotalCalories(l.reduce((s, item) => s + Number(item.calories), 0));
    } catch { }
    setIsLoading(false);
  }, []);

  const searchFood = useCallback(async (query: string) => {
    if (query.length < 2) { setSearchResults([]); return; }
    setIsSearching(true);
    try {
      const res = await api.searchFood(query);
      setSearchResults(res.items as Array<Record<string, unknown>>);
    } catch {
      setSearchResults([]);
    }
    setIsSearching(false);
  }, []);

  const handleScanAI = async () => {
    if (!foodText.trim()) { Alert.alert("Enter food name", "Please type food name to scan"); return; }
    setIsSearching(true);
    try {
      const res = await api.logFood({
        foodNameEn: foodText.trim(),
        mealType: activeMealType,
        calories: "0",
        inputMethod: "text",
      });
      const scan = await fetch(`${process.env.EXPO_PUBLIC_API_URL || "http://localhost:8080/api"}/food/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ foodName: foodText.trim() }),
      });
      const scanData = await scan.json() as { result: Record<string, unknown>; fromCache: boolean };
      if (scanData.result) {
        await api.logFood({
          foodNameEn: foodText.trim(),
          mealType: activeMealType,
          calories: String(scanData.result.calories || 100),
          proteinG: String(scanData.result.proteinG || 0),
          carbsG: String(scanData.result.carbsG || 0),
          fatG: String(scanData.result.fatG || 0),
          inputMethod: "text",
        });
      }
      setFoodText("");
      setShowAddModal(false);
      await loadLogs();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Error", "Failed to log food");
    }
    setIsSearching(false);
  };

  const handleQuickLog = async (item: Record<string, unknown>) => {
    setIsSubmitting(true);
    try {
      await api.logFood({
        foodNameEn: item.foodNameEn as string,
        mealType: activeMealType,
        calories: String(item.calories),
        proteinG: String(item.proteinG || 0),
        carbsG: String(item.carbsG || 0),
        fatG: String(item.fatG || 0),
        foodItemId: item.id as string,
        inputMethod: "text",
      });
      setFoodText("");
      setSearchResults([]);
      setShowAddModal(false);
      await loadLogs();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Error", "Failed to log food");
    }
    setIsSubmitting(false);
  };

  const grouped = MEAL_TYPES.reduce((acc, mt) => {
    acc[mt] = logs.filter((l) => l.mealType === mt);
    return acc;
  }, {} as Record<string, FoodLog[]>);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Food Log</Text>
        <TouchableOpacity
          onPress={() => setShowAddModal(true)}
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
        >
          <Ionicons name="add" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      <View style={[styles.calSummary, { backgroundColor: colors.card, borderColor: colors.border, marginHorizontal: 20, marginBottom: 16 }]}>
        <View style={styles.calItem}>
          <Text style={[styles.calNum, { color: colors.warning, fontFamily: "Inter_700Bold" }]}>{Math.round(totalCalories)}</Text>
          <Text style={[styles.calLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>kcal eaten</Text>
        </View>
        <View style={[styles.calDivider, { backgroundColor: colors.border }]} />
        <View style={styles.calItem}>
          <Text style={[styles.calNum, { color: colors.success, fontFamily: "Inter_700Bold" }]}>{Math.max(0, 2000 - Math.round(totalCalories))}</Text>
          <Text style={[styles.calLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>kcal left</Text>
        </View>
        <View style={[styles.calDivider, { backgroundColor: colors.border }]} />
        <View style={styles.calItem}>
          <Text style={[styles.calNum, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>2000</Text>
          <Text style={[styles.calLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>goal</Text>
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 90 }} showsVerticalScrollIndicator={false}>
          {MEAL_TYPES.map((mt) => (
            <View key={mt} style={styles.mealSection}>
              <Text style={[styles.mealTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                {MEAL_LABELS[mt]}
              </Text>
              {grouped[mt].length === 0 ? (
                <TouchableOpacity
                  onPress={() => { setActiveMealType(mt); setShowAddModal(true); }}
                  style={[styles.emptyMeal, { borderColor: colors.border, borderStyle: "dashed" }]}
                >
                  <Ionicons name="add-circle-outline" size={20} color={colors.mutedForeground} />
                  <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Add food</Text>
                </TouchableOpacity>
              ) : (
                grouped[mt].map((log) => (
                  <View key={log.id} style={[styles.logItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.logLeft}>
                      <Text style={[styles.logName, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{log.foodNameEn}</Text>
                      <Text style={[styles.logMacros, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                        P:{Math.round(Number(log.proteinG || 0))}g · C:{Math.round(Number(log.carbsG || 0))}g · F:{Math.round(Number(log.fatG || 0))}g
                      </Text>
                    </View>
                    <Text style={[styles.logCal, { color: colors.warning, fontFamily: "Inter_700Bold" }]}>
                      {Math.round(Number(log.calories))} kcal
                    </Text>
                  </View>
                ))
              )}
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalRoot, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Food Add Karein</Text>
            <TouchableOpacity onPress={() => { setShowAddModal(false); setFoodText(""); setSearchResults([]); }}>
              <Ionicons name="close" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <View style={styles.mealTypeRow}>
            {MEAL_TYPES.map((mt) => (
              <TouchableOpacity
                key={mt}
                onPress={() => setActiveMealType(mt)}
                style={[
                  styles.mealTab,
                  { backgroundColor: activeMealType === mt ? colors.primary : colors.card, borderColor: activeMealType === mt ? colors.primary : colors.border },
                ]}
              >
                <Text style={[styles.mealTabText, { color: activeMealType === mt ? "#FFF" : colors.foreground, fontFamily: "Inter_500Medium" }]}>
                  {mt.charAt(0).toUpperCase() + mt.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="search" size={20} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
              placeholder="Food ka naam likhein..."
              placeholderTextColor={colors.mutedForeground}
              value={foodText}
              onChangeText={(t) => { setFoodText(t); searchFood(t); }}
              autoFocus
            />
            {isSearching && <ActivityIndicator size="small" color={colors.primary} />}
          </View>

          {searchResults.length > 0 && (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => String(item.id)}
              style={styles.searchResults}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => handleQuickLog(item)}
                  style={[styles.searchItem, { borderBottomColor: colors.border }]}
                >
                  <View>
                    <Text style={[styles.searchName, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{item.foodNameEn as string}</Text>
                    <Text style={[styles.searchCal, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      {Math.round(Number(item.calories))} kcal · per {Math.round(Number(item.servingSizeG || 100))}g
                    </Text>
                  </View>
                  <Ionicons name="add-circle" size={24} color={colors.primary} />
                </TouchableOpacity>
              )}
            />
          )}

          {foodText.length > 2 && searchResults.length === 0 && !isSearching && (
            <TouchableOpacity
              onPress={handleScanAI}
              disabled={isSubmitting}
              style={[styles.aiBtn, { backgroundColor: colors.accent }]}
            >
              {isSubmitting
                ? <ActivityIndicator color="#FFF" />
                : <>
                    <Ionicons name="sparkles" size={18} color="#FFF" />
                    <Text style={[styles.aiBtnText, { fontFamily: "Inter_600SemiBold" }]}>AI se analyse karein</Text>
                  </>
              }
            </TouchableOpacity>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 16 },
  title: { fontSize: 24 },
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  calSummary: { flexDirection: "row", borderRadius: 14, padding: 14, borderWidth: 1, alignItems: "center" },
  calItem: { flex: 1, alignItems: "center" },
  calNum: { fontSize: 22 },
  calLabel: { fontSize: 12, marginTop: 2 },
  calDivider: { width: 1, height: 30 },
  mealSection: { marginBottom: 20 },
  mealTitle: { fontSize: 16, marginBottom: 10 },
  emptyMeal: { flexDirection: "row", alignItems: "center", gap: 8, padding: 14, borderRadius: 12, borderWidth: 1.5 },
  emptyText: { fontSize: 14 },
  logItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  logLeft: { flex: 1 },
  logName: { fontSize: 15, marginBottom: 4 },
  logMacros: { fontSize: 12 },
  logCal: { fontSize: 16 },
  modalRoot: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 20 },
  mealTypeRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingVertical: 16 },
  mealTab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  mealTabText: { fontSize: 13 },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 20, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, height: 50 },
  searchInput: { flex: 1, fontSize: 15 },
  searchResults: { flex: 1, paddingHorizontal: 20 },
  searchItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1 },
  searchName: { fontSize: 15, marginBottom: 4 },
  searchCal: { fontSize: 13 },
  aiBtn: { flexDirection: "row", alignItems: "center", gap: 8, margin: 20, height: 52, borderRadius: 14, justifyContent: "center" },
  aiBtnText: { color: "#FFF", fontSize: 16 },
});
