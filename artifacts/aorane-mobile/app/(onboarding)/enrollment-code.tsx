import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "@/lib/api";
import { setPendingEnrollment } from "@/lib/joinFlow";

const PRIMARY = "#0077B6";
const DEEP = "#023E8A";
const TEXT = "#1a1a2e";
const SUB = "rgba(10,22,40,0.55)";
const DANGER = "#DC2626";

/**
 * Enrolment code entry, BEFORE sign-in and compulsory on the employee path.
 *
 * The code is verified against the server rather than merely format-checked,
 * because every reason it can fail — expired, seats full, the organization's
 * own subscription lapsed — is invisible from the code itself, and all of them
 * are things only HR can fix. Getting that verdict here means nobody creates an
 * account they cannot use.
 */
export default function EnrollmentCodeScreen() {
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  // "grace" or "expired" means the code is valid but the company is not
  // currently paying, so joining will not grant its plan.
  const [planState, setPlanState] = useState<"active" | "grace" | "expired">("active");

  const trimmed = code.trim().toUpperCase();

  const verify = async () => {
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.verifyOrgCode(trimmed);
      if (!res?.valid) throw new Error("That code doesn't match any organization.");
      setOrgName(res.org.name);
      setPlanState(res.planState ?? "active");
      // Park the code for the post-sign-in step. It is redeemed only after a
      // department has been chosen, so nothing is consumed if the user stops
      // here.
      await setPendingEnrollment(trimmed, res.org.name);
    } catch (e) {
      setOrgName(null);
      setPlanState("active");
      setError((e as Error).message || "Could not verify that code.");
    } finally {
      setLoading(false);
    }
  };

  const proceed = () => router.replace("/(auth)/login");

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: "#F0F9FF" }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <LinearGradient colors={["#F0F9FF", "#FFF8F3"]} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, paddingHorizontal: 20 }} keyboardShouldPersistTaps="handled">

        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={20} color={TEXT} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Company enrolment</Text>
        </View>

        <LinearGradient colors={[PRIMARY, DEEP]} style={styles.badge}>
          <Ionicons name="business" size={34} color="#FFF" />
        </LinearGradient>

        <Text style={styles.title}>Enter your enrolment code</Text>
        <Text style={styles.subtitle}>
          Your HR team issues this code. We'll check it before you create an account.
        </Text>

        <View style={[styles.inputCard, error ? styles.inputCardError : null]}>
          <Text style={styles.inputLabel}>ENROLMENT CODE</Text>
          <TextInput
            value={code}
            onChangeText={(t) => { setCode(t); setError(null); setOrgName(null); }}
            placeholder="e.g. ABCD1234"
            placeholderTextColor="rgba(10,22,40,0.3)"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={16}
            editable={!orgName}
            onSubmitEditing={verify}
            returnKeyType="done"
            accessibilityLabel="Enrolment code"
            style={styles.input}
          />
          <View style={[styles.inputRule, error ? { backgroundColor: "rgba(220,38,38,0.35)" } : null]} />
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={17} color={DANGER} style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.errorTitle}>{error}</Text>
              {/* Every failure here is something the employee cannot resolve
                  themselves, so the only useful next step is the same one. */}
              <Text style={styles.errorHelp}>
                Ask your HR or admin team for a current code — they can issue one from the
                Aorane Business portal.
              </Text>
            </View>
          </View>
        )}

        {orgName && (
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle" size={19} color="#1B998B" />
            <View style={{ flex: 1 }}>
              <Text style={styles.successTitle}>Welcome to {orgName}</Text>
              <Text style={styles.successHelp}>Sign in next, then pick your department.</Text>
            </View>
          </View>
        )}

        {/* Said BEFORE they commit, not discovered afterwards. The code is
            genuinely valid — the company simply is not paying right now — so
            this is a warning, not an error, and joining is still allowed. */}
        {orgName && planState !== "active" && (
          <View style={styles.warnBox}>
            <Ionicons name="information-circle" size={18} color="#B45309" style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.warnTitle}>{orgName}'s plan is inactive</Text>
              <Text style={styles.warnHelp}>
                You can still join. You'll be on the Free plan until your company renews, and
                you'll be upgraded automatically when they do.
              </Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={orgName ? proceed : verify}
          disabled={loading || (!orgName && !trimmed)}
          accessibilityRole="button"
          style={{ borderRadius: 16, overflow: "hidden", opacity: loading || (!orgName && !trimmed) ? 0.55 : 1, marginTop: 18 }}
        >
          <LinearGradient colors={[PRIMARY, DEEP]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cta}>
            {loading
              ? <ActivityIndicator color="#FFF" />
              : <Ionicons name={orgName ? "arrow-forward" : "checkmark"} size={20} color="#FFF" />}
            <Text style={styles.ctaText}>
              {loading ? "Checking…" : orgName ? "Continue to sign in" : "Verify code"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={styles.altLink} accessibilityRole="button">
          <Text style={styles.altLinkText}>I don't have a code — join as an individual</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,119,182,0.08)", alignItems: "center", justifyContent: "center" },
  headerTitle: { color: TEXT, fontSize: 18, fontFamily: "Inter_700Bold" },
  badge: { width: 72, height: 72, borderRadius: 22, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 20 },
  title: { color: TEXT, fontFamily: "Inter_700Bold", fontSize: 21, textAlign: "center" },
  subtitle: { color: SUB, fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: 8, marginBottom: 26 },
  inputCard: { backgroundColor: "rgba(255,255,255,0.85)", borderRadius: 18, padding: 18, borderWidth: 1, borderColor: "rgba(0,119,182,0.14)" },
  inputCardError: { borderColor: "rgba(220,38,38,0.35)" },
  inputLabel: { color: SUB, fontFamily: "Inter_500Medium", fontSize: 11, letterSpacing: 1, marginBottom: 6 },
  input: { color: TEXT, fontFamily: "Inter_700Bold", fontSize: 22, letterSpacing: 3, textAlign: "center", paddingVertical: 10 },
  inputRule: { height: 2, backgroundColor: "rgba(0,119,182,0.2)", borderRadius: 2 },
  errorBox: { flexDirection: "row", gap: 9, backgroundColor: "rgba(220,38,38,0.07)", borderRadius: 14, padding: 13, marginTop: 14, borderWidth: 1, borderColor: "rgba(220,38,38,0.18)" },
  errorTitle: { color: DANGER, fontFamily: "Inter_600SemiBold", fontSize: 13.5 },
  errorHelp: { color: SUB, fontFamily: "Inter_400Regular", fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  successBox: { flexDirection: "row", gap: 10, alignItems: "center", backgroundColor: "rgba(27,153,139,0.08)", borderRadius: 14, padding: 14, marginTop: 14, borderWidth: 1, borderColor: "rgba(27,153,139,0.2)" },
  successTitle: { color: "#0F766E", fontFamily: "Inter_700Bold", fontSize: 15 },
  successHelp: { color: SUB, fontFamily: "Inter_400Regular", fontSize: 12.5, marginTop: 2 },
  warnBox: { flexDirection: "row", gap: 9, backgroundColor: "rgba(245,158,11,0.09)", borderRadius: 14, padding: 13, marginTop: 12, borderWidth: 1, borderColor: "rgba(245,158,11,0.22)" },
  warnTitle: { color: "#92400E", fontFamily: "Inter_600SemiBold", fontSize: 13.5 },
  warnHelp: { color: SUB, fontFamily: "Inter_400Regular", fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  cta: { padding: 17, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 9 },
  ctaText: { color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 16 },
  altLink: { marginTop: 18, alignItems: "center" },
  altLinkText: { color: PRIMARY, fontFamily: "Inter_500Medium", fontSize: 13.5 },
});
