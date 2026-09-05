import React, { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Switch, Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "@/lib/api";
import { storage } from "@/lib/storage";
import { useAuth } from "@/context/AuthContext";
import { getPendingEnrollment, clearPendingEnrollment } from "@/lib/joinFlow";

const PRIMARY = "#0077B6";
const DEEP = "#023E8A";
const TEXT = "#1a1a2e";
const SUB = "rgba(10,22,40,0.55)";

type Dept = { id: string; name: string };
/** "not_listed" and "declined" are separate choices, not one "other" bucket:
 *  the first is a gap an admin should close, the second is an opt-out an admin
 *  must not override. See the department_status enum on the server. */
type Choice = { kind: "assigned"; id: string; name: string } | { kind: "not_listed" } | { kind: "declined" };

export default function DepartmentScreen() {
  const insets = useSafeAreaInsets();
  const { refreshUser } = useAuth() as { refreshUser?: () => Promise<void> | void };

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [orgName, setOrgName] = useState("");
  const [code, setCode] = useState("");
  const [choice, setChoice] = useState<Choice | null>(null);
  const [shareAggregate, setShareAggregate] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const pending = await getPendingEnrollment();
      if (!pending) {
        // Nothing to enrol into — this screen has no purpose without a code.
        router.replace("/(onboarding)/" as never);
        return;
      }
      setCode(pending.code);
      setOrgName(pending.orgName);
      try {
        const res = await api.getOnboardingDepartments(pending.code);
        setDepartments(res.departments);
        if (res.org?.name) setOrgName(res.org.name);
      } catch (e) {
        // An org with no departments is normal; a failure to reach the server
        // is not, and must not silently look like "no departments".
        setLoadError((e as Error).message || "Could not load your company's departments.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const submit = async () => {
    if (!choice || submitting) return;
    setSubmitting(true);
    try {
      const res = await api.useEnrollmentCode(code, {
        departmentId: choice.kind === "assigned" ? choice.id : null,
        departmentStatus: choice.kind,
        shareOrgAggregate: shareAggregate,
      });
      // Fresh tokens carry the upgraded plan claim, so the very next request is
      // authorised for it instead of the old "free" claim.
      if (res.accessToken) await storage.setToken(res.accessToken);
      if (res.refreshToken) await storage.setRefreshToken(res.refreshToken);
      await clearPendingEnrollment();
      if (refreshUser) await refreshUser();
      router.replace("/(onboarding)/" as never);
    } catch (e) {
      // A code can stop being redeemable between the pre-sign-in check and
      // here — the last seat goes, the code is revoked, the org's subscription
      // lapses. Without an escape the user is stuck: app/index.tsx routes them
      // back to this screen for as long as a pending code exists, so a failure
      // that cannot be retried away would lock them out of the app entirely.
      // Offer to drop the code and continue as an individual; they can enrol
      // later from their profile once HR sorts it out.
      Alert.alert(
        "Could not complete enrolment",
        (e as Error).message || "Please try again.",
        [
          { text: "Try again", style: "cancel" },
          {
            text: "Continue without joining",
            style: "destructive",
            onPress: async () => {
              await clearPendingEnrollment();
              router.replace("/(onboarding)/" as never);
            },
          },
        ],
      );
      setSubmitting(false);
    }
  };

  const isPicked = (c: Choice) =>
    choice?.kind === c.kind && (c.kind !== "assigned" || (choice as { id: string }).id === c.id);

  const Option = ({ c, title, subtitle, icon }: { c: Choice; title: string; subtitle?: string; icon: keyof typeof Ionicons.glyphMap }) => (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => setChoice(c)}
      accessibilityRole="radio"
      accessibilityState={{ selected: isPicked(c) }}
      accessibilityLabel={title}
      style={[styles.option, isPicked(c) && styles.optionActive]}
    >
      <Ionicons name={icon} size={18} color={isPicked(c) ? PRIMARY : "rgba(10,22,40,0.35)"} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.optionTitle, isPicked(c) && { color: PRIMARY }]}>{title}</Text>
        {subtitle ? <Text style={styles.optionSub}>{subtitle}</Text> : null}
      </View>
      <Ionicons
        name={isPicked(c) ? "radio-button-on" : "radio-button-off"}
        size={19}
        color={isPicked(c) ? PRIMARY : "rgba(10,22,40,0.2)"}
      />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <LinearGradient colors={["#F0F9FF", "#FFF8F3"]} style={StyleSheet.absoluteFill} />
        <ActivityIndicator color={PRIMARY} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient colors={["#F0F9FF", "#FFF8F3"]} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 28, paddingHorizontal: 20 }}>

        <LinearGradient colors={[PRIMARY, DEEP]} style={styles.badge}>
          <Ionicons name="people" size={30} color="#FFF" />
        </LinearGradient>

        <Text style={styles.title}>Which team are you on?</Text>
        <Text style={styles.subtitle}>
          {orgName ? `${orgName} groups wellbeing insights by department.` : "Your company groups wellbeing insights by department."}
          {" "}Only team-level averages are ever shown — never your own numbers.
        </Text>

        {loadError && (
          <View style={styles.warnBox}>
            <Ionicons name="cloud-offline-outline" size={16} color="#B45309" />
            <Text style={styles.warnText}>{loadError} You can still continue and set this later.</Text>
          </View>
        )}

        <View style={styles.group}>
          {departments.map((d) => (
            <Option key={d.id} c={{ kind: "assigned", id: d.id, name: d.name }} title={d.name} icon="business-outline" />
          ))}

          {departments.length === 0 && !loadError && (
            <Text style={styles.emptyNote}>
              Your company hasn't set up its department list yet.
            </Text>
          )}

          {/* Kept distinct from "prefer not to say" on purpose: this one is a
              prompt for HR to extend the list, and stays reassignable. */}
          <Option
            c={{ kind: "not_listed" }}
            title="My department isn't listed"
            subtitle="Your admin can add it and assign you later"
            icon="add-circle-outline"
          />
          <Option
            c={{ kind: "declined" }}
            title="Prefer not to say"
            subtitle="This choice can't be overridden by your admin"
            icon="eye-off-outline"
          />
        </View>

        <View style={styles.consentCard}>
          <View style={styles.consentRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.consentTitle}>Contribute to company wellness averages</Text>
              <Text style={styles.consentText}>
                Your aggregate health data — never individually identifiable — helps your company
                see how its teams are doing. You can turn this off at any time in Privacy settings.
              </Text>
            </View>
            <Switch
              value={shareAggregate}
              onValueChange={setShareAggregate}
              trackColor={{ false: "rgba(10,22,40,0.15)", true: "rgba(0,119,182,0.4)" }}
              thumbColor={shareAggregate ? PRIMARY : "#f4f3f4"}
              accessibilityLabel="Contribute to company wellness averages"
            />
          </View>
          {/* Default off. Consent that was never given must not be assumed,
              and opting out excludes the member from the calculation itself,
              not just from what is displayed. */}
          <Text style={styles.consentFoot}>
            {shareAggregate
              ? "You'll be counted in your department's averages."
              : "You won't be included in any company average."}
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={submit}
          disabled={!choice || submitting}
          accessibilityRole="button"
          style={{ borderRadius: 16, overflow: "hidden", opacity: !choice || submitting ? 0.55 : 1, marginTop: 20 }}
        >
          <LinearGradient colors={[PRIMARY, DEEP]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cta}>
            {submitting ? <ActivityIndicator color="#FFF" /> : <Ionicons name="checkmark" size={20} color="#FFF" />}
            <Text style={styles.ctaText}>{submitting ? "Joining…" : "Join company"}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F0F9FF" },
  center: { alignItems: "center", justifyContent: "center" },
  badge: { width: 66, height: 66, borderRadius: 20, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 18 },
  title: { color: TEXT, fontFamily: "Inter_700Bold", fontSize: 22, textAlign: "center" },
  subtitle: { color: SUB, fontFamily: "Inter_400Regular", fontSize: 13.5, lineHeight: 20, textAlign: "center", marginTop: 8, marginBottom: 22 },
  group: { gap: 10 },
  option: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "rgba(255,255,255,0.85)", borderRadius: 15, paddingVertical: 14, paddingHorizontal: 15,
    borderWidth: 1.5, borderColor: "rgba(0,119,182,0.12)",
  },
  optionActive: { borderColor: PRIMARY, backgroundColor: "rgba(0,119,182,0.06)" },
  optionTitle: { color: TEXT, fontFamily: "Inter_600SemiBold", fontSize: 15 },
  optionSub: { color: SUB, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  emptyNote: { color: SUB, fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center", paddingVertical: 6 },
  warnBox: { flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: "rgba(245,158,11,0.08)", borderRadius: 13, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: "rgba(245,158,11,0.2)" },
  warnText: { flex: 1, color: "#92400E", fontFamily: "Inter_400Regular", fontSize: 12.5, lineHeight: 18 },
  consentCard: { backgroundColor: "rgba(255,255,255,0.85)", borderRadius: 18, padding: 16, marginTop: 20, borderWidth: 1, borderColor: "rgba(0,119,182,0.14)" },
  consentRow: { flexDirection: "row", alignItems: "center" },
  consentTitle: { color: TEXT, fontFamily: "Inter_600SemiBold", fontSize: 14.5 },
  consentText: { color: SUB, fontFamily: "Inter_400Regular", fontSize: 12.5, lineHeight: 18, marginTop: 5 },
  consentFoot: { color: SUB, fontFamily: "Inter_500Medium", fontSize: 12, marginTop: 11, fontStyle: "italic" },
  cta: { padding: 17, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 9 },
  ctaText: { color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 16 },
});
