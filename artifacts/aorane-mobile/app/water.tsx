import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Animated, Platform, useColorScheme, Dimensions,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { cachedGet } from "@/lib/api";
import { useOfflineLog } from "@/hooks/useOfflineLog";

const { width: W } = Dimensions.get("window");
const ML_PER_GLASS = 250;

const DRINK_TYPES = [
  { key: "water",   label: "Water",   emoji: "💧", color: "#0077B6" },
  { key: "chai",    label: "Chai",    emoji: "☕", color: "#A16207" },
  { key: "juice",   label: "Juice",   emoji: "🧃", color: "#F59E0B" },
  { key: "milk",    label: "Milk",    emoji: "🥛", color: "#6B7280" },
  { key: "coconut", label: "Coconut", emoji: "🥥", color: "#10B981" },
];

function GlassIcon({ filled, partial }: { filled: boolean; partial?: boolean }) {
  const isDark = useColorScheme() === "dark";
  return (
    <View style={{ width: 36, height: 48, alignItems: "center", justifyContent: "flex-end" }}>
      <View style={{ width: 28, height: 40, borderRadius: 6, borderWidth: 2, borderColor: filled ? "#0077B6" : (isDark ? "rgba(255,255,255,0.2)" : "rgba(0,119,182,0.25)"), overflow: "hidden", backgroundColor: "transparent" }}>
        {filled && <LinearGradient colors={["#38BDF8","#0077B6"]} style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "100%" }} />}
        {partial && !filled && <LinearGradient colors={["#38BDF8","#0077B6"]} style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "50%" }} />}
      </View>
    </View>
  );
}

export default function WaterScreen() {
  const isDark = useColorScheme() === "dark";
  const insets = useSafeAreaInsets();
  const [glasses, setGlasses] = useState(0);
  const [goalGlasses, setGoalGlasses] = useState(10); // default 2500ml / 250 = 10
  const [logs, setLogs] = useState<Array<{ drinkType?: string; drink_type?: string; glassesCount?: number; glasses_count?: number; loggedAt?: string; logged_at?: string; _offline?: boolean }>>([]);
  const [selectedDrink, setSelectedDrink] = useState("water");
  const [loading, setLoading] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const topPad = insets.top;
  const bg = isDark ? "#010814" : "#F0F9FF";
  const today = new Date().toISOString().split("T")[0];

  const { logEntry, onSync } = useOfflineLog();

  const loadWater = useCallback(async () => {
    try {
      const { data } = await cachedGet<{ logs: Array<Record<string, unknown>>; totalGlasses: number; goalGlasses: number }>(`/health/water/${today}`);
      setGlasses(data.totalGlasses);
      setLogs((data.logs || []) as Array<{ drinkType: string; glassesCount: number; loggedAt: string }>);
    } catch { }
  }, [today]);

  const loadGoal = useCallback(async () => {
    try {
      const { data } = await cachedGet<{ score?: { water?: { mlGoal?: number } } }>(`/health/score/${today}`);
      const mlGoal = data?.score?.water?.mlGoal;
      if (mlGoal && mlGoal > 0) {
        setGoalGlasses(Math.round(mlGoal / ML_PER_GLASS));
      }
    } catch { }
  }, [today]);

  useEffect(() => { loadWater(); loadGoal(); }, [loadWater, loadGoal]);

  // Refresh when offline queue syncs
  useEffect(() => onSync(loadWater), [onSync, loadWater]);

  useEffect(() => {
    Animated.timing(progressAnim, { toValue: Math.min(1, glasses / goalGlasses), duration: 600, useNativeDriver: false }).start();
  }, [glasses, goalGlasses]);

  const addGlass = async () => {
    setLoading(true);
    try {
      await logEntry({
        path: "/health/water",
        body: { glassesCount: 1, drinkType: selectedDrink },
        category: "water",
        onSynced: loadWater,
        onOptimistic: (temp) => {
          // Immediately update count and log list
          setGlasses((g) => g + 1);
          setLogs((prev) => [
            {
              drinkType: selectedDrink,
              glassesCount: 1,
              loggedAt: new Date().toISOString(),
              _offline: true,
            },
            ...prev,
          ]);
        },
      });
      // If online, reload to get server data
      loadWater();
    } catch { } finally { setLoading(false); }
  };

  const pct = Math.min(100, Math.round((glasses / goalGlasses) * 100));
  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  const getMsgColor = () => pct >= 100 ? "#10B981" : pct >= 60 ? "#F59E0B" : "#DC2626";
  const getMessage = () => {
    if (pct >= 100) return "🎉 Goal complete! Great job!";
    if (pct >= 75) return "💪 Almost there! Keep going!";
    if (pct >= 50) return "👍 Halfway done! Keep going!";
    if (pct >= 25) return "⚠️ Drink a bit more!";
    return "🚨 Very low water intake today!";
  };

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <LinearGradient colors={isDark ? ["#010814","#041428","#020C20"] : ["#E0F2FE","#BAE6FD","#F0FDF4"]} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={{ paddingTop: topPad + 12, paddingBottom: 100, paddingHorizontal: 16 }}>

        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,119,182,0.1)", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
            <Ionicons name="arrow-back" size={20} color={isDark ? "#FFF" : "#0077B6"} />
          </TouchableOpacity>
          <View>
            <Text style={{ color: isDark ? "#F0F8FF" : "#1a1a2e", fontFamily: "Inter_700Bold", fontSize: 22 }}>Water Tracker 💧</Text>
            <Text style={{ color: isDark ? "rgba(255,255,255,0.45)" : "rgba(10,22,40,0.5)", fontSize: 12, fontFamily: "Inter_400Regular" }}>Stay hydrated — daily goal: {goalGlasses * ML_PER_GLASS} ml</Text>
          </View>
        </View>

        {/* Progress Card */}
        <LinearGradient colors={["#0077B6","#1B998B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 22, padding: 24, marginBottom: 16, alignItems: "center" }}>
          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 8 }}>Today's Water</Text>
          <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 56 }}>{glasses}</Text>
          <Text style={{ color: "rgba(255,255,255,0.7)", fontFamily: "Inter_500Medium", fontSize: 16 }}>/ {goalGlasses} glasses ({goalGlasses * ML_PER_GLASS} ml goal)</Text>
          <View style={{ width: "100%", height: 10, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 5, marginTop: 16, overflow: "hidden" }}>
            <Animated.View style={{ height: "100%", width: progressWidth, backgroundColor: "#FFF", borderRadius: 5 }} />
          </View>
          <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 14, marginTop: 10 }}>{getMessage()}</Text>
        </LinearGradient>

        {/* Glass Icons Grid */}
        <LinearGradient colors={isDark ? ["rgba(56,189,248,0.18)","rgba(45,212,191,0.08)"] : ["rgba(255,255,255,0.9)","rgba(186,230,253,0.45)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 20, padding: 1.5, marginBottom: 16 }}>
          <View style={{ borderRadius: 19, overflow: "hidden", backgroundColor: isDark ? "rgba(4,20,40,0.5)" : "rgba(255,255,255,0.5)", padding: 20 }}>
            {Platform.OS === "ios" ? <BlurView intensity={60} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? "rgba(4,16,32,0.45)" : "rgba(255,255,255,0.45)" }]} />}
            <Text style={{ color: isDark ? "#F0F8FF" : "#1a1a2e", fontFamily: "Inter_600SemiBold", fontSize: 14, marginBottom: 16, textAlign: "center" }}>Progress: {pct}%</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12 }}>
              {Array.from({ length: goalGlasses }).map((_, i) => (
                <GlassIcon key={i} filled={i < glasses} partial={i === glasses && glasses < goalGlasses} />
              ))}
            </View>
          </View>
        </LinearGradient>

        {/* Drink Type Selector */}
        <LinearGradient colors={isDark ? ["rgba(56,189,248,0.18)","rgba(45,212,191,0.08)"] : ["rgba(255,255,255,0.9)","rgba(186,230,253,0.45)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 20, padding: 1.5, marginBottom: 16 }}>
          <View style={{ borderRadius: 19, overflow: "hidden", backgroundColor: isDark ? "rgba(4,20,40,0.5)" : "rgba(255,255,255,0.5)", padding: 18 }}>
            {Platform.OS === "ios" ? <BlurView intensity={60} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? "rgba(4,16,32,0.45)" : "rgba(255,255,255,0.45)" }]} />}
            <Text style={{ color: isDark ? "#F0F8FF" : "#1a1a2e", fontFamily: "Inter_600SemiBold", fontSize: 14, marginBottom: 12 }}>What did you drink?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {DRINK_TYPES.map(d => (
                  <TouchableOpacity key={d.key} onPress={() => setSelectedDrink(d.key)} style={{ alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 2, borderColor: selectedDrink === d.key ? d.color : "transparent", backgroundColor: selectedDrink === d.key ? d.color + "20" : (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,119,182,0.06)") }}>
                    <Text style={{ fontSize: 24, marginBottom: 4 }}>{d.emoji}</Text>
                    <Text style={{ color: selectedDrink === d.key ? d.color : (isDark ? "rgba(255,255,255,0.6)" : "rgba(10,22,40,0.6)"), fontFamily: "Inter_500Medium", fontSize: 11 }}>{d.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <TouchableOpacity onPress={addGlass} disabled={loading} style={{ marginTop: 16, backgroundColor: "#0077B6", borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Ionicons name="add-circle" size={22} color="#FFF" />
              <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 16 }}>{loading ? "Logging..." : "+ Log 1 Glass"}</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Today's Log */}
        {logs.length > 0 && (
          <LinearGradient colors={isDark ? ["rgba(56,189,248,0.18)","rgba(45,212,191,0.08)"] : ["rgba(255,255,255,0.9)","rgba(186,230,253,0.45)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 20, padding: 1.5 }}>
            <View style={{ borderRadius: 19, overflow: "hidden", backgroundColor: isDark ? "rgba(4,20,40,0.5)" : "rgba(255,255,255,0.5)", padding: 18 }}>
              {Platform.OS === "ios" ? <BlurView intensity={60} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? "rgba(4,16,32,0.45)" : "rgba(255,255,255,0.45)" }]} />}
              <Text style={{ color: isDark ? "#F0F8FF" : "#1a1a2e", fontFamily: "Inter_600SemiBold", fontSize: 14, marginBottom: 12 }}>Today's log</Text>
              <View style={{ gap: 8 }}>
                {logs.slice(0, 8).map((l, i) => {
                  const drinkKey = l.drink_type || l.drinkType || "water";
                  const dt = DRINK_TYPES.find(d => d.key === drinkKey) || DRINK_TYPES[0];
                  const glassCount = l.glasses_count ?? l.glassesCount ?? 1;
                  const rawTime = l.logged_at || l.loggedAt || "";
                  const t = rawTime ? new Date(rawTime) : new Date();
                  const validTime = !isNaN(t.getTime());
                  return (
                    <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: i < logs.length - 1 ? 1 : 0, borderBottomColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,119,182,0.08)" }}>
                      <Text style={{ fontSize: 22 }}>{dt.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: isDark ? "#F0F8FF" : "#1a1a2e", fontFamily: "Inter_500Medium", fontSize: 13 }}>{dt.label} — {glassCount} glass</Text>
                      </View>
                      {l._offline && (
                        <View style={{ backgroundColor: "#F59E0B20", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ color: "#F59E0B", fontSize: 10, fontFamily: "Inter_600SemiBold" }}>⏳ Syncing</Text>
                        </View>
                      )}
                      <Text style={{ color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.4)", fontSize: 11, fontFamily: "Inter_400Regular" }}>{validTime ? `${t.getHours()}:${String(t.getMinutes()).padStart(2, "0")}` : "--:--"}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </LinearGradient>
        )}
      </ScrollView>
    </View>
  );
}
