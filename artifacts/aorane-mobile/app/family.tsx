import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Platform, useColorScheme, Alert, Dimensions,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { api } from "@/lib/api";

const { width: W } = Dimensions.get("window");

type Member = { userId: string; name: string; healthScore: number; role: string; phone?: string };
type Group = { id: string; inviteCode: string; ownerId?: string };

function GlassCard({ children, style }: { children: React.ReactNode; style?: object }) {
  const isDark = useColorScheme() === "dark";
  return (
    <LinearGradient colors={isDark ? ["rgba(56,189,248,0.18)","rgba(45,212,191,0.08)","rgba(255,255,255,0.03)"] : ["rgba(255,255,255,0.9)","rgba(186,230,253,0.45)","rgba(255,255,255,0.7)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ borderRadius: 20, padding: 1.5 }, style]}>
      <View style={{ borderRadius: 19, overflow: "hidden", backgroundColor: useColorScheme() === "dark" ? "rgba(4,20,40,0.5)" : "rgba(255,255,255,0.5)" }}>
        {Platform.OS === "ios" ? <BlurView intensity={60} tint={useColorScheme() === "dark" ? "dark" : "light"} style={StyleSheet.absoluteFill} /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: useColorScheme() === "dark" ? "rgba(4,16,32,0.45)" : "rgba(255,255,255,0.45)" }]} />}
        {children}
      </View>
    </LinearGradient>
  );
}

const HEALTH_COLOR = (s: number) => s >= 75 ? "#10B981" : s >= 50 ? "#F59E0B" : "#DC2626";

export default function FamilyScreen() {
  const isDark = useColorScheme() === "dark";
  const insets = useSafeAreaInsets();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [creating, setCreating] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bg = isDark ? "#010814" : "#F0F9FF";

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.getFamilyGroup();
      setGroup(res.group as Group | null);
      setMembers((res.members || []) as Member[]);
      setIsOwner(res.isOwner);
    } catch { } finally { setLoading(false); }
  };

  const createGroup = async () => {
    setCreating(true);
    try {
      const res = await api.createFamilyGroup();
      Alert.alert("Family Group Created! 🎉", `Invite Code: ${res.inviteCode}\n\nShare this code with your family members!`);
      load();
    } catch (e: unknown) {
      Alert.alert("Error", (e as Error).message || "Failed");
    } finally { setCreating(false); }
  };

  const joinGroup = async () => {
    if (!joinCode.trim()) return;
    setJoining(true);
    try {
      await api.joinFamilyGroup(joinCode.trim().toUpperCase());
      Alert.alert("Joined! 🎉", "You have successfully joined the family group!");
      setJoinCode("");
      load();
    } catch (e: unknown) {
      Alert.alert("Error", (e as Error).message || "Invalid code");
    } finally { setJoining(false); }
  };

  const leaveGroup = () => Alert.alert("Leave Group?", "Are you sure you want to leave this group?", [
    { text: "Cancel", style: "cancel" },
    { text: "Leave", style: "destructive", onPress: async () => {
      try { await api.leaveFamilyGroup(); load(); } catch (e: unknown) { Alert.alert("Error", (e as Error).message || "Failed"); }
    }},
  ]);

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <LinearGradient colors={isDark ? ["#010814","#041428","#020C20"] : ["#E0F2FE","#BAE6FD","#F0FDF4"]} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={{ paddingTop: topPad + 12, paddingBottom: 100, paddingHorizontal: 16 }}>

        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,119,182,0.1)", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
            <Ionicons name="arrow-back" size={20} color={isDark ? "#FFF" : "#0077B6"} />
          </TouchableOpacity>
          <View>
            <Text style={{ color: isDark ? "#F0F8FF" : "#1a1a2e", fontFamily: "Inter_700Bold", fontSize: 22 }}>Family Health 👨‍👩‍👧‍👦</Text>
            <Text style={{ color: isDark ? "rgba(255,255,255,0.45)" : "rgba(10,22,40,0.5)", fontSize: 12, fontFamily: "Inter_400Regular" }}>Family health in one place</Text>
          </View>
        </View>

        {loading ? (
          <GlassCard><View style={{ padding: 30, alignItems: "center" }}><Text style={{ color: isDark ? "rgba(255,255,255,0.5)" : "rgba(10,22,40,0.5)", fontFamily: "Inter_400Regular" }}>Loading...</Text></View></GlassCard>
        ) : group ? (
          <>
            {/* Group Info */}
            <LinearGradient colors={["#0077B6","#1B998B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 20, padding: 20, marginBottom: 16 }}>
              <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 4 }}>Family Group</Text>
              <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 20, marginBottom: 12 }}>Our Family 🏠</Text>
              <View style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View>
                  <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontFamily: "Inter_500Medium" }}>Invite Code</Text>
                  <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 22, letterSpacing: 2 }}>{group.inviteCode}</Text>
                </View>
                <Ionicons name="copy-outline" size={22} color="rgba(255,255,255,0.7)" />
              </View>
              <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 8 }}>Share this code with your family members</Text>
            </LinearGradient>

            {/* Members */}
            <Text style={{ color: isDark ? "#F0F8FF" : "#1a1a2e", fontFamily: "Inter_700Bold", fontSize: 16, marginBottom: 12 }}>Members ({members.length})</Text>
            <View style={{ gap: 10, marginBottom: 16 }}>
              {members.map((m, i) => (
                <GlassCard key={i}>
                  <View style={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: "#0077B6" + "22", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#0077B6" }}>
                      <Text style={{ fontFamily: "Inter_700Bold", color: "#0077B6", fontSize: 16 }}>{(m.name || "U")[0]}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={{ color: isDark ? "#F0F8FF" : "#1a1a2e", fontFamily: "Inter_600SemiBold", fontSize: 15 }}>{m.name}</Text>
                        {m.role === "owner" && <View style={{ backgroundColor: "#F59E0B22", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ color: "#F59E0B", fontSize: 10, fontFamily: "Inter_600SemiBold" }}>Owner</Text></View>}
                      </View>
                      <Text style={{ color: isDark ? "rgba(255,255,255,0.45)" : "rgba(10,22,40,0.5)", fontSize: 12, fontFamily: "Inter_400Regular" }}>{m.phone || "Health member"}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ color: HEALTH_COLOR(m.healthScore), fontFamily: "Inter_700Bold", fontSize: 20 }}>{m.healthScore}</Text>
                      <Text style={{ color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.4)", fontSize: 10, fontFamily: "Inter_400Regular" }}>Health Score</Text>
                    </View>
                  </View>
                </GlassCard>
              ))}
            </View>

            <TouchableOpacity onPress={leaveGroup} style={{ backgroundColor: isDark ? "rgba(220,38,38,0.15)" : "#FEF2F2", borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: isDark ? "rgba(220,38,38,0.3)" : "#FECACA" }}>
              <Ionicons name="exit-outline" size={18} color="#DC2626" />
              <Text style={{ color: "#DC2626", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>Leave Group</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <GlassCard style={{ marginBottom: 16 }}>
              <View style={{ padding: 24, alignItems: "center" }}>
                <Text style={{ fontSize: 56, marginBottom: 12 }}>👨‍👩‍👧‍👦</Text>
                <Text style={{ color: isDark ? "#F0F8FF" : "#1a1a2e", fontFamily: "Inter_700Bold", fontSize: 18, marginBottom: 8, textAlign: "center" }}>Family Health Group</Text>
                <Text style={{ color: isDark ? "rgba(255,255,255,0.5)" : "rgba(10,22,40,0.5)", fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 }}>Track your family's health in one place. Everyone's health score, exercise, and goals on one screen!</Text>
              </View>
            </GlassCard>

            <TouchableOpacity onPress={createGroup} disabled={creating} style={{ backgroundColor: "#0077B6", borderRadius: 14, padding: 16, alignItems: "center", marginBottom: 12 }}>
              <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 16 }}>{creating ? "Creating..." : "Naya Group Banao"}</Text>
            </TouchableOpacity>

            <GlassCard>
              <View style={{ padding: 18 }}>
                <Text style={{ color: isDark ? "#F0F8FF" : "#1a1a2e", fontFamily: "Inter_600SemiBold", fontSize: 15, marginBottom: 12 }}>Join with Invite Code</Text>
                <TextInput
                  value={joinCode} onChangeText={setJoinCode}
                  placeholder="FAM123456 (enter code)" placeholderTextColor={isDark ? "rgba(255,255,255,0.35)" : "rgba(10,22,40,0.35)"}
                  style={{ backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,119,182,0.06)", borderRadius: 12, padding: 14, color: isDark ? "#FFF" : "#1a1a2e", fontFamily: "Inter_500Medium", fontSize: 16, borderWidth: 1, borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,119,182,0.15)", marginBottom: 12, letterSpacing: 1, textTransform: "uppercase" }}
                  autoCapitalize="characters" maxLength={9}
                />
                <TouchableOpacity onPress={joinGroup} disabled={joining || !joinCode.trim()} style={{ backgroundColor: "#1B998B", borderRadius: 12, padding: 14, alignItems: "center" }}>
                  <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 15 }}>{joining ? "Joining..." : "Join Group"}</Text>
                </TouchableOpacity>
              </View>
            </GlassCard>
          </>
        )}
      </ScrollView>
    </View>
  );
}
