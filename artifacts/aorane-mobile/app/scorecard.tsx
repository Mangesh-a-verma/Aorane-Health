import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, Alert, Dimensions, ActivityIndicator, Modal, Image,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Sharing from "expo-sharing";
import { api } from "@/lib/api";
import QRCode from "react-native-qrcode-svg";

const { width: W } = Dimensions.get("window");
const CARD_W = Math.min(W - 32, 400);
const PLAYSTORE_URL = "https://play.google.com/store/apps/details?id=in.aorane.health";

// ─── Avatar options ───────────────────────────────────────────────────────────
const AVATARS = [
  { id: "avatar_1", emoji: "🦁", bg: ["#F59E0B", "#D97706"] },
  { id: "avatar_2", emoji: "🐯", bg: ["#EF4444", "#DC2626"] },
  { id: "avatar_3", emoji: "🦊", bg: ["#F97316", "#EA580C"] },
  { id: "avatar_4", emoji: "🐻", bg: ["#8B5CF6", "#7C3AED"] },
  { id: "avatar_5", emoji: "🦅", bg: ["#0077B6", "#0369A1"] },
  { id: "avatar_6", emoji: "🌸", bg: ["#EC4899", "#DB2777"] },
  { id: "avatar_7", emoji: "🌿", bg: ["#10B981", "#059669"] },
  { id: "avatar_8", emoji: "⚡", bg: ["#06B6D4", "#0891B2"] },
];

type ActivePercent = {
  overall: number; foodPct: number; waterPct: number;
  exercisePct: number; medicinePct: number;
};
type Scorecard = {
  aoraneId: string; name: string; bloodGroup: string; bmi: string;
  bmiCategory: string; plan: string; gender: string; age: number | null;
  memberSince: string; city: string | null; state: string | null;
  workProfile: string | null; profilePhotoUrl?: string | null;
  activePercent: ActivePercent;
};

const PLAN_COLORS: Record<string, string> = {
  free: "#6B7280", pro: "#0077B6", max: "#8B5CF6", family: "#10B981",
};
const PLAN_LABELS: Record<string, string> = {
  free: "FREE", pro: "PRO", max: "MAX", family: "FAMILY",
};

// ─── Format AORANE ID with spaces ────────────────────────────────────────────
function formatId(id: string): string {
  if (!id) return "———";
  return id.replace(/(\d{4})(\d{4})(\d{4})/, "$1  $2  $3");
}

// ─── Format date for card ─────────────────────────────────────────────────────
function formatCardDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric"
  }).replace(/ /g, " ");
}

// ─── BMI color ────────────────────────────────────────────────────────────────
function getBmiColor(cat: string): string {
  return { Normal: "#10B981", Underweight: "#F59E0B", Overweight: "#F97316", Obese: "#DC2626" }[cat] || "#6B7280";
}

// ─── Active label ─────────────────────────────────────────────────────────────
function getActiveLabel(pct: number): string {
  if (pct >= 90) return "Excellent";
  if (pct >= 70) return "Good";
  if (pct >= 50) return "Average";
  if (pct >= 30) return "Low";
  return "Inactive";
}

// ─── Web: capture div as image and download ───────────────────────────────────
async function captureAndDownload(elementId: string, filename: string): Promise<string | null> {
  if (Platform.OS !== "web") return null;
  try {
    const html2canvas = (await import("html2canvas")).default;
    const el = document.getElementById(elementId);
    if (!el) return null;
    const canvas = await html2canvas(el, {
      scale: 3,
      useCORS: true,
      backgroundColor: null,
      logging: false,
    });
    const dataUrl = canvas.toDataURL("image/png");
    return dataUrl;
  } catch {
    return null;
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ScorecardScreen() {
  const insets = useSafeAreaInsets();
  const [card, setCard] = useState<Scorecard | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[4]);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [shareDate, setShareDate] = useState(new Date());
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => { loadCard(); }, []);

  const loadCard = async () => {
    try {
      const d = await api.getScorecard();
      setCard(d as Scorecard);
    } catch { }
    setLoading(false);
  };

  const handleDownload = async () => {
    if (!card) return;
    setDownloading(true);
    const now = new Date();
    setShareDate(now);
    const filename = `AORANE_Health_Card_${card.aoraneId || "user"}.png`;

    if (Platform.OS === "web") {
      await new Promise((r) => setTimeout(r, 150));
      const dataUrl = await captureAndDownload("aorane-scorecard-card", filename);
      if (dataUrl) {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = filename;
        a.click();
      } else {
        Alert.alert("Error", "Card capture failed. Please try again.");
      }
    } else {
      Alert.alert("Download", "Save card to Photos? (Feature coming soon on mobile)");
    }
    setDownloading(false);
  };

  const handleShare = async () => {
    if (!card) return;
    setSharing(true);
    const now = new Date();
    setShareDate(now);

    if (Platform.OS === "web") {
      await new Promise((r) => setTimeout(r, 150));
      const dataUrl = await captureAndDownload("aorane-scorecard-card", "aorane-card.png");
      if (dataUrl && typeof navigator !== "undefined" && "share" in navigator) {
        try {
          const res = await fetch(dataUrl);
          const blob = await res.blob();
          const file = new File([blob], "aorane-health-card.png", { type: "image/png" });
          await (navigator as unknown as { share: (data: unknown) => Promise<void> }).share({
            title: "My AORANE Health Card",
            text: `My AORANE ID: ${card.aoraneId}\nCheck out the AORANE Health App!`,
            files: [file],
          });
        } catch {
          if (dataUrl) {
            const a = document.createElement("a");
            a.href = dataUrl;
            a.download = "aorane-health-card.png";
            a.click();
          }
        }
      } else if (dataUrl) {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = "aorane-health-card.png";
        a.click();
      }
    } else {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        Alert.alert("Share", "Share card as image? (Feature coming soon)");
      }
    }
    setSharing(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F0F9FF" }}>
      <LinearGradient colors={["#E0F2FE", "#BAE6FD", "#EFF6FF"]} style={StyleSheet.absoluteFill} />

      <ScrollView contentContainerStyle={{ paddingTop: topPad + 12, paddingBottom: 100, paddingHorizontal: 16 }}>

        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
          <TouchableOpacity onPress={() => router.back()}
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(0,119,182,0.1)", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
            <Ionicons name="arrow-back" size={20} color="#0077B6" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#0D1F33", fontFamily: "Inter_700Bold", fontSize: 22 }}>Health Scorecard</Text>
            <Text style={{ color: "#7A90A4", fontSize: 12, fontFamily: "Inter_400Regular" }}>Your AORANE Health Identity</Text>
          </View>
          <TouchableOpacity onPress={() => setShowAvatarPicker(true)}
            style={{ backgroundColor: "rgba(0,119,182,0.08)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Text style={{ fontSize: 16 }}>{selectedAvatar.emoji}</Text>
            <Text style={{ color: "#0077B6", fontFamily: "Inter_600SemiBold", fontSize: 12 }}>Avatar</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={{ alignItems: "center", paddingTop: 80 }}>
            <ActivityIndicator size="large" color="#0077B6" />
            <Text style={{ color: "#7A90A4", fontFamily: "Inter_400Regular", marginTop: 12 }}>Loading your card...</Text>
          </View>
        ) : card ? (
          <>
            {/* ─── SHAREABLE CARD (captured for download/share) ─── */}
            <View
              {...(Platform.OS === "web" ? { id: "aorane-scorecard-card" } : {})}
              style={[styles.cardShell, { width: CARD_W, alignSelf: "center" }]}
            >
              {/* Card gradient background */}
              <LinearGradient
                colors={["#023E8A", "#0077B6", "#1B998B"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.cardGrad}
              >
                {/* Decorative circles */}
                <View style={{ position: "absolute", top: -50, right: -50, width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(255,255,255,0.06)" }} />
                <View style={{ position: "absolute", bottom: -60, left: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(255,255,255,0.04)" }} />
                <View style={{ position: "absolute", top: 60, right: -20, width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(255,255,255,0.05)" }} />

                {/* ── TOP ROW: Logo + Plan Badge ── */}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
                  <View>
                    <Text style={{ color: "rgba(255,255,255,0.9)", fontFamily: "Inter_700Bold", fontSize: 20, letterSpacing: 2 }}>AORANE</Text>
                    <Text style={{ color: "rgba(255,255,255,0.55)", fontFamily: "Inter_400Regular", fontSize: 9, letterSpacing: 1.5, marginTop: 1 }}>HEALTH IDENTITY CARD</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 6 }}>
                    <View style={[styles.planBadge, { backgroundColor: PLAN_COLORS[card.plan] || "#6B7280" }]}>
                      <Text style={styles.planText}>{PLAN_LABELS[card.plan] || "FREE"}</Text>
                    </View>
                    <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 8, fontFamily: "Inter_400Regular" }}>
                      {formatCardDate(shareDate)}
                    </Text>
                  </View>
                </View>

                {/* ── AVATAR + NAME SECTION ── */}
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20, gap: 14 }}>
                  {/* Avatar */}
                  <View style={styles.avatarRing}>
                    <LinearGradient colors={selectedAvatar.bg as [string, string]} style={styles.avatarInner}>
                      <Text style={{ fontSize: 28 }}>{selectedAvatar.emoji}</Text>
                    </LinearGradient>
                  </View>
                  {/* User info */}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 18, marginBottom: 3 }} numberOfLines={1}>
                      {card.name || "AORANE User"}
                    </Text>
                    <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
                      <Text style={styles.infoChip}>
                        {card.gender === "male" ? "Male" : card.gender === "female" ? "Female" : "Other"}
                      </Text>
                      {card.age && <Text style={styles.infoChip}>Age {card.age}</Text>}
                      {card.bloodGroup && <Text style={[styles.infoChip, { color: "#FFA0A0" }]}>{card.bloodGroup}</Text>}
                    </View>
                    {card.city && (
                      <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 3 }}>
                        {card.city}{card.state ? `, ${card.state}` : ""}
                      </Text>
                    )}
                  </View>
                </View>

                {/* ── AORANE ID ── */}
                <View style={styles.idBox}>
                  <Text style={styles.idLabel}>AORANE ID</Text>
                  <Text style={styles.idValue}>{formatId(card.aoraneId)}</Text>
                </View>

                {/* ── HEALTH METRICS ROW ── */}
                <View style={{ flexDirection: "row", gap: 10, marginBottom: 18 }}>
                  {[
                    { label: "BMI", value: card.bmi || "N/A", sub: card.bmiCategory },
                    { label: "BLOOD", value: card.bloodGroup || "N/A", sub: "Group" },
                    { label: "ACTIVE", value: `${card.activePercent?.overall ?? 0}%`, sub: getActiveLabel(card.activePercent?.overall ?? 0) },
                  ].map((m) => (
                    <View key={m.label} style={styles.metricBox}>
                      <Text style={styles.metricLabel}>{m.label}</Text>
                      <Text style={styles.metricVal}>{m.value}</Text>
                      <Text style={styles.metricSub}>{m.sub}</Text>
                    </View>
                  ))}
                </View>

                {/* ── ACTIVE PERCENTAGE BAR ── */}
                {card.activePercent && (
                  <View style={{ marginBottom: 18 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                      <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 9, fontFamily: "Inter_500Medium", letterSpacing: 1 }}>ACTIVITY SCORE</Text>
                      <Text style={{ color: "#FFF", fontSize: 9, fontFamily: "Inter_700Bold" }}>{card.activePercent.overall}% Active</Text>
                    </View>
                    <View style={{ height: 6, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 3, overflow: "hidden" }}>
                      <LinearGradient
                        colors={card.activePercent.overall >= 70 ? ["#00F5A0", "#00D9F5"] : card.activePercent.overall >= 40 ? ["#F59E0B", "#EF4444"] : ["#6B7280", "#4B5563"]}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={{ height: 6, width: `${Math.max(card.activePercent.overall, 3)}%`, borderRadius: 3 }}
                      />
                    </View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 5 }}>
                      {[
                        { icon: "🍛", val: card.activePercent.foodPct },
                        { icon: "💧", val: card.activePercent.waterPct },
                        { icon: "🏃", val: card.activePercent.exercisePct },
                        { icon: "💊", val: card.activePercent.medicinePct },
                      ].map((it) => (
                        <View key={it.icon} style={{ alignItems: "center" }}>
                          <Text style={{ fontSize: 11 }}>{it.icon}</Text>
                          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 9, fontFamily: "Inter_500Medium" }}>{it.val}%</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* ── BOTTOM: QR CODE + DIVIDER ── */}
                <View style={styles.cardBottom}>
                  {/* Left: QR code */}
                  <View style={styles.qrBox}>
                    <QRCode
                      value={PLAYSTORE_URL}
                      size={64}
                      color="#FFFFFF"
                      backgroundColor="transparent"
                    />
                    <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 7, fontFamily: "Inter_400Regular", marginTop: 4, textAlign: "center" }}>
                      Scan to Download
                    </Text>
                  </View>
                  {/* Divider */}
                  <View style={{ width: 1, backgroundColor: "rgba(255,255,255,0.15)", marginHorizontal: 14, alignSelf: "stretch" }} />
                  {/* Right: chip + company */}
                  <View style={{ flex: 1, justifyContent: "space-between" }}>
                    {/* Chip simulation */}
                    <View style={styles.chip}>
                      {[0,1,2,3,4,5].map((i) => (
                        <View key={i} style={{ flexDirection: "row" }}>
                          {[0,1,2].map((j) => (
                            <View key={j} style={{ width: 6, height: 5, borderWidth: 0.5, borderColor: "rgba(255,220,100,0.6)", margin: 0.5, borderRadius: 1 }} />
                          ))}
                        </View>
                      ))}
                    </View>
                    <View>
                      <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 8, fontFamily: "Inter_400Regular", marginBottom: 2 }}>VALID THRU</Text>
                      <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 1 }}>LIFETIME</Text>
                    </View>
                  </View>
                </View>

                {/* Company name */}
                <View style={styles.companyRow}>
                  <View style={{ height: 1, flex: 1, backgroundColor: "rgba(255,255,255,0.12)", marginRight: 10 }} />
                  <Text style={styles.companyText}>AORANE Health Pvt. Ltd. · aorane.com · India</Text>
                  <View style={{ height: 1, flex: 1, backgroundColor: "rgba(255,255,255,0.12)", marginLeft: 10 }} />
                </View>
              </LinearGradient>
            </View>

            {/* ─── ACTION BUTTONS ─── */}
            <View style={{ gap: 12, marginTop: 20 }}>
              <View style={{ flexDirection: "row", gap: 12 }}>
                {/* Download */}
                <TouchableOpacity
                  onPress={handleDownload}
                  disabled={downloading || sharing}
                  style={[styles.actionBtn, { flex: 1, backgroundColor: "#0077B6" }]}
                >
                  {downloading ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Ionicons name="download-outline" size={20} color="#FFF" />
                  )}
                  <Text style={styles.actionBtnText}>{downloading ? "Saving..." : "Download"}</Text>
                </TouchableOpacity>

                {/* Share */}
                <TouchableOpacity
                  onPress={handleShare}
                  disabled={sharing || downloading}
                  style={[styles.actionBtn, { flex: 1, backgroundColor: "#00B896" }]}
                >
                  {sharing ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Ionicons name="share-social-outline" size={20} color="#FFF" />
                  )}
                  <Text style={styles.actionBtnText}>{sharing ? "Sharing..." : "Share Card"}</Text>
                </TouchableOpacity>
              </View>

              {/* Copy ID */}
              <TouchableOpacity
                onPress={() => {
                  if (card?.aoraneId && Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
                    navigator.clipboard.writeText(card.aoraneId);
                    Alert.alert("Copied!", `AORANE ID: ${card.aoraneId}`);
                  } else {
                    Alert.alert("Your AORANE ID", card?.aoraneId || "N/A");
                  }
                }}
                style={[styles.actionBtn, { backgroundColor: "rgba(0,119,182,0.08)", borderWidth: 1.5, borderColor: "#0077B6" }]}
              >
                <Ionicons name="copy-outline" size={18} color="#0077B6" />
                <Text style={[styles.actionBtnText, { color: "#0077B6" }]}>Copy AORANE ID</Text>
              </TouchableOpacity>
            </View>

            {/* Info note */}
            <Text style={{ textAlign: "center", color: "#7A90A4", fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 16, lineHeight: 18 }}>
              The date shown on your card is the date of download/share.{"\n"}
              Your AORANE ID is permanent and never changes.
            </Text>
          </>
        ) : (
          <View style={{ alignItems: "center", padding: 40, backgroundColor: "rgba(255,255,255,0.6)", borderRadius: 20 }}>
            <Text style={{ fontSize: 52 }}>🪪</Text>
            <Text style={{ color: "#0D1F33", fontFamily: "Inter_700Bold", fontSize: 18, marginTop: 14, textAlign: "center" }}>
              Complete Your Profile First
            </Text>
            <Text style={{ color: "#7A90A4", fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 8 }}>
              Add your name, blood group, and health details in your profile to generate your AORANE ID.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ─── AVATAR PICKER MODAL ─── */}
      <Modal visible={showAvatarPicker} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#FFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 18, color: "#0D1F33", marginBottom: 6 }}>Choose Your Avatar</Text>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#7A90A4", marginBottom: 20 }}>
              This avatar appears on your Health Scorecard
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
              {AVATARS.map((av) => (
                <TouchableOpacity
                  key={av.id}
                  onPress={() => { setSelectedAvatar(av); setShowAvatarPicker(false); }}
                  style={[styles.avatarOption, selectedAvatar.id === av.id && styles.avatarOptionSelected]}
                >
                  <LinearGradient colors={av.bg as [string, string]} style={styles.avatarOptionGrad}>
                    <Text style={{ fontSize: 32 }}>{av.emoji}</Text>
                  </LinearGradient>
                  {selectedAvatar.id === av.id && (
                    <View style={styles.avatarCheck}>
                      <Ionicons name="checkmark" size={12} color="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              onPress={() => setShowAvatarPicker(false)}
              style={{ marginTop: 20, padding: 14, backgroundColor: "#F0F9FF", borderRadius: 14, alignItems: "center" }}
            >
              <Text style={{ color: "#0077B6", fontFamily: "Inter_600SemiBold", fontSize: 15 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  cardShell: {
    borderRadius: 22,
    shadowColor: "#0077B6",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 16,
    marginBottom: 4,
  },
  cardGrad: {
    borderRadius: 22,
    padding: 24,
    overflow: "hidden",
  },
  planBadge: {
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  planText: {
    color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 1.5,
  },
  avatarRing: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 2.5, borderColor: "rgba(255,255,255,0.4)",
    padding: 2,
  },
  avatarInner: {
    flex: 1, borderRadius: 30, alignItems: "center", justifyContent: "center",
  },
  infoChip: {
    color: "rgba(255,255,255,0.75)", fontSize: 11,
    fontFamily: "Inter_500Medium", letterSpacing: 0.3,
  },
  idBox: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12, padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  idLabel: {
    color: "rgba(255,255,255,0.55)", fontSize: 9,
    fontFamily: "Inter_500Medium", letterSpacing: 2, marginBottom: 4,
  },
  idValue: {
    color: "#FFF", fontFamily: "Inter_700Bold",
    fontSize: 20, letterSpacing: 3,
  },
  metricBox: {
    flex: 1, backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 10, padding: 10, alignItems: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  metricLabel: {
    color: "rgba(255,255,255,0.5)", fontSize: 8,
    fontFamily: "Inter_500Medium", letterSpacing: 1.5, marginBottom: 3,
  },
  metricVal: {
    color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 16, marginBottom: 1,
  },
  metricSub: {
    color: "rgba(255,255,255,0.55)", fontSize: 8, fontFamily: "Inter_400Regular",
  },
  cardBottom: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 14, padding: 14, marginBottom: 14,
  },
  qrBox: {
    alignItems: "center",
  },
  chip: {
    backgroundColor: "rgba(255,220,100,0.15)",
    borderRadius: 6, padding: 5, alignSelf: "flex-start",
  },
  companyRow: {
    flexDirection: "row", alignItems: "center",
  },
  companyText: {
    color: "rgba(255,255,255,0.4)", fontSize: 8,
    fontFamily: "Inter_400Regular", letterSpacing: 0.8, textAlign: "center",
  },
  actionBtn: {
    borderRadius: 14, padding: 15, flexDirection: "row",
    alignItems: "center", justifyContent: "center", gap: 8,
  },
  actionBtnText: {
    color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 15,
  },
  avatarOption: {
    position: "relative",
    borderRadius: 20, padding: 3,
    borderWidth: 3, borderColor: "transparent",
  },
  avatarOptionSelected: {
    borderColor: "#0077B6",
    shadowColor: "#0077B6", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 8,
  },
  avatarOptionGrad: {
    width: 64, height: 64, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
  },
  avatarCheck: {
    position: "absolute", bottom: 0, right: 0,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: "#0077B6", alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#FFF",
  },
});
