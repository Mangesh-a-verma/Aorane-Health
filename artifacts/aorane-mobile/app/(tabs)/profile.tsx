import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Switch, Alert, Platform, Dimensions, Modal, ActivityIndicator, RefreshControl,
} from "react-native";
import AoraneLogo from "@/components/AoraneLogo";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { DS } from "@/lib/theme";
import {
  Briefcase, Heart, Shield, User, Users, Bell, Diamond,
  HelpCircle, LogOut, ChevronRight, Lock, Pencil, Trash2, Globe, X,
} from "lucide-react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "@/context/LanguageContext";
import { LANGUAGE_NAMES, type LangCode } from "@/lib/translations";
import { LanguagePickerList, ENGLISH_LABEL } from "@/components/LanguagePickerList";
import { MULTI_LANGUAGE_ENABLED } from "@/constants/features";

const { width: W } = Dimensions.get("window");
const P = DS.color.primary;
const G = DS.color.green;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<Record<string, unknown>>({});
  const [privacy, setPrivacy] = useState<Record<string, boolean>>({});
  // Only gates the very first load — loadProfile() is also re-run on every
  // focus (see useFocusEffect below), and we don't want the whole screen
  // to flash back to a spinner every time the user switches back to this
  // tab, only on the initial mount before any data has ever loaded.
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const { lang, setLang } = useLanguage();
  const [showLanguageModal, setShowLanguageModal] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const [p, priv] = await Promise.allSettled([api.getProfile(), api.getPrivacy()]);
      if (p.status === "fulfilled")    setProfile(p.value.profile as Record<string, unknown>);
      if (priv.status === "fulfilled") setPrivacy(priv.value.privacy as Record<string, boolean>);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadProfile(); }, []);

  useFocusEffect(useCallback(() => {
    loadProfile();
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [loadProfile]));

  const togglePrivacy = async (key: string, value: boolean) => {
    const previous = privacy[key];
    setPrivacy((p) => ({ ...p, [key]: value }));
    try {
      await api.updatePrivacy({ [key]: value });
    } catch {
      // BUG FIX: this used to fail silently, leaving the switch showing
      // the NEW value while the server still had the OLD one — the UI
      // was lying about what got saved. Revert the optimistic update and
      // tell the user.
      setPrivacy((p) => ({ ...p, [key]: previous }));
      Alert.alert("Couldn't save", "Failed to update this privacy setting. Please check your connection and try again.");
    }
  };

  const handleLogout = () => {
    if (Platform.OS === "web") {
      if (window.confirm("Are you sure you want to log out?")) {
        logout().then(() => router.replace("/(auth)/login"));
      }
    } else {
      Alert.alert("Logout", "Are you sure you want to log out?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout", style: "destructive", onPress: async () => {
            await logout();
            router.replace("/(auth)/login");
          },
        },
      ]);
    }
  };

  const topPad  = insets.top;
  const heightVal = profile.height_cm ?? profile.heightCm;
  const weightVal = profile.weight_kg ?? profile.weightKg;
  const bmi     = heightVal && weightVal
    ? (Number(weightVal) / Math.pow(Number(heightVal) / 100, 2)).toFixed(1) : null;
  const phone   = (user as Record<string, unknown>)?.phone as string;
  const name    = (profile.full_name as string) || (profile.fullName as string) || "Aorane User";
  const plan    = ((user as Record<string, unknown>)?.plan as string || "free").toUpperCase();
  const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const privacyItems = [
    { key: "shareBasicProfile",   label: "Basic Profile",    desc: "Name and photo",      icon: "person-outline"   as const, sensitive: false },
    { key: "shareBmi",            label: "BMI & Weight",     desc: "Physical data",       icon: "barbell-outline"  as const, sensitive: false },
    { key: "shareExerciseData",   label: "Exercise",         desc: "Activity logs",       icon: "bicycle-outline"  as const, sensitive: false },
    { key: "shareFoodData",       label: "Food Data",        desc: "Diet logs",           icon: "restaurant-outline" as const, sensitive: false },
    { key: "shareSleepData",      label: "Sleep Data",       desc: "Sensitive — OFF",     icon: "moon-outline"     as const, sensitive: true },
    { key: "shareStressLevel",    label: "Stress Level",     desc: "Sensitive — OFF",     icon: "pulse-outline"    as const, sensitive: true },
    { key: "shareMedicineDetails",label: "Medicine Details", desc: "Sensitive — OFF",     icon: "medical-outline"  as const, sensitive: true },
  ];

  if (isLoading) {
    return (
      <View style={[s.root, { alignItems: "center", justifyContent: "center" }]}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: DS.color.bgSoft }]} />
        <ActivityIndicator size="large" color={DS.color.primary} />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: DS.color.bgSoft }]} />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadProfile(); }} tintColor={P} colors={[P]} />
        }
      >
        {/* ── Hero section ── */}
        <LinearGradient
          colors={["#0668AD", "#0B84D6", "#38B6FF"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={[s.heroGrad, { paddingTop: topPad + 20 }]}
        >
          {/* Edit button top-right */}
          <TouchableOpacity
            onPress={() => router.push("/edit-profile" as never)}
            activeOpacity={0.8}
            style={[s.editProfileBtn, { top: topPad + 12 }]}
          >
            <Pencil size={14} color="#FFF" strokeWidth={2} />
            <Text style={s.editProfileBtnText}>Edit</Text>
          </TouchableOpacity>

          <LinearGradient colors={[P, G]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.avatar}>
            <Text style={s.avatarText}>{initials}</Text>
          </LinearGradient>
          <Text style={s.heroName}>{name}</Text>
          {phone ? <Text style={s.heroPhone}>+91 {phone}</Text> : null}
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
            <LinearGradient colors={[DS.color.purple, P]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.planBadge}>
              <Diamond size={12} color="#FFF" strokeWidth={2} />
              <Text style={s.planText}>{plan} Plan</Text>
            </LinearGradient>
            {/* Show quick stats inline if available */}
            {(profile.blood_group || profile.bloodGroup) ? (
              <View style={s.heroBadge}>
                <Text style={s.heroBadgeText}>🩸 {String(profile.blood_group || profile.bloodGroup)}</Text>
              </View>
            ) : null}
            {profile.city ? (
              <View style={s.heroBadge}>
                <Text style={s.heroBadgeText}>📍 {String(profile.city)}</Text>
              </View>
            ) : null}
          </View>
        </LinearGradient>

        <View style={s.body}>
          {/* ── Body stats ── */}
          {bmi ? (
            <TouchableOpacity onPress={() => router.push("/edit-profile" as never)} activeOpacity={0.9}>
              <View style={s.statsRow}>
                {[
                  { label: "Height", value: `${heightVal}`, unit: "cm",  color: DS.color.sky    },
                  { label: "Weight", value: `${weightVal}`, unit: "kg",  color: DS.color.primary },
                  { label: "BMI",    value: bmi,            unit: "",    color: G               },
                  { label: "Blood",  value: (profile.blood_group || profile.bloodGroup) as string || "--", unit: "", color: DS.color.red },
                ].map((item) => (
                  <View key={item.label} style={s.statCard}>
                    <Text style={[s.statNum, { color: item.color }]}>{item.value}</Text>
                    {item.unit ? <Text style={s.statUnit}>{item.unit}</Text> : null}
                    <Text style={s.statLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          ) : (
            /* Prompt to fill profile */
            <TouchableOpacity
              onPress={() => router.push("/edit-profile" as never)}
              activeOpacity={0.87}
            >
              <LinearGradient
                colors={["#F5F9FF", "#EAF3FC"]}
                style={s.completeCard}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.completeTitle}>📋 Complete Your Profile</Text>
                  <Text style={s.completeDesc}>
                    Add your height, weight, blood group, and age to get your BMI, personalised health score, and AI recommendations.
                  </Text>
                  <View style={[s.completeCta, { marginTop: 10 }]}>
                    <Text style={s.completeCtaText}>Fill Details Now →</Text>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* ── Medical Emergency ── */}
          <TouchableOpacity onPress={() => router.push("/medical-emergency" as never)} activeOpacity={0.85}>
            <View style={s.emergencyCard}>
              <View style={s.emergencyIcon}>
                <Text style={{ fontSize: 26 }}>🚑</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.emergencyTitle}>Medical Emergency</Text>
                <Text style={s.emergencyDesc}>Blood Emergency (Live) · Accident Emergency (Coming Soon)</Text>
              </View>
              <ChevronRight size={20} color={DS.color.red} strokeWidth={2} />
            </View>
          </TouchableOpacity>

          {/* ── Work & Lifestyle ── */}
          <View style={s.section}>
            <View style={s.sectionHead}>
              <View style={[s.sectionIcon, { backgroundColor: DS.color.primarySoft }]}>
                <Briefcase size={16} color={DS.color.primary} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.sectionTitle}>Work & Lifestyle</Text>
                <Text style={s.sectionSub}>For calorie & health calculations</Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push("/edit-work-profile" as never)}
                style={s.editBtn}
              >
                <Text style={s.editBtnText}>Edit</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              {(profile.work_profile || profile.workProfile) ? (
                <View style={[s.chip, { backgroundColor: DS.color.primarySoft, borderColor: DS.color.primary + "30" }]}>
                  <Ionicons name="briefcase-outline" size={13} color={DS.color.primary} />
                  <Text style={[s.chipText, { color: DS.color.primary }]}>{(profile.work_profile || profile.workProfile) as string}</Text>
                </View>
              ) : (
                <TouchableOpacity style={[s.chip, { backgroundColor: DS.color.primarySoft, borderColor: P + "25" }]}
                  onPress={() => router.push("/edit-work-profile" as never)}>
                  <Ionicons name="add-circle-outline" size={13} color={P} />
                  <Text style={[s.chipText, { color: P }]}>Add Work Profile</Text>
                </TouchableOpacity>
              )}
              {(profile.activity_level || profile.activityLevel) ? (
                <View style={[s.chip, { backgroundColor: DS.color.greenSoft, borderColor: G + "30" }]}>
                  <Ionicons name="fitness-outline" size={13} color={G} />
                  <Text style={[s.chipText, { color: G }]}>
                    {({ sedentary: "Sedentary", light: "Light Active", moderate: "Moderate", very: "Very Active", athlete: "Athlete" } as Record<string, string>)[(profile.activity_level || profile.activityLevel) as string] || (profile.activity_level || profile.activityLevel) as string}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={s.tipText}>
              💡 Work profile helps AI calculate exact calorie needs — field workers need more, office jobs need less
            </Text>
          </View>

          {/* ── Period Tracker (female only) ── */}
          {profile.gender === "female" && (
            <View style={s.section}>
              <View style={s.sectionHead}>
                <View style={[s.sectionIcon, { backgroundColor: "#FF2D5515" }]}>
                  <Heart size={16} color="#FF2D55" strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.sectionTitle}>Women's Health</Text>
                  <Text style={s.sectionSub}>Cycle tracking & predictions</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => router.push("/period" as never)}
                style={s.menuRow}
              >
                <View style={[s.menuEmoji, { backgroundColor: "#FF2D5515" }]}>
                  <Text style={{ fontSize: 18 }}>🌸</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.menuLabel}>Period Tracker</Text>
                  <Text style={s.menuDesc}>Cycle log + AI prediction + symptoms</Text>
                </View>
                <ChevronRight size={16} color={DS.color.muted} strokeWidth={1.8} />
              </TouchableOpacity>
            </View>
          )}

          {/* ── Privacy ── */}
          <View style={s.section}>
            <View style={s.sectionHead}>
              <View style={[s.sectionIcon, { backgroundColor: DS.color.primarySoft }]}>
                <Shield size={16} color={P} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.sectionTitle}>Privacy Settings</Text>
                <Text style={s.sectionSub}>You decide what to share</Text>
              </View>
            </View>
            {privacyItems.map((item, idx) => (
              <View key={item.key} style={[s.privacyRow, idx > 0 && s.menuBorder]}>
                <View style={[s.menuEmoji, {
                  backgroundColor: item.sensitive ? DS.color.redSoft : DS.color.primarySoft,
                }]}>
                  {item.sensitive
                    ? <Lock size={14} color={DS.color.red} strokeWidth={2} />
                    : <Ionicons name={item.icon} size={14} color={P} />
                  }
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.menuLabel}>{item.label}</Text>
                  <Text style={s.menuDesc}>{item.desc}</Text>
                </View>
                <Switch
                  value={!!privacy[item.key]}
                  onValueChange={(v) => togglePrivacy(item.key, v)}
                  trackColor={{ false: DS.color.bgSoft, true: P + "60" }}
                  thumbColor={privacy[item.key] ? P : "#C7C7CC"}
                  ios_backgroundColor={DS.color.bgSoft}
                />
              </View>
            ))}
          </View>

          {/* ── Account ── */}
          <View style={s.section}>
            <View style={s.sectionHead}>
              <View style={[s.sectionIcon, { backgroundColor: DS.color.purpleSoft }]}>
                <User size={16} color={DS.color.purple} strokeWidth={2} />
              </View>
              <Text style={s.sectionTitle}>Account</Text>
            </View>
            {[
              { Icon: Diamond,    label: "Upgrade Plan",              color: DS.color.purple, bg: DS.color.purpleSoft, onPress: () => router.push("/upgrade" as never) },
              { Icon: Briefcase,  label: "Join Organization",         color: "#0077B6",       bg: "#EBF5FB",            onPress: () => router.push("/enrollment" as never) },
              { Icon: Users,      label: "Family Health",             color: "#10B981",       bg: "#ECFDF5",            onPress: () => router.push("/family" as never) },
              { Icon: Shield,     label: "Privacy & Security",        color: DS.color.primary, bg: DS.color.primarySoft, onPress: () => router.push("/privacy-security" as never) },
              // Language picker is hidden while multi-language is off — see
              // constants/features.ts. Spread rather than render-and-disable,
              // so the row leaves no gap and the separator borders stay right.
              ...(MULTI_LANGUAGE_ENABLED
                ? [{ Icon: Globe, label: `Language — ${ENGLISH_LABEL[lang]}`, color: "#8B5CF6", bg: "#F3E8FF", onPress: () => setShowLanguageModal(true) }]
                : []),
              { Icon: Bell,       label: "Notifications & Reminders", color: P,               bg: DS.color.primarySoft, onPress: () => router.push("/notification-settings" as never) },
              { Icon: HelpCircle, label: "Help & Support",            color: G,               bg: DS.color.greenSoft,   onPress: () => router.push("/help" as never) },
            ].map((item, idx) => (
              <TouchableOpacity
                key={item.label}
                onPress={item.onPress}
                style={[s.menuRow, idx > 0 && s.menuBorder]}
              >
                <View style={[s.menuEmoji, { backgroundColor: item.bg }]}>
                  <item.Icon size={16} color={item.color} strokeWidth={2} />
                </View>
                <Text style={[s.menuLabel, { flex: 1 }]}>{item.label}</Text>
                <ChevronRight size={16} color={DS.color.muted} strokeWidth={1.8} />
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => router.push("/delete-account" as never)}
              style={[s.menuRow, s.menuBorder]}
            >
              <View style={[s.menuEmoji, { backgroundColor: DS.color.redSoft }]}>
                <Trash2 size={16} color={DS.color.red} strokeWidth={2} />
              </View>
              <Text style={[s.menuLabel, { color: DS.color.red, flex: 1 }]}>Delete My Account</Text>
              <ChevronRight size={16} color={DS.color.red} strokeWidth={1.8} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleLogout}
              style={[s.menuRow, s.menuBorder]}
            >
              <View style={[s.menuEmoji, { backgroundColor: DS.color.redSoft }]}>
                <LogOut size={16} color={DS.color.red} strokeWidth={2} />
              </View>
              <Text style={[s.menuLabel, { color: DS.color.red, flex: 1 }]}>Logout</Text>
              <ChevronRight size={16} color={DS.color.red} strokeWidth={1.8} />
            </TouchableOpacity>
          </View>

          {/* ── Footer ── */}
          <View style={s.footer}>
            <AoraneLogo width={140} />
            <Text style={s.version}>Aorane v1.0.0</Text>
            <Text style={s.tagline}>Privacy-First Health Platform</Text>
          </View>
        </View>
      </ScrollView>

      {/* Language Picker Modal — nothing can open it while multi-language is
          off (the row that sets showLanguageModal is hidden), but gate the
          visibility too so a stale state value can never surface it. */}
      <Modal
        visible={MULTI_LANGUAGE_ENABLED && showLanguageModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <View style={langModalStyles.root}>
          <View style={langModalStyles.header}>
            <Text style={langModalStyles.title}>Language</Text>
            <TouchableOpacity onPress={() => setShowLanguageModal(false)} style={langModalStyles.closeBtn}>
              <X size={20} color={DS.color.text} strokeWidth={2} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
            <LanguagePickerList
              selected={lang}
              onSelect={async (code: LangCode) => {
                await setLang(code);
                setShowLanguageModal(false);
              }}
            />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const langModalStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: DS.color.borderLight,
  },
  title: { fontSize: 18, fontFamily: "Inter_700Bold", color: DS.color.text },
  closeBtn: { padding: 4 },
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: DS.color.bgSoft },

  // Hero
  heroGrad:    { alignItems: "center", paddingBottom: 28, paddingHorizontal: 16 },
  editProfileBtn: {
    position: "absolute", top: 16, right: 16,
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(255,255,255,0.22)", borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  editProfileBtnText: { color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 13 },
  heroBadge:   { backgroundColor: "rgba(255,255,255,0.20)", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5 },
  heroBadgeText: { color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 12 },
  avatar:      { width: 90, height: 90, borderRadius: 45, alignItems: "center", justifyContent: "center", marginBottom: 14, ...DS.shadow.lg },
  avatarText:  { fontSize: 32, fontFamily: "Inter_700Bold", color: "#FFF" },
  heroName:    { fontSize: 22, fontFamily: "Inter_700Bold", color: "#FFF", marginBottom: 4 },
  heroPhone:   { fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.80)", marginBottom: 12 },
  planBadge:   { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  planText:    { color: "#FFF", fontSize: 12, fontFamily: "Inter_600SemiBold" },

  // Complete profile card
  completeCard:      { borderRadius: DS.radius.xl, padding: 18, borderWidth: 1.5, borderColor: DS.color.primary + "30", ...DS.shadow.sm },
  completeTitle:     { fontSize: 16, fontFamily: "Inter_700Bold", color: DS.color.primary, marginBottom: 6 },
  completeDesc:      { fontSize: 13, fontFamily: "Inter_400Regular", color: DS.color.muted, lineHeight: 19 },
  completeCta:       { backgroundColor: DS.color.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, alignSelf: "flex-start" },
  completeCtaText:   { color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 13 },

  body: { paddingHorizontal: 16, gap: 12 },

  // Stats
  statsRow: { flexDirection: "row", gap: 8 },
  statCard: {
    flex: 1, backgroundColor: "#FFF", borderRadius: DS.radius.md, padding: 12,
    alignItems: "center", gap: 2,
    borderWidth: 1, borderColor: DS.color.border, ...DS.shadow.sm,
  },
  statNum:   { fontSize: 18, fontFamily: "Inter_700Bold" },
  statUnit:  { fontSize: 10, fontFamily: "Inter_400Regular", color: DS.color.muted, marginTop: -2 },
  statLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: DS.color.muted, marginTop: 2 },

  // Emergency card
  emergencyCard: {
    backgroundColor: "#FFF", borderRadius: DS.radius.lg,
    padding: 16, flexDirection: "row", alignItems: "center", gap: 14,
    borderWidth: 1.5, borderColor: DS.color.red + "25",
    borderLeftWidth: 4, borderLeftColor: DS.color.red,
    ...DS.shadow.sm,
  },
  emergencyIcon:  { width: 50, height: 50, borderRadius: 14, backgroundColor: DS.color.redSoft, alignItems: "center", justifyContent: "center" },
  emergencyTitle: { color: DS.color.red, fontFamily: "Inter_700Bold", fontSize: 15 },
  emergencyDesc:  { color: DS.color.muted, fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2 },

  // Section card
  section: {
    backgroundColor: "#FFF", borderRadius: DS.radius.xl, padding: 16,
    borderWidth: 1, borderColor: DS.color.border, ...DS.shadow.sm,
  },
  sectionHead:  { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  sectionIcon:  { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: DS.color.text },
  sectionSub:   { fontSize: 11, fontFamily: "Inter_400Regular", color: DS.color.muted, marginTop: 2 },
  editBtn:      { backgroundColor: DS.color.primarySoft, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  editBtnText:  { fontSize: 12, fontFamily: "Inter_600SemiBold", color: P },

  // Chips
  chip:     { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  chipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  tipText:  { fontSize: 11, fontFamily: "Inter_400Regular", color: DS.color.muted, lineHeight: 16 },

  // Menu rows
  menuRow:    { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11 },
  menuBorder: { borderTopWidth: 1, borderTopColor: DS.color.borderLight },
  menuEmoji:  { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  menuLabel:  { fontSize: 14, fontFamily: "Inter_600SemiBold", color: DS.color.text },
  menuDesc:   { fontSize: 11, fontFamily: "Inter_400Regular", color: DS.color.muted, marginTop: 1 },

  // Privacy
  privacyRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11 },

  // Footer
  footer:     { alignItems: "center", marginTop: 16, paddingBottom: 8, gap: 5 },
  footerLogo: { width: 110, height: 38, opacity: 0.3 },
  version:    { fontSize: 12, fontFamily: "Inter_400Regular", color: DS.color.muted },
  tagline:    { fontSize: 11, fontFamily: "Inter_400Regular", color: DS.color.muted, opacity: 0.7 },
});