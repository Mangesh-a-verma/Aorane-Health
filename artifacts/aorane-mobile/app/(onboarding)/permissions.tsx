import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, useColorScheme,
  Animated, Dimensions, Platform, Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as Location from "expo-location";
import { useAuth } from "@/context/AuthContext";

const { width: W } = Dimensions.get("window");

type PermissionStatus = "idle" | "granted" | "denied" | "asking";

const PERMS = [
  {
    key: "location",
    icon: "location" as const,
    iconColor: "#0EA5E9",
    gradColors: ["#0077B6", "#0EA5E9"] as [string, string],
    title: "Location Access",
    desc: "Nazdeeki doctor, pharmacy aur hospital dhundne ke liye",
    benefit: "Emergency mein turant madad mile",
  },
  {
    key: "notification",
    icon: "notifications" as const,
    iconColor: "#F59E0B",
    gradColors: ["#F59E0B", "#EF4444"] as [string, string],
    title: "Notifications",
    desc: "Medicine reminder, health tips aur appointment alerts",
    benefit: "Kabhi koi dose miss na ho",
  },
  {
    key: "health",
    icon: "fitness" as const,
    iconColor: "#10B981",
    gradColors: ["#059669", "#1B998B"] as [string, string],
    title: "Health & Activity",
    desc: "Kadam ginti, calories burn aur physical activity track karne ke liye",
    benefit: "Automatic fitness data — kuch type karne ki zaroorat nahi",
  },
];

export default function PermissionsScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const insets = useSafeAreaInsets();
  const { setOnboardingComplete } = useAuth();

  const [statuses, setStatuses] = useState<Record<string, PermissionStatus>>({
    location: "idle", notification: "idle", health: "idle",
  });

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: false }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
    ]).start();
  }, []);

  const requestPermission = async (key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStatuses((s) => ({ ...s, [key]: "asking" }));
    try {
      let granted = false;
      if (key === "location") {
        const { status } = await Location.requestForegroundPermissionsAsync();
        granted = status === "granted";
      } else if (key === "notification") {
        // Expo Notifications — if not available gracefully skip
        try {
          const Notifications = await import("expo-notifications");
          const { status } = await Notifications.requestPermissionsAsync();
          granted = status === "granted";
        } catch { granted = false; }
      } else if (key === "health") {
        // Health permissions are iOS HealthKit / Android Health Connect
        // For now, we mark as granted (actual integration happens later)
        granted = true;
      }
      setStatuses((s) => ({ ...s, [key]: granted ? "granted" : "denied" }));
      if (granted) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setStatuses((s) => ({ ...s, [key]: "denied" }));
    }
  };

  const allAsked = Object.values(statuses).every((s) => s !== "idle");

  const handleContinue = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await setOnboardingComplete();
    router.replace("/(auth)/setup-pin");
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={isDark
          ? ["#010814", "#031628", "#051E30", "#061A2A"]
          : ["#C8E9FA", "#D9F4EE", "#E8F4FF", "#D4F0F7"]}
        locations={[0, 0.3, 0.65, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.orb1, { backgroundColor: isDark ? "#065F46" : "#6EE7B7" }]} />
      <View style={[styles.orb2, { backgroundColor: isDark ? "#0055A3" : "#7DD3FC" }]} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.stepRow}>
          {[1, 2, 3].map((s) => (
            <View key={s} style={styles.stepTrack}>
              {s <= 2
                ? <LinearGradient colors={["#0077B6", "#1B998B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.stepFill} />
                : <View style={[styles.stepFill, { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,119,182,0.12)" }]} />
              }
            </View>
          ))}
        </View>
        <View style={styles.stepLabelRow}>
          <View style={[styles.stepPill, { backgroundColor: isDark ? "rgba(56,189,248,0.15)" : "rgba(0,119,182,0.1)", borderColor: isDark ? "rgba(56,189,248,0.3)" : "rgba(0,119,182,0.2)" }]}>
            <Text style={[styles.stepPillTxt, { color: isDark ? "#38BDF8" : "#0077B6", fontFamily: "Inter_600SemiBold" }]}>Step 2 of 3</Text>
          </View>
          <Text style={[styles.stepName, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular" }]}>Permissions</Text>
        </View>
      </View>

      <Animated.View style={[styles.body, { opacity: fadeAnim, transform: [{ translateY: slideAnim }], paddingBottom: insets.bottom + 100 }]}>

        {/* Title */}
        <View style={styles.titleWrap}>
          <LinearGradient colors={["#0077B6", "#0EA5E9", "#1B998B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.titleIcon}>
            <Ionicons name="shield-checkmark" size={26} color="#FFF" />
          </LinearGradient>
          <Text style={[styles.title, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>App Permissions</Text>
          <Text style={[styles.subtitle, { color: isDark ? "rgba(255,255,255,0.48)" : "rgba(10,22,40,0.52)", fontFamily: "Inter_400Regular" }]}>
            Ye permissions AORANE ko better banati hain — sabhi optional hain
          </Text>
        </View>

        {/* Permission Cards */}
        {PERMS.map((perm, idx) => {
          const status = statuses[perm.key];
          const isGranted = status === "granted";
          const isDenied = status === "denied";
          const isAsking = status === "asking";

          return (
            <Animated.View key={perm.key} style={{ opacity: fadeAnim }}>
              <LinearGradient
                colors={isDark
                  ? isGranted
                    ? ["rgba(16,185,129,0.25)", "rgba(16,185,129,0.1)", "rgba(255,255,255,0.04)"]
                    : ["rgba(56,189,248,0.22)", "rgba(45,212,191,0.12)", "rgba(255,255,255,0.04)"]
                  : isGranted
                    ? ["rgba(167,243,208,0.9)", "rgba(186,230,253,0.5)"]
                    : ["rgba(255,255,255,0.95)", "rgba(186,230,253,0.5)"]
                }
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.cardBorder}
              >
                <View style={[styles.cardInner, { backgroundColor: isDark ? "rgba(8,18,40,0.52)" : "rgba(255,255,255,0.52)" }]}>
                  {Platform.OS === "ios"
                    ? <BlurView intensity={isDark ? 75 : 55} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
                    : <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? "rgba(8,16,36,0.38)" : "rgba(255,255,255,0.38)" }]} />
                  }
                  <View style={styles.permRow}>
                    <LinearGradient colors={perm.gradColors} style={styles.permIcon}>
                      <Ionicons name={perm.icon} size={22} color="#FFF" />
                    </LinearGradient>
                    <View style={styles.permText}>
                      <Text style={[styles.permTitle, { color: isDark ? "#F0F8FF" : "#0A1628", fontFamily: "Inter_700Bold" }]}>{perm.title}</Text>
                      <Text style={[styles.permDesc, { color: isDark ? "rgba(255,255,255,0.5)" : "rgba(10,22,40,0.55)", fontFamily: "Inter_400Regular" }]}>{perm.desc}</Text>
                      <View style={styles.benefitRow}>
                        <Ionicons name="checkmark-circle" size={12} color={isDark ? "#2DD4BF" : "#059669"} />
                        <Text style={[styles.benefitTxt, { color: isDark ? "#2DD4BF" : "#059669", fontFamily: "Inter_400Regular" }]}>{perm.benefit}</Text>
                      </View>
                    </View>

                    {/* Status Button */}
                    {isGranted ? (
                      <View style={[styles.statusBtn, { backgroundColor: "rgba(16,185,129,0.15)", borderColor: "rgba(16,185,129,0.3)" }]}>
                        <Ionicons name="checkmark" size={16} color="#10B981" />
                      </View>
                    ) : isDenied ? (
                      <TouchableOpacity onPress={() => requestPermission(perm.key)} style={[styles.statusBtn, { backgroundColor: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.25)" }]} activeOpacity={0.8}>
                        <Ionicons name="refresh" size={14} color="#EF4444" />
                      </TouchableOpacity>
                    ) : isAsking ? (
                      <View style={[styles.statusBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,119,182,0.08)", borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,119,182,0.2)" }]}>
                        <Ionicons name="hourglass-outline" size={14} color={isDark ? "#38BDF8" : "#0077B6"} />
                      </View>
                    ) : (
                      <TouchableOpacity onPress={() => requestPermission(perm.key)} activeOpacity={0.8}>
                        <LinearGradient colors={perm.gradColors} style={styles.allowBtn}>
                          <Text style={[styles.allowTxt, { fontFamily: "Inter_600SemiBold" }]}>Allow</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </LinearGradient>
            </Animated.View>
          );
        })}

        {/* Privacy assurance */}
        <View style={[styles.privNote, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.6)", borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.88)" }]}>
          <Ionicons name="lock-closed" size={12} color={isDark ? "#38BDF8" : "#0077B6"} />
          <Text style={[styles.privTxt, { color: isDark ? "rgba(255,255,255,0.38)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular" }]}>
            Koi bhi data kabhi third-party ke saath share nahi hoga • AORANE Privacy Policy
          </Text>
        </View>
      </Animated.View>

      {/* Bottom CTA — fixed */}
      <View style={[styles.footer, {
        paddingBottom: insets.bottom + 16,
        backgroundColor: isDark ? "rgba(1,8,20,0.88)" : "rgba(200,233,250,0.88)",
      }]}>
        {Platform.OS === "ios" && <BlurView intensity={20} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />}
        <TouchableOpacity onPress={handleContinue} activeOpacity={0.85} style={styles.ctaWrap}>
          <LinearGradient colors={["#0077B6", "#0EA5E9", "#1B998B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaBtn}>
            <Text style={[styles.ctaTxt, { fontFamily: "Inter_700Bold" }]}>
              {allAsked ? "Aage Barein" : "Abhi Karo / Skip"}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#FFF" />
          </LinearGradient>
        </TouchableOpacity>
        <Text style={[styles.skipNote, { color: isDark ? "rgba(255,255,255,0.3)" : "rgba(10,22,40,0.35)", fontFamily: "Inter_400Regular" }]}>
          Permissions baad mein Settings se bhi de sakte hain
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  orb1: { position: "absolute", width: 320, height: 320, borderRadius: 160, top: -110, right: -90, opacity: 0.46 },
  orb2: { position: "absolute", width: 260, height: 260, borderRadius: 130, bottom: 80, left: -80, opacity: 0.4 },

  header: { paddingHorizontal: 22, marginBottom: 4 },
  stepRow: { flexDirection: "row", gap: 6, marginBottom: 8 },
  stepTrack: { flex: 1, height: 5, borderRadius: 3, overflow: "hidden" },
  stepFill: { flex: 1, height: 5, borderRadius: 3 },
  stepLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stepPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  stepPillTxt: { fontSize: 12 },
  stepName: { fontSize: 12 },

  body: { flex: 1, paddingHorizontal: 22, paddingTop: 4 },
  titleWrap: { alignItems: "center", marginBottom: 20 },
  titleIcon: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  title: { fontSize: 22, marginBottom: 5, textAlign: "center" },
  subtitle: { fontSize: 13, textAlign: "center", lineHeight: 18 },

  cardBorder: { borderRadius: 22, padding: 1.5, marginBottom: 12 },
  cardInner: { borderRadius: 21, overflow: "hidden", padding: 16 },

  permRow: { flexDirection: "row", alignItems: "center", gap: 14, zIndex: 1 },
  permIcon: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  permText: { flex: 1, gap: 3 },
  permTitle: { fontSize: 15 },
  permDesc: { fontSize: 12, lineHeight: 16 },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  benefitTxt: { fontSize: 11 },

  statusBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", borderWidth: 1, flexShrink: 0 },
  allowBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12 },
  allowTxt: { color: "#FFF", fontSize: 13 },

  privNote: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1, marginTop: 4 },
  privTxt: { fontSize: 11, flex: 1, lineHeight: 16 },

  footer: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 22, paddingTop: 12, overflow: "hidden" },
  ctaWrap: { borderRadius: 16, overflow: "hidden", marginBottom: 8 },
  ctaBtn: { height: 54, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  ctaTxt: { color: "#FFF", fontSize: 16 },
  skipNote: { fontSize: 11, textAlign: "center" },
});
