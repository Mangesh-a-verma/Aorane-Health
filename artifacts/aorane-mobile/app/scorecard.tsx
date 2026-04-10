import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, useColorScheme, Alert, Dimensions,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { api } from "@/lib/api";

const { width: W } = Dimensions.get("window");

const PLAN_COLORS: Record<string, string> = {
  free: "#6B7280", pro: "#0077B6", max: "#8B5CF6", family: "#10B981",
};
const PLAN_LABELS: Record<string, string> = {
  free: "Free", pro: "Pro", max: "Max", family: "Family",
};

type Scorecard = {
  aoraneId: string; name: string; bloodGroup: string; bmi: string;
  bmiCategory: string; plan: string; gender: string; age: number | null; memberSince: string; qrData: string;
};

export default function ScorecardScreen() {
  const isDark = useColorScheme() === "dark";
  const insets = useSafeAreaInsets();
  const [card, setCard] = useState<Scorecard | null>(null);
  const [loading, setLoading] = useState(true);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bg = isDark ? "#010814" : "#F0F9FF";

  useEffect(() => { loadCard(); }, []);
  const loadCard = async () => {
    try { const d = await api.getScorecard(); setCard(d); } catch { } finally { setLoading(false); }
  };

  const getBmiColor = (cat: string) => ({ Normal: "#10B981", Underweight: "#F59E0B", Overweight: "#F97316", Obese: "#DC2626" }[cat] || "#6B7280");
  const getGenderEmoji = (g: string) => g === "male" ? "👨" : g === "female" ? "👩" : "🧑";

  const copyId = () => {
    if (card?.aoraneId) Alert.alert("Copied!", `AORANE ID: ${card.aoraneId}`);
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
            <Text style={{ color: isDark ? "#F0F8FF" : "#1a1a2e", fontFamily: "Inter_700Bold", fontSize: 22 }}>Health Scorecard</Text>
            <Text style={{ color: isDark ? "rgba(255,255,255,0.45)" : "rgba(10,22,40,0.5)", fontSize: 12, fontFamily: "Inter_400Regular" }}>Tera AORANE Health ID</Text>
          </View>
        </View>

        {loading ? (
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <Text style={{ color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.4)", fontFamily: "Inter_400Regular" }}>Loading...</Text>
          </View>
        ) : card ? (
          <>
            {/* ATM Card Style */}
            <LinearGradient
              colors={["#0077B6","#1B998B","#023E8A"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ borderRadius: 22, padding: 24, marginBottom: 16, minHeight: 200, position: "relative", overflow: "hidden" }}
            >
              <View style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(255,255,255,0.07)" }} />
              <View style={{ position: "absolute", bottom: -30, left: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(255,255,255,0.05)" }} />
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 20 }}>
                <View>
                  <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, fontFamily: "Inter_500Medium" }}>AORANE HEALTH CARD</Text>
                  <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 18, marginTop: 2 }}>{card.name}</Text>
                </View>
                <View style={{ backgroundColor: PLAN_COLORS[card.plan], borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, alignSelf: "flex-start" }}>
                  <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 11 }}>{PLAN_LABELS[card.plan]}</Text>
                </View>
              </View>
              <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontFamily: "Inter_400Regular", letterSpacing: 1, marginBottom: 8 }}>AORANE ID</Text>
              <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 22, letterSpacing: 2, marginBottom: 20 }}>{card.aoraneId}</Text>
              <View style={{ flexDirection: "row", gap: 24 }}>
                <View>
                  <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, fontFamily: "Inter_500Medium" }}>BLOOD GROUP</Text>
                  <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 16 }}>{card.bloodGroup}</Text>
                </View>
                <View>
                  <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, fontFamily: "Inter_500Medium" }}>BMI</Text>
                  <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 16 }}>{card.bmi}</Text>
                </View>
                <View>
                  <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, fontFamily: "Inter_500Medium" }}>AGE</Text>
                  <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 16 }}>{card.age || "N/A"}</Text>
                </View>
              </View>
            </LinearGradient>

            {/* QR Code Placeholder */}
            <LinearGradient
              colors={isDark ? ["rgba(56,189,248,0.18)","rgba(45,212,191,0.08)"] : ["rgba(255,255,255,0.9)","rgba(186,230,253,0.45)"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 20, padding: 1.5, marginBottom: 16 }}
            >
              <View style={{ borderRadius: 19, overflow: "hidden", backgroundColor: isDark ? "rgba(4,20,40,0.5)" : "rgba(255,255,255,0.5)", padding: 20, alignItems: "center" }}>
                {Platform.OS === "ios" ? <BlurView intensity={60} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? "rgba(4,16,32,0.45)" : "rgba(255,255,255,0.45)" }]} />}
                <Text style={{ color: isDark ? "#F0F8FF" : "#1a1a2e", fontFamily: "Inter_700Bold", fontSize: 15, marginBottom: 12 }}>QR Code — Share Karo</Text>
                <View style={{ width: 140, height: 140, backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,119,182,0.08)", borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,119,182,0.2)" }}>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", width: 80, height: 80, gap: 3 }}>
                    {Array.from({ length: 25 }).map((_, i) => {
                      const isBlack = [0,1,2,5,7,10,12,14,17,19,22,23,24,3,6,9,11,13,16,18,21].includes(i);
                      return <View key={i} style={{ width: 13, height: 13, backgroundColor: isBlack ? (isDark ? "#FFF" : "#000") : "transparent" }} />;
                    })}
                  </View>
                  <Text style={{ color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.4)", fontSize: 8, fontFamily: "Inter_400Regular", marginTop: 6, textAlign: "center" }}>{card.aoraneId}</Text>
                </View>
                <Text style={{ color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 10, textAlign: "center" }}>Koi bhi scan karke teri health summary dekh sakta hai</Text>
              </View>
            </LinearGradient>

            {/* Stats Grid */}
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
              {[
                { label: "BMI Category", value: card.bmiCategory, color: getBmiColor(card.bmiCategory), icon: "fitness" },
                { label: "Gender", value: getGenderEmoji(card.gender) + " " + (card.gender === "male" ? "Male" : card.gender === "female" ? "Female" : "Other"), color: "#0077B6", icon: "person" },
              ].map((stat, i) => (
                <LinearGradient key={i} colors={isDark ? ["rgba(56,189,248,0.14)","rgba(45,212,191,0.06)"] : ["rgba(255,255,255,0.85)","rgba(186,230,253,0.4)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, borderRadius: 16, padding: 1.5 }}>
                  <View style={{ borderRadius: 15, overflow: "hidden", backgroundColor: isDark ? "rgba(4,20,40,0.5)" : "rgba(255,255,255,0.5)", padding: 16, alignItems: "center" }}>
                    {Platform.OS === "ios" ? <BlurView intensity={50} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? "rgba(4,16,32,0.45)" : "rgba(255,255,255,0.45)" }]} />}
                    <Text style={{ color: isDark ? "rgba(255,255,255,0.45)" : "rgba(10,22,40,0.5)", fontSize: 11, fontFamily: "Inter_500Medium", marginBottom: 6 }}>{stat.label}</Text>
                    <Text style={{ color: stat.color, fontFamily: "Inter_700Bold", fontSize: 15, textAlign: "center" }}>{stat.value}</Text>
                  </View>
                </LinearGradient>
              ))}
            </View>

            <View style={{ gap: 10 }}>
              <TouchableOpacity onPress={copyId} style={{ backgroundColor: "#0077B6", borderRadius: 14, padding: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Ionicons name="copy-outline" size={18} color="#FFF" />
                <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 15 }}>AORANE ID Copy Karo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,119,182,0.08)", borderRadius: 14, padding: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Ionicons name="share-outline" size={18} color={isDark ? "#38BDF8" : "#0077B6"} />
                <Text style={{ color: isDark ? "#38BDF8" : "#0077B6", fontFamily: "Inter_600SemiBold", fontSize: 15 }}>Health Card Share Karo</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <LinearGradient colors={isDark ? ["rgba(56,189,248,0.18)","rgba(45,212,191,0.08)"] : ["rgba(255,255,255,0.9)","rgba(186,230,253,0.45)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 20, padding: 1.5 }}>
            <View style={{ borderRadius: 19, overflow: "hidden", backgroundColor: isDark ? "rgba(4,20,40,0.5)" : "rgba(255,255,255,0.5)", padding: 30, alignItems: "center" }}>
              {Platform.OS === "ios" ? <BlurView intensity={60} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? "rgba(4,16,32,0.45)" : "rgba(255,255,255,0.45)" }]} />}
              <Text style={{ fontSize: 48 }}>🪪</Text>
              <Text style={{ color: isDark ? "#F0F8FF" : "#1a1a2e", fontFamily: "Inter_700Bold", fontSize: 18, marginTop: 14 }}>Pehle Profile Complete Karo</Text>
              <Text style={{ color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 8 }}>Profile mein naam, blood group, aur health details daalo</Text>
            </View>
          </LinearGradient>
        )}
      </ScrollView>
    </View>
  );
}
