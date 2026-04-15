import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, Alert, Dimensions, ActivityIndicator, Modal, Image, Share,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
import { api } from "@/lib/api";
import QRCode from "react-native-qrcode-svg";

const { width: W } = Dimensions.get("window");
const CARD_W = Math.min(W - 32, 380);
const CARD_H = Math.round(CARD_W / 1.586);
const AORANE_URL = "https://aorane.com";

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
type CompanySettings = {
  companyName: string; companyLogoUrl: string | null; tagline: string | null;
  website: string | null; supportPhone: string | null; supportEmail: string | null;
  address: string | null; primaryColor: string; accentColor: string;
  scorecardShowQr: boolean; scorecardShowBloodGroup: boolean; scorecardShowBmi: boolean;
  scorecardShowActivePercent: boolean; scorecardBgGradientFrom: string; scorecardBgGradientTo: string;
  reportHeaderText: string | null; reportFooterText: string | null; reportLogoUrl: string | null;
  weeklyReportEnabled: boolean; monthlyReportEnabled: boolean;
};
const DEFAULT_COMPANY: CompanySettings = {
  companyName: "AORANE Health", companyLogoUrl: null, tagline: "Your health, in your hands",
  website: "aorane.com", supportPhone: null, supportEmail: null, address: null,
  primaryColor: "#0077B6", accentColor: "#00B896",
  scorecardShowQr: true, scorecardShowBloodGroup: true, scorecardShowBmi: true, scorecardShowActivePercent: true,
  scorecardBgGradientFrom: "#023E8A", scorecardBgGradientTo: "#1B998B",
  reportHeaderText: null, reportFooterText: null, reportLogoUrl: null,
  weeklyReportEnabled: true, monthlyReportEnabled: true,
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
  const [company, setCompany] = useState<CompanySettings>(DEFAULT_COMPANY);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[4]);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [shareDate, setShareDate] = useState(new Date());
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => { loadCard(); loadCompany(); }, []);

  const loadCard = async () => {
    try {
      const d = await api.getScorecard();
      setCard(d as Scorecard);
    } catch { }
    setLoading(false);
  };

  const loadCompany = async () => {
    try {
      const d = await api.getCompanySettings();
      setCompany({ ...DEFAULT_COMPANY, ...d.settings });
    } catch { }
  };

  // Generate a beautiful HTML card for PDF sharing on native
  const generateCardHtml = (c: Scorecard, date: Date) => `
<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; font-family: Arial, sans-serif; }
  body { background: #F0F9FF; padding: 24px; }
  .card { background: linear-gradient(135deg, #023E8A 0%, #0077B6 50%, #1B998B 100%);
    border-radius: 20px; padding: 28px; max-width: 400px; margin: 0 auto; color: #FFF; }
  .logo { font-size: 22px; font-weight: 900; letter-spacing: 3px; margin-bottom: 4px; }
  .tagline { font-size: 11px; opacity: 0.75; margin-bottom: 20px; }
  .divider { height: 1px; background: rgba(255,255,255,0.2); margin: 16px 0; }
  .name { font-size: 22px; font-weight: 700; }
  .id { font-size: 18px; font-weight: 800; letter-spacing: 2px; margin: 8px 0; opacity: 0.95; }
  .plan-badge { display: inline-block; background: rgba(255,255,255,0.18); border-radius: 8px;
    padding: 2px 10px; font-size: 11px; font-weight: 700; letter-spacing: 1px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 16px 0; }
  .box { background: rgba(255,255,255,0.12); border-radius: 12px; padding: 12px; }
  .box-label { font-size: 10px; opacity: 0.7; text-transform: uppercase; letter-spacing: 0.5px; }
  .box-value { font-size: 18px; font-weight: 700; margin-top: 2px; }
  .score-section { text-align: center; margin: 16px 0; }
  .score-num { font-size: 52px; font-weight: 900; line-height: 1; }
  .score-label { font-size: 13px; opacity: 0.75; margin-top: 4px; }
  .grade { font-size: 28px; font-weight: 900; }
  .footer { font-size: 10px; opacity: 0.5; text-align: center; margin-top: 16px; }
</style></head><body>
<div class="card">
  <div class="logo">AORANE</div>
  <div class="tagline">स्वास्थ्य ही धन — Your Health, Your Wealth</div>
  <div class="name">${c.name || "User"}</div>
  <div class="id">${(c.aoraneId || "").replace(/(\d{4})(\d{4})(\d{4})/, "$1  $2  $3")}</div>
  <span class="plan-badge">${(c.plan || "FREE").toUpperCase()} MEMBER</span>
  <div class="divider"></div>
  <div class="score-section">
    <div class="score-num">${Math.round(c.activePercent?.overall ?? 0)}</div>
    <div class="score-label">Health Score • ${c.activePercent?.overall >= 80 ? 'Excellent 🌟' : c.activePercent?.overall >= 60 ? 'Good 👍' : c.activePercent?.overall >= 40 ? 'Average 📊' : 'Needs Improvement ⚡'}</div>
  </div>
  <div class="grid">
    ${c.bloodGroup ? `<div class="box"><div class="box-label">Blood Group</div><div class="box-value">${c.bloodGroup}</div></div>` : ''}
    ${c.bmi ? `<div class="box"><div class="box-label">BMI</div><div class="box-value">${c.bmi} <span style="font-size:13px;opacity:0.8">${c.bmiCategory || ''}</span></div></div>` : ''}
    ${c.age ? `<div class="box"><div class="box-label">Age</div><div class="box-value">${c.age} yrs</div></div>` : ''}
    ${c.city ? `<div class="box"><div class="box-label">Location</div><div class="box-value" style="font-size:14px">${c.city}${c.state ? ', ' + c.state : ''}</div></div>` : ''}
  </div>
  <div class="divider"></div>
  <div class="footer">
    Generated on ${date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} • aorane.com
  </div>
</div>
</body></html>`;

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
      try {
        const html = generateCardHtml(card, now);
        const { uri } = await Print.printToFileAsync({ html, base64: false });
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Save AORANE Health Card" });
        } else {
          Alert.alert("Saved", `Health card PDF saved to: ${uri}`);
        }
      } catch {
        Alert.alert("Error", "Could not save health card. Please try again.");
      }
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
      try {
        const html = generateCardHtml(card, now);
        const { uri } = await Print.printToFileAsync({ html, base64: false });
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Share AORANE Health Card" });
        } else {
          // Fallback: share text via native Share sheet
          await Share.share({
            title: "My AORANE Health Card",
            message: `🏥 My AORANE Health Card\n\nName: ${card.name}\nAORANE ID: ${(card.aoraneId || "").replace(/(\d{4})(\d{4})(\d{4})/, "$1 $2 $3")}\nHealth Score: ${Math.round(card.activePercent?.overall ?? 0)}\nBlood Group: ${card.bloodGroup || "N/A"}\nBMI: ${card.bmi || "N/A"}\n\nDownload AORANE: https://play.google.com/store/apps/details?id=in.aorane.app`,
          });
        }
      } catch {
        Alert.alert("Error", "Could not share health card. Please try again.");
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
            {/* ─── SHAREABLE ATM CARD ─── */}
            <View
              {...(Platform.OS === "web" ? { id: "aorane-scorecard-card" } : {})}
              style={[styles.cardShell, { width: CARD_W, height: CARD_H, alignSelf: "center" }]}
            >
              <LinearGradient
                colors={[company.scorecardBgGradientFrom || "#023E8A", company.primaryColor || "#0077B6", company.scorecardBgGradientTo || "#1B998B"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={[styles.cardGrad, { height: CARD_H }]}
              >
                {/* Decorative blobs */}
                <View style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(255,255,255,0.06)" }} />
                <View style={{ position: "absolute", bottom: -40, left: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: "rgba(255,255,255,0.04)" }} />

                {/* ── TOP ROW: Logo + Plan Badge ── */}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    {company.companyLogoUrl ? (
                      <Image source={{ uri: company.companyLogoUrl }} style={{ width: 20, height: 20, borderRadius: 4 }} resizeMode="contain" />
                    ) : (
                      <View style={{ width: 20, height: 20, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ color: "#FFF", fontSize: 8, fontFamily: "Inter_700Bold" }}>A</Text>
                      </View>
                    )}
                    <Text style={{ color: "rgba(255,255,255,0.9)", fontFamily: "Inter_700Bold", fontSize: 12, letterSpacing: 2 }}>
                      {company.companyName.toUpperCase()}
                    </Text>
                  </View>
                  <View style={[styles.planBadge, { backgroundColor: PLAN_COLORS[card.plan] || "#6B7280" }]}>
                    <Text style={styles.planText}>{PLAN_LABELS[card.plan] || "FREE"}</Text>
                  </View>
                </View>

                {/* ── MAIN ROW: Left (user info) + Right (QR) ── */}
                <View style={{ flexDirection: "row", flex: 1, alignItems: "center" }}>
                  {/* Left: avatar + name + ID + metrics */}
                  <View style={{ flex: 1 }}>
                    {/* Avatar + Name */}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <LinearGradient colors={selectedAvatar.bg as [string, string]} style={{ width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontSize: 18 }}>{selectedAvatar.emoji}</Text>
                      </LinearGradient>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 13 }} numberOfLines={1}>
                          {card.name || "AORANE User"}
                        </Text>
                        <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 9, fontFamily: "Inter_400Regular" }}>
                          {card.age ? `Age ${card.age}` : ""}
                          {card.age && card.gender ? " • " : ""}
                          {card.gender === "male" ? "Male" : card.gender === "female" ? "Female" : ""}
                        </Text>
                      </View>
                    </View>
                    {/* ID */}
                    <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 7, fontFamily: "Inter_500Medium", letterSpacing: 1.5, marginBottom: 1 }}>AORANE ID</Text>
                    <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 2, marginBottom: 8 }}>
                      {formatId(card.aoraneId)}
                    </Text>
                    {/* Metric chips */}
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      <View style={{ backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 7, paddingHorizontal: 7, paddingVertical: 4, alignItems: "center" }}>
                        <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 6, fontFamily: "Inter_500Medium", letterSpacing: 0.8 }}>HEALTH</Text>
                        <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 13 }}>{Math.round(card.activePercent?.overall ?? 0)}%</Text>
                      </View>
                      <View style={{ backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 7, paddingHorizontal: 7, paddingVertical: 4, alignItems: "center" }}>
                        <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 6, fontFamily: "Inter_500Medium", letterSpacing: 0.8 }}>ACTIVE</Text>
                        <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 13 }}>{Math.round(card.activePercent?.exercisePct ?? 0)}%</Text>
                      </View>
                      {card.bloodGroup ? (
                        <View style={{ backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 7, paddingHorizontal: 7, paddingVertical: 4, alignItems: "center" }}>
                          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 6, fontFamily: "Inter_500Medium", letterSpacing: 0.8 }}>BLOOD</Text>
                          <Text style={{ color: "#FFA0A0", fontFamily: "Inter_700Bold", fontSize: 13 }}>{card.bloodGroup}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  {/* Right: QR code */}
                  <View style={{ alignItems: "center", marginLeft: 12 }}>
                    <View style={{ backgroundColor: "#FFF", borderRadius: 8, padding: 5 }}>
                      <QRCode value={AORANE_URL} size={58} color="#023E8A" backgroundColor="#FFF" />
                    </View>
                    <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 7, fontFamily: "Inter_400Regular", marginTop: 3 }}>
                      aorane.com
                    </Text>
                  </View>
                </View>

                {/* ── BOTTOM: date footer ── */}
                <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 6, fontFamily: "Inter_400Regular", marginTop: 6, letterSpacing: 0.5 }}>
                  {formatCardDate(shareDate)} • स्वास्थ्य ही धन
                </Text>
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

              {/* Health Report */}
              <TouchableOpacity
                onPress={() => router.push("/health-report" as never)}
                style={[styles.actionBtn, { backgroundColor: "rgba(16,185,129,0.08)", borderWidth: 1.5, borderColor: "#10B981" }]}
              >
                <Ionicons name="document-text-outline" size={18} color="#10B981" />
                <Text style={[styles.actionBtnText, { color: "#10B981" }]}>Generate Health Report</Text>
              </TouchableOpacity>

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
    borderRadius: 18,
    padding: 16,
    overflow: "hidden",
    flex: 1,
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
