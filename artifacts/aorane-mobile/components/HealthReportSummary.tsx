// components/HealthReportSummary.tsx
//
// Native "Health Report" summary screen — shows a dashboard-style snapshot
// of the same data that goes into the PDF (ReportData), instead of loading
// the full 10-page report inside a WebView. The full report is still one
// tap away via "View Detailed Report" / "Download PDF" / "Share Report".
//
// All numbers here come from the same `ReportData` object used by
// buildHealthReport.ts, and reuse the same pure calculation helpers from
// `lib/reports/reportLogic.ts` — so the summary and the PDF never disagree.

import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useFonts, Inter_800ExtraBold } from "@expo-google-fonts/inter";
import { PremiumScoreRing } from "./PremiumScoreRing";
import { ReportData } from "@/lib/reports/reportTypes";
import {
  getGrade,
  calcHealthAge,
  buildRiskCards,
  buildAiHealthInsight,
  buildRecommendations,
  calcMedPct,
  RiskCard,
} from "@/lib/reports/reportLogic";
import { api } from "@/lib/api";
// AoraneLogo is shown in PDF only (buildHealthReport.ts), NOT on this screen

// ─── Mini ring for the 6 Health Pillars row ──────────────────────────────

function MiniRing({ pct, color, size = 56, strokeWidth = 5 }: { pct: number; color: string; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (Math.min(100, Math.max(0, pct)) / 100) * circumference;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke="#E8F0F8" strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={color} strokeWidth={strokeWidth} fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          rotation="-90"
          originX={size / 2}
          originY={size / 2}
        />
      </Svg>
      <View style={{ position: "absolute" }}>
        <Text style={{ fontSize: 13, fontFamily: "Inter_800ExtraBold", color: "#0D1F33" }}>{Math.round(pct)}%</Text>
      </View>
    </View>
  );
}

// ─── Simple bar-trend (Health Score / Water — last 7 logged days) ───────

function MiniBarTrend({ values, labels, color, max }: { values: number[]; labels: string[]; color: string; max: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", height: 64, gap: 6 }}>
      {values.map((v, i) => {
        const h = v > 0 ? Math.max(6, Math.round((v / max) * 56)) : 2;
        return (
          <View key={i} style={{ flex: 1, alignItems: "center", gap: 4 }}>
            <View style={{ height: h, width: "100%", maxWidth: 18, backgroundColor: v > 0 ? color : "#E8F0F8", borderRadius: 4 }} />
            <Text style={{ fontSize: 9, color: "#94A3B8", fontFamily: "Inter_500Medium" }}>{labels[i]}</Text>
          </View>
        );
      })}
    </View>
  );
}

function riskBadgeColors(risk: RiskCard["risk"]) {
  if (risk === "Low") return { bg: "#ECFDF5", fg: "#059669" };
  if (risk === "Moderate") return { bg: "#FFFBEB", fg: "#D97706" };
  return { bg: "#FEF2F2", fg: "#DC2626" };
}

const PILLAR_META: { key: keyof ReportData["scores"]; label: string; color: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "foodPct", label: "Nutrition", color: "#10B981", icon: "leaf-outline" },
  { key: "waterPct", label: "Hydration", color: "#0EA5E9", icon: "water-outline" },
  { key: "exercisePct", label: "Exercise", color: "#F97316", icon: "walk-outline" },
  { key: "sleepPct", label: "Sleep", color: "#8B5CF6", icon: "moon-outline" },
  { key: "stressPct", label: "Stress", color: "#14B8A6", icon: "leaf" },
  { key: "medicinePct", label: "Medication", color: "#3B82F6", icon: "medkit-outline" },
];

function pillarStatusLabel(pct: number): string {
  if (pct >= 90) return "Excellent";
  if (pct >= 76) return "Good";
  if (pct >= 61) return "Fair";
  if (pct >= 41) return "Below Avg";
  return "Needs Focus";
}

function pillarStatusColor(pct: number): string {
  if (pct >= 76) return "#059669";
  if (pct >= 41) return "#D97706";
  return "#DC2626";
}

type Props = {
  data: ReportData;
  weeklyChangePercent: number | null;
  primaryColor: string;
  accentColor: string;
  onViewDetailed: () => void;
  onDownloadPdf: () => void;
  onSharePdf: () => void;
  generating: boolean;
};

export function HealthReportSummary({
  data, weeklyChangePercent, primaryColor, accentColor,
  onViewDetailed, onDownloadPdf, onSharePdf, generating,
}: Props) {
  // Lazy-load Inter_800ExtraBold — not needed until this screen is opened
  // (removed from app startup critical path in _layout.tsx)
  useFonts({ Inter_800ExtraBold });

  const [steps, setSteps] = useState<number | null>(null);
  const [wearableSleepHours, setWearableSleepHours] = useState<number | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    api
      .getWearableData()
      .then((res: any) => {
        if (!isMounted.current) return;
        const latestSteps = res?.latest?.steps;
        setSteps(typeof latestSteps === "number" ? latestSteps : 0);

        // Prefer the wearable's own last-recorded sleep duration (matches
        // how Steps already works) over manually-logged sleep — a user
        // who tracks sleep automatically via Health Connect may never log
        // it manually, and previously this vital showed "—" for them even
        // though real synced data existed.
        const rawSleep = res?.latest?.sleepHours;
        const parsedSleep = typeof rawSleep === "string" ? parseFloat(rawSleep) : rawSleep;
        setWearableSleepHours(typeof parsedSleep === "number" && !isNaN(parsedSleep) && parsedSleep > 0 ? parsedSleep : null);
      })
      .catch(() => {
        if (isMounted.current) setSteps(0);
      });
    return () => {
      isMounted.current = false;
    };
  }, []);

  const avgScore = data.scores?.periodAvgScore || 0;
  const grade = getGrade(avgScore);
  const gradeColor =
    avgScore >= 80 ? "#059669" : avgScore >= 70 ? "#0EA5E9" : avgScore >= 50 ? "#F59E0B" : "#EF4444";

  const medPct = calcMedPct(data);
  const actualAge = data.profile?.age ?? null;
  const healthAge = actualAge
    ? calcHealthAge(actualAge, avgScore, data.risks?.stressRisk || "Low", data.profile?.bmiCategory || null, medPct, data.scores?.activePercent || 0)
    : null;

  const aiInsight = buildAiHealthInsight(data);
  const riskCards = buildRiskCards(data, medPct);
  const topRisks = [...riskCards].filter((r) => r.risk !== "Low").slice(0, 3);
  const recommendations = buildRecommendations(data).slice(0, 3);

  // Last 7 logged days for the mini-trend bars (works for both weekly & monthly —
  // monthly just shows the most recent 7 of the period).
  const recentLogs = (data.dailyLogs || []).slice(-7);
  const scoreValues = recentLogs.map((l) => l.healthScore || 0);
  const scoreLabels = recentLogs.map((l) => (l.dayName || "").slice(0, 1));
  const waterValues = recentLogs.map((l) => l.waterGlasses || 0);
  const maxWater = Math.max(4, ...waterValues);

  const avgWater = recentLogs.length
    ? (recentLogs.reduce((s, l) => s + (l.waterGlasses || 0), 0) / recentLogs.length).toFixed(1)
    : "0.0";
  const avgCalories = data.goals?.currentAvgCalories || 0;
  const manualAvgSleepHours = recentLogs.length
    ? recentLogs.reduce((s, l) => s + (l.sleepHours || 0), 0) / recentLogs.length
    : 0;
  // Prefer real wearable-synced sleep (last recorded night) over the
  // manual-log average when available — same precedence as Steps.
  const avgSleepHours = wearableSleepHours ?? manualAvgSleepHours;
  const sleepIsFromWearable = wearableSleepHours !== null;
  const sleepDisplay = avgSleepHours > 0 ? `${Math.floor(avgSleepHours)}h ${Math.round((avgSleepHours % 1) * 60)}m` : "—";

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>

      {/* ── Health Score + Grade + Health Age ── */}
      <View style={st.heroCard}>
        <View style={st.heroRow}>
          <View style={st.heroScoreCol}>
            <Text style={st.heroLabel}>HEALTH SCORE</Text>
            <PremiumScoreRing score={avgScore} size={130} strokeWidth={11} subLabel={avgScore >= 70 ? "Great Progress!" : avgScore >= 50 ? "Keep Going" : "Needs Focus"} textColor="dynamic" />
          </View>

          <View style={st.heroSideCol}>
            <View style={st.heroSideBlock}>
              <Text style={st.heroSideLabel}>GRADE</Text>
              <View style={[st.gradeChip, { backgroundColor: gradeColor }]}>
                <Text style={st.gradeChipTxt}>{grade}</Text>
              </View>
              {weeklyChangePercent !== null && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 }}>
                  <Ionicons
                    name={weeklyChangePercent >= 0 ? "trending-up" : "trending-down"}
                    size={13}
                    color={weeklyChangePercent >= 0 ? "#059669" : "#DC2626"}
                  />
                  <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: weeklyChangePercent >= 0 ? "#059669" : "#DC2626" }}>
                    {weeklyChangePercent >= 0 ? "+" : ""}{weeklyChangePercent}%
                  </Text>
                  <Text style={{ fontSize: 10, color: "#94A3B8", fontFamily: "Inter_400Regular" }}>
                    vs {data.reportType === "weekly" ? "last week" : "last month"}
                  </Text>
                </View>
              )}
            </View>

            {healthAge !== null && (
              <View style={st.heroSideBlock}>
                <Text style={st.heroSideLabel}>HEALTH AGE</Text>
                <Text style={st.heroSideVal}>{healthAge} <Text style={st.heroSideUnit}>yrs</Text></Text>
                <Text style={st.heroSideSub}>Actual: {actualAge} yrs</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* ── AI Health Insight ── */}
      <TouchableOpacity activeOpacity={0.8} onPress={onViewDetailed} style={st.insightCard}>
        <View style={st.insightIconBox}>
          <Ionicons name="sparkles" size={18} color={primaryColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.insightLabel}>AI HEALTH INSIGHT</Text>
          <Text style={st.insightTxt}>{aiInsight}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#C5D2DE" />
      </TouchableOpacity>

      {/* ── Health Pillars ── */}
      <Text style={st.sectionTitle}>YOUR HEALTH PILLARS</Text>
      <View style={st.pillarsRow}>
        {PILLAR_META.map((p) => {
          const pct = (data.scores?.[p.key] as number) || 0;
          return (
            <View key={p.label} style={st.pillarCol}>
              <MiniRing pct={pct} color={p.color} />
              <Text style={st.pillarLabel}>{p.label}</Text>
              <Text style={[st.pillarStatus, { color: pillarStatusColor(pct) }]}>{pillarStatusLabel(pct)}</Text>
            </View>
          );
        })}
      </View>

      {/* ── Vitals Snapshot ── */}
      <Text style={st.sectionTitle}>VITALS SNAPSHOT</Text>
      <View style={st.vitalsGrid}>
        <VitalChip icon="body-outline" label="Weight" value={data.profile?.weight_kg ? `${data.profile.weight_kg} kg` : "—"} sub={data.profile?.bmiCategory || ""} color="#0EA5E9" />
        <VitalChip icon="analytics-outline" label="BMI" value={data.profile?.bmi || "—"} sub={data.profile?.bmiCategory || ""} color="#8B5CF6" />
        <VitalChip icon="water-outline" label="Water" value={`${avgWater} gl`} sub="avg/day" color="#0EA5E9" />
        <VitalChip icon="flame-outline" label="Calories" value={avgCalories ? `${avgCalories}` : "—"} sub="kcal avg" color="#F97316" />
        <VitalChip icon="moon-outline" label="Sleep" value={sleepDisplay} sub={sleepIsFromWearable ? "last night" : "avg/night"} color="#8B5CF6" />
        <VitalChip icon="footsteps-outline" label="Steps" value={steps !== null ? steps.toLocaleString() : "…"} sub={Platform.OS === "ios" ? "Apple Health soon" : "today"} color="#3B82F6" />
      </View>

      {/* ── Trends ── */}
      <Text style={st.sectionTitle}>TRENDS</Text>
      <View style={st.trendsRow}>
        <View style={st.trendCard}>
          <Text style={st.trendCardLabel}>Health Score</Text>
          <Text style={[st.trendCardVal, { color: gradeColor }]}>{avgScore}</Text>
          <MiniBarTrend values={scoreValues} labels={scoreLabels} color={primaryColor} max={100} />
        </View>
        <View style={st.trendCard}>
          <Text style={st.trendCardLabel}>Water (L/day)</Text>
          <Text style={[st.trendCardVal, { color: "#0EA5E9" }]}>{avgWater}</Text>
          <MiniBarTrend values={waterValues} labels={scoreLabels} color="#0EA5E9" max={maxWater} />
        </View>
      </View>

      {/* ── Alerts & Risks ── */}
      {topRisks.length > 0 && (
        <>
          <Text style={st.sectionTitle}>ALERTS & RISKS</Text>
          <View style={st.card}>
            {topRisks.map((r, i) => {
              const colors = riskBadgeColors(r.risk);
              return (
                <View key={r.key} style={[st.alertRow, i < topRisks.length - 1 && st.alertRowDivider]}>
                  <View style={[st.alertIconBox, { backgroundColor: colors.bg }]}>
                    <Ionicons name="alert-circle" size={16} color={colors.fg} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.alertTitle}>{r.name}</Text>
                    <Text style={st.alertSub} numberOfLines={2}>{r.tip}</Text>
                  </View>
                  <View style={[st.riskPill, { backgroundColor: colors.bg }]}>
                    <Text style={[st.riskPillTxt, { color: colors.fg }]}>{r.risk}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}

      {/* ── AI Recommendations ── */}
      <Text style={st.sectionTitle}>AI RECOMMENDATIONS</Text>
      <View style={st.card}>
        {recommendations.map((rec, i) => (
          <View key={i} style={[st.recRow, i < recommendations.length - 1 && st.alertRowDivider]}>
            <View style={[st.recNumBox, { backgroundColor: accentColor }]}>
              <Text style={st.recNumTxt}>{i + 1}</Text>
            </View>
            <Text style={st.recTxt}>{rec}</Text>
          </View>
        ))}
        <TouchableOpacity onPress={onViewDetailed} style={st.viewAllRow} activeOpacity={0.7}>
          <Text style={[st.viewAllTxt, { color: primaryColor }]}>View All Recommendations</Text>
          <Ionicons name="chevron-forward" size={14} color={primaryColor} />
        </TouchableOpacity>
      </View>

      {/* ── Bottom Actions ── */}
      <View style={st.bottomActions}>
        <TouchableOpacity style={st.bottomBtn} onPress={onViewDetailed} activeOpacity={0.75}>
          <Ionicons name="document-text-outline" size={20} color={primaryColor} />
          <Text style={st.bottomBtnTitle}>View Detailed{"\n"}Report</Text>
        </TouchableOpacity>
        <TouchableOpacity style={st.bottomBtn} onPress={onDownloadPdf} disabled={generating} activeOpacity={0.75}>
          <Ionicons name="download-outline" size={20} color={accentColor} />
          <Text style={st.bottomBtnTitle}>{generating ? "Generating…" : "Download PDF"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={st.bottomBtn} onPress={onSharePdf} disabled={generating} activeOpacity={0.75}>
          <Ionicons name="share-social-outline" size={20} color="#8B5CF6" />
          <Text style={st.bottomBtnTitle}>Share Report</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function VitalChip({ icon, label, value, sub, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; sub?: string; color: string }) {
  return (
    <View style={st.vitalChip}>
      <View style={[st.vitalIconBox, { backgroundColor: color + "18" }]}>
        <Ionicons name={icon} size={15} color={color} />
      </View>
      <Text style={st.vitalLabel}>{label}</Text>
      <Text style={st.vitalVal}>{value}</Text>
      {!!sub && <Text style={st.vitalSub} numberOfLines={1}>{sub}</Text>}
    </View>
  );
}

const st = StyleSheet.create({
  heroCard: {
    backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: "#E8F0F8",
  },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  heroScoreCol: { alignItems: "center", gap: 8 },
  heroLabel: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#94A3B8", letterSpacing: 0.6 },
  heroSideCol: { flex: 1, gap: 10 },
  heroSideBlock: {
    backgroundColor: "#F8FAFC", borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: "#EEF2F7",
  },
  heroSideLabel: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#94A3B8", letterSpacing: 0.5, marginBottom: 6 },
  gradeChip: { alignSelf: "flex-start", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 4 },
  gradeChipTxt: { color: "#fff", fontFamily: "Inter_800ExtraBold", fontSize: 18 },
  heroSideVal: { fontSize: 22, fontFamily: "Inter_800ExtraBold", color: "#0D1F33" },
  heroSideUnit: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#94A3B8" },
  heroSideSub: { fontSize: 10, color: "#94A3B8", fontFamily: "Inter_400Regular", marginTop: 2 },

  insightCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: "#F0F9FF", borderRadius: 16, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: "#DCEEFB",
  },
  insightIconBox: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
  },
  insightLabel: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#0EA5E9", letterSpacing: 0.5, marginBottom: 4 },
  insightTxt: { fontSize: 12.5, fontFamily: "Inter_400Regular", color: "#334155", lineHeight: 18 },

  sectionTitle: {
    fontSize: 11, fontFamily: "Inter_700Bold", color: "#94A3B8",
    letterSpacing: 0.6, marginBottom: 10, marginTop: 2,
  },

  pillarsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  pillarCol: {
    flexBasis: "30%", flexGrow: 1, alignItems: "center", backgroundColor: "#fff",
    borderRadius: 14, paddingVertical: 12, borderWidth: 1, borderColor: "#EEF2F7", gap: 4,
  },
  pillarLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#0D1F33", marginTop: 4, textAlign: "center" },
  pillarStatus: { fontSize: 9, fontFamily: "Inter_600SemiBold", textAlign: "center" },

  vitalsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  vitalChip: {
    flexBasis: "30%", flexGrow: 1, backgroundColor: "#fff", borderRadius: 14, padding: 10,
    borderWidth: 1, borderColor: "#EEF2F7", gap: 2,
  },
  vitalIconBox: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  vitalLabel: { fontSize: 9.5, fontFamily: "Inter_600SemiBold", color: "#94A3B8" },
  vitalVal: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#0D1F33" },
  vitalSub: { fontSize: 9, fontFamily: "Inter_400Regular", color: "#94A3B8" },

  trendsRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  trendCard: {
    flex: 1, backgroundColor: "#fff", borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: "#EEF2F7",
  },
  trendCardLabel: { fontSize: 10.5, fontFamily: "Inter_600SemiBold", color: "#94A3B8", marginBottom: 2 },
  trendCardVal: { fontSize: 20, fontFamily: "Inter_800ExtraBold", marginBottom: 8 },

  card: {
    backgroundColor: "#fff", borderRadius: 16, padding: 4, marginBottom: 16,
    borderWidth: 1, borderColor: "#EEF2F7",
  },
  alertRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  alertRowDivider: { borderBottomWidth: 1, borderColor: "#F1F5F9" },
  alertIconBox: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  alertTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#0D1F33" },
  alertSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748B", marginTop: 1 },
  riskPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  riskPillTxt: { fontSize: 10, fontFamily: "Inter_700Bold" },

  recRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 12 },
  recNumBox: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", marginTop: 1 },
  recNumTxt: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
  recTxt: { flex: 1, fontSize: 12.5, fontFamily: "Inter_400Regular", color: "#334155", lineHeight: 18 },
  viewAllRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4,
    paddingVertical: 12, borderTopWidth: 1, borderColor: "#F1F5F9",
  },
  viewAllTxt: { fontSize: 12.5, fontFamily: "Inter_700Bold" },

  bottomActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  bottomBtn: {
    flex: 1, backgroundColor: "#fff", borderRadius: 14, paddingVertical: 14,
    alignItems: "center", gap: 6, borderWidth: 1, borderColor: "#EEF2F7",
  },
  bottomBtnTitle: { fontSize: 10.5, fontFamily: "Inter_600SemiBold", color: "#0D1F33", textAlign: "center", lineHeight: 14 },
});