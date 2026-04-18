import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, ActivityIndicator, Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { api } from "@/lib/api";

const C = {
  bg: "#F0FAFB", card: "#FFFFFF", primary: "#0077B6", accent: "#00B896",
  text: "#0D1F33", muted: "#7A90A4", border: "#E2EFF5",
  yellow: "#F59E0B", green: "#10B981", red: "#EF4444", purple: "#7C3AED",
};

type WorkProfile = {
  value: string; label: string; icon: string;
  activityHint: string; description: string;
  calorieFactor: string; category: string;
};

const WORK_PROFILES: WorkProfile[] = [
  // Desk / Sedentary
  { value: "Office/Desk Job",    label: "Office / Desk Job",    icon: "💼", activityHint: "sedentary", description: "Computer work, mostly sitting",     calorieFactor: "1.2× BMR",  category: "💼 Desk / Sedentary" },
  { value: "IT/Software",        label: "IT / Software",        icon: "💻", activityHint: "sedentary", description: "Programming, system work",           calorieFactor: "1.2× BMR",  category: "💼 Desk / Sedentary" },
  { value: "Call Center/BPO",    label: "Call Center / BPO",    icon: "📞", activityHint: "sedentary", description: "Calling, customer service",           calorieFactor: "1.2× BMR",  category: "💼 Desk / Sedentary" },
  { value: "Freelancer/WFH",     label: "Freelancer / WFH",     icon: "🏡", activityHint: "sedentary", description: "Work from home, flexible hours",     calorieFactor: "1.2× BMR",  category: "💼 Desk / Sedentary" },
  // Light Active
  { value: "Teacher/Professor",  label: "Teacher / Professor",  icon: "📚", activityHint: "light",     description: "Teaching in class, light walking",   calorieFactor: "1.375× BMR", category: "🚶 Light Active" },
  { value: "Doctor/Healthcare",  label: "Doctor / Healthcare",  icon: "🏥", activityHint: "light",     description: "Hospital, clinic, patient care",      calorieFactor: "1.375× BMR", category: "🚶 Light Active" },
  { value: "Business Owner",     label: "Business Owner",       icon: "🏢", activityHint: "light",     description: "Managing shop or office",             calorieFactor: "1.375× BMR", category: "🚶 Light Active" },
  { value: "Housewife",          label: "Housewife",            icon: "🏠", activityHint: "light",     description: "Home duties, cooking, cleaning",      calorieFactor: "1.375× BMR", category: "🚶 Light Active" },
  { value: "House Husband",      label: "House Husband",        icon: "🏠", activityHint: "light",     description: "Managing home, childcare",            calorieFactor: "1.375× BMR", category: "🚶 Light Active" },
  { value: "Retired",            label: "Retired (Sewa Nivratt)", icon: "🌅", activityHint: "light",   description: "Retired, daily routine",              calorieFactor: "1.375× BMR", category: "🚶 Light Active" },
  { value: "Artist/Creative",    label: "Artist / Creative",    icon: "🎨", activityHint: "light",     description: "Design, music, writing",              calorieFactor: "1.375× BMR", category: "🚶 Light Active" },
  { value: "Student (School)",   label: "Student (School)",     icon: "🎒", activityHint: "light",     description: "School student, daily classes",       calorieFactor: "1.375× BMR", category: "🚶 Light Active" },
  // Moderate Active
  { value: "Field/Sales",        label: "Field / Sales",        icon: "🚗", activityHint: "moderate",  description: "Travel for work, meeting clients",    calorieFactor: "1.55× BMR",  category: "🏃 Moderate Active" },
  { value: "Driver/Delivery",    label: "Driver / Delivery",    icon: "🚚", activityHint: "moderate",  description: "Driving, making deliveries",          calorieFactor: "1.55× BMR",  category: "🏃 Moderate Active" },
  { value: "Factory Worker",     label: "Factory Worker",       icon: "🔧", activityHint: "moderate",  description: "Machine work, factory floor",          calorieFactor: "1.55× BMR",  category: "🏃 Moderate Active" },
  { value: "ASHA/ANM Worker",    label: "ASHA / ANM Worker",    icon: "👩‍⚕️", activityHint: "moderate", description: "Village health worker, home visits",  calorieFactor: "1.55× BMR",  category: "🏃 Moderate Active" },
  { value: "Student (College)",  label: "Student (College)",    icon: "🎓", activityHint: "moderate",  description: "College, campus activities",          calorieFactor: "1.55× BMR",  category: "🏃 Moderate Active" },
  // Very Active
  { value: "Police/CRPF",        label: "Police / CRPF",        icon: "👮", activityHint: "very",      description: "Patrol, training, duty",              calorieFactor: "1.725× BMR", category: "⚡ Very Active" },
  { value: "Army/Defence",       label: "Army / Defence",       icon: "🪖", activityHint: "very",      description: "Physical training, field duty",       calorieFactor: "1.725× BMR", category: "⚡ Very Active" },
  { value: "Farmer/Agriculture", label: "Farmer / Agriculture", icon: "🌾", activityHint: "very",      description: "Field work, heavy physical labor",    calorieFactor: "1.725× BMR", category: "⚡ Very Active" },
  { value: "Construction Worker",label: "Construction Worker",  icon: "🏗️", activityHint: "very",      description: "Building, heavy manual work",         calorieFactor: "1.725× BMR", category: "⚡ Very Active" },
  { value: "Athlete/Sports",     label: "Athlete / Sports",     icon: "🏃", activityHint: "athlete",   description: "Professional sports, twice daily",    calorieFactor: "1.9× BMR",   category: "🏆 Athlete" },
  { value: "Other",              label: "Other",                icon: "✨", activityHint: "moderate",  description: "Any other type of work",             calorieFactor: "1.55× BMR",  category: "✨ Other" },
];

const ACTIVITY_LEVELS = [
  { value: "sedentary", label: "Sedentary",    desc: "Mostly sitting, no exercise",   icon: "🛋️", color: C.red,    multiplier: "1.2×" },
  { value: "light",     label: "Light Active", desc: "Light activity 1–3 days/week",  icon: "🚶", color: C.yellow, multiplier: "1.375×" },
  { value: "moderate",  label: "Moderate",     desc: "Exercise 3–5 days/week",        icon: "🏃", color: C.green,  multiplier: "1.55×" },
  { value: "very",      label: "Very Active",  desc: "Hard exercise 6–7 days/week",   icon: "⚡", color: C.primary, multiplier: "1.725×" },
  { value: "athlete",   label: "Athlete",      desc: "Twice daily intense training",  icon: "🏆", color: C.purple, multiplier: "1.9×" },
];

const CATEGORY_ORDER = ["💼 Desk / Sedentary", "🚶 Light Active", "🏃 Moderate Active", "⚡ Very Active", "🏆 Athlete", "✨ Other"];

export default function EditWorkProfileScreen() {
  const insets = useSafeAreaInsets();
  const topPad = insets.top;
  const [workProfile, setWorkProfile] = useState("");
  const [activityLevel, setActivityLevel] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getProfile();
        const p = res.profile as Record<string, unknown>;
        setWorkProfile(((p.work_profile ?? p.workProfile) as string) || "");
        setActivityLevel(((p.activity_level ?? p.activityLevel) as string) || "");
      } catch { }
      setLoading(false);
    })();
  }, []);

  const handleSelectWork = (wp: WorkProfile) => {
    Haptics.selectionAsync();
    setWorkProfile(wp.value);
    // Auto-suggest activity level if not yet set or if user wants the hint
    if (!activityLevel) {
      setActivityLevel(wp.activityHint);
    }
  };

  const handleSave = async () => {
    if (!workProfile) {
      Alert.alert("Required", "Please select your work profile");
      return;
    }
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await api.updateProfile({ workProfile, activityLevel });
      // Clear cached suggestions so new ones reflect work profile
      await api.refreshSuggestions().catch(() => {});
      Alert.alert(
        "Saved! ✅",
        "Work profile saved! AI Coach will now give suggestions based on your work type.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch {
      Alert.alert("Error", "Could not save. Please try again.");
    }
    setSaving(false);
  };

  // Group by category
  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: WORK_PROFILES.filter((w) => w.category === cat),
  })).filter((g) => g.items.length > 0);

  const selectedWP = WORK_PROFILES.find((w) => w.value === workProfile);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <LinearGradient colors={["#F59E0B", "#EF4444"]} style={{ paddingTop: topPad + 10, paddingHorizontal: 18, paddingBottom: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#FFF", fontSize: 21, fontFamily: "Inter_700Bold" }}>💼 Work Profile</Text>
            <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontFamily: "Inter_400Regular" }}>
              Required for calorie calculation
            </Text>
          </View>
        </View>

        {/* Info Banner */}
        <View style={{ marginTop: 12, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 12, padding: 12 }}>
          <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 13, lineHeight: 19 }}>
            🎯 A field worker needs more calories than an office worker — 1.725× vs 1.2× BMR. Select the right profile for exact Aorane calculations!
          </Text>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 100, gap: 18 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Selected preview */}
        {selectedWP && (
          <View style={{ backgroundColor: "#FFF9EC", borderRadius: 14, borderWidth: 1.5, borderColor: "#FDE68A", padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Text style={{ fontSize: 30 }}>{selectedWP.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontFamily: "Inter_700Bold", fontSize: 15 }}>Selected: {selectedWP.label}</Text>
              <Text style={{ color: C.muted, fontFamily: "Inter_400Regular", fontSize: 12 }}>{selectedWP.description}</Text>
            </View>
            <View style={{ backgroundColor: "#F59E0B20", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
              <Text style={{ color: "#92400E", fontFamily: "Inter_700Bold", fontSize: 12 }}>{selectedWP.calorieFactor}</Text>
            </View>
          </View>
        )}

        {/* Work Profile Grid by Category */}
        {grouped.map((group) => (
          <View key={group.category} style={{ gap: 8 }}>
            <Text style={{ color: C.muted, fontFamily: "Inter_700Bold", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>{group.category}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {group.items.map((wp) => {
                const selected = workProfile === wp.value;
                return (
                  <TouchableOpacity
                    key={wp.value}
                    onPress={() => handleSelectWork(wp)}
                    activeOpacity={0.8}
                    style={{ width: "47%" }}
                  >
                    {selected ? (
                      <LinearGradient colors={["#F59E0B", "#EF4444"]} style={styles.wpCardActive}>
                        <Text style={{ fontSize: 22 }}>{wp.icon}</Text>
                        <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 13, marginTop: 4 }}>{wp.label}</Text>
                        <Text style={{ color: "rgba(255,255,255,0.7)", fontFamily: "Inter_400Regular", fontSize: 10, marginTop: 2 }}>{wp.description}</Text>
                        <View style={{ marginTop: 6, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, alignSelf: "flex-start" }}>
                          <Text style={{ color: "#FFF", fontSize: 9, fontFamily: "Inter_700Bold" }}>{wp.calorieFactor}</Text>
                        </View>
                      </LinearGradient>
                    ) : (
                      <View style={styles.wpCard}>
                        <Text style={{ fontSize: 22 }}>{wp.icon}</Text>
                        <Text style={{ color: C.text, fontFamily: "Inter_600SemiBold", fontSize: 12, marginTop: 4 }}>{wp.label}</Text>
                        <Text style={{ color: C.muted, fontFamily: "Inter_400Regular", fontSize: 10, marginTop: 2 }}>{wp.description}</Text>
                        <View style={{ marginTop: 6, backgroundColor: C.border, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, alignSelf: "flex-start" }}>
                          <Text style={{ color: C.muted, fontSize: 9, fontFamily: "Inter_600SemiBold" }}>{wp.calorieFactor}</Text>
                        </View>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        {/* Activity Level */}
        <View style={{ gap: 10 }}>
          <Text style={{ color: C.muted, fontFamily: "Inter_700Bold", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>🏋️ Activity Level (Exercise)</Text>
          <Text style={{ color: C.muted, fontFamily: "Inter_400Regular", fontSize: 12 }}>This refers to your daily exercise outside of work</Text>
          {ACTIVITY_LEVELS.map((al) => {
            const selected = activityLevel === al.value;
            return (
              <TouchableOpacity
                key={al.value}
                onPress={() => { setActivityLevel(al.value); Haptics.selectionAsync(); }}
                style={[styles.actRow, selected && { borderColor: al.color, backgroundColor: al.color + "08" }]}
              >
                <Text style={{ fontSize: 22 }}>{al.icon}</Text>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: selected ? al.color : C.text, fontFamily: "Inter_700Bold", fontSize: 14 }}>{al.label}</Text>
                  <Text style={{ color: C.muted, fontFamily: "Inter_400Regular", fontSize: 12 }}>{al.desc}</Text>
                </View>
                <View style={{ backgroundColor: selected ? al.color + "20" : C.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                  <Text style={{ color: selected ? al.color : C.muted, fontFamily: "Inter_700Bold", fontSize: 12 }}>{al.multiplier}</Text>
                </View>
                {selected && <Ionicons name="checkmark-circle" size={20} color={al.color} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Calorie explanation */}
        <View style={{ backgroundColor: "#EFF9FF", borderRadius: 14, borderWidth: 1, borderColor: "#BAE6FD", padding: 14, gap: 8 }}>
          <Text style={{ color: C.primary, fontFamily: "Inter_700Bold", fontSize: 13 }}>🧮 Calorie Calculation Kaise Hoti Hai?</Text>
          <Text style={{ color: C.text, fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 19 }}>
            <Text style={{ fontFamily: "Inter_600SemiBold" }}>TDEE = BMR × Work Multiplier{"\n"}</Text>
            Jaise koi 70kg Army Officer (male, 25yr, 170cm):{"\n"}
            BMR = 1,710 kcal{"\n"}
            TDEE = 1,710 × 1.725 = <Text style={{ fontFamily: "Inter_700Bold", color: C.primary }}>2,950 kcal/day</Text>{"\n"}
            Vs Office worker = 1,710 × 1.2 = <Text style={{ fontFamily: "Inter_700Bold", color: C.muted }}>2,052 kcal/day</Text>
          </Text>
        </View>
      </ScrollView>

      {/* Save Button */}
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#FFF", borderTopWidth: 1, borderTopColor: C.border, padding: 16, paddingBottom: insets.bottom + 10 }}>
        <TouchableOpacity onPress={handleSave} disabled={saving} style={{ borderRadius: 16, overflow: "hidden", opacity: saving ? 0.7 : 1 }}>
          <LinearGradient colors={["#F59E0B", "#EF4444"]} style={{ padding: 16, alignItems: "center" }}>
            {saving ? <ActivityIndicator size="small" color="#FFF" /> : (
              <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 16 }}>✅ Save Profile</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backBtn: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20, padding: 8 },
  wpCard: { backgroundColor: "#FFF", borderRadius: 14, borderWidth: 1.5, borderColor: "#E2EFF5", padding: 12, minHeight: 90 },
  wpCardActive: { borderRadius: 14, padding: 12, minHeight: 90 },
  actRow: { backgroundColor: "#FFF", borderRadius: 14, borderWidth: 1.5, borderColor: "#E2EFF5", padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
});
