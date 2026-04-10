import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, TextInput,
  Alert, ActivityIndicator, useColorScheme, Platform, Linking,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { api } from "@/lib/api";
import { sendImmediateNotification } from "@/lib/notifications";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

const URGENCY_CONFIG = {
  critical: { label: "Critical (2-4 hrs)", color: "#DC2626", bg: "rgba(220,38,38,0.12)", icon: "alert-circle" as const },
  urgent:   { label: "Urgent (24 hrs)",    color: "#F59E0B", bg: "rgba(245,158,11,0.12)", icon: "time" as const },
  routine:  { label: "Routine (3-7 days)", color: "#10B981", bg: "rgba(16,185,129,0.12)", icon: "calendar" as const },
};

type EmergencyRequest = {
  id: string;
  bloodGroupNeeded?: string; bloodGroup?: string;
  unitsNeeded: number;
  hospitalName: string;
  hospitalCity?: string; city?: string;
  contactPhone?: string;
  urgency?: string;
  notes?: string;
  createdAt?: string; status?: string;
};

export default function BloodEmergencyScreen() {
  const isDark = useColorScheme() === "dark";
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<"find" | "donate" | "request">("find");
  const [loading, setLoading] = useState(false);
  const [emergencies, setEmergencies] = useState<EmergencyRequest[]>([]);

  // Find donors state
  const [searchBloodGroup, setSearchBloodGroup] = useState("O+");
  const [searchCity, setSearchCity] = useState("");
  const [donors, setDonors] = useState<Array<{ id: string; bloodGroup: string; city: string; state: string; phone?: string; isAvailable: boolean }>>([]);
  const [searching, setSearching] = useState(false);

  // Donate state
  const [donorBloodGroup, setDonorBloodGroup] = useState("O+");
  const [donorCity, setDonorCity] = useState("");
  const [donorState, setDonorState] = useState("");
  const [donorPhone, setDonorPhone] = useState("");
  const [donorSubmitting, setDonorSubmitting] = useState(false);

  // Request state
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [reqBloodGroup, setReqBloodGroup] = useState("O+");
  const [reqUnits, setReqUnits] = useState("2");
  const [reqHospital, setReqHospital] = useState("");
  const [reqCity, setReqCity] = useState("");
  const [reqState, setReqState] = useState("");
  const [reqPhone, setReqPhone] = useState("");
  const [reqUrgency, setReqUrgency] = useState<"critical" | "urgent" | "routine">("urgent");
  const [reqNotes, setReqNotes] = useState("");
  const [reqSubmitting, setReqSubmitting] = useState(false);

  useEffect(() => { loadEmergencies(); }, []);

  const loadEmergencies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getBloodEmergencies();
      setEmergencies(res.requests as EmergencyRequest[]);
    } catch { }
    setLoading(false);
  }, []);

  const searchDonors = async () => {
    if (!searchCity.trim()) { Alert.alert("Required", "City naam enter karein"); return; }
    setSearching(true);
    try {
      const res = await api.getBloodDonors(searchBloodGroup, searchCity.trim());
      setDonors(res.donors);
      if (!res.donors.length) Alert.alert("No donors", `${searchCity} mein ${searchBloodGroup} donors nahi mile`);
    } catch { Alert.alert("Error", "Donors nahi mil sake"); }
    setSearching(false);
  };

  const registerDonor = async () => {
    if (!donorCity.trim() || !donorState.trim()) { Alert.alert("Required", "City aur state bharo"); return; }
    setDonorSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      await api.registerBloodDonor({ bloodGroup: donorBloodGroup, city: donorCity.trim(), state: donorState.trim(), phone: donorPhone.trim() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert("✅ Registered!", "Aap blood donor ke roop mein register ho gaye hain. Thank you! 🙏");
      setDonorCity(""); setDonorState(""); setDonorPhone("");
    } catch (e) { Alert.alert("Error", (e as Error).message || "Registration fail hua"); }
    setDonorSubmitting(false);
  };

  const submitEmergencyRequest = async () => {
    if (!reqHospital.trim() || !reqCity.trim() || !reqPhone.trim()) {
      Alert.alert("Required", "Hospital, city aur phone number bharo");
      return;
    }
    setReqSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    try {
      await api.createBloodEmergency({
        bloodGroup: reqBloodGroup,
        unitsNeeded: parseInt(reqUnits) || 2,
        hospitalName: reqHospital.trim(),
        city: reqCity.trim(),
        state: reqState.trim(),
        contactPhone: reqPhone.trim(),
        urgency: reqUrgency,
        notes: reqNotes.trim() || undefined,
      });
      await sendImmediateNotification(
        "🆘 Blood Emergency Alert",
        `${reqBloodGroup} blood ki zaroorat hai — ${reqHospital}, ${reqCity}`
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setShowRequestModal(false);
      setReqHospital(""); setReqCity(""); setReqState(""); setReqPhone(""); setReqNotes("");
      Alert.alert("🆘 Emergency Posted!", "Blood emergency alert sab donors ko bhej diya gaya hai");
      await loadEmergencies();
    } catch (e) { Alert.alert("Error", (e as Error).message || "Request post nahi hua"); }
    setReqSubmitting(false);
  };

  const callPhone = (phone?: string) => {
    if (!phone) { Alert.alert("No phone", "Phone number available nahi hai"); return; }
    Linking.openURL(`tel:${phone}`).catch(() => Alert.alert("Error", "Call nahi ho saka"));
  };

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? "#010814" : "#FFF5F5" }}>
      {/* Header */}
      <LinearGradient
        colors={["#DC2626", "#B91C1C"]}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>🩸 Blood Emergency</Text>
            <Text style={styles.headerSub}>Donate Blood, Save Lives</Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowRequestModal(true)}
            style={[styles.sosBtn]}
          >
            <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 12 }}>🆘 SOS</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabRow}>
          {(["find", "donate", "request"] as const).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => { setTab(t); Haptics.selectionAsync().catch(() => {}); }}
              style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            >
              <Text style={[styles.tabBtnText, { color: tab === t ? "#DC2626" : "rgba(255,255,255,0.7)" }]}>
                {t === "find" ? "🔍 Find Donor" : t === "donate" ? "❤️ Donate" : "📋 Requests"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>

        {/* ─── FIND DONOR TAB ─── */}
        {tab === "find" && (
          <View style={{ gap: 12 }}>
            <View style={[styles.card, { backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "#FFF", borderColor: isDark ? "rgba(255,255,255,0.08)" : "#FFE4E4" }]}>
              <Text style={[styles.cardTitle, { color: isDark ? "#F0F8FF" : "#1a1a2e" }]}>Blood Group Chunein</Text>
              <View style={styles.bloodGroupGrid}>
                {BLOOD_GROUPS.map((g) => (
                  <TouchableOpacity
                    key={g}
                    onPress={() => setSearchBloodGroup(g)}
                    style={[styles.bloodGroupBtn, { backgroundColor: searchBloodGroup === g ? "#DC2626" : (isDark ? "rgba(255,255,255,0.06)" : "#FFF5F5"), borderColor: searchBloodGroup === g ? "#DC2626" : (isDark ? "rgba(255,255,255,0.1)" : "#FECACA") }]}
                  >
                    <Text style={{ color: searchBloodGroup === g ? "#FFF" : (isDark ? "#F87171" : "#DC2626"), fontFamily: "Inter_700Bold", fontSize: 15 }}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                value={searchCity}
                onChangeText={setSearchCity}
                placeholder="City enter karein (e.g. Mumbai)"
                placeholderTextColor={isDark ? "rgba(255,255,255,0.3)" : "#9CA3AF"}
                style={[styles.input, { color: isDark ? "#F0F8FF" : "#0A1628", backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#FFF5F5", borderColor: isDark ? "rgba(255,255,255,0.1)" : "#FECACA" }]}
              />

              <TouchableOpacity onPress={searchDonors} disabled={searching} activeOpacity={0.85}>
                <LinearGradient colors={["#DC2626", "#B91C1C"]} style={styles.actionBtn}>
                  {searching ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name="search" size={18} color="#FFF" />}
                  <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 15 }}>{searching ? "Dhundh rahe hain..." : "Donors Dhundein"}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {donors.map((d, i) => (
              <View key={i} style={[styles.card, { backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "#FFF", borderColor: isDark ? "rgba(255,255,255,0.08)" : "#FFE4E4" }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <LinearGradient colors={["#DC2626", "#B91C1C"]} style={styles.bloodBadge}>
                    <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 16 }}>{d.bloodGroup}</Text>
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: isDark ? "#F0F8FF" : "#1a1a2e", fontFamily: "Inter_600SemiBold", fontSize: 15 }}>{d.bloodGroup} Donor</Text>
                    <Text style={{ color: isDark ? "rgba(255,255,255,0.45)" : "rgba(10,22,40,0.5)", fontSize: 13, fontFamily: "Inter_400Regular" }}>{d.city}, {d.state}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 6 }}>
                    <View style={[styles.availBadge, { backgroundColor: d.isAvailable ? "rgba(16,185,129,0.15)" : "rgba(156,163,175,0.15)" }]}>
                      <View style={[styles.availDot, { backgroundColor: d.isAvailable ? "#10B981" : "#9CA3AF" }]} />
                      <Text style={{ color: d.isAvailable ? "#10B981" : "#9CA3AF", fontSize: 11, fontFamily: "Inter_600SemiBold" }}>{d.isAvailable ? "Available" : "Busy"}</Text>
                    </View>
                    {d.phone && (
                      <TouchableOpacity onPress={() => callPhone(d.phone)} style={styles.callBtn}>
                        <Ionicons name="call" size={14} color="#FFF" />
                        <Text style={{ color: "#FFF", fontSize: 12, fontFamily: "Inter_600SemiBold" }}>Call</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ─── DONATE TAB ─── */}
        {tab === "donate" && (
          <View style={{ gap: 12 }}>
            <LinearGradient colors={["rgba(220,38,38,0.12)", "rgba(185,28,28,0.06)"]} style={[styles.card, { borderColor: "rgba(220,38,38,0.2)" }]}>
              <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                <Text style={{ fontSize: 28 }}>❤️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: isDark ? "#FCA5A5" : "#DC2626", fontFamily: "Inter_700Bold", fontSize: 16 }}>Blood Donate karke kisi ki jaan bachayein</Text>
                  <Text style={{ color: isDark ? "rgba(255,255,255,0.5)" : "rgba(10,22,40,0.55)", fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 4, lineHeight: 19 }}>Ek donation se 3 log jeete hain. Har 3 mahine mein donate kar sakte hain.</Text>
                </View>
              </View>
            </LinearGradient>

            <View style={[styles.card, { backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "#FFF", borderColor: isDark ? "rgba(255,255,255,0.08)" : "#FFE4E4" }]}>
              <Text style={[styles.cardTitle, { color: isDark ? "#F0F8FF" : "#1a1a2e" }]}>Apna Blood Group</Text>
              <View style={styles.bloodGroupGrid}>
                {BLOOD_GROUPS.map((g) => (
                  <TouchableOpacity
                    key={g}
                    onPress={() => setDonorBloodGroup(g)}
                    style={[styles.bloodGroupBtn, { backgroundColor: donorBloodGroup === g ? "#DC2626" : (isDark ? "rgba(255,255,255,0.06)" : "#FFF5F5"), borderColor: donorBloodGroup === g ? "#DC2626" : (isDark ? "rgba(255,255,255,0.1)" : "#FECACA") }]}
                  >
                    <Text style={{ color: donorBloodGroup === g ? "#FFF" : (isDark ? "#F87171" : "#DC2626"), fontFamily: "Inter_700Bold", fontSize: 15 }}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {[
                { value: donorCity, setter: setDonorCity, placeholder: "Aapka shehar (e.g. Delhi)" },
                { value: donorState, setter: setDonorState, placeholder: "State (e.g. Delhi)" },
                { value: donorPhone, setter: setDonorPhone, placeholder: "Mobile number (optional)" },
              ].map(({ value, setter, placeholder }, i) => (
                <TextInput
                  key={i}
                  value={value}
                  onChangeText={setter}
                  placeholder={placeholder}
                  placeholderTextColor={isDark ? "rgba(255,255,255,0.3)" : "#9CA3AF"}
                  keyboardType={i === 2 ? "phone-pad" : "default"}
                  style={[styles.input, { color: isDark ? "#F0F8FF" : "#0A1628", backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#FFF5F5", borderColor: isDark ? "rgba(255,255,255,0.1)" : "#FECACA" }]}
                />
              ))}

              <TouchableOpacity onPress={registerDonor} disabled={donorSubmitting} activeOpacity={0.85}>
                <LinearGradient colors={["#DC2626", "#B91C1C"]} style={styles.actionBtn}>
                  {donorSubmitting ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name="heart" size={18} color="#FFF" />}
                  <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 15 }}>{donorSubmitting ? "Registering..." : "Donor Register Karein"}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Eligibility tips */}
            <View style={[styles.card, { backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "#FFF", borderColor: isDark ? "rgba(255,255,255,0.08)" : "#FFE4E4" }]}>
              <Text style={[styles.cardTitle, { color: isDark ? "#F0F8FF" : "#1a1a2e", marginBottom: 10 }]}>Donate karne ke liye zaroorat</Text>
              {["Umra 18-65 saal ho", "Wajan kam se kam 50 kg ho", "Healthy ho, koi serious bimari na ho", "Haemoglobin 12.5 g/dL se zyada ho", "Pichle 3 mahine mein donate na kiya ho"].map((t, i) => (
                <View key={i} style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" style={{ marginTop: 1 }} />
                  <Text style={{ color: isDark ? "rgba(255,255,255,0.6)" : "rgba(10,22,40,0.65)", fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 }}>{t}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ─── REQUESTS TAB ─── */}
        {tab === "request" && (
          <View style={{ gap: 12 }}>
            <TouchableOpacity onPress={() => setShowRequestModal(true)} activeOpacity={0.85}>
              <LinearGradient colors={["#DC2626", "#B91C1C"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.actionBtn, { marginBottom: 4 }]}>
                <Ionicons name="add-circle-outline" size={18} color="#FFF" />
                <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 15 }}>Naya Emergency Request</Text>
              </LinearGradient>
            </TouchableOpacity>

            {loading ? (
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <ActivityIndicator color="#DC2626" size="large" />
              </View>
            ) : emergencies.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 40, gap: 10 }}>
                <Ionicons name="checkmark-circle" size={52} color="#10B981" />
                <Text style={{ color: isDark ? "#F0F8FF" : "#1a1a2e", fontFamily: "Inter_600SemiBold", fontSize: 17 }}>Koi active emergency nahi</Text>
                <Text style={{ color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontSize: 14, fontFamily: "Inter_400Regular" }}>Filhaal koi blood request nahi hai</Text>
              </View>
            ) : emergencies.map((req, i) => {
              const urgConf = URGENCY_CONFIG[(req.urgency as keyof typeof URGENCY_CONFIG)] || URGENCY_CONFIG.urgent;
              const displayBlood = req.bloodGroupNeeded || req.bloodGroup || "?";
              const displayCity = req.hospitalCity || req.city || "";
              return (
                <View key={i} style={[styles.card, { backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "#FFF", borderColor: urgConf.color + "40" }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <LinearGradient colors={["#DC2626", "#B91C1C"]} style={styles.bloodBadge}>
                      <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 16 }}>{displayBlood}</Text>
                    </LinearGradient>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: isDark ? "#F0F8FF" : "#1a1a2e", fontFamily: "Inter_600SemiBold", fontSize: 15 }}>{req.hospitalName}</Text>
                      <Text style={{ color: isDark ? "rgba(255,255,255,0.45)" : "rgba(10,22,40,0.5)", fontSize: 12, fontFamily: "Inter_400Regular" }}>{displayCity}</Text>
                    </View>
                    <View style={[styles.urgBadge, { backgroundColor: urgConf.bg }]}>
                      <Ionicons name={urgConf.icon} size={12} color={urgConf.color} />
                      <Text style={{ color: urgConf.color, fontSize: 10, fontFamily: "Inter_700Bold" }}>{req.urgency?.toUpperCase() || "URGENT"}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <View style={{ flex: 1, backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "#FFF5F5", borderRadius: 8, padding: 8, alignItems: "center" }}>
                      <Text style={{ color: "#DC2626", fontFamily: "Inter_700Bold", fontSize: 18 }}>{req.unitsNeeded}</Text>
                      <Text style={{ color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.45)", fontSize: 11, fontFamily: "Inter_400Regular" }}>Units</Text>
                    </View>
                    {req.notes ? <View style={{ flex: 2, backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "#FFF5F5", borderRadius: 8, padding: 8 }}>
                      <Text style={{ color: isDark ? "rgba(255,255,255,0.55)" : "rgba(10,22,40,0.6)", fontSize: 12, fontFamily: "Inter_400Regular" }}>{req.notes}</Text>
                    </View> : null}
                  </View>
                  {req.contactPhone && (
                    <TouchableOpacity onPress={() => callPhone(req.contactPhone)} activeOpacity={0.85} style={{ marginTop: 10 }}>
                      <LinearGradient colors={["#DC2626", "#B91C1C"]} style={[styles.callBtn, { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }]}>
                        <Ionicons name="call" size={16} color="#FFF" />
                        <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>Hospital Call Karein</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Emergency Request Modal */}
      <Modal visible={showRequestModal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: isDark ? "#010814" : "#FFF" }}>
          <LinearGradient colors={["#DC2626", "#B91C1C"]} style={{ padding: 20, paddingTop: insets.top + 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View>
              <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 20 }}>🆘 Blood Emergency</Text>
              <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontFamily: "Inter_400Regular" }}>Emergency blood request bhejein</Text>
            </View>
            <TouchableOpacity onPress={() => setShowRequestModal(false)} style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 20, padding: 8 }}>
              <Ionicons name="close" size={20} color="#FFF" />
            </TouchableOpacity>
          </LinearGradient>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
            <Text style={{ color: isDark ? "rgba(255,255,255,0.5)" : "rgba(10,22,40,0.5)", fontFamily: "Inter_600SemiBold", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>Blood Group</Text>
            <View style={styles.bloodGroupGrid}>
              {BLOOD_GROUPS.map((g) => (
                <TouchableOpacity key={g} onPress={() => setReqBloodGroup(g)} style={[styles.bloodGroupBtn, { backgroundColor: reqBloodGroup === g ? "#DC2626" : (isDark ? "rgba(255,255,255,0.06)" : "#FFF5F5"), borderColor: reqBloodGroup === g ? "#DC2626" : (isDark ? "rgba(255,255,255,0.1)" : "#FECACA") }]}>
                  <Text style={{ color: reqBloodGroup === g ? "#FFF" : (isDark ? "#F87171" : "#DC2626"), fontFamily: "Inter_700Bold", fontSize: 15 }}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={{ color: isDark ? "rgba(255,255,255,0.5)" : "rgba(10,22,40,0.5)", fontFamily: "Inter_600SemiBold", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 }}>Urgency</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(["critical", "urgent", "routine"] as const).map((u) => (
                <TouchableOpacity key={u} onPress={() => setReqUrgency(u)} style={[styles.urgBadge, { flex: 1, justifyContent: "center", paddingVertical: 10, backgroundColor: reqUrgency === u ? URGENCY_CONFIG[u].bg : (isDark ? "rgba(255,255,255,0.04)" : "#F9FAFB"), borderWidth: 1, borderColor: reqUrgency === u ? URGENCY_CONFIG[u].color : (isDark ? "rgba(255,255,255,0.1)" : "#E5E7EB") }]}>
                  <Text style={{ color: reqUrgency === u ? URGENCY_CONFIG[u].color : (isDark ? "rgba(255,255,255,0.5)" : "rgba(10,22,40,0.5)"), fontFamily: "Inter_600SemiBold", fontSize: 11, textAlign: "center" }}>{u.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {[
              { value: reqHospital, setter: setReqHospital, placeholder: "Hospital ka naam *", keyboard: "default" as const },
              { value: reqCity, setter: setReqCity, placeholder: "City *", keyboard: "default" as const },
              { value: reqState, setter: setReqState, placeholder: "State *", keyboard: "default" as const },
              { value: reqPhone, setter: setReqPhone, placeholder: "Contact number *", keyboard: "phone-pad" as const },
              { value: reqUnits, setter: setReqUnits, placeholder: "Units chahiye (e.g. 2)", keyboard: "number-pad" as const },
              { value: reqNotes, setter: setReqNotes, placeholder: "Additional info (optional)", keyboard: "default" as const },
            ].map(({ value, setter, placeholder, keyboard }, i) => (
              <TextInput
                key={i}
                value={value}
                onChangeText={setter}
                placeholder={placeholder}
                placeholderTextColor={isDark ? "rgba(255,255,255,0.3)" : "#9CA3AF"}
                keyboardType={keyboard}
                style={[styles.input, { color: isDark ? "#F0F8FF" : "#0A1628", backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#FFF5F5", borderColor: isDark ? "rgba(255,255,255,0.1)" : "#FECACA" }]}
              />
            ))}

            <TouchableOpacity onPress={submitEmergencyRequest} disabled={reqSubmitting} activeOpacity={0.85}>
              <LinearGradient colors={["#DC2626", "#B91C1C"]} style={styles.actionBtn}>
                {reqSubmitting ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name="alert-circle" size={18} color="#FFF" />}
                <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 15 }}>{reqSubmitting ? "Bhej rahe hain..." : "🆘 Emergency Alert Bhejein"}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 0 },
  headerTop: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  headerTitle: { color: "#FFF", fontSize: 22, fontFamily: "Inter_700Bold" },
  headerSub: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontFamily: "Inter_400Regular" },
  backBtn: { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 20, padding: 8 },
  sosBtn: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  tabRow: { flexDirection: "row", gap: 6, paddingBottom: 12 },
  tabBtn: { flex: 1, paddingVertical: 8, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 10, alignItems: "center" },
  tabBtnActive: { backgroundColor: "#FFF" },
  tabBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  bloodGroupGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  bloodGroupBtn: { minWidth: 52, height: 44, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  input: { borderRadius: 12, borderWidth: 1, padding: 13, fontSize: 14, fontFamily: "Inter_400Regular" },
  actionBtn: { height: 50, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  bloodBadge: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  availBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  availDot: { width: 6, height: 6, borderRadius: 3 },
  callBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#DC2626", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  urgBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
});
