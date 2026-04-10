import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Platform, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { HealthRing } from "@/components/HealthRing";
import { WaterTracker } from "@/components/WaterTracker";
import { CalorieRing } from "@/components/CalorieRing";
import { StatCard } from "@/components/StatCard";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [healthScore, setHealthScore] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [water, setWater] = useState({ current: 0, goal: 8 });
  const [calories, setCalories] = useState({ eaten: 0, goal: 2000, burned: 0 });
  const [exerciseMin, setExerciseMin] = useState(0);
  const [medicineAdherence, setMedicineAdherence] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [greeting, setGreeting] = useState("Namaste");

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) setGreeting("Suprabhat 🌅");
    else if (h < 17) setGreeting("Namaskar ☀️");
    else setGreeting("Shubh Sham 🌙");
    loadData();
  }, []);

  const loadData = useCallback(async () => {
    try {
      const date = todayDate();
      const [scoreRes, waterRes, foodRes, exerciseRes] = await Promise.allSettled([
        api.getHealthScore(date),
        api.getWaterLog(date),
        api.getFoodSummary(date),
        api.getExerciseLogs(date),
      ]);

      if (scoreRes.status === "fulfilled") {
        const s = scoreRes.value.score as Record<string, number>;
        setHealthScore(s.healthScore ?? 0);
        setConfidence(Number(s.dataConfidencePct) ?? 0);
        setMedicineAdherence(Number(s.medicineAdherencePct) ?? 0);
      }
      if (waterRes.status === "fulfilled") {
        setWater({ current: waterRes.value.totalGlasses || 0, goal: waterRes.value.goal || 8 });
      }
      if (foodRes.status === "fulfilled") {
        const summ = foodRes.value.summary as Record<string, number>;
        setCalories({
          eaten: Math.round(summ.totalCalories || 0),
          goal: 2000,
          burned: 0,
        });
      }
      if (exerciseRes.status === "fulfilled") {
        const logs = exerciseRes.value.logs as Array<{ durationMinutes: number; caloriesBurned?: string }>;
        const totalMin = logs.reduce((s, l) => s + l.durationMinutes, 0);
        const totalBurned = logs.reduce((s, l) => s + Number(l.caloriesBurned || 0), 0);
        setExerciseMin(totalMin);
        setCalories((c) => ({ ...c, burned: Math.round(totalBurned) }));
      }
    } catch { }
    setIsLoading(false);
    setRefreshing(false);
  }, []);

  const handleAddWater = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await api.logWater(1);
      setWater((w) => ({ ...w, current: w.current + 1 }));
      await api.computeHealthScore(todayDate());
    } catch { }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  if (isLoading) {
    return (
      <View style={[styles.loadingCenter, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topPad + 8, paddingBottom: insets.bottom + 90 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topBar}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {greeting}
          </Text>
          <Text style={[styles.userName, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            {(user as unknown as { phone?: string })?.phone || "AORANE User"}
          </Text>
        </View>
        <View style={styles.topIcons}>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="notifications-outline" size={22} color={colors.foreground} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.adBanner, { backgroundColor: colors.tealLight, borderColor: colors.border }]}>
        <View style={styles.adContent}>
          <Ionicons name="heart-circle" size={24} color={colors.primary} />
          <Text style={[styles.adText, { color: colors.primary, fontFamily: "Inter_500Medium" }]}>
            Aaj ka tip: Subah 2 glass paani pi ke din start karein 💧
          </Text>
        </View>
      </View>

      <View style={styles.scoreSection}>
        <HealthRing score={healthScore} confidence={confidence} size={180} />
        <View style={styles.miniStats}>
          <StatCard
            icon={<Ionicons name="flame" size={20} color={colors.warning} />}
            label="Calories"
            value={`${calories.eaten}`}
            subValue={`Goal: ${calories.goal}`}
            color={colors.warning}
          />
          <StatCard
            icon={<MaterialCommunityIcons name="run-fast" size={20} color={colors.success} />}
            label="Exercise"
            value={`${exerciseMin}m`}
            subValue="today"
            color={colors.success}
          />
        </View>
      </View>

      <View style={styles.cardRow}>
        <WaterTracker current={water.current} goal={water.goal} onAdd={handleAddWater} />
        <CalorieRing eaten={calories.eaten} goal={calories.goal} burned={calories.burned} />
      </View>

      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Aaj ka Summary
        </Text>
        <View style={styles.summaryRows}>
          <SummaryRow
            icon={<Ionicons name="restaurant-outline" size={18} color={colors.warning} />}
            label="Calories Khaaye"
            value={`${calories.eaten} kcal`}
            colors={colors}
          />
          <SummaryRow
            icon={<Ionicons name="water-outline" size={18} color="#60A5FA" />}
            label="Paani Piya"
            value={`${water.current} / ${water.goal} glass`}
            colors={colors}
          />
          <SummaryRow
            icon={<Ionicons name="barbell-outline" size={18} color={colors.success} />}
            label="Exercise"
            value={`${exerciseMin} min`}
            colors={colors}
          />
          <SummaryRow
            icon={<Ionicons name="medical-outline" size={18} color={colors.accent} />}
            label="Medicine Adherence"
            value={medicineAdherence ? `${Math.round(medicineAdherence)}%` : "N/A"}
            colors={colors}
          />
        </View>
      </View>
    </ScrollView>
  );
}

function SummaryRow({
  icon, label, value, colors,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[summaryStyles.row, { borderBottomColor: colors.border }]}>
      <View style={summaryStyles.left}>
        {icon}
        <Text style={[summaryStyles.label, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{label}</Text>
      </View>
      <Text style={[summaryStyles.value, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{value}</Text>
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1 },
  left: { flexDirection: "row", alignItems: "center", gap: 10 },
  label: { fontSize: 14 },
  value: { fontSize: 14 },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  loadingCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, marginBottom: 16,
  },
  greeting: { fontSize: 13 },
  userName: { fontSize: 20 },
  topIcons: { flexDirection: "row", gap: 8 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  adBanner: { marginHorizontal: 20, borderRadius: 14, padding: 14, borderWidth: 1, marginBottom: 24 },
  adContent: { flexDirection: "row", alignItems: "center", gap: 10 },
  adText: { flex: 1, fontSize: 13, lineHeight: 18 },
  scoreSection: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 20 },
  miniStats: { flex: 1, paddingLeft: 16, gap: 12 },
  cardRow: { flexDirection: "row", gap: 12, paddingHorizontal: 20, marginBottom: 20 },
  section: { marginHorizontal: 20, borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 16 },
  sectionTitle: { fontSize: 16, marginBottom: 12 },
  summaryRows: {},
});
