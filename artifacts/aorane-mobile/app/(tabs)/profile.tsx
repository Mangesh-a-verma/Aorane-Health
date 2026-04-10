import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Switch, Alert, Platform, Image, useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { GlassCard } from "@/components/GlassCard";
import { GradientBackground } from "@/components/GradientBackground";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";

export default function ProfileScreen() {
  const colors = useColors();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const [profile, setProfile] = useState<Record<string, unknown>>({});
  const [privacy, setPrivacy] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      try {
        const [p, priv] = await Promise.allSettled([api.getProfile(), api.getPrivacy()]);
        if (p.status === "fulfilled") setProfile(p.value.profile as Record<string, unknown>);
        if (priv.status === "fulfilled") setPrivacy(priv.value.privacy as Record<string, boolean>);
      } catch { }
    })();
  }, []);

  const togglePrivacy = async (key: string, value: boolean) => {
    setPrivacy((p) => ({ ...p, [key]: value }));
    try { await api.updatePrivacy({ [key]: value }); } catch { }
  };

  const handleLogout = () => Alert.alert("Logout", "Kya aap sure hain?", [
    { text: "Cancel", style: "cancel" },
    { text: "Logout", style: "destructive", onPress: () => logout() },
  ]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bmi = profile.heightCm && profile.weightKg
    ? (Number(profile.weightKg) / Math.pow(Number(profile.heightCm) / 100, 2)).toFixed(1) : null;
  const phone = (user as Record<string, unknown>)?.phone as string;
  const name = (profile.fullName as string) || "AORANE User";
  const plan = ((user as Record<string, unknown>)?.plan as string || "free").toUpperCase();

  return (
    <GradientBackground>
      <ScrollView
        contentContainerStyle={{ paddingTop: topPad + 8, paddingBottom: insets.bottom + 90 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar Hero */}
        <GlassCard style={styles.avatarCard}>
          <LinearGradient colors={["#0077B6", "#1B998B"]} style={styles.avatar}>
            <Text style={[styles.avatarText, { fontFamily: "Inter_700Bold" }]}>
              {name[0].toUpperCase()}
            </Text>
          </LinearGradient>
          <View style={styles.avatarInfo}>
            <Text style={[styles.userName, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>{name}</Text>
            {phone ? <Text style={[styles.userPhone, { color: isDark ? "rgba(255,255,255,0.5)" : "rgba(10,22,40,0.5)", fontFamily: "Inter_400Regular" }]}>+91 {phone}</Text> : null}
            <View style={[styles.planBadge, { backgroundColor: isDark ? "rgba(56,189,248,0.15)" : "rgba(0,119,182,0.1)" }]}>
              <Ionicons name="diamond-outline" size={12} color={isDark ? "#38BDF8" : "#0077B6"} />
              <Text style={[styles.planText, { color: isDark ? "#38BDF8" : "#0077B6", fontFamily: "Inter_600SemiBold" }]}>{plan} Plan</Text>
            </View>
          </View>
        </GlassCard>

        {/* Body Stats */}
        {bmi && (
          <View style={styles.statsRow}>
            {[
              { label: "Height", value: `${profile.heightCm}cm`, color: isDark ? "#38BDF8" : "#0077B6" },
              { label: "Weight", value: `${profile.weightKg}kg`, color: isDark ? "#FCD34D" : "#D97706" },
              { label: "BMI", value: bmi, color: isDark ? "#2DD4BF" : "#1B998B" },
              { label: "Blood", value: (profile.bloodGroup as string) || "--", color: isDark ? "#F87171" : "#EF4444" },
            ].map((s) => (
              <GlassCard key={s.label} style={styles.statBox}>
                <Text style={[styles.statNum, { color: s.color, fontFamily: "Inter_700Bold" }]}>{s.value}</Text>
                <Text style={[styles.statLabel, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular" }]}>{s.label}</Text>
              </GlassCard>
            ))}
          </View>
        )}

        {/* Privacy */}
        <GlassCard style={styles.section}>
          <Text style={[styles.sectionTitle, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>Privacy Settings</Text>
          <Text style={[styles.sectionSub, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular" }]}>
            Aap decide karein kya share karna hai
          </Text>
          {[
            { key: "shareBasicProfile", label: "Basic Profile", desc: "Naam aur photo", sensitive: false },
            { key: "shareBmi", label: "BMI & Weight", desc: "Physical data", sensitive: false },
            { key: "shareExerciseData", label: "Exercise", desc: "Activity logs", sensitive: false },
            { key: "shareFoodData", label: "Food Data", desc: "Diet logs", sensitive: false },
            { key: "shareSleepData", label: "Sleep Data", desc: "Sensitive — default OFF", sensitive: true },
            { key: "shareStressLevel", label: "Stress Level", desc: "Sensitive — default OFF", sensitive: true },
            { key: "shareMedicineDetails", label: "Medicine Details", desc: "Sensitive — default OFF", sensitive: true },
          ].map((item) => (
            <View key={item.key} style={[styles.privacyRow, { borderBottomColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)" }]}>
              <View style={styles.privacyLeft}>
                {item.sensitive && <Ionicons name="lock-closed" size={12} color={isDark ? "rgba(248,113,113,0.7)" : "#EF4444"} style={{ marginBottom: 2 }} />}
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
          <Text style={[styles.sectionTitle, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>Account</Text>
          <TouchableOpacity onPress={() => Alert.alert("Coming Soon", "Plan upgrade coming soon")} style={[styles.menuItem, { borderBottomColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)" }]}>
            <View style={styles.menuLeft}>
              <LinearGradient colors={["#7C3AED", "#0077B6"]} style={styles.menuIconBg}>
                <Ionicons name="diamond-outline" size={16} color="#FFF" />
              </LinearGradient>
              <Text style={[styles.menuLabel, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_500Medium" }]}>Upgrade to Pro</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={isDark ? "rgba(255,255,255,0.3)" : "rgba(10,22,40,0.35)"} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.menuItem}>
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconBg, { backgroundColor: "rgba(239,68,68,0.15)" }]}>
                <Ionicons name="log-out-outline" size={16} color="#EF4444" />
              </View>
              <Text style={[styles.menuLabel, { color: "#EF4444", fontFamily: "Inter_500Medium" }]}>Logout</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={isDark ? "rgba(255,255,255,0.3)" : "rgba(10,22,40,0.35)"} />
          </TouchableOpacity>
        </GlassCard>

        <View style={styles.logoFooter}>
          <Image source={require("../../assets/images/aorane-logo.png")} style={styles.footerLogo} resizeMode="contain" />
          <Text style={[styles.version, { color: isDark ? "rgba(255,255,255,0.2)" : "rgba(10,22,40,0.3)", fontFamily: "Inter_400Regular" }]}>v1.0.0</Text>
        </View>
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  avatarCard: { flexDirection: "row", alignItems: "center", gap: 16, margin: 18, padding: 18 },
  avatar: { width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 28, color: "#FFF" },
  avatarInfo: { flex: 1 },
  userName: { fontSize: 20, marginBottom: 4 },
  userPhone: { fontSize: 14, marginBottom: 8 },
  planBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: "flex-start" },
  planText: { fontSize: 12 },
  statsRow: { flexDirection: "row", gap: 10, paddingHorizontal: 18, marginBottom: 14 },
  statBox: { flex: 1, alignItems: "center", padding: 12 },
  statNum: { fontSize: 18 },
  statLabel: { fontSize: 11, marginTop: 4 },
  section: { marginHorizontal: 18, padding: 18 },
  sectionTitle: { fontSize: 18, marginBottom: 4 },
  sectionSub: { fontSize: 13, marginBottom: 16 },
  privacyRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1 },
  privacyLeft: { flex: 1 },
  privacyLabel: { fontSize: 15, marginBottom: 2 },
  privacyDesc: { fontSize: 12 },
  menuItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1 },
  menuLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  menuIconBg: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  menuLabel: { fontSize: 15 },
  logoFooter: { alignItems: "center", marginTop: 24, marginBottom: 8 },
  footerLogo: { width: 100, height: 36, opacity: 0.4 },
  version: { fontSize: 12, marginTop: 4 },
});
