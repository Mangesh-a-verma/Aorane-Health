import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Switch, Alert, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const [profile, setProfile] = useState<Record<string, unknown>>({});
  const [privacy, setPrivacy] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [profileRes, privacyRes] = await Promise.allSettled([
        api.getProfile(),
        api.getPrivacy(),
      ]);
      if (profileRes.status === "fulfilled") setProfile(profileRes.value.profile as Record<string, unknown>);
      if (privacyRes.status === "fulfilled") setPrivacy(privacyRes.value.privacy as Record<string, boolean>);
    } catch { }
    setIsLoading(false);
  };

  const togglePrivacy = async (key: string, value: boolean) => {
    const newPrivacy = { ...privacy, [key]: value };
    setPrivacy(newPrivacy);
    try {
      await api.updatePrivacy({ [key]: value });
    } catch { }
  };

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Kya aap sure hain?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Logout", style: "destructive", onPress: () => logout() },
      ]
    );
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const bmi = profile.heightCm && profile.weightKg
    ? (Number(profile.weightKg) / Math.pow(Number(profile.heightCm) / 100, 2)).toFixed(1)
    : null;

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topPad + 8, paddingBottom: insets.bottom + 90 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.pageTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Profile</Text>

      <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={[styles.avatarText, { fontFamily: "Inter_700Bold" }]}>
            {(profile.fullName as string || (user as unknown as { phone?: string })?.phone || "U")[0].toUpperCase()}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={[styles.profileName, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            {(profile.fullName as string) || "AORANE User"}
          </Text>
          <Text style={[styles.profilePhone, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {(user as unknown as { phone?: string })?.phone ? `+91 ${(user as unknown as { phone?: string }).phone}` : (user as unknown as { email?: string })?.email || ""}
          </Text>
          <View style={[styles.planBadge, { backgroundColor: colors.tealLight }]}>
            <Text style={[styles.planText, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
              {((user as unknown as { plan?: string })?.plan || "free").toUpperCase()} Plan
            </Text>
          </View>
        </View>
      </View>

      {bmi && (
        <View style={[styles.statsRow, { marginHorizontal: 20 }]}>
          <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statNum, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>{profile.heightCm ? `${profile.heightCm}cm` : "--"}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Height</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statNum, { color: colors.warning, fontFamily: "Inter_700Bold" }]}>{profile.weightKg ? `${profile.weightKg}kg` : "--"}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Weight</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statNum, { color: colors.success, fontFamily: "Inter_700Bold" }]}>{bmi}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>BMI</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statNum, { color: colors.destructive, fontFamily: "Inter_700Bold" }]}>{(profile.bloodGroup as string) || "--"}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Blood</Text>
          </View>
        </View>
      )}

      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Privacy Settings</Text>
        <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          Kya share karna hai aap decide karein
        </Text>

        {[
          { key: "shareBasicProfile", label: "Basic Profile", desc: "Naam aur photo" },
          { key: "shareBmi", label: "BMI & Weight", desc: "Physical data" },
          { key: "shareExerciseData", label: "Exercise Data", desc: "Activity logs" },
          { key: "shareWaterIntake", label: "Water Intake", desc: "Daily water" },
          { key: "shareFoodData", label: "Food Data", desc: "Diet logs" },
          { key: "shareSleepData", label: "Sleep Data", desc: "Sensitive - default OFF" },
          { key: "shareStressLevel", label: "Stress Level", desc: "Sensitive - default OFF" },
          { key: "shareMedicineDetails", label: "Medicine Details", desc: "Sensitive - default OFF" },
        ].map((item) => (
          <View key={item.key} style={[styles.privacyRow, { borderBottomColor: colors.border }]}>
            <View style={styles.privacyInfo}>
              <Text style={[styles.privacyLabel, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{item.label}</Text>
              <Text style={[styles.privacyDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{item.desc}</Text>
            </View>
            <Switch
              value={!!privacy[item.key]}
              onValueChange={(v) => togglePrivacy(item.key, v)}
              trackColor={{ false: colors.muted, true: `${colors.primary}80` }}
              thumbColor={privacy[item.key] ? colors.primary : colors.mutedForeground}
            />
          </View>
        ))}
      </View>

      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Account</Text>

        <TouchableOpacity
          onPress={() => Alert.alert("Coming Soon", "Plan upgrade coming soon")}
          style={[styles.menuItem, { borderBottomColor: colors.border }]}
        >
          <View style={styles.menuLeft}>
            <Ionicons name="diamond-outline" size={20} color={colors.accent} />
            <Text style={[styles.menuLabel, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>Upgrade to Pro</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleLogout}
          style={styles.menuItem}
        >
          <View style={styles.menuLeft}>
            <Ionicons name="log-out-outline" size={20} color={colors.destructive} />
            <Text style={[styles.menuLabel, { color: colors.destructive, fontFamily: "Inter_500Medium" }]}>Logout</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <Text style={[styles.version, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>AORANE v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  pageTitle: { fontSize: 24, paddingHorizontal: 20, marginBottom: 16 },
  profileCard: { flexDirection: "row", alignItems: "center", gap: 16, margin: 20, padding: 16, borderRadius: 20, borderWidth: 1 },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 28, color: "#FFF" },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 20, marginBottom: 4 },
  profilePhone: { fontSize: 14, marginBottom: 8 },
  planBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, alignSelf: "flex-start" },
  planText: { fontSize: 12 },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  statBox: { flex: 1, alignItems: "center", padding: 12, borderRadius: 14, borderWidth: 1, gap: 4 },
  statNum: { fontSize: 18 },
  statLabel: { fontSize: 11 },
  section: { margin: 20, borderRadius: 20, padding: 16, borderWidth: 1, marginBottom: 0 },
  sectionTitle: { fontSize: 18, marginBottom: 4 },
  sectionSubtitle: { fontSize: 13, marginBottom: 16 },
  privacyRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1 },
  privacyInfo: { flex: 1 },
  privacyLabel: { fontSize: 15, marginBottom: 2 },
  privacyDesc: { fontSize: 12 },
  menuItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1 },
  menuLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  menuLabel: { fontSize: 15 },
  version: { textAlign: "center", fontSize: 12, marginTop: 24, marginBottom: 8 },
});
