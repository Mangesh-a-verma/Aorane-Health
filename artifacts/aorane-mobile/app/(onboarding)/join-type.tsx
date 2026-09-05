import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AoraneLogo from "@/components/AoraneLogo";
import { setJoinType, clearPendingEnrollment } from "@/lib/joinFlow";

const PRIMARY = "#0077B6";
const DEEP = "#023E8A";
const TEXT = "#1a1a2e";
const SUB = "rgba(10,22,40,0.55)";

/**
 * The fork at the top of onboarding: are you here for yourself, or through
 * your employer?
 *
 * It sits BEFORE sign-in on purpose. The employee path needs an enrolment code,
 * and asking for it after account creation means someone can complete sign-up
 * only to be told their code is wrong — at which point they are a half-created
 * individual account that has to be reconciled with an org later.
 */
export default function JoinTypeScreen() {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState<"individual" | "employee" | null>(null);

  const choose = async (type: "individual" | "employee") => {
    if (busy) return;
    setBusy(type);
    try {
      await setJoinType(type);
      if (type === "individual") {
        // Clear any code left over from an abandoned employee attempt, so the
        // post-login step does not send this user into department selection
        // for an organization they decided not to join.
        await clearPendingEnrollment();
        router.replace("/(auth)/login");
      } else {
        router.push("/(onboarding)/enrollment-code" as never);
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <LinearGradient colors={["#F0F9FF", "#FFF8F3"]} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <AoraneLogo width={180} />
        <Text style={styles.title}>How are you joining?</Text>
        <Text style={styles.subtitle}>
          You can change this later — joining through your company just unlocks your
          employer's plan.
        </Text>
      </View>

      <View style={styles.options}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => choose("individual")}
          disabled={!!busy}
          accessibilityRole="button"
          accessibilityLabel="Join as an individual"
          style={[styles.card, busy === "employee" && styles.cardDimmed]}
        >
          <View style={[styles.iconWrap, { backgroundColor: "rgba(0,119,182,0.10)" }]}>
            {busy === "individual"
              ? <ActivityIndicator color={PRIMARY} />
              : <Ionicons name="person-outline" size={26} color={PRIMARY} />}
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>Join as an individual</Text>
            <Text style={styles.cardText}>
              Track your own health. Choose a plan that suits you.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="rgba(10,22,40,0.25)" />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => choose("employee")}
          disabled={!!busy}
          accessibilityRole="button"
          accessibilityLabel="Join through my company"
          style={[styles.card, busy === "individual" && styles.cardDimmed]}
        >
          <View style={[styles.iconWrap, { backgroundColor: "rgba(2,62,138,0.10)" }]}>
            {busy === "employee"
              ? <ActivityIndicator color={DEEP} />
              : <Ionicons name="business-outline" size={26} color={DEEP} />}
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>Join through my company</Text>
            <Text style={styles.cardText}>
              You'll need the enrolment code from your HR team.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="rgba(10,22,40,0.25)" />
        </TouchableOpacity>
      </View>

      <View style={styles.footerNote}>
        <Ionicons name="lock-closed-outline" size={13} color={SUB} />
        <Text style={styles.footerText}>
          Your employer only ever sees team-level averages — never your individual health data.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F0F9FF", paddingHorizontal: 20 },
  header: { alignItems: "center", marginTop: 12, marginBottom: 28 },
  title: { color: TEXT, fontFamily: "Inter_700Bold", fontSize: 24, marginTop: 24, textAlign: "center" },
  subtitle: { color: SUB, fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 8, paddingHorizontal: 8 },
  options: { gap: 14, flex: 1, justifyContent: "center" },
  card: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "rgba(255,255,255,0.9)", borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: "rgba(0,119,182,0.14)",
  },
  cardDimmed: { opacity: 0.5 },
  iconWrap: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  cardBody: { flex: 1 },
  cardTitle: { color: TEXT, fontFamily: "Inter_600SemiBold", fontSize: 16 },
  cardText: { color: SUB, fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19, marginTop: 3 },
  footerNote: { flexDirection: "row", alignItems: "flex-start", gap: 7, paddingHorizontal: 4 },
  footerText: { flex: 1, color: SUB, fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 17 },
});
