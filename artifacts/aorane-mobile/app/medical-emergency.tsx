import React from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, Linking, Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { logSilentError } from "@/lib/silentCatch";

const C = {
  bg: "#FFF5F5", card: "#FFFFFF", primary: "#DC2626", dark: "#B91C1C",
  text: "#1a1a2e", muted: "rgba(10,22,40,0.5)", border: "#FFE4E4",
  green: "#10B981", amber: "#F59E0B", blue: "#0077B6", purple: "#7C3AED",
};

type FeatureItem = {
  icon: string;
  label: string;
  color: string;
};

function ComingSoonBadge() {
  return (
    <View style={{ backgroundColor: "#F59E0B20", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start" }}>
      <Text style={{ color: C.amber, fontSize: 11, fontFamily: "Inter_700Bold" }}>⏳ COMING SOON</Text>
    </View>
  );
}

function LiveBadge() {
  return (
    <View style={{ backgroundColor: "#10B98120", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.green }} />
      <Text style={{ color: C.green, fontSize: 11, fontFamily: "Inter_700Bold" }}>LIVE</Text>
    </View>
  );
}

export default function MedicalEmergencyScreen() {
  const insets = useSafeAreaInsets();
  const topPad = insets.top;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <LinearGradient colors={["#DC2626", "#991B1B"]} style={{ paddingTop: topPad + 10, paddingHorizontal: 18, paddingBottom: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back" accessibilityRole="button">
            <Ionicons name="chevron-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#FFF", fontSize: 22, fontFamily: "Inter_700Bold" }}>🚑 Medical Emergency</Text>
            <Text style={{ color: "rgba(255,255,255,0.72)", fontSize: 13, fontFamily: "Inter_400Regular" }}>
              Blood · Accident · Future Emergency Features
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 40, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Info banner */}
        <View style={{ backgroundColor: "rgba(220,38,38,0.07)", borderRadius: 14, padding: 14, flexDirection: "row", gap: 10, alignItems: "flex-start", borderWidth: 1, borderColor: C.border }}>
          <Text style={{ fontSize: 20 }}>ℹ️</Text>
          <Text style={{ color: C.text, fontSize: 13, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 19 }}>
            All medical emergency tools in one place. More features will be added as they launch.
          </Text>
        </View>

        {/* ── BLOOD EMERGENCY — LIVE ─────────────────────────────────────────── */}
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch((e) => logSilentError('haptics', e));
            router.push("/blood" as never);
          }}
          activeOpacity={0.87}
        >
          <View style={[styles.card, { borderColor: "#FECACA" }]}>
            {/* Top gradient accent */}
            <LinearGradient
              colors={["#DC2626", "#B91C1C"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ height: 4, borderRadius: 4, marginBottom: 14 }}
            />

            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 14, marginBottom: 14 }}>
              <LinearGradient colors={["#DC2626", "#B91C1C"]} style={styles.iconBox}>
                <Text style={{ fontSize: 26 }}>🩸</Text>
              </LinearGradient>
              <View style={{ flex: 1, gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ color: C.primary, fontFamily: "Inter_700Bold", fontSize: 18 }}>Blood Emergency</Text>
                  <LiveBadge />
                </View>
                <Text style={{ color: C.muted, fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 18 }}>
                  Find blood donors, post an emergency request, or register as a donor yourself. Nearby donors are shown via GPS.
                </Text>
              </View>
            </View>

            {/* Features list */}
            {([
              { icon: "🔍", label: "Donor Search — City or GPS within 50km radius" },
              { icon: "📍", label: "Nearby Donors — Sorted by distance" },
              { icon: "❤️", label: "Donor Registration — OTP verified + GPS location" },
              { icon: "🆘", label: "Emergency Request — Hospital + Doctor info verified" },
              { icon: "🛡️", label: "Safety System — OTP + Flag/Report + Rate Limit" },
            ] as FeatureItem[]).map((f, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 5, borderTopWidth: i === 0 ? 1 : 0, borderTopColor: i === 0 ? C.border : "transparent" }}>
                <Text style={{ fontSize: 15 }}>{f.icon}</Text>
                <Text style={{ color: C.text, fontFamily: "Inter_400Regular", fontSize: 13, flex: 1 }}>{f.label}</Text>
                {i === 0 && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.green }} />}
              </View>
            ))}

            <LinearGradient colors={["#DC2626", "#B91C1C"]} style={[styles.actionBtn, { marginTop: 12 }]}>
              <Ionicons name="arrow-forward-circle" size={20} color="#FFF" />
              <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 15 }}>Open Blood Emergency →</Text>
            </LinearGradient>
          </View>
        </TouchableOpacity>

        {/* ── ACCIDENT EMERGENCY — COMING SOON ──────────────────────────────── */}
        <View style={[styles.card, { borderColor: "#FDE68A", opacity: 0.92 }]}>
          <LinearGradient
            colors={["#F59E0B", "#D97706"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ height: 4, borderRadius: 4, marginBottom: 14 }}
          />

          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 14, marginBottom: 14 }}>
            <View style={[styles.iconBox, { backgroundColor: "#FEF3C7" }]}>
              <Text style={{ fontSize: 26 }}>🚗</Text>
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ color: "#92400E", fontFamily: "Inter_700Bold", fontSize: 18 }}>Accident Emergency</Text>
                <ComingSoonBadge />
              </View>
              <Text style={{ color: C.muted, fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 18 }}>
                In 2–3 taps, send your GPS location automatically and call the nearest hospital or police. Launches after permissions are granted.
              </Text>
            </View>
          </View>

          {/* Planned flow preview */}
          <View style={{ backgroundColor: "#FFFBEB", borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "#FDE68A" }}>
            <Text style={{ color: "#92400E", fontFamily: "Inter_700Bold", fontSize: 12, marginBottom: 8 }}>PLANNED FLOW — 3 Taps:</Text>
            {[
              { step: "1", action: "Tap SOS", detail: "Hold for 2 seconds to prevent accidental trigger" },
              { step: "2", action: "GPS auto-capture", detail: "Exact location + address automatically" },
              { step: "3", action: "Auto-dispatch", detail: "Nearest hospital (2-3 km) + Police 112 notify + Auto-call" },
            ].map((s) => (
              <View key={s.step} style={{ flexDirection: "row", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: C.amber, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: "#FFF", fontSize: 11, fontFamily: "Inter_700Bold" }}>{s.step}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#92400E", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>{s.action}</Text>
                  <Text style={{ color: C.muted, fontFamily: "Inter_400Regular", fontSize: 11 }}>{s.detail}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* What's pending */}
          <View style={{ gap: 6 }}>
            <Text style={{ color: C.muted, fontFamily: "Inter_600SemiBold", fontSize: 11, textTransform: "uppercase" }}>Required to launch:</Text>
            {[
              { icon: "business-outline" as const, text: "Hospital API partnerships (Apollo, Fortis, AIIMS etc.)", done: false },
              { icon: "shield-checkmark-outline" as const, text: "Government 112-India Emergency API approval", done: false },
              { icon: "call-outline" as const, text: "Telecom auto-call API (Twilio/Exotel)", done: false },
              { icon: "server-outline" as const, text: "Database schema + Backend routes", done: true },
              { icon: "layers-outline" as const, text: "Frontend screen structure", done: true },
            ].map((item, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons
                  name={item.done ? "checkmark-circle" : "time-outline"}
                  size={15}
                  color={item.done ? C.green : C.amber}
                />
                <Text style={{ color: item.done ? C.text : C.muted, fontFamily: item.done ? "Inter_500Medium" : "Inter_400Regular", fontSize: 12, flex: 1 }}>
                  {item.text}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── FUTURE PLACEHOLDER ────────────────────────────────────────────── */}
        <View style={[styles.card, { borderColor: "#E9D5FF", borderStyle: "dashed" }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={[styles.iconBox, { backgroundColor: "#F3E8FF" }]}>
              <Ionicons name="add-circle-outline" size={28} color={C.purple} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.purple, fontFamily: "Inter_700Bold", fontSize: 15 }}>Aur features aayenge yahan</Text>
              <Text style={{ color: C.muted, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 3, lineHeight: 17 }}>
                Mental health crisis · Fire emergency · Child safety · Senior citizen fall detection
              </Text>
            </View>
          </View>
        </View>

        {/* National emergency quick-dial */}
        <View style={[styles.card, { borderColor: "#FECACA" }]}>
          <Text style={{ color: C.primary, fontFamily: "Inter_700Bold", fontSize: 14, marginBottom: 10 }}>📞 India Emergency Numbers (Always Available)</Text>
          {[
            { number: "112", label: "National Emergency", sub: "Ambulance + Police + Fire — one number for all", grad: ["#DC2626", "#B91C1C"] as [string, string] },
            { number: "108", label: "Ambulance",          sub: "Medical emergency",       grad: ["#EF4444", "#DC2626"] as [string, string] },
            { number: "100", label: "Police",             sub: "Law & order",             grad: ["#1D4ED8", "#1E40AF"] as [string, string] },
            { number: "101", label: "Fire",               sub: "Fire brigade",            grad: ["#EA580C", "#C2410C"] as [string, string] },
          ].map((e) => (
            <TouchableOpacity
              key={e.number}
              activeOpacity={0.75}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch((e) => logSilentError('haptics', e));
                if (Platform.OS === "web") {
                  Alert.alert(`Call ${e.number}`, `Dial ${e.number} — ${e.label}`, [
                    { text: "Cancel", style: "cancel" },
                    { text: `Call ${e.number}`, style: "destructive", onPress: () => Linking.openURL(`tel:${e.number}`) },
                  ]);
                } else {
                  Alert.alert(`📞 Call ${e.number}?`, `${e.label}\n${e.sub}`, [
                    { text: "Cancel", style: "cancel" },
                    { text: `Call ${e.number} Now`, style: "destructive", onPress: () => Linking.openURL(`tel:${e.number}`) },
                  ]);
                }
              }}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border }}
            >
              <LinearGradient colors={e.grad} style={{ width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 17 }}>{e.number}</Text>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>{e.label}</Text>
                <Text style={{ color: C.muted, fontFamily: "Inter_400Regular", fontSize: 11 }}>{e.sub}</Text>
              </View>
              <View style={{ backgroundColor: C.primary, borderRadius: 20, padding: 7 }}>
                <Ionicons name="call" size={16} color="#FFF" />
              </View>
            </TouchableOpacity>
          ))}
          <Text style={{ color: C.muted, fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 4 }}>
            These numbers are always available for direct calls — no app needed
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  backBtn: { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 20, padding: 8 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, padding: 16 },
  iconBox: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(220,38,38,0.1)" },
  actionBtn: { height: 50, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
});
