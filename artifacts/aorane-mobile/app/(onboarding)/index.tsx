import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator,
  Animated, Dimensions, Platform, BackHandler,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";

const { width: W } = Dimensions.get("window");

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

const WORK_PROFILES = [
  { value: "Office/Desk Job",     icon: "business-outline" as const },
  { value: "IT/Software",         icon: "laptop-outline" as const },
  { value: "Call Center/BPO",     icon: "call-outline" as const },
  { value: "Field/Sales",         icon: "walk-outline" as const },
  { value: "Doctor/Healthcare",   icon: "medical-outline" as const },
  { value: "Teacher/Professor",   icon: "school-outline" as const },
  { value: "Army/Defence",        icon: "shield-outline" as const },
  { value: "Police/CRPF",         icon: "shield-half-outline" as const },
  { value: "Farmer/Agriculture",  icon: "leaf-outline" as const },
  { value: "Housewife",           icon: "home-outline" as const },
  { value: "Student",             icon: "school-outline" as const },
  { value: "Business Owner",      icon: "briefcase-outline" as const },
  { value: "Driver/Delivery",     icon: "car-outline" as const },
  { value: "Factory Worker",      icon: "construct-outline" as const },
  { value: "Athlete/Sports",      icon: "fitness-outline" as const },
  { value: "Other",               icon: "ellipsis-horizontal-outline" as const },
];

export default function ProfileSetupScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { logout } = useAuth();

  const GENDERS = [
    { value: "male",   label: t("genderMale"),   icon: "male" as const },
    { value: "female", label: t("genderFemale"), icon: "female" as const },
    { value: "other",  label: t("genderOther"),  icon: "transgender" as const },
  ];

  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [workProfile, setWorkProfile] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: Platform.OS !== "web" }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 60, useNativeDriver: Platform.OS !== "web" }),
    ]).start();

    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => backHandler.remove();
  }, []);

  const handleDobChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, "");
    let formatted = cleaned;
    if (cleaned.length > 2) formatted = cleaned.slice(0, 2) + "/" + cleaned.slice(2);
    if (cleaned.length > 4) formatted = cleaned.slice(0, 2) + "/" + cleaned.slice(2, 4) + "/" + cleaned.slice(4, 8);
    setDob(formatted);
  };

  const canProceed = name.trim().length >= 2 && gender !== "" && dob.length === 10;

  // dob is DD/MM/YYYY (see handleDobChange above). Returns age in
  // completed years, or null if the string isn't a valid, parseable date.
  const calculateAgeFromDob = (ddmmyyyy: string): number | null => {
    const parts = ddmmyyyy.split("/");
    if (parts.length !== 3) return null;
    const [dd, mm, yyyy] = parts.map((p) => parseInt(p, 10));
    const birthDate = new Date(yyyy, mm - 1, dd);
    if (isNaN(birthDate.getTime()) || birthDate.getDate() !== dd) return null; // rejects e.g. 31/02
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
  };

  // AORANE is 18+ only — no parental-consent flow exists for a minor's
  // health data (DPDPA 2023 §9), so we block entirely: force logout and
  // let the root layout redirect back to the login/intro screen.
  const blockUnderageUser = () => {
    Alert.alert(
      "Age Restriction",
      "AORANE is only available to users who are 18 years or older. Your account has been deactivated.",
      [{ text: "OK", onPress: () => { logout(); } }],
      { cancelable: false }
    );
  };

  const handleNext = async () => {
    if (!canProceed) {
      Alert.alert(t("required"), t("nameGenderRequired"));
      return;
    }

    // Client-side age gate — checked first so an under-18 user is blocked
    // immediately without even making the API call.
    const age = calculateAgeFromDob(dob);
    if (age === null) {
      Alert.alert(t("required"), "Please enter a valid date of birth.");
      return;
    }
    if (age < 18) {
      blockUnderageUser();
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    try {
      const [dd, mm, yyyy] = dob.split("/");
      const isoDob = `${yyyy}-${mm}-${dd}`; // unambiguous format for the backend
      await api.updateProfile({
        fullName: name.trim(),
        dateOfBirth: isoDob,
        gender,
        bloodGroup: bloodGroup || undefined,
        workProfile: workProfile || undefined,
      });
      router.push("/(onboarding)/physical");
    } catch (e) {
      // Defense-in-depth: server independently re-validates age. If it
      // rejects for the same reason, treat it identically to the
      // client-side block above instead of showing a generic error.
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.startsWith("AGE_RESTRICTED")) {
        blockUnderageUser();
      } else {
        Alert.alert(t("error"), t("saveError"));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["#C8E9FA", "#D9F4EE", "#E8F4FF", "#D4F0F7"]}
        locations={[0, 0.3, 0.65, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.orb1, { backgroundColor: "#7DD3FC" }]} />
      <View style={[styles.orb2, { backgroundColor: "#6EE7B7" }]} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.stepRow}>
          {[1, 2, 3, 4, 5].map((s) => (
            <View key={s} style={styles.stepTrack}>
              {s === 1
                ? <LinearGradient colors={["#0077B6", "#1B998B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.stepFill} />
                : <View style={[styles.stepFill, { backgroundColor: "rgba(0,119,182,0.12)" }]} />
              }
            </View>
          ))}
        </View>
        <View style={styles.stepLabelRow}>
          <View style={[styles.stepPill, { backgroundColor: "rgba(0,119,182,0.1)", borderColor: "rgba(0,119,182,0.2)" }]}>
            <Text style={[styles.stepPillTxt, { color: "#0077B6", fontFamily: "Inter_600SemiBold" }]}>Step 1 of 5</Text>
          </View>
          <Text style={[styles.stepName, { color: "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular" }]}>{t("yourIntroLabel")}</Text>
        </View>
      </View>

      <Animated.View style={[{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Icon + Title */}
          <View style={styles.titleWrap}>
            <LinearGradient colors={["#0077B6", "#0EA5E9", "#1B998B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.titleIcon}>
              <Ionicons name="person" size={26} color="#FFF" />
            </LinearGradient>
            <Text style={[styles.title, { color: "#0A1628", fontFamily: "Inter_700Bold" }]}>{t("introTitle")}</Text>
            <Text style={[styles.subtitle, { color: "rgba(10,22,40,0.52)", fontFamily: "Inter_400Regular" }]}>
              {t("introSubtitle")}
            </Text>
          </View>

          {/* MANDATORY SECTION */}
          <View style={styles.sectionLabel}>
            <View style={[styles.requiredDot, { backgroundColor: "#EF4444" }]} />
            <Text style={[styles.sectionTxt, { color: "#EF4444", fontFamily: "Inter_600SemiBold" }]}>{t("requiredInfo")}</Text>
          </View>

          <LinearGradient
            colors={["rgba(255,255,255,0.95)", "rgba(186,230,253,0.5)", "rgba(167,243,208,0.4)"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.cardBorder}
          >
            <View style={[styles.cardInner, { backgroundColor: "rgba(255,255,255,0.55)" }]}>
              {Platform.OS === "ios"
                ? <BlurView intensity={60} tint={"light"} style={StyleSheet.absoluteFill} />
                : <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(255,255,255,0.4)" }]} />
              }
              <LinearGradient
                colors={["rgba(255,255,255,0.9)", "transparent"]}
                style={styles.topShimmer}
              />

              {/* Name */}
              <View style={styles.fieldWrap}>
                <View style={styles.fieldLabel}>
                  <Ionicons name="person-outline" size={13} color={"#0077B6"} />
                  <Text style={[styles.label, { color: "rgba(10,22,40,0.7)", fontFamily: "Inter_600SemiBold" }]}>{t("fullName")}</Text>
                </View>
                <TextInput
                  style={[styles.input, {
                    backgroundColor: focusedField === "name"
                      ? ("rgba(0,119,182,0.06)")
                      : ("rgba(255,255,255,0.7)"),
                    borderColor: focusedField === "name"
                      ? ("#0077B6")
                      : ("rgba(255,255,255,0.9)"),
                    color: "#0A1628",
                    fontFamily: "Inter_400Regular",
                  }]}
                  placeholder={t("fullNamePlaceholder")}
                  placeholderTextColor={"rgba(10,22,40,0.32)"}
                  value={name} onChangeText={setName}
                  onFocus={() => setFocusedField("name")} onBlur={() => setFocusedField(null)}
                  autoCapitalize="words" autoFocus
                />
              </View>

              {/* DOB */}
              <View style={styles.fieldWrap}>
                <View style={styles.fieldLabel}>
                  <Ionicons name="calendar-outline" size={13} color={"#0077B6"} />
                  <Text style={[styles.label, { color: "rgba(10,22,40,0.7)", fontFamily: "Inter_600SemiBold" }]}>{t("dobLabel")}</Text>
                </View>
                <TextInput
                  style={[styles.input, {
                    backgroundColor: focusedField === "dob"
                      ? ("rgba(0,119,182,0.06)")
                      : ("rgba(255,255,255,0.7)"),
                    borderColor: focusedField === "dob"
                      ? ("#0077B6")
                      : ("rgba(255,255,255,0.9)"),
                    color: "#0A1628",
                    fontFamily: "Inter_400Regular",
                  }]}
                  placeholder="DD/MM/YYYY"
                  placeholderTextColor={"rgba(10,22,40,0.32)"}
                  value={dob} onChangeText={handleDobChange}
                  onFocus={() => setFocusedField("dob")} onBlur={() => setFocusedField(null)}
                  keyboardType="numeric" maxLength={10}
                />
              </View>

              {/* Gender */}
              <View>
                <View style={styles.fieldLabel}>
                  <Ionicons name="people-outline" size={13} color={"#0077B6"} />
                  <Text style={[styles.label, { color: "rgba(10,22,40,0.7)", fontFamily: "Inter_600SemiBold" }]}>{t("genderLabel")}</Text>
                </View>
                <View style={styles.genderRow}>
                  {GENDERS.map((g) => {
                    const sel = gender === g.value;
                    return (
                      <TouchableOpacity key={g.value} onPress={() => { setGender(g.value); Haptics.selectionAsync(); }} activeOpacity={0.8} style={styles.genderWrap}>
                        {sel
                          ? <LinearGradient colors={["#0077B6", "#1B998B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.genderBtn}>
                              <Ionicons name={g.icon} size={16} color="#FFF" />
                              <Text style={[styles.genderTxt, { color: "#FFF", fontFamily: "Inter_600SemiBold" }]}>{g.label}</Text>
                            </LinearGradient>
                          : <View style={[styles.genderBtn, { backgroundColor: "rgba(255,255,255,0.7)", borderWidth: 1, borderColor: "rgba(255,255,255,0.9)" }]}>
                              <Ionicons name={g.icon} size={16} color={"#0077B6"} />
                              <Text style={[styles.genderTxt, { color: "#0077B6", fontFamily: "Inter_500Medium" }]}>{g.label}</Text>
                            </View>
                        }
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          </LinearGradient>

          {/* OPTIONAL SECTION */}
          <View style={[styles.sectionLabel, { marginTop: 20 }]}>
            <View style={[styles.requiredDot, { backgroundColor: "#10B981" }]} />
            <Text style={[styles.sectionTxt, { color: "#059669", fontFamily: "Inter_600SemiBold" }]}>{t("optionalSection")}</Text>
          </View>

          <LinearGradient
            colors={["rgba(255,255,255,0.95)", "rgba(167,243,208,0.5)", "rgba(186,230,253,0.4)"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.cardBorder}
          >
            <View style={[styles.cardInner, { backgroundColor: "rgba(255,255,255,0.55)" }]}>
              {Platform.OS === "ios"
                ? <BlurView intensity={55} tint={"light"} style={StyleSheet.absoluteFill} />
                : <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(255,255,255,0.35)" }]} />
              }
              <LinearGradient
                colors={["rgba(255,255,255,0.9)", "transparent"]}
                style={styles.topShimmer}
              />

              {/* Blood Group */}
              <View style={[styles.fieldWrap, { marginBottom: 18 }]}>
                <View style={styles.fieldLabel}>
                  <Ionicons name="water-outline" size={13} color={"#EF4444"} />
                  <Text style={[styles.label, { color: "rgba(10,22,40,0.7)", fontFamily: "Inter_600SemiBold" }]}>{t("bloodGroup")}</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.chipRow}>
                    {BLOOD_GROUPS.map((bg) => {
                      const sel = bloodGroup === bg;
                      return (
                        <TouchableOpacity key={bg} onPress={() => { setBloodGroup(sel ? "" : bg); Haptics.selectionAsync(); }} activeOpacity={0.8}>
                          {sel
                            ? <LinearGradient colors={["#EF4444", "#F59E0B"]} style={styles.chip}>
                                <Text style={[styles.chipTxt, { color: "#FFF", fontFamily: "Inter_600SemiBold" }]}>{bg}</Text>
                              </LinearGradient>
                            : <View style={[styles.chip, { backgroundColor: "rgba(255,255,255,0.7)", borderWidth: 1, borderColor: "rgba(255,255,255,0.9)" }]}>
                                <Text style={[styles.chipTxt, { color: "#0A1628", fontFamily: "Inter_400Regular" }]}>{bg}</Text>
                              </View>
                          }
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>

              {/* Work Profile */}
              <View>
                <View style={styles.fieldLabel}>
                  <Ionicons name="briefcase-outline" size={13} color={"#7C3AED"} />
                  <Text style={[styles.label, { color: "rgba(10,22,40,0.7)", fontFamily: "Inter_600SemiBold" }]}>{t("workType")}</Text>
                </View>
                <View style={styles.workGrid}>
                  {WORK_PROFILES.map((wp) => {
                    const sel = workProfile === wp.value;
                    return (
                      <TouchableOpacity key={wp.value} onPress={() => { setWorkProfile(sel ? "" : wp.value); Haptics.selectionAsync(); }} activeOpacity={0.8} style={styles.workWrap}>
                        {sel
                          ? <LinearGradient colors={["#7C3AED", "#0077B6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.workBtn}>
                              <Ionicons name={wp.icon} size={18} color="#FFF" />
                              <Text style={[styles.workTxt, { color: "#FFF", fontFamily: "Inter_600SemiBold" }]}>{wp.value}</Text>
                            </LinearGradient>
                          : <View style={[styles.workBtn, { backgroundColor: "rgba(255,255,255,0.7)", borderWidth: 1, borderColor: "rgba(255,255,255,0.9)" }]}>
                              <Ionicons name={wp.icon} size={18} color={"#7C3AED"} />
                              <Text style={[styles.workTxt, { color: "#7C3AED", fontFamily: "Inter_500Medium" }]}>{wp.value}</Text>
                            </View>
                        }
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          </LinearGradient>

          {/* Privacy note */}
          <View style={[styles.privNote, { backgroundColor: "rgba(255,255,255,0.6)", borderColor: "rgba(255,255,255,0.88)" }]}>
            <Ionicons name="shield-checkmark" size={13} color={"#0077B6"} />
            <Text style={[styles.privTxt, { color: "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular" }]}>
              {t("privacyNote")}
            </Text>
          </View>
        </ScrollView>

        {/* CTA */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity onPress={handleNext} disabled={isLoading || !canProceed} activeOpacity={0.85} style={styles.ctaWrap}>
            <LinearGradient
              colors={canProceed
                ? ["#0077B6", "#0EA5E9", "#1B998B"]
                : (["rgba(0,0,0,0.06)", "rgba(0,0,0,0.04)"])}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.ctaBtn}
            >
              {isLoading
                ? <ActivityIndicator color="#FFF" />
                : <>
                    <Text style={[styles.ctaTxt, { color: canProceed ? "#FFF" : ("rgba(10,22,40,0.3)"), fontFamily: "Inter_700Bold" }]}>{t("continueBtn")}</Text>
                    <Ionicons name="arrow-forward" size={18} color={canProceed ? "#FFF" : ("rgba(10,22,40,0.3)")} />
                  </>
              }
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  orb1: { position: "absolute", width: 350, height: 350, borderRadius: 175, top: -110, right: -100, opacity: 0.48 },
  orb2: { position: "absolute", width: 280, height: 280, borderRadius: 140, bottom: 60, left: -85, opacity: 0.42 },
  header: { paddingHorizontal: 22, marginBottom: 4 },
  stepRow: { flexDirection: "row", gap: 6, marginBottom: 8 },
  stepTrack: { flex: 1, height: 5, borderRadius: 3, overflow: "hidden" },
  stepFill: { flex: 1, height: 5, borderRadius: 3 },
  stepLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stepPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  stepPillTxt: { fontSize: 12 },
  stepName: { fontSize: 12 },
  scroll: { paddingHorizontal: 22, paddingTop: 4, paddingBottom: 24 },
  titleWrap: { alignItems: "center", marginBottom: 20 },
  titleIcon: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  title: { fontSize: 22, marginBottom: 5, textAlign: "center" },
  subtitle: { fontSize: 13, textAlign: "center", lineHeight: 18 },
  sectionLabel: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  requiredDot: { width: 7, height: 7, borderRadius: 3.5 },
  sectionTxt: { fontSize: 12 },
  cardBorder: { borderRadius: 24, padding: 1.5, marginBottom: 4 },
  cardInner: { borderRadius: 23, overflow: "hidden", padding: 18 },
  topShimmer: { position: "absolute", top: 0, left: 0, right: 0, height: 50 },
  fieldWrap: { marginBottom: 14 },
  fieldLabel: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  label: { fontSize: 13 },
  input: { borderWidth: 1.5, borderRadius: 14, height: 50, paddingHorizontal: 16, fontSize: 15 },
  genderRow: { flexDirection: "row", gap: 8 },
  genderWrap: { flex: 1, borderRadius: 14, overflow: "hidden" },
  genderBtn: { paddingVertical: 12, alignItems: "center", justifyContent: "center", borderRadius: 14, flexDirection: "row", gap: 5 },
  genderTxt: { fontSize: 14 },
  chipRow: { flexDirection: "row", gap: 8, paddingVertical: 2 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
  chipTxt: { fontSize: 14 },
  workGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  workWrap: { borderRadius: 14, overflow: "hidden" },
  workBtn: { paddingHorizontal: 14, paddingVertical: 11, alignItems: "center", justifyContent: "center", borderRadius: 14, flexDirection: "row", gap: 6 },
  workTxt: { fontSize: 13 },
  privNote: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1, marginTop: 14 },
  privTxt: { fontSize: 11, flex: 1, lineHeight: 16 },
  footer: { paddingHorizontal: 22, paddingTop: 8 },
  ctaWrap: { borderRadius: 16, overflow: "hidden" },
  ctaBtn: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  ctaTxt: { fontSize: 17 },
});
