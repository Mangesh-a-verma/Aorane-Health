import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Switch, Alert, Platform, Image, useColorScheme, Dimensions,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";

const { width: W } = Dimensions.get("window");

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

export default function ProfileScreen() {
  const scheme = useColorScheme(); const isDark = scheme === "dark";
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<Record<string, unknown>>({});
  const [privacy, setPrivacy] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<ScrollView>(null);

  const loadProfile = useCallback(async () => {
    try {
      const [p, priv] = await Promise.allSettled([api.getProfile(), api.getPrivacy()]);
      if (p.status === "fulfilled") setProfile(p.value.profile as Record<string, unknown>);
      if (priv.status === "fulfilled") setPrivacy(priv.value.privacy as Record<string, boolean>);
    } catch { }
  }, []);

  useEffect(() => { loadProfile(); }, []);

  // Scroll to top when Profile tab is re-focused
  useFocusEffect(
    useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, [])
  );

  const togglePrivacy = async (key: string, value: boolean) => {
    setPrivacy((p) => ({ ...p, [key]: value }));
    try { await api.updatePrivacy({ [key]: value }); } catch { }
  };

  const handleLogout = () => Alert.alert("Logout", "Are you sure you want to log out?", [
    { text: "Cancel", style: "cancel" },
    { text: "Logout", style: "destructive", onPress: () => logout() },
  ]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bmi = profile.heightCm && profile.weightKg
    ? (Number(profile.weightKg) / Math.pow(Number(profile.heightCm) / 100, 2)).toFixed(1) : null;
  const phone = (user as Record<string, unknown>)?.phone as string;
  const name = (profile.fullName as string) || "AORANE User";
  const plan = ((user as Record<string, unknown>)?.plan as string || "free").toUpperCase();
  const initials = name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  const privacyItems = [
    { key: "shareBasicProfile", label: "Basic Profile", desc: "Naam aur photo", icon: "person-outline" as const, sensitive: false },
    { key: "shareBmi", label: "BMI & Weight", desc: "Physical data", icon: "barbell-outline" as const, sensitive: false },
    { key: "shareExerciseData", label: "Exercise", desc: "Activity logs", icon: "bicycle-outline" as const, sensitive: false },
    { key: "shareFoodData", label: "Food Data", desc: "Diet logs", icon: "restaurant-outline" as const, sensitive: false },
    { key: "shareSleepData", label: "Sleep Data", desc: "Sensitive — default OFF", icon: "moon-outline" as const, sensitive: true },
    { key: "shareStressLevel", label: "Stress Level", desc: "Sensitive — default OFF", icon: "pulse-outline" as const, sensitive: true },
    { key: "shareMedicineDetails", label: "Medicine Details", desc: "Sensitive — default OFF", icon: "medical-outline" as const, sensitive: true },
  ];

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={isDark ? ["#010814","#031628","#051E30","#061A2A"] : ["#C8E9FA","#D9F4EE","#E8F4FF","#D4F0F7"]}
        locations={[0,0.3,0.65,1]} style={StyleSheet.absoluteFill}
      />
      <View style={[styles.orb1, { backgroundColor: isDark ? "#0C4A6E" : "#BAE6FD" }]} />
      <View style={[styles.orb2, { backgroundColor: isDark ? "#4C1D95" : "#DDD6FE" }]} />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingTop: topPad + 8, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar Hero */}
        <View style={styles.heroSection}>
          <LinearGradient colors={["rgba(56,189,248,0.25)","rgba(45,212,191,0.15)"]} style={styles.avatarGlow} />
          <LinearGradient colors={["#0077B6","#1B998B","#7C3AED"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
            <Text style={[styles.avatarText, { fontFamily: "Inter_700Bold" }]}>{initials}</Text>
          </LinearGradient>
          <Text style={[styles.heroName, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>{name}</Text>
          {phone ? <Text style={[styles.heroPhone, { color: isDark ? "rgba(255,255,255,0.45)" : "rgba(10,22,40,0.5)", fontFamily: "Inter_400Regular" }]}>+91 {phone}</Text> : null}
          <LinearGradient colors={["#7C3AED","#0077B6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.planBadge}>
            <Ionicons name="diamond-outline" size={12} color="#FFF" />
            <Text style={[styles.planText, { fontFamily: "Inter_600SemiBold" }]}>{plan} Plan</Text>
          </LinearGradient>
        </View>

        {/* Body Stats */}
        {bmi && (
          <View style={styles.statsRow}>
            {[
              { label: "Height", value: `${profile.heightCm}`, unit: "cm", color: "#38BDF8" },
              { label: "Weight", value: `${profile.weightKg}`, unit: "kg", color: "#FCD34D" },
              { label: "BMI", value: bmi, unit: "", color: "#2DD4BF" },
              { label: "Blood", value: (profile.bloodGroup as string) || "--", unit: "", color: "#F87171" },
            ].map((s) => (
              <GlassCard key={s.label} style={{ flex: 1 }}>
                <View style={styles.statBox}>
                  <Text style={[styles.statNum, { color: s.color, fontFamily: "Inter_700Bold" }]}>{s.value}</Text>
                  {s.unit ? <Text style={[styles.statUnit, { color: isDark ? "rgba(255,255,255,0.3)" : "rgba(10,22,40,0.35)", fontFamily: "Inter_400Regular" }]}>{s.unit}</Text> : null}
                  <Text style={[styles.statLabel, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular" }]}>{s.label}</Text>
                </View>
              </GlassCard>
            ))}
          </View>
        )}

        {/* Medical Emergency Quick Access */}
        <TouchableOpacity onPress={() => router.push("/medical-emergency" as never)} activeOpacity={0.85}>
          <LinearGradient
            colors={["#DC2626", "#991B1B"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ borderRadius: 18, padding: 1.5, marginBottom: 14 }}
          >
            <View style={{ borderRadius: 17, padding: 16, backgroundColor: isDark ? "rgba(8,0,0,0.5)" : "rgba(255,245,245,0.9)", flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View style={{ width: 50, height: 50, borderRadius: 14, backgroundColor: "rgba(220,38,38,0.15)", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 26 }}>🚑</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: isDark ? "#FCA5A5" : "#DC2626", fontFamily: "Inter_700Bold", fontSize: 16 }}>Medical Emergency</Text>
                <Text style={{ color: isDark ? "rgba(255,255,255,0.45)" : "rgba(10,22,40,0.5)", fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>Blood Emergency (Live) · Accident Emergency (Coming Soon)</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={isDark ? "#F87171" : "#DC2626"} />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Work & Lifestyle Section */}
        <GlassCard style={[styles.section, { marginBottom: 14 }]}>
          <View style={styles.sectionHeaderRow}>
            <LinearGradient colors={["#F59E0B","#EF4444"]} style={styles.sectionIconBg}>
              <Ionicons name="briefcase-outline" size={16} color="#FFF" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>Work & Lifestyle</Text>
              <Text style={[styles.sectionSub, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular" }]}>
                Calorie aur health calculation ke liye
              </Text>
            </View>
            <TouchableOpacity onPress={() => router.push("/edit-work-profile" as never)} style={{ backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,119,182,0.08)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
              <Text style={{ color: isDark ? "#38BDF8" : "#0077B6", fontFamily: "Inter_600SemiBold", fontSize: 12 }}>Edit</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: "row", gap: 10, paddingVertical: 10, flexWrap: "wrap" }}>
            {profile.workProfile ? (
              <View style={{ backgroundColor: isDark ? "rgba(245,158,11,0.15)" : "rgba(245,158,11,0.1)", borderRadius: 10, borderWidth: 1, borderColor: isDark ? "rgba(245,158,11,0.3)" : "rgba(245,158,11,0.25)", paddingHorizontal: 12, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="briefcase-outline" size={14} color="#F59E0B" />
                <Text style={{ color: isDark ? "#FDE68A" : "#92400E", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>{profile.workProfile as string}</Text>
              </View>
            ) : (
              <TouchableOpacity onPress={() => router.push("/edit-work-profile" as never)} style={{ backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,119,182,0.06)", borderRadius: 10, borderWidth: 1, borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,119,182,0.15)", paddingHorizontal: 12, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="add-circle-outline" size={14} color={isDark ? "rgba(255,255,255,0.4)" : "#0077B6"} />
                <Text style={{ color: isDark ? "rgba(255,255,255,0.4)" : "#0077B6", fontFamily: "Inter_500Medium", fontSize: 13 }}>Add Work Profile</Text>
              </TouchableOpacity>
            )}
            {profile.activityLevel ? (
              <View style={{ backgroundColor: isDark ? "rgba(16,185,129,0.15)" : "rgba(16,185,129,0.1)", borderRadius: 10, borderWidth: 1, borderColor: isDark ? "rgba(16,185,129,0.3)" : "rgba(16,185,129,0.25)", paddingHorizontal: 12, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="fitness-outline" size={14} color="#10B981" />
                <Text style={{ color: isDark ? "#6EE7B7" : "#065F46", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                  {({ sedentary: "Sedentary", light: "Light Active", moderate: "Moderate", very: "Very Active", athlete: "Athlete" } as Record<string, string>)[profile.activityLevel as string] || profile.activityLevel as string}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={{ color: isDark ? "rgba(255,255,255,0.35)" : "rgba(10,22,40,0.4)", fontFamily: "Inter_400Regular", fontSize: 11, lineHeight: 16 }}>
            💡 Work profile helps AI calculate your exact calorie needs — Field workers need more, office jobs need less
          </Text>
        </GlassCard>

        {/* Health Tools Section */}
        <GlassCard style={[styles.section, { marginBottom: 14 }]}>
          <View style={styles.sectionHeaderRow}>
            <LinearGradient colors={["#1B998B","#10B981"]} style={styles.sectionIconBg}>
              <Ionicons name="heart-outline" size={16} color="#FFF" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>Health Tools</Text>
              <Text style={[styles.sectionSub, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular" }]}>Saare health features ek jagah</Text>
            </View>
          </View>
          {[
            { emoji: "🪪", label: "Health Scorecard (AORANE ID)", desc: "ATM card style health ID + QR code", route: "/scorecard", grad: ["#0077B6","#023E8A"] as [string,string] },
            { emoji: "⌚", label: "Smart Watch & Wearables", desc: "Google Fit, Smart Band, steps, heart rate, SpO2", route: "/wearable", grad: ["#34A853","#1A73E8"] as [string,string] },
            { emoji: "💧", label: "Water Tracker", desc: "Track 8 glasses of water daily", route: "/water", grad: ["#0EA5E9","#0077B6"] as [string,string] },
            { emoji: "🧘", label: "Stress Tracker", desc: "Mood + 5-Pillar analysis + 4-7-8 Breathing", route: "/stress", grad: ["#8B5CF6","#6D28D9"] as [string,string] },
            { emoji: "👨‍👩‍👧‍👦", label: "Family Health", desc: "Manage whole family health together", route: "/family", grad: ["#10B981","#059669"] as [string,string] },
            { emoji: "🌸", label: "Period Tracker", desc: "Cycle log + AI prediction + symptoms", route: "/period", grad: ["#EC4899","#9333EA"] as [string,string] },
          ].map((item, idx) => (
            <TouchableOpacity key={item.label} onPress={() => router.push(item.route as never)}
              style={[styles.menuItem, { borderTopColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)", borderTopWidth: idx > 0 ? 1 : 0 }]}>
              <LinearGradient colors={item.grad} style={styles.menuIconBg}>
                <Text style={{ fontSize: 16 }}>{item.emoji}</Text>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={[styles.menuLabel, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_600SemiBold" }]}>{item.label}</Text>
                <Text style={{ color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontSize: 11, fontFamily: "Inter_400Regular" }}>{item.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={isDark ? "rgba(255,255,255,0.25)" : "rgba(10,22,40,0.3)"} />
            </TouchableOpacity>
          ))}
        </GlassCard>

        {/* Privacy Section */}
        <GlassCard style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <LinearGradient colors={["#0077B6","#1B998B"]} style={styles.sectionIconBg}>
              <Ionicons name="shield-checkmark-outline" size={16} color="#FFF" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>Privacy Settings</Text>
              <Text style={[styles.sectionSub, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular" }]}>
                You decide what to share
              </Text>
            </View>
          </View>
          {privacyItems.map((item, idx) => (
            <View key={item.key} style={[styles.privacyRow, { borderTopColor: idx > 0 ? (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)") : "transparent", borderTopWidth: idx > 0 ? 1 : 0 }]}>
              <View style={[styles.privacyIconBg, { backgroundColor: item.sensitive ? (isDark ? "rgba(248,113,113,0.15)" : "rgba(239,68,68,0.1)") : (isDark ? "rgba(56,189,248,0.12)" : "rgba(0,119,182,0.1)") }]}>
                <Ionicons name={item.sensitive ? "lock-closed" : item.icon} size={14} color={item.sensitive ? (isDark ? "#F87171" : "#EF4444") : (isDark ? "#38BDF8" : "#0077B6")} />
              </View>
              <View style={styles.privacyLeft}>
                <Text style={[styles.privacyLabel, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_500Medium" }]}>{item.label}</Text>
                <Text style={[styles.privacyDesc, { color: isDark ? "rgba(255,255,255,0.35)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular" }]}>{item.desc}</Text>
              </View>
              <Switch
                value={!!privacy[item.key]}
                onValueChange={(v) => togglePrivacy(item.key, v)}
                trackColor={{ false: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)", true: isDark ? "rgba(56,189,248,0.5)" : "rgba(0,119,182,0.45)" }}
                thumbColor={privacy[item.key] ? (isDark ? "#38BDF8" : "#0077B6") : (isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.3)")}
              />
            </View>
          ))}
        </GlassCard>

        {/* Account */}
        <GlassCard style={[styles.section, { marginTop: 14 }]}>
          <View style={styles.sectionHeaderRow}>
            <LinearGradient colors={["#7C3AED","#0077B6"]} style={styles.sectionIconBg}>
              <Ionicons name="person-outline" size={16} color="#FFF" />
            </LinearGradient>
            <Text style={[styles.sectionTitle, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>Account</Text>
          </View>
          {[
            { icon: "diamond-outline" as const, label: "Upgrade Plan", color: "#7C3AED", grad: ["#7C3AED","#0077B6"] as [string,string], onPress: () => router.push("/upgrade" as never) },
            { icon: "notifications-outline" as const, label: "Notifications & Reminders", color: "#0077B6", grad: ["#0077B6","#1B998B"] as [string,string], onPress: () => router.push("/notification-settings" as never) },
            { icon: "help-circle-outline" as const, label: "Help & Support", color: "#1B998B", grad: ["#1B998B","#059669"] as [string,string], onPress: () => Alert.alert("Coming Soon") },
          ].map((item, idx, arr) => (
            <TouchableOpacity key={item.label} onPress={item.onPress}
              style={[styles.menuItem, { borderTopColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)", borderTopWidth: idx > 0 ? 1 : 0 }]}>
              <LinearGradient colors={item.grad} style={styles.menuIconBg}>
                <Ionicons name={item.icon} size={16} color="#FFF" />
              </LinearGradient>
              <Text style={[styles.menuLabel, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_500Medium", flex: 1 }]}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={isDark ? "rgba(255,255,255,0.25)" : "rgba(10,22,40,0.3)"} />
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={handleLogout} style={[styles.menuItem, { borderTopColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)", borderTopWidth: 1 }]}>
            <View style={[styles.menuIconBg, { backgroundColor: "rgba(239,68,68,0.15)" }]}>
              <Ionicons name="log-out-outline" size={16} color="#EF4444" />
            </View>
            <Text style={[styles.menuLabel, { color: "#EF4444", fontFamily: "Inter_500Medium", flex: 1 }]}>Logout</Text>
            <Ionicons name="chevron-forward" size={16} color={isDark ? "rgba(255,255,255,0.25)" : "rgba(10,22,40,0.3)"} />
          </TouchableOpacity>
        </GlassCard>

        {/* Footer */}
        <View style={styles.footer}>
          <Image source={require("../../assets/images/aorane-logo.png")} style={styles.footerLogo} resizeMode="contain" />
          <Text style={[styles.version, { color: isDark ? "rgba(255,255,255,0.18)" : "rgba(10,22,40,0.3)", fontFamily: "Inter_400Regular" }]}>AORANE v1.0.0</Text>
          <Text style={[styles.tagline, { color: isDark ? "rgba(255,255,255,0.12)" : "rgba(10,22,40,0.22)", fontFamily: "Inter_400Regular" }]}>Privacy-First Health Platform</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  orb1: { position: "absolute", width: 320, height: 320, borderRadius: 160, top: -120, right: -90, opacity: 0.4 },
  orb2: { position: "absolute", width: 250, height: 250, borderRadius: 125, bottom: 150, left: -70, opacity: 0.35 },
  heroSection: { alignItems: "center", paddingVertical: 28, paddingHorizontal: 18 },
  avatarGlow: { position: "absolute", width: 130, height: 130, borderRadius: 65, top: 22, opacity: 0.7 },
  avatar: { width: 90, height: 90, borderRadius: 45, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  avatarText: { fontSize: 32, color: "#FFF" },
  heroName: { fontSize: 22, marginBottom: 6 },
  heroPhone: { fontSize: 14, marginBottom: 12 },
  planBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  planText: { color: "#FFF", fontSize: 12 },
  statsRow: { flexDirection: "row", gap: 10, paddingHorizontal: 18, marginBottom: 16 },
  statBox: { alignItems: "center", padding: 14 },
  statNum: { fontSize: 18 },
  statUnit: { fontSize: 11, marginTop: -2 },
  statLabel: { fontSize: 11, marginTop: 4 },
  section: { marginHorizontal: 18, padding: 18 },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  sectionIconBg: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 16 },
  sectionSub: { fontSize: 12, marginTop: 2 },
  privacyRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, gap: 10 },
  privacyIconBg: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  privacyLeft: { flex: 1 },
  privacyLabel: { fontSize: 14, marginBottom: 2 },
  privacyDesc: { fontSize: 11 },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13 },
  menuIconBg: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  menuLabel: { fontSize: 15 },
  footer: { alignItems: "center", marginTop: 28, gap: 5 },
  footerLogo: { width: 110, height: 38, opacity: 0.35 },
  version: { fontSize: 12 },
  tagline: { fontSize: 11 },
});
