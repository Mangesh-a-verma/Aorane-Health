import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, Alert, Dimensions, ActivityIndicator, Image,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "@/lib/api";

const { width: W } = Dimensions.get("window");
const DOC_W = Math.min(W - 24, 480);

type ReportType = "weekly" | "monthly";
type CompanySettings = {
  companyName: string; companyLogoUrl: string | null; tagline: string | null;
  website: string | null; supportPhone: string | null; supportEmail: string | null;
  address: string | null; primaryColor: string; accentColor: string;
  reportHeaderText: string | null; reportFooterText: string | null;
  reportLogoUrl: string | null; weeklyReportEnabled: boolean; monthlyReportEnabled: boolean;
};
type Scorecard = {
  aoraneId: string; name: string; bloodGroup: string; bmi: string; bmiCategory: string;
  plan: string; gender: string; age: number | null; city: string | null; state: string | null;
  activePercent: { overall: number; foodPct: number; waterPct: number; exercisePct: number; medicinePct: number; };
};

const DEFAULT_CO: CompanySettings = {
  companyName: "AORANE Health", companyLogoUrl: null, tagline: "Aapki health, aapke haath mein",
  website: "aorane.com", supportPhone: null, supportEmail: null, address: null,
  primaryColor: "#0077B6", accentColor: "#00B896",
  reportHeaderText: null, reportFooterText: null, reportLogoUrl: null,
  weeklyReportEnabled: true, monthlyReportEnabled: true,
};

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}
function getDateRange(type: ReportType): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(now);
  if (type === "weekly") {
    const from = new Date(now);
    from.setDate(now.getDate() - 6);
    return { from, to };
  } else {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from, to };
  }
}
function getActiveLabel(pct: number): string {
  if (pct >= 90) return "Excellent";
  if (pct >= 70) return "Good";
  if (pct >= 50) return "Average";
  if (pct >= 30) return "Low";
  return "Inactive";
}
function getActiveColor(pct: number): string {
  if (pct >= 70) return "#10B981";
  if (pct >= 40) return "#F59E0B";
  return "#EF4444";
}
function getBmiColor(cat: string): string {
  return { Normal: "#10B981", Underweight: "#F59E0B", Overweight: "#F97316", Obese: "#DC2626" }[cat] || "#6B7280";
}

async function captureAndDownload(elementId: string, filename: string): Promise<void> {
  if (Platform.OS !== "web") { Alert.alert("Coming soon on mobile!"); return; }
  try {
    const html2canvas = (await import("html2canvas")).default;
    const el = document.getElementById(elementId);
    if (!el) return;
    const canvas = await html2canvas(el, { scale: 3, useCORS: true, backgroundColor: "#FFFFFF", logging: false });
    const dataUrl = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl; a.download = filename; a.click();
  } catch { Alert.alert("Error", "Report capture failed."); }
}

export default function HealthReportScreen() {
  const insets = useSafeAreaInsets();
  const [reportType, setReportType] = useState<ReportType>("weekly");
  const [card, setCard] = useState<Scorecard | null>(null);
  const [company, setCompany] = useState<CompanySettings>(DEFAULT_CO);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const dateRange = getDateRange(reportType);
  const generatedAt = new Date();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [sc, co] = await Promise.all([api.getScorecard(), api.getCompanySettings()]);
      setCard(sc as Scorecard);
      setCompany({ ...DEFAULT_CO, ...co.settings });
    } catch { }
    setLoading(false);
  };

  const handleDownload = async () => {
    setDownloading(true);
    const name = card?.name?.replace(/\s+/g, "_") || "User";
    await captureAndDownload("health-report-doc", `AORANE_${reportType}_report_${name}.png`);
    setDownloading(false);
  };

  const handleShare = async () => {
    setSharing(true);
    const name = card?.name?.replace(/\s+/g, "_") || "User";
    if (Platform.OS === "web") {
      try {
        const html2canvas = (await import("html2canvas")).default;
        const el = document.getElementById("health-report-doc");
        if (!el) { setSharing(false); return; }
        const canvas = await html2canvas(el, { scale: 3, useCORS: true, backgroundColor: "#FFFFFF", logging: false });
        const dataUrl = canvas.toDataURL("image/png");
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const file = new File([blob], `aorane_health_report.png`, { type: "image/png" });
        if ("share" in navigator) {
          try { await (navigator as unknown as { share: (d: unknown) => Promise<void> }).share({ title: "AORANE Health Report", files: [file] }); }
          catch { const a = document.createElement("a"); a.href = dataUrl; a.download = `${name}_report.png`; a.click(); }
        } else {
          const a = document.createElement("a"); a.href = dataUrl; a.download = `${name}_report.png`; a.click();
        }
      } catch { Alert.alert("Error", "Share failed."); }
    } else {
      Alert.alert("Coming soon", "Share feature coming soon on mobile.");
    }
    setSharing(false);
  };

  const logoUrl = company.reportLogoUrl || company.companyLogoUrl;
  const pColor = company.primaryColor || "#0077B6";

  const metrics = [
    {
      icon: "🍛", label: "Nutrition", value: card?.activePercent?.foodPct ?? 0,
      weight: "35%", desc: "Food logging adherence",
    },
    {
      icon: "💧", label: "Hydration", value: card?.activePercent?.waterPct ?? 0,
      weight: "30%", desc: "Water intake tracking",
    },
    {
      icon: "🏃", label: "Exercise", value: card?.activePercent?.exercisePct ?? 0,
      weight: "25%", desc: "Physical activity logged",
    },
    {
      icon: "💊", label: "Medicines", value: card?.activePercent?.medicinePct ?? 0,
      weight: "10%", desc: "Medicine adherence",
    },
  ];

  const overall = card?.activePercent?.overall ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F7FA" }}>
      <ScrollView contentContainerStyle={{ paddingTop: topPad + 12, paddingBottom: 100, paddingHorizontal: 12 }}>

        {/* ─── Header ─── */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16, paddingHorizontal: 4 }}>
          <TouchableOpacity onPress={() => router.back()}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,119,182,0.1)", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
            <Ionicons name="arrow-back" size={18} color="#0077B6" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#0D1F33", fontFamily: "Inter_700Bold", fontSize: 20 }}>Health Report</Text>
            <Text style={{ color: "#7A90A4", fontSize: 11, fontFamily: "Inter_400Regular" }}>Medical-style report generated by AORANE</Text>
          </View>
        </View>

        {/* ─── Report Type Selector ─── */}
        <View style={{ flexDirection: "row", backgroundColor: "#FFF", borderRadius: 14, padding: 4, marginBottom: 16, marginHorizontal: 4, borderWidth: 1, borderColor: "#E5EFF7" }}>
          {(["weekly", "monthly"] as ReportType[]).map((t) => (
            <TouchableOpacity key={t} onPress={() => setReportType(t)} style={{ flex: 1 }}>
              <LinearGradient
                colors={reportType === t ? [pColor, company.accentColor || "#00B896"] : ["transparent", "transparent"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={{ borderRadius: 10, paddingVertical: 10, alignItems: "center" }}>
                <Text style={{
                  fontFamily: "Inter_600SemiBold", fontSize: 13,
                  color: reportType === t ? "#FFF" : "#7A90A4",
                }}>
                  {t === "weekly" ? "Weekly Report" : "Monthly Report"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={{ alignItems: "center", paddingTop: 80 }}>
            <ActivityIndicator size="large" color="#0077B6" />
            <Text style={{ color: "#7A90A4", fontFamily: "Inter_400Regular", marginTop: 12 }}>Generating report...</Text>
          </View>
        ) : (
          <>
            {/* ─── THE REPORT DOCUMENT ─── */}
            <View
              {...(Platform.OS === "web" ? { id: "health-report-doc" } : {})}
              style={[styles.doc, { width: DOC_W, alignSelf: "center" }]}
            >
              {/* ── LETTERHEAD ── */}
              <LinearGradient colors={[pColor, company.accentColor || "#00B896"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.letterhead}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  {logoUrl ? (
                    <Image source={{ uri: logoUrl }} style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.2)" }} resizeMode="contain" />
                  ) : (
                    <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontSize: 22 }}>🏥</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 18, letterSpacing: 1 }}>
                      {company.companyName}
                    </Text>
                    {company.tagline && (
                      <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 1 }}>
                        {company.tagline}
                      </Text>
                    )}
                    {company.website && (
                      <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 9, fontFamily: "Inter_400Regular" }}>
                        {company.website}
                      </Text>
                    )}
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 8, fontFamily: "Inter_400Regular" }}>REPORT TYPE</Text>
                    <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 13, letterSpacing: 1 }}>
                      {reportType === "weekly" ? "WEEKLY" : "MONTHLY"}
                    </Text>
                  </View>
                </View>
              </LinearGradient>

              {/* Report header text from company settings */}
              {company.reportHeaderText && (
                <View style={{ backgroundColor: "#F0F7FF", padding: 10, borderBottomWidth: 1, borderColor: "#DCEDF8" }}>
                  <Text style={{ color: "#0D1F33", fontSize: 10, fontFamily: "Inter_400Regular", lineHeight: 15 }}>
                    {company.reportHeaderText}
                  </Text>
                </View>
              )}

              {/* ── REPORT INFO BAR ── */}
              <View style={styles.infoBar}>
                <View style={styles.infoCell}>
                  <Text style={styles.infoLabel}>REPORT PERIOD</Text>
                  <Text style={styles.infoVal}>{formatDate(dateRange.from)} — {formatDate(dateRange.to)}</Text>
                </View>
                <View style={[styles.infoCell, { borderLeftWidth: 1, borderColor: "#E5EFF7" }]}>
                  <Text style={styles.infoLabel}>GENERATED ON</Text>
                  <Text style={styles.infoVal}>{formatDate(generatedAt)}</Text>
                </View>
                <View style={[styles.infoCell, { borderLeftWidth: 1, borderColor: "#E5EFF7" }]}>
                  <Text style={styles.infoLabel}>REPORT NO.</Text>
                  <Text style={styles.infoVal}>#{Math.floor(Math.random() * 90000 + 10000)}</Text>
                </View>
              </View>

              {/* ── PATIENT SECTION ── */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { borderColor: pColor }]}>PATIENT INFORMATION</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
                  {[
                    { label: "Patient Name", value: card?.name || "—" },
                    { label: "AORANE ID", value: card?.aoraneId ? card.aoraneId.replace(/(\d{4})(\d{4})(\d{4})/, "$1 $2 $3") : "Not Generated" },
                    { label: "Age", value: card?.age ? `${card.age} Years` : "—" },
                    { label: "Gender", value: card?.gender ? card.gender.charAt(0).toUpperCase() + card.gender.slice(1) : "—" },
                    { label: "Blood Group", value: card?.bloodGroup || "—" },
                    { label: "BMI", value: card?.bmi ? `${card.bmi} (${card.bmiCategory})` : "—" },
                    { label: "Location", value: card?.city ? `${card.city}${card.state ? `, ${card.state}` : ""}` : "—" },
                    { label: "Health Plan", value: card?.plan?.toUpperCase() || "FREE" },
                  ].map((item) => (
                    <View key={item.label} style={styles.patientField}>
                      <Text style={styles.patientLabel}>{item.label}</Text>
                      <Text style={[styles.patientVal, item.label === "Blood Group" && { color: "#DC2626" }]}>
                        {item.value}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* ── SEPARATOR ── */}
              <View style={styles.ruler} />

              {/* ── OVERALL ACTIVITY SCORE ── */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { borderColor: pColor }]}>ACTIVITY SCORE — {reportType === "weekly" ? "THIS WEEK" : "THIS MONTH"}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 12, gap: 16 }}>
                  {/* Big score circle */}
                  <View style={[styles.scoreCircle, { borderColor: getActiveColor(overall) }]}>
                    <Text style={[styles.scoreNum, { color: getActiveColor(overall) }]}>{overall}%</Text>
                    <Text style={[styles.scoreLabel, { color: getActiveColor(overall) }]}>{getActiveLabel(overall)}</Text>
                  </View>
                  {/* Score breakdown */}
                  <View style={{ flex: 1, gap: 6 }}>
                    {metrics.map((m) => (
                      <View key={m.label}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 2 }}>
                          <Text style={{ fontSize: 10, color: "#0D1F33", fontFamily: "Inter_500Medium" }}>{m.icon} {m.label} <Text style={{ color: "#9CA3AF", fontSize: 8 }}>({m.weight})</Text></Text>
                          <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: getActiveColor(m.value) }}>{m.value}%</Text>
                        </View>
                        <View style={{ height: 5, backgroundColor: "#F0F4F8", borderRadius: 3, overflow: "hidden" }}>
                          <View style={{ height: 5, width: `${Math.max(m.value, 2)}%`, backgroundColor: getActiveColor(m.value), borderRadius: 3 }} />
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              </View>

              <View style={styles.ruler} />

              {/* ── HEALTH METRICS TABLE ── */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { borderColor: pColor }]}>HEALTH METRICS SUMMARY</Text>
                <View style={styles.table}>
                  {/* Table header */}
                  <View style={[styles.tableRow, { backgroundColor: `${pColor}12` }]}>
                    <Text style={[styles.thCell, { flex: 2 }]}>PARAMETER</Text>
                    <Text style={[styles.thCell, { flex: 1.5 }]}>VALUE</Text>
                    <Text style={[styles.thCell, { flex: 1 }]}>STATUS</Text>
                  </View>
                  {[
                    { param: "Body Mass Index (BMI)", value: card?.bmi || "N/A", cat: card?.bmiCategory || "N/A", normal: "18.5–24.9" },
                    { param: "Blood Group", value: card?.bloodGroup || "N/A", cat: "Recorded", normal: "—" },
                    { param: "Weekly Active Score", value: `${overall}%`, cat: getActiveLabel(overall), normal: "≥70% Good" },
                    { param: "Nutrition Adherence", value: `${card?.activePercent?.foodPct ?? 0}%`, cat: getActiveLabel(card?.activePercent?.foodPct ?? 0), normal: "≥70%" },
                    { param: "Hydration Score", value: `${card?.activePercent?.waterPct ?? 0}%`, cat: getActiveLabel(card?.activePercent?.waterPct ?? 0), normal: "≥70%" },
                    { param: "Exercise Adherence", value: `${card?.activePercent?.exercisePct ?? 0}%`, cat: getActiveLabel(card?.activePercent?.exercisePct ?? 0), normal: "≥70%" },
                    { param: "Medicine Adherence", value: `${card?.activePercent?.medicinePct ?? 0}%`, cat: getActiveLabel(card?.activePercent?.medicinePct ?? 0), normal: "≥70%" },
                  ].map((row, i) => (
                    <View key={i} style={[styles.tableRow, i % 2 === 0 && { backgroundColor: "#FAFBFC" }]}>
                      <Text style={[styles.tdCell, { flex: 2 }]}>{row.param}</Text>
                      <Text style={[styles.tdCell, { flex: 1.5, fontFamily: "Inter_600SemiBold" }]}>{row.value}</Text>
                      <Text style={[styles.tdCell, { flex: 1, color: getActiveColor(parseInt(row.value) || 0), fontFamily: "Inter_600SemiBold", fontSize: 9 }]}>
                        {row.cat}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.ruler} />

              {/* ── DOCTOR RECOMMENDATION BOX ── */}
              <View style={[styles.section, { backgroundColor: "#FFFBEB", borderRadius: 8, padding: 12, marginHorizontal: 12 }]}>
                <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                  <Text style={{ fontSize: 18 }}>📋</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: "Inter_700Bold", fontSize: 11, color: "#92400E", marginBottom: 4 }}>AI HEALTH INSIGHTS</Text>
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#78350F", lineHeight: 16 }}>
                      {overall >= 70
                        ? `Your health activity is ${getActiveLabel(overall).toLowerCase()} this ${reportType === "weekly" ? "week" : "month"}. Keep maintaining your current habits — especially your ${card?.activePercent?.foodPct ?? 0 > card?.activePercent?.waterPct ?? 0 ? "nutrition" : "hydration"} routine. Consistency is key to long-term health improvement.`
                        : `Your ${reportType === "weekly" ? "weekly" : "monthly"} health score of ${overall}% shows room for improvement. Focus on increasing ${card?.activePercent?.waterPct ?? 0 < 50 ? "water intake 💧" : card?.activePercent?.foodPct ?? 0 < 50 ? "meal logging 🍛" : "daily exercise 🏃"}. Small daily improvements lead to significant health gains.`
                      }
                    </Text>
                  </View>
                </View>
              </View>

              {/* ── DISCLAIMER ── */}
              <View style={{ padding: 12, paddingTop: 8 }}>
                <Text style={{ fontSize: 7.5, color: "#9CA3AF", fontFamily: "Inter_400Regular", lineHeight: 12, textAlign: "center" }}>
                  This report is auto-generated by AORANE Health platform and is for personal health tracking purposes only. It does not constitute medical advice. Please consult a qualified healthcare professional for medical diagnosis or treatment.
                </Text>
              </View>

              {/* ── FOOTER ── */}
              <LinearGradient colors={[`${pColor}18`, `${company.accentColor || "#00B896"}18`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.reportFooter}>
                {company.reportFooterText ? (
                  <Text style={{ fontSize: 9, color: "#0D1F33", fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 15 }}>
                    {company.reportFooterText}
                  </Text>
                ) : (
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: pColor, letterSpacing: 0.5 }}>
                      {company.companyName}
                    </Text>
                    <Text style={{ fontSize: 8, color: "#6B7280", fontFamily: "Inter_400Regular", marginTop: 2 }}>
                      {[company.website, company.supportEmail, company.supportPhone].filter(Boolean).join(" · ") || "aorane.com"}
                    </Text>
                    {company.address && (
                      <Text style={{ fontSize: 8, color: "#9CA3AF", fontFamily: "Inter_400Regular", marginTop: 1, textAlign: "center" }}>
                        {company.address}
                      </Text>
                    )}
                  </View>
                )}
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderColor: "#E5EFF7" }}>
                  <Text style={{ fontSize: 7.5, color: "#9CA3AF", fontFamily: "Inter_400Regular" }}>CONFIDENTIAL — FOR PATIENT USE ONLY</Text>
                  <Text style={{ fontSize: 7.5, color: "#9CA3AF", fontFamily: "Inter_400Regular" }}>Generated: {formatDate(generatedAt)}</Text>
                </View>
              </LinearGradient>
            </View>

            {/* ─── ACTION BUTTONS ─── */}
            <View style={{ width: DOC_W, alignSelf: "center", gap: 12, marginTop: 16 }}>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <TouchableOpacity onPress={handleDownload} disabled={downloading || sharing}
                  style={[styles.btn, { flex: 1, backgroundColor: pColor }]}>
                  {downloading ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="download-outline" size={18} color="#FFF" />}
                  <Text style={styles.btnText}>{downloading ? "Saving..." : "Download"}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleShare} disabled={sharing || downloading}
                  style={[styles.btn, { flex: 1, backgroundColor: company.accentColor || "#00B896" }]}>
                  {sharing ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="share-social-outline" size={18} color="#FFF" />}
                  <Text style={styles.btnText}>{sharing ? "Sharing..." : "Share Report"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  doc: {
    backgroundColor: "#FFFFFF",
    borderRadius: 4,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  letterhead: { padding: 16 },
  infoBar: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#E5EFF7" },
  infoCell: { flex: 1, padding: 10 },
  infoLabel: { fontSize: 7.5, color: "#9CA3AF", fontFamily: "Inter_500Medium", letterSpacing: 1, marginBottom: 2 },
  infoVal: { fontSize: 9, color: "#0D1F33", fontFamily: "Inter_600SemiBold" },
  section: { padding: 14 },
  sectionTitle: {
    fontSize: 9.5, color: "#374151", fontFamily: "Inter_700Bold", letterSpacing: 1.5,
    borderLeftWidth: 3, paddingLeft: 8, marginBottom: 4,
  },
  ruler: { height: 1, backgroundColor: "#E5EFF7", marginHorizontal: 14 },
  patientField: { width: "47%" },
  patientLabel: { fontSize: 8, color: "#9CA3AF", fontFamily: "Inter_500Medium", letterSpacing: 0.5, marginBottom: 2 },
  patientVal: { fontSize: 11, color: "#0D1F33", fontFamily: "Inter_600SemiBold" },
  scoreCircle: {
    width: 90, height: 90, borderRadius: 45,
    borderWidth: 4, alignItems: "center", justifyContent: "center",
    backgroundColor: "#FAFBFF",
  },
  scoreNum: { fontFamily: "Inter_700Bold", fontSize: 22 },
  scoreLabel: { fontFamily: "Inter_500Medium", fontSize: 9 },
  table: { marginTop: 10, borderWidth: 1, borderColor: "#E5EFF7", borderRadius: 6, overflow: "hidden" },
  tableRow: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 1, borderColor: "#E5EFF7" },
  thCell: { fontSize: 8, fontFamily: "Inter_700Bold", color: "#374151", letterSpacing: 0.8 },
  tdCell: { fontSize: 9.5, fontFamily: "Inter_400Regular", color: "#0D1F33" },
  reportFooter: { padding: 14 },
  btn: {
    borderRadius: 12, padding: 14, flexDirection: "row",
    alignItems: "center", justifyContent: "center", gap: 8,
  },
  btnText: { color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 14 },
});
