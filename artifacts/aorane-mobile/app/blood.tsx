import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, TextInput,
  Alert, ActivityIndicator, Platform, Linking,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { api } from "@/lib/api";

// ── Design ────────────────────────────────────────────────────────────────────
const C = {
  bg: "#FFF5F5", card: "#FFFFFF", primary: "#DC2626", dark: "#B91C1C",
  text: "#1a1a2e", muted: "rgba(10,22,40,0.5)", border: "#FFE4E4",
  green: "#10B981", amber: "#F59E0B", blue: "#0077B6",
};

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"] as const;
type BloodGroup = typeof BLOOD_GROUPS[number];

const URGENCY_CONFIG = {
  critical: { label: "Critical (2-4 hrs)", color: "#DC2626", bg: "rgba(220,38,38,0.12)", icon: "alert-circle" as const },
  urgent:   { label: "Urgent (24 hrs)",    color: "#F59E0B", bg: "rgba(245,158,11,0.12)", icon: "time" as const },
  routine:  { label: "Routine (3-7 days)", color: "#10B981", bg: "rgba(16,185,129,0.12)", icon: "calendar" as const },
};

type EmergencyRequest = {
  id: string;
  patientName?: string;
  bloodGroupNeeded?: string; bloodGroup?: string;
  unitsNeeded: number;
  urgency?: string;
  hospitalName: string;
  hospitalAddress?: string;
  hospitalCity?: string; city?: string;
  hospitalState?: string; state?: string;
  hospitalPincode?: string;
  hospitalPhone?: string;
  doctorName?: string;
  doctorPhone?: string;
  contactPhone?: string;
  contactName?: string;
  notes?: string;
  createdAt?: string;
  status?: string;
  requesterId?: string;
  isFlagged?: boolean;
  flagCount?: number;
};

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }, style]}>{children}</View>;
}

function FieldLabel({ text, required }: { text: string; required?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 6, marginTop: 4 }}>
      <Text style={{ color: C.muted, fontFamily: "Inter_600SemiBold", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>{text}</Text>
      {required && <Text style={{ color: C.primary, fontSize: 11, fontFamily: "Inter_700Bold" }}>*</Text>}
    </View>
  );
}

function InputField({ value, onChangeText, placeholder, keyboard = "default", multiline = false }:
  { value: string; onChangeText: (t: string) => void; placeholder: string; keyboard?: "default" | "phone-pad" | "number-pad"; multiline?: boolean }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={C.muted}
      keyboardType={keyboard}
      multiline={multiline}
      numberOfLines={multiline ? 3 : 1}
      style={[styles.input, multiline && { height: 72, textAlignVertical: "top", paddingTop: 10 }]}
    />
  );
}

function callPhone(phone?: string) {
  if (!phone) { Alert.alert("No number", "Phone number not available"); return; }
  Linking.openURL(`tel:${phone}`).catch(() => Alert.alert("Error", "Could not initiate call"));
}

function CallButton({ phone, label = "Call" }: { phone?: string; label?: string }) {
  if (!phone) return null;
  return (
    <TouchableOpacity onPress={() => callPhone(phone)} style={styles.callBtn} activeOpacity={0.85}>
      <Ionicons name="call" size={14} color="#FFF" />
      <Text style={{ color: "#FFF", fontSize: 12, fontFamily: "Inter_600SemiBold" }}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function BloodEmergencyScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<"find" | "donate" | "requests">("requests");
  const [loading, setLoading] = useState(false);
  const [emergencies, setEmergencies] = useState<EmergencyRequest[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // GPS
  const [gpsLoading, setGpsLoading] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [nearbySearch, setNearbySearch] = useState(false);

  // Find donors
  const [searchBloodGroup, setSearchBloodGroup] = useState<BloodGroup>("O+");
  const [searchCity, setSearchCity] = useState("");
  const [donors, setDonors] = useState<Array<{ id: string; bloodGroup: string; city: string; state: string; isAvailable: boolean; distanceKm?: number | null }>>([]);
  const [searching, setSearching] = useState(false);

  // Donate
  const [donorBloodGroup, setDonorBloodGroup] = useState<BloodGroup>("O+");
  const [donorCity, setDonorCity] = useState("");
  const [donorState, setDonorState] = useState("");
  const [donorPhone, setDonorPhone] = useState("");
  const [donorLat, setDonorLat] = useState<number | undefined>();
  const [donorLng, setDonorLng] = useState<number | undefined>();
  const [donorSubmitting, setDonorSubmitting] = useState(false);

  // My donor status
  type DonorStatus = { registered: boolean; isAvailable?: boolean; otpVerified?: boolean; isOnCooldown?: boolean; daysLeft?: number; bloodGroup?: string; city?: string; state?: string; donationCount?: number } | null;
  const [donorStatus, setDonorStatus] = useState<DonorStatus>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);

  // My requests (as requester)
  type MyRequest = { id: string; patientName: string; bloodGroupNeeded: string; unitsNeeded: number; urgency: string; hospitalName: string; hospitalCity: string; hospitalState: string; status: string; expiresAt?: string; fulfilledAt?: string; createdAt: string; donorsNotified?: number; donorsResponded?: number };
  const [myRequests, setMyRequests] = useState<MyRequest[]>([]);
  const [myReqLoading, setMyReqLoading] = useState(false);
  const [reqView, setReqView] = useState<"all" | "mine">("all");
  const [fulfilling, setFulfilling] = useState<string | null>(null);

  // GPS search radius info
  const [searchedRadius, setSearchedRadius] = useState(50);
  const [radiusExpanded, setRadiusExpanded] = useState(false);

  // Emergency request modal
  const [showModal, setShowModal] = useState(false);
  // Required fields
  const [reqPatientName, setReqPatientName] = useState("");
  const [reqBloodGroup, setReqBloodGroup] = useState<BloodGroup>("O+");
  const [reqUnits, setReqUnits] = useState("2");
  const [reqUrgency, setReqUrgency] = useState<"critical" | "urgent" | "routine">("urgent");
  // Hospital (compulsory)
  const [reqHospitalName, setReqHospitalName] = useState("");
  const [reqHospitalAddress, setReqHospitalAddress] = useState("");
  const [reqHospitalCity, setReqHospitalCity] = useState("");
  const [reqHospitalState, setReqHospitalState] = useState("");
  const [reqHospitalPincode, setReqHospitalPincode] = useState("");
  const [reqHospitalPhone, setReqHospitalPhone] = useState("");
  // Doctor (optional)
  const [reqDoctorName, setReqDoctorName] = useState("");
  const [reqDoctorPhone, setReqDoctorPhone] = useState("");
  // Contact person
  const [reqContactName, setReqContactName] = useState("");
  const [reqContactPhone, setReqContactPhone] = useState("");
  // Notes
  const [reqNotes, setReqNotes] = useState("");
  const [reqHospitalLat, setReqHospitalLat] = useState<number | undefined>();
  const [reqHospitalLng, setReqHospitalLng] = useState<number | undefined>();
  const [hospitalGpsLoading, setHospitalGpsLoading] = useState(false);
  const [reqSubmitting, setReqSubmitting] = useState(false);
  const [formStep, setFormStep] = useState<"form" | "disclaimer">("form");
  const [urgencyFilter, setUrgencyFilter] = useState<"all" | "critical" | "urgent" | "routine">("all");
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  useEffect(() => { loadEmergencies(); }, []);

  useEffect(() => {
    if (tab === "donate") loadDonorStatus();
    if (tab === "requests" && reqView === "mine") loadMyRequests();
  }, [tab, reqView]);

  const loadDonorStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await api.getMyDonorStatus();
      setDonorStatus(res);
      if (res.bloodGroup) setDonorBloodGroup(res.bloodGroup as BloodGroup);
      if (res.city) setDonorCity(res.city);
      if (res.state) setDonorState(res.state);
    } catch { }
    setStatusLoading(false);
  }, []);

  const handleToggleAvailability = useCallback(async (available: boolean) => {
    setToggleLoading(true);
    try {
      const res = await api.toggleDonorAvailability(available);
      setDonorStatus(prev => prev ? { ...prev, isAvailable: res.isAvailable } : prev);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(
        res.isAvailable ? "✅ Ab Aap Available Ho" : "⏸ Availability Paused",
        res.isAvailable
          ? "Blood requests mein aapka naam dikhega. Agar koi zaroorat ho toh remove kar sakte ho."
          : "Aap temporarily unavailable ho. Jab ready ho tab wapas ON kar dena.",
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update";
      Alert.alert("Error", msg);
    }
    setToggleLoading(false);
  }, []);

  const loadEmergencies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getBloodEmergencies();
      setEmergencies(res.requests as EmergencyRequest[]);
    } catch { }
    setLoading(false);
  }, []);

  const loadMyRequests = useCallback(async () => {
    setMyReqLoading(true);
    try {
      const res = await api.getMyBloodRequests();
      setMyRequests(res.requests);
    } catch { }
    setMyReqLoading(false);
  }, []);

  const handleMarkFulfilled = useCallback(async (id: string) => {
    setFulfilling(id);
    try {
      await api.markBloodFulfilled(id);
      setMyRequests(prev => prev.map(r => r.id === id ? { ...r, status: "fulfilled", fulfilledAt: new Date().toISOString() } : r));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      Alert.alert("Error", "Could not mark as fulfilled");
    }
    setFulfilling(null);
  }, []);

  // ── GPS helpers ──────────────────────────────────────────────────────────────
  const getGPSCoords = async (): Promise<{ lat: number; lng: number } | null> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Enable location permission to find nearby donors");
        return null;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      return { lat: loc.coords.latitude, lng: loc.coords.longitude };
    } catch {
      Alert.alert("GPS Error", "Could not get location. Please check that GPS is on.");
      return null;
    }
  };

  // Auto-fill city/state from GPS for donor registration
  const autofillFromGPS = async () => {
    setGpsLoading(true);
    const coords = await getGPSCoords();
    if (!coords) { setGpsLoading(false); return; }
    try {
      const [place] = await Location.reverseGeocodeAsync({ latitude: coords.lat, longitude: coords.lng });
      if (place) {
        setDonorCity(place.city || place.district || place.subregion || "");
        setDonorState(place.region || place.subregion || "");
      }
      setDonorLat(coords.lat);
      setDonorLng(coords.lng);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert("✅ Location Found!", `City: ${place?.city || "—"}\nState: ${place?.region || "—"}\n\nYou can edit these fields if needed.`);
    } catch {
      Alert.alert("Location lookup failed", "Could not auto-fill city/state. Please enter manually.");
    }
    setGpsLoading(false);
  };

  // GPS-based nearby donor search
  const searchNearbyDonors = async () => {
    setSearching(true);
    setNearbySearch(true);
    setRadiusExpanded(false);
    setSearchedRadius(50);
    const coords = await getGPSCoords();
    if (!coords) { setSearching(false); setNearbySearch(false); return; }
    setUserCoords(coords);
    try {
      const res = await api.getBloodDonors(searchBloodGroup, undefined, { lat: coords.lat, lng: coords.lng, radiusKm: 50 });
      setDonors(res.donors);
      setSearchedRadius(res.searchedRadiusKm ?? 50);
      setRadiusExpanded(res.expanded ?? false);
      if (!res.donors.length) {
        Alert.alert("No donors found", `No ${searchBloodGroup} donors found within 200km.\n\nTry searching by city name instead.`);
      }
    } catch { Alert.alert("Error", "Could not find nearby donors"); }
    setSearching(false);
  };

  const searchDonors = async () => {
    if (!searchCity.trim()) { Alert.alert("Required", "Enter a city name or use the 'Near Me' button"); return; }
    setSearching(true);
    setNearbySearch(false);
    try {
      const res = await api.getBloodDonors(searchBloodGroup, searchCity.trim());
      setDonors(res.donors);
      if (!res.donors.length) Alert.alert("No donors found", `No ${searchBloodGroup} donors found in ${searchCity}.\n\nCompatible blood groups are also checked.`);
    } catch { Alert.alert("Error", "Could not find donors"); }
    setSearching(false);
  };

  const registerDonor = async () => {
    if (!donorCity.trim() || !donorState.trim()) { Alert.alert("Required", "City aur State bharo"); return; }

    // Warn if no GPS — donor won't appear in "Near Me" searches
    if (!donorLat || !donorLng) {
      await new Promise<void>((resolve) =>
        Alert.alert(
          "📍 GPS Recommended",
          "Aapne GPS button use nahi kiya.\n\nBina GPS ke aap sirf city search mein dikhenge — 'Donors Near Me' search mein nahi aayenge.\n\nAbhi GPS add karna chahte hain?",
          [
            { text: "GPS Add Karo", style: "default", onPress: async () => { resolve(); await autofillFromGPS(); } },
            { text: "City Search Kaafi Hai", style: "cancel", onPress: () => resolve() },
          ]
        )
      );
      if (!donorLat || !donorLng) {
        // User chose to continue without GPS — proceed
      }
    }

    setDonorSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      await api.registerBloodDonor({ bloodGroup: donorBloodGroup, city: donorCity.trim(), state: donorState.trim(), phone: donorPhone.trim(), lat: donorLat, lng: donorLng });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const gpsNote = donorLat ? "\n\nAap GPS Near Me search mein bhi dikhenge. ✅" : "\n\nTip: GPS add karo taaki Near Me search mein aao.";
      Alert.alert("✅ Registered!", `You are now a blood donor!${gpsNote}\n\nThank you! 🙏 Ek donation se 3 lives bachti hain ❤️`);
      setDonorCity(""); setDonorState(""); setDonorPhone("");
      setDonorLat(undefined); setDonorLng(undefined);
    } catch (e) { Alert.alert("Error", (e as Error).message || "Registration failed"); }
    setDonorSubmitting(false);
  };

  const openModal = () => {
    setFormStep("form");
    setShowModal(true);
  };

  const resetModal = () => {
    setReqPatientName(""); setReqUnits("2"); setReqUrgency("urgent");
    setReqHospitalName(""); setReqHospitalAddress(""); setReqHospitalCity(""); setReqHospitalState("");
    setReqHospitalPincode(""); setReqHospitalPhone("");
    setReqHospitalLat(undefined); setReqHospitalLng(undefined);
    setReqDoctorName(""); setReqDoctorPhone("");
    setReqContactName(""); setReqContactPhone(""); setReqNotes("");
    setFormStep("form");
  };

  const detectHospitalGPS = async () => {
    setHospitalGpsLoading(true);
    const coords = await getGPSCoords();
    if (!coords) { setHospitalGpsLoading(false); return; }
    try {
      const [place] = await Location.reverseGeocodeAsync({ latitude: coords.lat, longitude: coords.lng });
      if (place) {
        if (!reqHospitalCity.trim()) setReqHospitalCity(place.city || place.district || place.subregion || "");
        if (!reqHospitalState.trim()) setReqHospitalState(place.region || place.subregion || "");
      }
      setReqHospitalLat(coords.lat);
      setReqHospitalLng(coords.lng);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert("📍 Hospital Location Saved!", `GPS coordinates saved — donors will be found by proximity, not just city name.\n\nCity: ${place?.city || "—"}\nState: ${place?.region || "—"}`);
    } catch {
      Alert.alert("GPS Error", "Could not detect hospital location. Please fill city and state manually.");
    }
    setHospitalGpsLoading(false);
  };

  const handleCancelRequest = useCallback(async (id: string) => {
    Alert.alert(
      "Request Cancel Karo?",
      "Yeh request permanently cancel ho jaayegi. Donors ko aur notification nahi jayegi.",
      [
        { text: "Nahi, Rehne Do", style: "cancel" },
        { text: "Haan, Cancel Karo", style: "destructive", onPress: async () => {
          setCancelling(id);
          try {
            await api.cancelBloodRequest(id);
            setMyRequests(prev => prev.map(r => r.id === id ? { ...r, status: "cancelled" } : r));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          } catch {
            Alert.alert("Error", "Request cancel nahi ho saka. Dobara try karo.");
          }
          setCancelling(null);
        }},
      ]
    );
  }, []);

  const handleRespond = useCallback(async (id: string) => {
    setRespondingId(id);
    try {
      await api.respondToBloodEmergency(id, "can_help");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(
        "✅ Response Registered!",
        "Aapka response save ho gaya.\n\nHospital ko directly contact karo. Requester ko notification bhi mil gayi hai. 🙏",
      );
    } catch {
      Alert.alert("Error", "Response submit nahi ho saka. Dobara try karo.");
    }
    setRespondingId(null);
  }, []);

  const goToDisclaimer = () => {
    const missing: string[] = [];
    if (!reqPatientName.trim()) missing.push("Patient name");
    if (!reqHospitalName.trim()) missing.push("Hospital name");
    if (!reqHospitalAddress.trim()) missing.push("Hospital full address");
    if (!reqHospitalCity.trim()) missing.push("Hospital city");
    if (!reqHospitalPhone.trim()) missing.push("Hospital phone number");
    if (!reqContactPhone.trim()) missing.push("Your contact number");
    if (missing.length) {
      Alert.alert("Required fields:", missing.map((m, i) => `${i + 1}. ${m}`).join("\n"));
      return;
    }
    setFormStep("disclaimer");
  };

  const submitEmergency = async () => {
    setReqSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    const payload = {
      patientName: reqPatientName.trim(),
      bloodGroup: reqBloodGroup,
      unitsNeeded: parseInt(reqUnits) || 2,
      hospitalName: reqHospitalName.trim(),
      hospitalAddress: reqHospitalAddress.trim(),
      hospitalCity: reqHospitalCity.trim(),
      hospitalState: reqHospitalState.trim(),
      hospitalPincode: reqHospitalPincode.trim() || undefined,
      hospitalPhone: reqHospitalPhone.trim(),
      hospitalLat: reqHospitalLat,
      hospitalLng: reqHospitalLng,
      doctorName: reqDoctorName.trim() || undefined,
      doctorPhone: reqDoctorPhone.trim() || undefined,
      contactPhone: reqContactPhone.trim(),
      contactName: reqContactName.trim() || undefined,
      urgency: reqUrgency,
      notes: reqNotes.trim() || undefined,
    };
    try {
      const result = await api.createBloodEmergency(payload);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setShowModal(false);
      resetModal();
      Alert.alert("🆘 Emergency Posted!", "Blood emergency request sent to all donors.\n\nDonors will contact the hospital directly.");
      await loadEmergencies();
    } catch (e: unknown) {
      console.error("[BloodEmergency] ERROR:", (e as Error).message, e);
      Alert.alert("Error", (e as Error).message || "Could not post request");
    }
    setReqSubmitting(false);
  };

  const flagRequest = async (id: string) => {
    Alert.alert("Report this request?", "Does this request look fake? It will be automatically hidden after 3 reports.", [
      { text: "Cancel", style: "cancel" },
      { text: "Report", style: "destructive", onPress: async () => {
        try {
          await api.flagBloodRequest(id);
          Alert.alert("Reported", "Your report has been submitted. Our team will verify it.");
          await loadEmergencies();
        } catch { Alert.alert("Error", "Could not submit report"); }
      }},
    ]);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <LinearGradient colors={["#DC2626", "#B91C1C"]} style={{ paddingTop: (insets.top) + 12, paddingHorizontal: 16, paddingBottom: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#FFF", fontSize: 21, fontFamily: "Inter_700Bold" }}>🩸 Blood Emergency</Text>
            <Text style={{ color: "rgba(255,255,255,0.72)", fontSize: 12, fontFamily: "Inter_400Regular" }}>Donate Blood · Save 3 Lives ❤️</Text>
          </View>
          <TouchableOpacity onPress={openModal} style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 }}>
            <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 12 }}>🆘 SOS</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={{ flexDirection: "row", gap: 6, paddingBottom: 12 }}>
          {([["requests", "📋 Requests"], ["find", "🔍 Find Donor"], ["donate", "❤️ Donate"]] as [string, string][]).map(([t, label]) => (
            <TouchableOpacity key={t} onPress={() => { setTab(t as typeof tab); Haptics.selectionAsync().catch(() => {}); }}
              style={[{ flex: 1, paddingVertical: 8, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 10, alignItems: "center" },
                       tab === t && { backgroundColor: "#FFF" }]}>
              <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", textAlign: "center", color: tab === t ? C.primary : "rgba(255,255,255,0.7)" }}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>

        {/* ─── REQUESTS TAB ─────────────────────────────────────────────────── */}
        {tab === "requests" && (
          <View style={{ gap: 12 }}>
            {/* Post new request CTA */}
            <TouchableOpacity onPress={openModal} activeOpacity={0.87}>
              <LinearGradient colors={["#DC2626", "#B91C1C"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.actionBtn, { marginBottom: 4 }]}>
                <Ionicons name="add-circle-outline" size={18} color="#FFF" />
                <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 15 }}>New Blood Emergency Request</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Sub-filter: Sab / Meri */}
            <View style={{ flexDirection: "row", backgroundColor: "#F3F4F6", borderRadius: 12, padding: 3 }}>
              {([["all", "📋 Sab Requests"], ["mine", "🙋 Meri Requests"]] as const).map(([v, label]) => (
                <TouchableOpacity key={v} onPress={() => setReqView(v)} style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center", backgroundColor: reqView === v ? "#FFF" : "transparent" }} activeOpacity={0.85}>
                  <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: reqView === v ? C.primary : C.muted }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Meri Requests list ── */}
            {reqView === "mine" && (
              myReqLoading ? (
                <View style={{ alignItems: "center", paddingVertical: 30 }}><ActivityIndicator color={C.primary} size="large" /></View>
              ) : myRequests.length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: 40, gap: 10 }}>
                  <Ionicons name="document-outline" size={48} color={C.muted} />
                  <Text style={{ color: C.text, fontFamily: "Inter_600SemiBold", fontSize: 16 }}>Koi request nahi</Text>
                  <Text style={{ color: C.muted, fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" }}>Aapne abhi tak koi blood request nahi daali</Text>
                </View>
              ) : myRequests.map((r) => {
                const STATUS_CONFIG = {
                  active:    { color: C.green,   bg: "rgba(16,185,129,0.1)",   label: "Active" },
                  fulfilled: { color: C.blue,    bg: "rgba(0,119,182,0.1)",    label: "Fulfilled ✓" },
                  expired:   { color: "#9CA3AF", bg: "rgba(156,163,175,0.1)", label: "Expired" },
                  cancelled: { color: "#9CA3AF", bg: "rgba(156,163,175,0.1)", label: "Cancelled" },
                };
                const sc = STATUS_CONFIG[r.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.expired;
                const urgConf = URGENCY_CONFIG[(r.urgency as keyof typeof URGENCY_CONFIG)] || URGENCY_CONFIG.urgent;
                return (
                  <Card key={r.id}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <LinearGradient colors={["#DC2626", "#B91C1C"]} style={styles.bloodBadge}>
                        <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 15 }}>{r.bloodGroupNeeded}</Text>
                      </LinearGradient>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: C.text, fontFamily: "Inter_700Bold", fontSize: 14 }} numberOfLines={1}>{r.hospitalName}</Text>
                        <Text style={{ color: C.muted, fontSize: 12, fontFamily: "Inter_400Regular" }}>{r.hospitalCity}, {r.hospitalState}</Text>
                      </View>
                      <View style={{ backgroundColor: sc.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                        <Text style={{ color: sc.color, fontSize: 10, fontFamily: "Inter_700Bold" }}>{sc.label}</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                      <View style={[styles.urgBadge, { backgroundColor: urgConf.bg }]}>
                        <Ionicons name={urgConf.icon} size={10} color={urgConf.color} />
                        <Text style={{ color: urgConf.color, fontSize: 9, fontFamily: "Inter_700Bold" }}>{r.urgency.toUpperCase()}</Text>
                      </View>
                      <Text style={{ color: C.muted, fontSize: 11, fontFamily: "Inter_400Regular" }}>{r.unitsNeeded} units • Patient: {r.patientName}</Text>
                    </View>
                    {(r.donorsNotified ?? 0) > 0 && (
                      <Text style={{ color: C.muted, fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 6 }}>
                        📢 {r.donorsNotified} notified · {r.donorsResponded ?? 0} responded
                      </Text>
                    )}
                    <Text style={{ color: C.muted, fontSize: 10, fontFamily: "Inter_400Regular", marginBottom: r.status === "active" ? 8 : 0 }}>
                      {new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      {r.fulfilledAt ? ` · Fulfilled ${new Date(r.fulfilledAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}
                    </Text>
                    {r.status === "active" && (
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <TouchableOpacity onPress={() => handleMarkFulfilled(r.id)} disabled={fulfilling === r.id || cancelling === r.id} activeOpacity={0.85}
                          style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "rgba(16,185,129,0.1)", borderRadius: 10, paddingVertical: 9, borderWidth: 1, borderColor: "rgba(16,185,129,0.3)" }}>
                          {fulfilling === r.id ? <ActivityIndicator size="small" color={C.green} /> : <Ionicons name="checkmark-circle" size={15} color={C.green} />}
                          <Text style={{ color: C.green, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>Blood Mil Gaya</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleCancelRequest(r.id)} disabled={fulfilling === r.id || cancelling === r.id} activeOpacity={0.85}
                          style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, backgroundColor: "rgba(220,38,38,0.08)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: "rgba(220,38,38,0.2)" }}>
                          {cancelling === r.id ? <ActivityIndicator size="small" color={C.primary} /> : <Ionicons name="close-circle-outline" size={15} color={C.primary} />}
                          <Text style={{ color: C.primary, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </Card>
                );
              })
            )}

            {/* ── All requests list ── */}
            {reqView === "all" && (
              <>
                {/* Urgency filter tabs */}
                <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                  {([
                    ["all", "🩸 Sab"],
                    ["critical", "⚡ Critical"],
                    ["urgent", "⏱ Urgent"],
                    ["routine", "📅 Routine"],
                  ] as const).map(([f, label]) => {
                    const isActive = urgencyFilter === f;
                    const col = f === "all" ? C.primary : URGENCY_CONFIG[f as keyof typeof URGENCY_CONFIG]?.color || C.primary;
                    return (
                      <TouchableOpacity key={f} onPress={() => setUrgencyFilter(f)} activeOpacity={0.85}
                        style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, backgroundColor: isActive ? col : "#FFF", borderColor: isActive ? col : C.border }}>
                        <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: isActive ? "#FFF" : C.muted }}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
            {reqView === "all" && loading && (
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <ActivityIndicator color={C.primary} size="large" />
              </View>
            )}
            {reqView === "all" && !loading && (urgencyFilter === "all" ? emergencies : emergencies.filter(e => (e.urgency || "urgent") === urgencyFilter)).length === 0 && (
              <View style={{ alignItems: "center", paddingVertical: 40, gap: 10 }}>
                <Ionicons name="checkmark-circle" size={52} color={C.green} />
                <Text style={{ color: C.text, fontFamily: "Inter_600SemiBold", fontSize: 17 }}>{urgencyFilter === "all" ? "No active emergencies" : `No ${urgencyFilter} requests`}</Text>
                <Text style={{ color: C.muted, fontSize: 14, fontFamily: "Inter_400Regular" }}>{urgencyFilter === "all" ? "There are no blood requests right now" : "Try a different filter"}</Text>
              </View>
            )}
            {reqView === "all" && !loading && (urgencyFilter === "all" ? emergencies : emergencies.filter(e => (e.urgency || "urgent") === urgencyFilter)).map((req) => {
              const urgConf = URGENCY_CONFIG[(req.urgency as keyof typeof URGENCY_CONFIG)] || URGENCY_CONFIG.urgent;
              const displayBlood = req.bloodGroupNeeded || req.bloodGroup || "?";
              const displayCity = req.hospitalCity || req.city || "";
              const isExpanded = expandedId === req.id;

              return (
                <Card key={req.id}>
                  {/* Header row */}
                  <TouchableOpacity onPress={() => setExpandedId(isExpanded ? null : req.id)} activeOpacity={0.8} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <LinearGradient colors={["#DC2626", "#B91C1C"]} style={styles.bloodBadge}>
                      <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 16 }}>{displayBlood}</Text>
                    </LinearGradient>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.text, fontFamily: "Inter_700Bold", fontSize: 15 }}>{req.hospitalName}</Text>
                      <Text style={{ color: C.muted, fontSize: 12, fontFamily: "Inter_400Regular" }}>
                        {displayCity}{req.hospitalState ? `, ${req.hospitalState}` : ""}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                      <View style={[styles.urgBadge, { backgroundColor: urgConf.bg }]}>
                        <Ionicons name={urgConf.icon} size={11} color={urgConf.color} />
                        <Text style={{ color: urgConf.color, fontSize: 9, fontFamily: "Inter_700Bold" }}>{(req.urgency || "urgent").toUpperCase()}</Text>
                      </View>
                      <Text style={{ color: C.primary, fontFamily: "Inter_700Bold", fontSize: 13 }}>{req.unitsNeeded} units</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Patient row */}
                  {req.patientName && req.patientName !== "Mobile User" && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FFF5F5", borderRadius: 10, padding: 8 }}>
                      <Ionicons name="person" size={14} color={C.muted} />
                      <Text style={{ color: C.text, fontSize: 13, fontFamily: "Inter_500Medium" }}>Patient: {req.patientName}</Text>
                    </View>
                  )}

                  {/* Expanded — full hospital + doctor info for donor safety */}
                  {isExpanded && (
                    <View style={{ gap: 10, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12 }}>
                      {/* Hospital complete info */}
                      <View style={{ backgroundColor: "#FFF5F5", borderRadius: 12, padding: 12, gap: 6 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                          <Ionicons name="business" size={15} color={C.primary} />
                          <Text style={{ color: C.primary, fontFamily: "Inter_700Bold", fontSize: 13 }}>Hospital Info</Text>
                        </View>
                        <Text style={{ color: C.text, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>{req.hospitalName}</Text>
                        {req.hospitalAddress && (
                          <Text style={{ color: C.muted, fontSize: 12, fontFamily: "Inter_400Regular" }}>📍 {req.hospitalAddress}</Text>
                        )}
                        <Text style={{ color: C.muted, fontSize: 12, fontFamily: "Inter_400Regular" }}>
                          {displayCity}{req.hospitalState ? `, ${req.hospitalState}` : ""}{req.hospitalPincode ? ` — ${req.hospitalPincode}` : ""}
                        </Text>
                        {req.hospitalPhone && (
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                            <Text style={{ color: C.text, fontSize: 13, fontFamily: "Inter_500Medium" }}>📞 {req.hospitalPhone}</Text>
                            <CallButton phone={req.hospitalPhone} label="Hospital" />
                          </View>
                        )}
                      </View>

                      {/* Doctor info */}
                      {req.doctorName && (
                        <View style={{ backgroundColor: "rgba(16,185,129,0.08)", borderRadius: 12, padding: 12, gap: 6 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
                            <Ionicons name="medical" size={15} color={C.green} />
                            <Text style={{ color: C.green, fontFamily: "Inter_700Bold", fontSize: 13 }}>Doctor</Text>
                          </View>
                          <Text style={{ color: C.text, fontFamily: "Inter_500Medium", fontSize: 13 }}>Dr. {req.doctorName}</Text>
                          {req.doctorPhone && (
                            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                              <Text style={{ color: C.muted, fontSize: 12 }}>📞 {req.doctorPhone}</Text>
                              <CallButton phone={req.doctorPhone} label="Doctor" />
                            </View>
                          )}
                        </View>
                      )}

                      {/* Contact person */}
                      {req.contactPhone && (
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(0,119,182,0.08)", borderRadius: 10, padding: 10 }}>
                          <View style={{ gap: 2 }}>
                            <Text style={{ color: C.text, fontFamily: "Inter_500Medium", fontSize: 12 }}>
                              👤 {req.contactName || "Requester"} (Contact)
                            </Text>
                            <Text style={{ color: C.muted, fontSize: 12 }}>{req.contactPhone}</Text>
                          </View>
                          <CallButton phone={req.contactPhone} label="Contact" />
                        </View>
                      )}

                      {req.notes && (
                        <View style={{ backgroundColor: "#F9FAFB", borderRadius: 10, padding: 10 }}>
                          <Text style={{ color: C.muted, fontSize: 12, fontFamily: "Inter_400Regular" }}>📝 {req.notes}</Text>
                        </View>
                      )}

                      {/* Report button */}
                      <TouchableOpacity onPress={() => flagRequest(req.id)} style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-end", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: "#FEE2E2" }}>
                        <Ionicons name="flag-outline" size={13} color={C.primary} />
                        <Text style={{ color: C.primary, fontSize: 11, fontFamily: "Inter_500Medium" }}>Report</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Action buttons — always visible */}
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                    <TouchableOpacity
                      onPress={() => handleRespond(req.id)}
                      disabled={respondingId === req.id}
                      activeOpacity={0.85}
                      style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, backgroundColor: "rgba(16,185,129,0.12)", borderRadius: 10, height: 40, borderWidth: 1, borderColor: "rgba(16,185,129,0.35)" }}>
                      {respondingId === req.id
                        ? <ActivityIndicator size="small" color={C.green} />
                        : <Ionicons name="heart" size={14} color={C.green} />}
                      <Text style={{ color: C.green, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>I Can Help</Text>
                    </TouchableOpacity>
                    {req.hospitalPhone && (
                      <TouchableOpacity onPress={() => callPhone(req.hospitalPhone)} activeOpacity={0.85}>
                        <LinearGradient colors={["#DC2626", "#B91C1C"]} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, height: 40, borderRadius: 10, paddingHorizontal: 14 }}>
                          <Ionicons name="call" size={14} color="#FFF" />
                          <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 12 }}>Hospital</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => setExpandedId(isExpanded ? null : req.id)}
                      style={{ backgroundColor: C.border, borderRadius: 10, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", height: 40 }}>
                      <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color={C.muted} />
                    </TouchableOpacity>
                  </View>
                </Card>
              );
            })}
          </View>
        )}

        {/* ─── FIND DONOR TAB ───────────────────────────────────────────────── */}
        {tab === "find" && (
          <View style={{ gap: 12 }}>
            <Card>
              <Text style={styles.cardTitle}>Blood Group Chunein</Text>
              <BloodGroupGrid selected={searchBloodGroup} onSelect={setSearchBloodGroup} />

              {/* GPS nearby search */}
              <TouchableOpacity onPress={searchNearbyDonors} disabled={searching || gpsLoading} activeOpacity={0.85}>
                <LinearGradient colors={["#DC2626", "#B91C1C"]} style={styles.actionBtn}>
                  {searching && nearbySearch ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name="navigate" size={18} color="#FFF" />}
                  <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 15 }}>
                    {searching && nearbySearch ? "Searching via GPS..." : "📍 Donors Near Me (50 km)"}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Divider */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
                <Text style={{ color: C.muted, fontSize: 11, fontFamily: "Inter_400Regular" }}>or search by city</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
              </View>

              <InputField value={searchCity} onChangeText={setSearchCity} placeholder="Enter city (e.g. Mumbai, Delhi)" />
              <TouchableOpacity onPress={searchDonors} disabled={searching} activeOpacity={0.85}
                style={{ borderWidth: 1.5, borderColor: C.primary, borderRadius: 14, height: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {searching && !nearbySearch ? <ActivityIndicator color={C.primary} size="small" /> : <Ionicons name="search" size={18} color={C.primary} />}
                <Text style={{ color: C.primary, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>{searching && !nearbySearch ? "Searching..." : "Search Donors by City"}</Text>
              </TouchableOpacity>

              <Text style={{ color: C.muted, fontSize: 11, textAlign: "center" }}>Compatible blood groups are also checked automatically</Text>
            </Card>

            {nearbySearch && userCoords && donors.length > 0 && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: radiusExpanded ? "rgba(245,158,11,0.1)" : "rgba(220,38,38,0.08)", borderRadius: 12, padding: 10 }}>
                <Ionicons name="navigate-circle" size={18} color={radiusExpanded ? C.amber : C.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: radiusExpanded ? C.amber : C.primary, fontSize: 12, fontFamily: "Inter_600SemiBold" }}>
                    {donors.length} donor{donors.length > 1 ? "s" : ""} within {searchedRadius}km — sorted by distance
                  </Text>
                  {radiusExpanded && (
                    <Text style={{ color: C.muted, fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 }}>
                      50km mein kam donors mile — auto-expand hokar {searchedRadius}km tak search hua
                    </Text>
                  )}
                </View>
              </View>
            )}

            {donors.map((d, i) => (
              <Card key={i}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <LinearGradient colors={["#DC2626", "#B91C1C"]} style={styles.bloodBadge}>
                    <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 16 }}>{d.bloodGroup}</Text>
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>{d.bloodGroup} Donor</Text>
                    <Text style={{ color: C.muted, fontSize: 12, fontFamily: "Inter_400Regular" }}>{d.city}, {d.state}</Text>
                    {d.distanceKm != null && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                        <Ionicons name="navigate" size={11} color={C.green} />
                        <Text style={{ color: C.green, fontSize: 11, fontFamily: "Inter_600SemiBold" }}>
                          {d.distanceKm < 1 ? "<1 km" : `~${Math.round(d.distanceKm)} km`} away
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={[styles.availBadge, { backgroundColor: d.isAvailable ? "rgba(16,185,129,0.15)" : "rgba(156,163,175,0.15)" }]}>
                    <View style={[styles.availDot, { backgroundColor: d.isAvailable ? C.green : "#9CA3AF" }]} />
                    <Text style={{ color: d.isAvailable ? C.green : "#9CA3AF", fontSize: 11, fontFamily: "Inter_600SemiBold" }}>{d.isAvailable ? "Available" : "Busy"}</Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* ─── DONATE TAB ───────────────────────────────────────────────────── */}
        {tab === "donate" && (
          <View style={{ gap: 12 }}>
            <LinearGradient colors={["rgba(220,38,38,0.12)", "rgba(185,28,28,0.06)"]} style={[styles.card, { borderColor: "rgba(220,38,38,0.2)" }]}>
              <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                <Text style={{ fontSize: 28 }}>❤️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.primary, fontFamily: "Inter_700Bold", fontSize: 16 }}>Donate Blood — Save up to 3 Lives</Text>
                  <Text style={{ color: C.muted, fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 4, lineHeight: 19 }}>One donation can change someone's life. You can donate every 3 months.</Text>
                </View>
              </View>
            </LinearGradient>

            {/* ── My Donor Status Card ─────────────────────────────── */}
            {statusLoading ? (
              <Card><ActivityIndicator color={C.primary} style={{ marginVertical: 8 }} /></Card>
            ) : donorStatus?.registered ? (
              <Card>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <Text style={styles.cardTitle}>Mera Donor Status</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: donorStatus.isAvailable ? C.green : "#9CA3AF" }} />
                    <Text style={{ color: donorStatus.isAvailable ? C.green : "#9CA3AF", fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                      {donorStatus.isAvailable ? "Available" : "Unavailable"}
                    </Text>
                  </View>
                </View>

                {/* Info row */}
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                  <View style={{ backgroundColor: "rgba(220,38,38,0.08)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
                    <Text style={{ color: C.primary, fontFamily: "Inter_700Bold", fontSize: 14 }}>{donorStatus.bloodGroup}</Text>
                  </View>
                  <View style={{ backgroundColor: "#F3F4F6", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
                    <Text style={{ color: C.text, fontFamily: "Inter_500Medium", fontSize: 13 }}>{donorStatus.city}, {donorStatus.state}</Text>
                  </View>
                  {(donorStatus.donationCount ?? 0) > 0 && (
                    <View style={{ backgroundColor: "rgba(16,185,129,0.1)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
                      <Text style={{ color: C.green, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>🩸 {donorStatus.donationCount} donations</Text>
                    </View>
                  )}
                </View>

                {/* Cooldown warning */}
                {donorStatus.isOnCooldown ? (
                  <View style={{ backgroundColor: "rgba(245,158,11,0.1)", borderRadius: 10, padding: 12, marginBottom: 10, flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                    <Ionicons name="time" size={18} color={C.amber} style={{ marginTop: 1 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.amber, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>90-Day Cooldown Active</Text>
                      <Text style={{ color: C.muted, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>
                        Aap {donorStatus.daysLeft} din baad wapas donate kar sakte ho. Tab tak availability ON nahi hogi.
                      </Text>
                    </View>
                  </View>
                ) : null}

                {/* Toggle */}
                {!donorStatus.isOnCooldown && (
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#F9FAFB", borderRadius: 12, padding: 14 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.text, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>Availability Toggle</Text>
                      <Text style={{ color: C.muted, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>
                        {donorStatus.isAvailable ? "Donors list mein visible ho — requests aa sakti hain" : "Ab koi blood request nahi aayegi aapko"}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleToggleAvailability(!donorStatus.isAvailable)}
                      disabled={toggleLoading}
                      activeOpacity={0.85}
                      style={{ width: 52, height: 28, borderRadius: 14, backgroundColor: donorStatus.isAvailable ? C.green : "#D1D5DB", justifyContent: "center", paddingHorizontal: 3, marginLeft: 12 }}>
                      {toggleLoading
                        ? <ActivityIndicator size="small" color="#FFF" />
                        : <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#FFF", alignSelf: donorStatus.isAvailable ? "flex-end" : "flex-start", shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 2, elevation: 2 }} />
                      }
                    </TouchableOpacity>
                  </View>
                )}

              </Card>
            ) : null}

            {/* ── Registration Form — show only if not yet registered ── */}
            {!statusLoading && (!donorStatus?.registered) && (
              <Card>
                <Text style={styles.cardTitle}>Donor Register Karo</Text>
                <BloodGroupGrid selected={donorBloodGroup} onSelect={setDonorBloodGroup} />

                {/* GPS auto-fill */}
                <TouchableOpacity onPress={autofillFromGPS} disabled={gpsLoading} activeOpacity={0.85}
                  style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: donorLat ? "rgba(16,185,129,0.1)" : "rgba(220,38,38,0.06)", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: donorLat ? C.green : C.border }}>
                  {gpsLoading ? <ActivityIndicator size="small" color={C.primary} /> : <Ionicons name={donorLat ? "navigate-circle" : "navigate-circle-outline"} size={22} color={donorLat ? C.green : C.primary} />}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: donorLat ? C.green : C.primary, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                      {gpsLoading ? "Getting location..." : donorLat ? "✅ Location saved" : "📍 Auto-fill via GPS"}
                    </Text>
                    <Text style={{ color: C.muted, fontSize: 11, fontFamily: "Inter_400Regular" }}>
                      {donorLat ? `${donorLat.toFixed(4)}, ${donorLng?.toFixed(4)} — nearby donors will appear first` : "City/State will auto-fill + proximity search will be enabled"}
                    </Text>
                  </View>
                  {donorLat && <TouchableOpacity onPress={() => { setDonorLat(undefined); setDonorLng(undefined); }} style={{ padding: 4 }}>
                    <Ionicons name="close-circle" size={18} color={C.muted} />
                  </TouchableOpacity>}
                </TouchableOpacity>

                <InputField value={donorCity} onChangeText={setDonorCity} placeholder="Your city * (e.g. Delhi, Mumbai)" />
                <InputField value={donorState} onChangeText={setDonorState} placeholder="State * (e.g. Maharashtra, UP)" />
                <InputField value={donorPhone} onChangeText={setDonorPhone} placeholder="Mobile number (for OTP verification)" keyboard="phone-pad" />
                <TouchableOpacity onPress={registerDonor} disabled={donorSubmitting} activeOpacity={0.85}>
                  <LinearGradient colors={["#DC2626", "#B91C1C"]} style={styles.actionBtn}>
                    {donorSubmitting ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name="heart" size={18} color="#FFF" />}
                    <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 15 }}>{donorSubmitting ? "Registering..." : "Register as Donor"}</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(16,185,129,0.08)", borderRadius: 10, padding: 10 }}>
                  <Ionicons name="shield-checkmark" size={16} color={C.green} />
                  <Text style={{ color: C.green, fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 }}>OTP verification keeps your identity secure</Text>
                </View>
              </Card>
            )}

            {/* Eligibility */}
            <Card>
              <Text style={styles.cardTitle}>Eligibility Criteria</Text>
              {["Age between 18–65 years", "Weight at least 50 kg", "No serious illness (controlled diabetes is OK)", "Haemoglobin above 12.5 g/dL", "Not donated in the last 3 months", "No surgery or tattoo in the last 6 months"].map((t, i) => (
                <View key={i} style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
                  <Ionicons name="checkmark-circle" size={16} color={C.green} style={{ marginTop: 1 }} />
                  <Text style={{ color: C.muted, fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 }}>{t}</Text>
                </View>
              ))}
            </Card>
          </View>
        )}
      </ScrollView>

      {/* ─── EMERGENCY REQUEST MODAL ────────────────────────────────────────── */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          <LinearGradient colors={["#DC2626", "#B91C1C"]} style={{ padding: 20, paddingTop: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View>
              <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 20 }}>🆘 Blood Emergency</Text>
              <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontFamily: "Inter_400Regular" }}>
                {formStep === "form" ? "Fill hospital info — donors will contact directly" : "Review and post your request"}
              </Text>
            </View>
            <TouchableOpacity onPress={() => { setShowModal(false); resetModal(); }} style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 20, padding: 8 }}>
              <Ionicons name="close" size={20} color="#FFF" />
            </TouchableOpacity>
          </LinearGradient>

          {formStep === "form" ? (
            <ScrollView contentContainerStyle={{ padding: 18, gap: 4, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* Blood group + urgency */}
              <FieldLabel text="Blood Group" required />
              <BloodGroupGrid selected={reqBloodGroup} onSelect={setReqBloodGroup} />

              <FieldLabel text="Urgency" required />
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                {(["critical", "urgent", "routine"] as const).map((u) => (
                  <TouchableOpacity key={u} onPress={() => setReqUrgency(u)}
                    style={[styles.urgBadge, { flex: 1, justifyContent: "center", paddingVertical: 10, backgroundColor: reqUrgency === u ? URGENCY_CONFIG[u].bg : "#F9FAFB", borderWidth: 1, borderColor: reqUrgency === u ? URGENCY_CONFIG[u].color : "#E5E7EB" }]}>
                    <Text style={{ color: reqUrgency === u ? URGENCY_CONFIG[u].color : C.muted, fontFamily: "Inter_600SemiBold", fontSize: 10, textAlign: "center" }}>
                      {u === "critical" ? "⚡ CRITICAL\n2-4 hrs" : u === "urgent" ? "⏱ URGENT\n24 hrs" : "📅 ROUTINE\n3-7 days"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <FieldLabel text="Units Chahiye" required />
              <InputField value={reqUnits} onChangeText={setReqUnits} placeholder="Units (e.g. 2)" keyboard="number-pad" />

              {/* Patient */}
              <View style={{ height: 1, backgroundColor: C.border, marginVertical: 10 }} />
              <FieldLabel text="Patient Info" required />
              <InputField value={reqPatientName} onChangeText={setReqPatientName} placeholder="Patient name *" />

              {/* Hospital — COMPULSORY */}
              <View style={{ height: 1, backgroundColor: C.border, marginVertical: 10 }} />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <Ionicons name="business" size={15} color={C.primary} />
                <Text style={{ color: C.primary, fontFamily: "Inter_700Bold", fontSize: 13, textTransform: "uppercase" }}>Hospital Info (Compulsory)</Text>
              </View>
              <View style={{ backgroundColor: "#FEE2E2", borderRadius: 10, padding: 10, marginBottom: 10 }}>
                <Text style={{ color: C.dark, fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 }}>
                  ⚠️ Donors will go directly to the hospital. Please fill in complete and accurate information so donors reach the right location.
                </Text>
              </View>

              {/* Hospital GPS — pin current location for accurate donor matching */}
              <TouchableOpacity onPress={detectHospitalGPS} disabled={hospitalGpsLoading} activeOpacity={0.85}
                style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: reqHospitalLat ? "rgba(16,185,129,0.1)" : "rgba(220,38,38,0.06)", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: reqHospitalLat ? C.green : C.border, marginBottom: 10 }}>
                {hospitalGpsLoading ? <ActivityIndicator size="small" color={C.primary} /> : <Ionicons name={reqHospitalLat ? "navigate-circle" : "navigate-circle-outline"} size={22} color={reqHospitalLat ? C.green : C.primary} />}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: reqHospitalLat ? C.green : C.primary, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                    {hospitalGpsLoading ? "Getting location..." : reqHospitalLat ? "✅ Hospital GPS Saved" : "📍 Pin Hospital Location (Recommended)"}
                  </Text>
                  <Text style={{ color: C.muted, fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 }}>
                    {reqHospitalLat ? `${reqHospitalLat.toFixed(4)}, ${reqHospitalLng?.toFixed(4)} — donors will be matched by distance` : "GPS se nearby donors dhundhe jaayenge — city name se zyada accurate"}
                  </Text>
                </View>
                {reqHospitalLat && (
                  <TouchableOpacity onPress={() => { setReqHospitalLat(undefined); setReqHospitalLng(undefined); }} style={{ padding: 4 }}>
                    <Ionicons name="close-circle" size={18} color={C.muted} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              <InputField value={reqHospitalName} onChangeText={setReqHospitalName} placeholder="Hospital name * (e.g. AIIMS Delhi)" />
              <InputField value={reqHospitalAddress} onChangeText={setReqHospitalAddress} placeholder="Full address * (include ward/floor/building)" multiline />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 2 }}>
                  <InputField value={reqHospitalCity} onChangeText={setReqHospitalCity} placeholder="City *" />
                </View>
                <View style={{ flex: 1 }}>
                  <InputField value={reqHospitalPincode} onChangeText={setReqHospitalPincode} placeholder="Pincode" keyboard="number-pad" />
                </View>
              </View>
              <InputField value={reqHospitalState} onChangeText={setReqHospitalState} placeholder="State (e.g. Delhi, Maharashtra)" />
              <InputField value={reqHospitalPhone} onChangeText={setReqHospitalPhone} placeholder="Hospital phone number * (reception/ward)" keyboard="phone-pad" />

              {/* Doctor — optional but encouraged */}
              <View style={{ height: 1, backgroundColor: C.border, marginVertical: 10 }} />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <Ionicons name="medical" size={15} color={C.green} />
                <Text style={{ color: C.green, fontFamily: "Inter_700Bold", fontSize: 13, textTransform: "uppercase" }}>Doctor Info</Text>
                <View style={{ backgroundColor: "rgba(16,185,129,0.12)", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ color: C.green, fontSize: 9, fontFamily: "Inter_600SemiBold" }}>STRONGLY RECOMMENDED</Text>
                </View>
              </View>
              <Text style={{ color: C.muted, fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 8 }}>
                Providing a doctor's number helps donors confirm the request and get proper guidance
              </Text>
              <InputField value={reqDoctorName} onChangeText={setReqDoctorName} placeholder="Attending doctor's name (optional)" />
              <InputField value={reqDoctorPhone} onChangeText={setReqDoctorPhone} placeholder="Doctor's direct number (optional)" keyboard="phone-pad" />

              {/* Contact person */}
              <View style={{ height: 1, backgroundColor: C.border, marginVertical: 10 }} />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <Ionicons name="person" size={15} color={C.blue} />
                <Text style={{ color: C.blue, fontFamily: "Inter_700Bold", fontSize: 13, textTransform: "uppercase" }}>Your Contact Info (Required)</Text>
              </View>
              <InputField value={reqContactName} onChangeText={setReqContactName} placeholder="Your name (patient's relative or friend)" />
              <InputField value={reqContactPhone} onChangeText={setReqContactPhone} placeholder="Your mobile number * (donors can call you)" keyboard="phone-pad" />

              {/* Notes */}
              <View style={{ height: 1, backgroundColor: C.border, marginVertical: 10 }} />
              <FieldLabel text="Additional Info (Optional)" />
              <InputField value={reqNotes} onChangeText={setReqNotes} placeholder="Any additional info (e.g. Patient in ICU, O- blood type needed urgently)" multiline />

              <TouchableOpacity onPress={goToDisclaimer} activeOpacity={0.85} style={{ marginTop: 14 }}>
                <LinearGradient colors={["#DC2626", "#B91C1C"]} style={styles.actionBtn}>
                  <Ionicons name="arrow-forward" size={18} color="#FFF" />
                  <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 15 }}>Next: Confirm →</Text>
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          ) : (
            /* Disclaimer + Summary step */
            <ScrollView contentContainerStyle={{ padding: 18, gap: 12, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
              {/* Summary */}
              <Card>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <LinearGradient colors={["#DC2626","#B91C1C"]} style={[styles.bloodBadge, { width: 44, height: 44 }]}>
                    <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 15 }}>{reqBloodGroup}</Text>
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontFamily: "Inter_700Bold", fontSize: 15 }}>{reqHospitalName}</Text>
                    <Text style={{ color: C.muted, fontSize: 12 }}>{reqHospitalCity} · {reqUnits} units</Text>
                  </View>
                  <View style={[styles.urgBadge, { backgroundColor: URGENCY_CONFIG[reqUrgency].bg }]}>
                    <Text style={{ color: URGENCY_CONFIG[reqUrgency].color, fontSize: 9, fontFamily: "Inter_700Bold" }}>{reqUrgency.toUpperCase()}</Text>
                  </View>
                </View>

                {[
                  { icon: "person" as const, label: "Patient", val: reqPatientName },
                  { icon: "business" as const, label: "Hospital", val: `${reqHospitalName}, ${reqHospitalAddress}` },
                  { icon: "location" as const, label: "Location", val: `${reqHospitalCity}, ${reqHospitalState} ${reqHospitalPincode}` },
                  { icon: "call" as const, label: "Hospital No.", val: reqHospitalPhone, bold: true },
                  ...(reqDoctorName ? [{ icon: "medical" as const, label: "Doctor", val: `Dr. ${reqDoctorName}${reqDoctorPhone ? ` · ${reqDoctorPhone}` : ""}` }] : []),
                  { icon: "person-circle" as const, label: "Contact", val: `${reqContactName || "Requester"} · ${reqContactPhone}` },
                ].map(({ icon, label, val, bold }) => (
                  <View key={label} style={{ flexDirection: "row", gap: 8, paddingVertical: 4, borderTopWidth: 1, borderTopColor: C.border }}>
                    <Ionicons name={icon} size={14} color={C.muted} style={{ marginTop: 2 }} />
                    <Text style={{ color: C.muted, fontSize: 12, width: 72 }}>{label}:</Text>
                    <Text style={{ color: C.text, fontSize: 12, fontFamily: bold ? "Inter_700Bold" : "Inter_400Regular", flex: 1 }}>{val}</Text>
                  </View>
                ))}
              </Card>

              {/* Disclaimer */}
              <View style={{ backgroundColor: "#FEE2E2", borderRadius: 14, padding: 14, gap: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="warning" size={18} color={C.primary} />
                  <Text style={{ color: C.primary, fontFamily: "Inter_700Bold", fontSize: 14 }}>Disclaimer — Please Read</Text>
                </View>
                {[
                  "This information is real and accurate (fake requests are a criminal offence)",
                  "Donors will go directly to the hospital — you are responsible for providing accurate hospital information",
                  "Your contact number will be shared with donors",
                  "The request will automatically expire after 72 hours",
                  "A request flagged by 3 reports will be automatically hidden",
                  "Aorane is not responsible for the safety or quality of blood — this is a connecting platform only",
                ].map((t, i) => (
                  <View key={i} style={{ flexDirection: "row", gap: 8 }}>
                    <Text style={{ color: C.primary, fontFamily: "Inter_700Bold", fontSize: 12 }}>{i + 1}.</Text>
                    <Text style={{ color: C.dark, fontSize: 12, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 17 }}>{t}</Text>
                  </View>
                ))}
              </View>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity onPress={() => setFormStep("form")} style={{ flex: 1, height: 50, borderRadius: 14, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: C.muted, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>← Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={submitEmergency} disabled={reqSubmitting} style={{ flex: 2 }} activeOpacity={0.85}>
                  <LinearGradient colors={["#DC2626", "#B91C1C"]} style={styles.actionBtn}>
                    {reqSubmitting ? <ActivityIndicator color="#FFF" /> : <Ionicons name="alert-circle" size={18} color="#FFF" />}
                    <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 14 }}>{reqSubmitting ? "Posting..." : "✅ I Agree — Post Request"}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

// ── Blood Group Selector ───────────────────────────────────────────────────────
function BloodGroupGrid({ selected, onSelect }: { selected: BloodGroup; onSelect: (g: BloodGroup) => void }) {
  return (
    <View style={[styles.bloodGroupGrid, { marginBottom: 10 }]}>
      {BLOOD_GROUPS.map((g) => (
        <TouchableOpacity key={g} onPress={() => onSelect(g)}
          style={[styles.bloodGroupBtn, {
            backgroundColor: selected === g ? C.primary : "#FFF5F5",
            borderColor: selected === g ? C.primary : C.border,
          }]}>
          <Text style={{ color: selected === g ? "#FFF" : C.primary, fontFamily: "Inter_700Bold", fontSize: 15 }}>{g}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 10 },
  cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#1a1a2e", marginBottom: 4 },
  bloodGroupGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  bloodGroupBtn: { minWidth: 52, height: 44, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  input: { borderRadius: 12, borderWidth: 1, borderColor: "#FFE4E4", padding: 13, fontSize: 14, fontFamily: "Inter_400Regular", color: "#1a1a2e", backgroundColor: "#FFF", marginBottom: 8 },
  actionBtn: { height: 50, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  bloodBadge: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  availBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  availDot: { width: 6, height: 6, borderRadius: 3 },
  callBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#DC2626", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  urgBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  backBtn: { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 20, padding: 8 },
});
