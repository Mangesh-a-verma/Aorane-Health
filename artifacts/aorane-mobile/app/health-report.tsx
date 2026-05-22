import React, { useState, useEffect, useMemo } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, Alert, Dimensions, ActivityIndicator, Image,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { PremiumScoreRing } from "../components/PremiumScoreRing";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { api } from "@/lib/api";
import { AORANE_LOGO_DATAURI } from "@/lib/brand-logo";

const { width: W } = Dimensions.get("window");

// ── Types ─────────────────────────────────────────────────────────────────────

type ReportType = "weekly" | "monthly";

type CompanySettings = {
  companyName: string; companyLogoUrl: string | null; tagline: string | null;
  website: string | null; supportPhone: string | null; supportEmail: string | null;
  address: string | null; primaryColor: string; accentColor: string;
};

type Scorecard = {
  aoraneId: string; name: string; bloodGroup: string; bmi: string; bmiCategory: string;
  plan: string; gender: string; age: number | null; memberSince: string; qrData: string;
  city: string | null; state: string | null; healthScore?: number;
  activePercent: {
    overall: number; foodPct: number; waterPct: number;
    exercisePct: number; medicinePct: number;
  };
};

type StressReport = {
  weekAvg: number; highStreakDays: number; burnoutRisk: boolean; totalLogs: number;
  days: Array<{ date: string; dayLabel: string; avgScore: number; count: number }>;
};

type ProfileData = {
  height_cm?: number | string | null;
  weight_kg?: number | string | null;
};

type DietDay = {
  day: string; date: string;
  breakfast: { time: string; items: string[]; calories: number };
  lunch:     { time: string; items: string[]; calories: number };
  dinner:    { time: string; items: string[]; calories: number };
  snacks:    Array<{ time: string; item: string; calories: number }>;
  totalCalories: number; water: string; tip: string;
};

type DietChart = {
  weekStart: string; targetCalories: number;
  days: DietDay[];
  weeklyTips: string[];
};

type AISuggestions = {
  healthTip?: string | null;
  motivation?: string | null;
  exerciseSuggestion?: { name?: string; duration?: string; benefit?: string } | null;
  targetProgress?: { weightGoal?: string; progressPct?: number; note?: string } | null;
};

type WeeklyNutrition = {
  weeklyTotals: {
    totalCalories: number; totalProteinG: number; totalCarbsG: number; totalFatG: number;
    totalCalciumMg: number; totalVitaminB12Mcg: number; totalVitaminCMg: number; totalIronMg: number;
  };
  weeklyAverages: Record<string, number>;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_CO: CompanySettings = {
  companyName: "Aorane Health", companyLogoUrl: null, tagline: "Your health, in your hands",
  website: "aorane.com", supportPhone: null, supportEmail: "support@aorane.com",
  address: "Mumbai, Maharashtra, India", primaryColor: "#0077B6", accentColor: "#00B896",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function getDateRange(type: ReportType): { from: Date; to: Date } {
  const now = new Date();
  const to  = new Date(now);
  if (type === "weekly") {
    const from = new Date(now); from.setDate(now.getDate() - 6); return { from, to };
  }
  const from = new Date(now.getFullYear(), now.getMonth(), 1); return { from, to };
}

function activeLabel(pct: number): string {
  if (pct >= 90) return "Excellent"; if (pct >= 70) return "Good";
  if (pct >= 50) return "Average";   if (pct >= 30) return "Low";
  return "Inactive";
}

function activeColor(pct: number): string {
  if (pct >= 70) return "#10B981"; if (pct >= 40) return "#F59E0B"; return "#EF4444";
}

function stressColor(s: number): string {
  if (s < 26) return "#10B981"; if (s < 51) return "#F59E0B";
  if (s < 76) return "#F97316"; return "#EF4444";
}

function stressLabel(s: number): string {
  if (s < 26) return "Low"; if (s < 51) return "Moderate";
  if (s < 76) return "Elevated"; return "High Risk";
}

function healthGrade(score: number): string {
  if (score >= 90) return "A+"; if (score >= 80) return "A";
  if (score >= 70) return "B+"; if (score >= 60) return "B";
  if (score >= 50) return "C";  return "D";
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// DETERMINISTIC REPORT ID: Ensures same report always gets exact same ID for audit trails
function generateDeterministicId(aoraneId: string | undefined, fromDate: Date, toDate: Date): string {
  const userStr = aoraneId ? aoraneId.slice(-4).toUpperCase() : "0000";
  const d1 = fromDate.toISOString().slice(0,10).replace(/-/g,'');
  const d2 = toDate.toISOString().slice(0,10).replace(/-/g,'');
  
  // Simple hash function for stability
  const str = `${userStr}${d1}${d2}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const hashStr = Math.abs(hash).toString(16).toUpperCase().substring(0, 4).padStart(4, '0');
  return `HR-${d2}-${userStr}-${hashStr}`;
}

// ── HTML Report Builder (PDF Gen) ──────────────────────────────────────────────

function buildReportHtml(
  card: Scorecard | null,
  company: CompanySettings,
  reportType: ReportType,
  dateRange: { from: Date; to: Date },
  generatedAt: Date,
  profile: ProfileData | null,
  stress: StressReport | null,
  dietChart: DietChart | null,
  ai: AISuggestions | null,
  weeklyNutrition: WeeklyNutrition | null,
  rangeScore: number | null,
  stableReportId: string,
  riskProfile: { hyd: string, nut: string, str: string },
  advancedAI: string
): string {
  const P  = company.primaryColor || "#0077B6";
  const A  = company.accentColor  || "#00B896";
  const overall     = card?.activePercent?.overall ?? 0;
  const healthScore = rangeScore !== null ? rangeScore : (card?.healthScore ?? overall);
  const stressAvg   = stress?.weekAvg ?? 0;
  const heightCm    = profile?.height_cm ? Number(profile.height_cm) : null;
  const weightKg    = profile?.weight_kg ? Number(profile.weight_kg) : null;

  const weeklyCalories = dietChart ? dietChart.days.reduce((sum, d) => sum + (d.totalCalories || 0), 0) : 0;
  const wn = weeklyNutrition?.weeklyTotals;
  const proteinG = wn?.totalProteinG ? Math.round(wn.totalProteinG) : (weeklyCalories > 0 ? Math.round((weeklyCalories * 0.15) / 4) : 0);
  const carbsG   = wn?.totalCarbsG   ? Math.round(wn.totalCarbsG)   : (weeklyCalories > 0 ? Math.round((weeklyCalories * 0.55) / 4) : 0);
  const fatG     = wn?.totalFatG     ? Math.round(wn.totalFatG)     : (weeklyCalories > 0 ? Math.round((weeklyCalories * 0.30) / 9) : 0);

  const calciumMgW = wn ? Math.round(wn.totalCalciumMg) : null;
  const vitCMgW    = wn ? Math.round(wn.totalVitaminCMg) : null;
  const ironMgW    = wn ? Math.round(wn.totalIronMg * 10) / 10 : null;
  
  const dietRows = dietChart && dietChart.days.length > 0
    ? dietChart.days.map(d => `
      <tr>
        <td style="font-weight:bold;padding:7px 8px;font-size:10px;background:#F8FAFC">${d.day.slice(0,3)}<br/><span style="font-weight:normal;font-size:8px;color:#9CA3AF">${d.date}</span></td>
        <td style="padding:7px 8px;font-size:9px">${d.breakfast.items.slice(0,2).join(", ") || "—"}</td>
        <td style="padding:7px 8px;font-size:9px">${d.lunch.items.slice(0,2).join(", ") || "—"}</td>
        <td style="padding:7px 8px;font-size:9px">${d.dinner.items.slice(0,2).join(", ") || "—"}</td>
        <td style="padding:7px 8px;font-size:9px;font-weight:bold;color:${P}">${d.totalCalories}</td>
      </tr>`).join("")
    : `<tr><td colspan="5" style="padding:16px;text-align:center;color:#9CA3AF;font-size:10px">No diet chart data available.</td></tr>`;

  const riskColor = (r: string) => r === "High" ? "#EF4444" : r === "Moderate" ? "#F59E0B" : "#10B981";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background:#E5EFF8;padding:14px}
.page{background:#fff;max-width:700px;margin:0 auto;border-radius:10px;overflow:hidden;box-shadow:0 6px 32px rgba(0,0,0,0.12)}
.hdr{background:linear-gradient(135deg,${P},${A});padding:18px 22px;display:flex;align-items:center;gap:14px}
.hdr-logo{width:52px;height:52px;border-radius:14px;background:rgba(255,255,255,0.22);display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:900;color:#fff}
.hdr h1{color:#fff;font-size:19px;font-weight:800;letter-spacing:0.4px}
.hdr p{color:rgba(255,255,255,0.72);font-size:10.5px;margin-top:2px}
.hdr-r{margin-left:auto;text-align:right}
.badge{background:rgba(255,255,255,0.22);border:1px solid rgba(255,255,255,0.35);border-radius:8px;padding:4px 12px;display:inline-block;margin-bottom:4px;color:#fff;font-size:11px;font-weight:700;letter-spacing:1px}
.rno{color:rgba(255,255,255,0.55);font-size:8px;letter-spacing:0.5px}
.sec{padding:14px 18px}
.st{font-size:9.5px;font-weight:800;color:${P};text-transform:uppercase;letter-spacing:1px;border-left:3px solid ${P};padding-left:8px;margin-bottom:12px}
.rule{height:1px;background:#EEF2F7;margin:0 16px}
.pgrid{display:flex;flex-wrap:wrap;gap:7px}
.pf{background:#F8FAFD;border:1px solid #E5EFF7;border-radius:8px;padding:8px 12px;min-width:120px;flex:1}
.pl{font-size:7.5px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.4px}
.pv{font-size:12.5px;font-weight:700;color:#0D1F33;margin-top:2px}
.srow{display:flex;gap:10px}
.sc{flex:1;border-radius:11px;padding:12px;text-align:center;border:1px solid #E5EFF7}
.sb{font-size:26px;font-weight:800;margin-bottom:2px}
.sl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px}
.ng{display:flex;gap:8px;margin-bottom:4px}
.nc{flex:1;background:linear-gradient(135deg,${hexToRgba(P, 0.05)},${hexToRgba(A, 0.05)});border:1px solid ${hexToRgba(P, 0.15)};border-radius:10px;padding:10px;text-align:center}
.nv{font-size:16px;font-weight:800;color:${P}}
.nn{font-size:8.5px;font-weight:600;color:#374151;margin-top:4px;text-transform:uppercase}
table{width:100%;border-collapse:collapse;font-size:10px}
th{background:${hexToRgba(P, 0.1)};padding:7px 9px;text-align:left;font-size:8.5px;text-transform:uppercase;color:#374151}
td{padding:7px 9px;border-bottom:1px solid #F0F4F8;color:#1F2937}
.ibox{background:linear-gradient(135deg,#FFF8F0,#FFFBF4);border:1px solid #FDE68A;border-radius:10px;padding:14px}
.it{font-size:11px;font-weight:700;color:#92400E;margin-bottom:7px}
.ib{font-size:10px;color:#78350F;line-height:1.7}
.ftr{background:linear-gradient(135deg,${hexToRgba(P, 0.08)},${hexToRgba(A, 0.08)});border-top:2px solid ${hexToRgba(P, 0.1)};padding:16px 20px}
</style>
</head>
<body>
<div class="page">
  <div class="hdr">
    <div class="hdr-logo"><img src="${AORANE_LOGO_DATAURI}" style="width:42px;height:42px;border-radius:10px"/></div>
    <div><h1>${company.companyName}</h1><p>${company.tagline || ""}</p></div>
    <div class="hdr-r"><div class="badge">${reportType === "weekly" ? "WEEKLY" : "MONTHLY"} REPORT</div><div class="rno">${stableReportId}</div></div>
  </div>

  <div class="sec">
    <div class="st">User Profile</div>
    <div class="pgrid">
      <div class="pf"><div class="pl">Full Name</div><div class="pv">${card?.name || "—"}</div></div>
      <div class="pf"><div class="pl">AORANE ID</div><div class="pv" style="font-size:10px">${card?.aoraneId || "—"}</div></div>
      <div class="pf"><div class="pl">Age / Gender</div><div class="pv">${card?.age || "—"} / ${card?.gender || "—"}</div></div>
      <div class="pf"><div class="pl">BMI</div><div class="pv">${card?.bmi || "—"} <span style="font-size:10px;font-weight:normal">(${card?.bmiCategory || ""})</span></div></div>
      <div class="pf"><div class="pl">Blood Group</div><div class="pv" style="color:#DC2626">${card?.bloodGroup || "—"}</div></div>
    </div>
  </div>
  <div class="rule"></div>

  <div class="sec">
    <div class="st">Health & Risk Analysis</div>
    <div class="srow">
      <div class="sc" style="background:${hexToRgba(activeColor(healthScore), 0.05)};border-color:${hexToRgba(activeColor(healthScore), 0.2)}">
        <div class="sb" style="color:${activeColor(healthScore)}">${healthScore}</div>
        <div class="sl" style="color:${activeColor(healthScore)}">Health Score</div>
      </div>
      <div class="sc" style="background:${hexToRgba("#6366F1", 0.05)};border-color:${hexToRgba("#6366F1", 0.2)}">
        <div class="sb" style="color:#6366F1">${overall}%</div>
        <div class="sl" style="color:#6366F1">Active Score</div>
      </div>
      <div class="sc" style="background:${hexToRgba(stressColor(stressAvg), 0.05)};border-color:${hexToRgba(stressColor(stressAvg), 0.2)}">
        <div class="sb" style="color:${stressColor(stressAvg)}">${stressAvg || "—"}</div>
        <div class="sl" style="color:${stressColor(stressAvg)}">Stress Index</div>
      </div>
    </div>
    
    <div style="margin-top:14px;display:flex;gap:10px">
       ${[
         { label: "Hydration Risk", val: riskProfile.hyd },
         { label: "Nutrition Risk", val: riskProfile.nut },
         { label: "Stress Risk", val: riskProfile.str }
       ].map(r => `
         <div style="flex:1;background:#FAFBFC;border:1px solid #E5EFF7;border-radius:8px;padding:8px;text-align:center">
            <div style="font-size:7.5px;color:#9CA3AF;text-transform:uppercase">${r.label}</div>
            <div style="font-size:11px;font-weight:700;color:${riskColor(r.val)};margin-top:2px">${r.val}</div>
         </div>
       `).join("")}
    </div>
  </div>
  <div class="rule"></div>

  ${ai?.targetProgress ? `
  <div class="sec">
    <div class="st" style="color:#6366F1;border-color:#6366F1">Goal Progress Dashboard</div>
    <div style="background:#F5F3FF;border:1px solid #DDD6FE;border-radius:10px;padding:14px;display:flex;align-items:center;gap:14px">
      <div style="font-size:24px">🎯</div>
      <div style="flex:1">
         <div style="font-size:11px;font-weight:700;color:#4C1D95">${ai.targetProgress.weightGoal || "Health Target"}</div>
         <div style="font-size:9px;color:#5B21B6;margin-top:2px">${ai.targetProgress.note || "On track"}</div>
      </div>
      <div style="text-align:right">
         <div style="font-size:16px;font-weight:800;color:#6D28D9">${ai.targetProgress.progressPct ?? 0}%</div>
         <div style="font-size:7px;color:#7C3AED;text-transform:uppercase">Achieved</div>
      </div>
    </div>
  </div>
  <div class="rule"></div>
  ` : ""}

  <div class="sec">
    <div class="st">Nutrition & Micronutrients</div>
    <div class="ng">
      <div class="nc"><div class="nv">${proteinG || "—"}g</div><div class="nn">Protein</div></div>
      <div class="nc"><div class="nv">${carbsG || "—"}g</div><div class="nn">Carbs</div></div>
      <div class="nc"><div class="nv">${fatG || "—"}g</div><div class="nn">Fats</div></div>
    </div>
    <div class="ng" style="margin-top:8px">
      <div class="nc"><div class="nv" style="font-size:12px">${calciumMgW || "—"}mg</div><div class="nn">Calcium</div></div>
      <div class="nc"><div class="nv" style="font-size:12px">${vitCMgW || "—"}mg</div><div class="nn">Vit C</div></div>
      <div class="nc"><div class="nv" style="font-size:12px">${ironMgW || "—"}mg</div><div class="nn">Iron</div></div>
    </div>
  </div>
  <div class="rule"></div>

  <div class="sec">
    <div class="st" style="color:#92400E;border-color:#F59E0B">Multi-Factor AI Recommendations</div>
    <div class="ibox">
      <div class="it">🤖 Personalized Health Plan</div>
      <div class="ib">${advancedAI.replace(/\n/g, "<br/>")}</div>
      ${ai?.exerciseSuggestion ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid #FDE68A;font-size:9.5px;color:#78350F">💪 <b>Action:</b> ${ai.exerciseSuggestion.name} (${ai.exerciseSuggestion.duration})</div>` : ""}
    </div>
  </div>
  <div class="rule"></div>

  <div class="sec">
    <div class="st" style="color:#065F46;border-color:#10B981">Diet Chart Summary</div>
    <table>
      <thead><tr><th>Day</th><th>Breakfast</th><th>Lunch</th><th>Dinner</th><th>Kcal</th></tr></thead>
      <tbody>${dietRows}</tbody>
    </table>
  </div>

  <div class="ftr">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:13px;font-weight:800;color:${P}">${company.companyName}</div>
        <div style="font-size:8px;color:#6B7280;margin-top:4px">Report ID: ${stableReportId} | Date: ${formatDate(generatedAt)}</div>
      </div>
      <div style="font-size:7px;color:#9CA3AF;text-align:right;max-width:200px">
        Auto-generated from user data. Not medical advice.
      </div>
    </div>
  </div>
</div>
</body>
</html>`;
}

// ── Main Screen ────────────────────────────────────────────────────────────────

export default function HealthReportScreen() {
  const insets = useSafeAreaInsets();
  const topPad = insets.top;

  const [reportType, setReportType] = useState<ReportType>("weekly");
  const [card, setCard]             = useState<Scorecard | null>(null);
  const [company, setCompany]       = useState<CompanySettings>(DEFAULT_CO);
  const [stressData, setStress]     = useState<StressReport | null>(null);
  const [profile, setProfile]       = useState<ProfileData | null>(null);
  const [dietChart, setDiet]        = useState<DietChart | null>(null);
  const [aiSugg, setAi]             = useState<AISuggestions | null>(null);
  const [weeklyNutrition, setWeeklyNutrition] = useState<WeeklyNutrition | null>(null);
  const [rangeScore, setRangeScore] = useState<number | null>(null);

  const [loading, setLoading]       = useState(true);
  const [downloading, setDl]        = useState(false);

  useEffect(() => {
    let isMounted = true; 
    loadData(isMounted);
    return () => { isMounted = false; };
  }, [reportType]);

  const loadData = async (isMounted = true) => {
    setLoading(true);
    try {
      const dr = getDateRange(reportType);
      const startDate = dr.from.toISOString().split('T')[0];
      const endDate   = dr.to.toISOString().split('T')[0];
      
      const pStress = reportType === "monthly" && (api as any).getStressMonthly ? (api as any).getStressMonthly() : api.getStressWeekly();
      const pDiet   = reportType === "monthly" && (api as any).getMonthlyDietChart ? (api as any).getMonthlyDietChart() : api.getWeeklyDietChart();
      const pNut    = reportType === "monthly" && (api as any).getMonthlyFoodNutrition ? (api as any).getMonthlyFoodNutrition() : api.getWeeklyFoodNutrition();

      const [scRes, coRes, stRes, prRes, dtRes, aiRes, wnRes, srRes] = await Promise.allSettled([
        api.getScorecard(), api.getCompanySettings(), pStress, api.getProfile(), pDiet, api.getDailySuggestions(), pNut, api.getScoreRange(startDate, endDate),
      ]);

      if (!isMounted) return;

      if (scRes.status === "fulfilled") setCard(scRes.value as Scorecard);
      if (coRes.status === "fulfilled") {
        const co = (coRes.value as { settings: CompanySettings }).settings;
        if (co) setCompany({ ...DEFAULT_CO, ...co });
      }
      if (stRes.status === "fulfilled") setStress(stRes.value as StressReport);
      if (prRes.status === "fulfilled") {
        const p = (prRes.value as { profile: Record<string, unknown> }).profile || {};
        setProfile({ height_cm: p.height_cm as number, weight_kg: p.weight_kg as number });
      }
      if (dtRes.status === "fulfilled") {
        const dc = (dtRes.value as { dietChart: DietChart }).dietChart;
        if (dc) setDiet(dc);
      }
      if (aiRes.status === "fulfilled") {
        const s = (aiRes.value as { suggestions: AISuggestions }).suggestions;
        if (s) setAi(s);
      }
      if (wnRes.status === "fulfilled") setWeeklyNutrition(wnRes.value as WeeklyNutrition);
      if (srRes.status === "fulfilled") setRangeScore((srRes.value as { score: number }).score ?? null);

    } catch { 
      Alert.alert("Network Error", "Failed to fetch full health data.");
    } finally {
      if (isMounted) setLoading(false);
    }
  };

  const dateRange   = getDateRange(reportType);
  const generatedAt = new Date();
  
  // FIX 1: Deterministic Stable Report ID
  const stableReportId = generateDeterministicId(card?.aoraneId, dateRange.from, dateRange.to);

  const P = company.primaryColor || "#0077B6";
  const overall = card?.activePercent?.overall ?? 0;
  const healthScore = rangeScore !== null ? rangeScore : (card?.healthScore ?? overall);
  const stressAvg = stressData?.weekAvg ?? 0;
  const bmiNum = card?.bmi ? parseFloat(card.bmi) : 0;

  // FIX 2: Medical Risk Analysis Logic
  const riskProfile = {
    hyd: (card?.activePercent?.waterPct ?? 0) < 40 ? "High" : (card?.activePercent?.waterPct ?? 0) < 70 ? "Moderate" : "Low",
    nut: (card?.activePercent?.foodPct ?? 0) < 40 ? "High" : (card?.activePercent?.foodPct ?? 0) < 70 ? "Moderate" : "Low",
    str: (stressAvg > 75 || stressData?.burnoutRisk) ? "High" : stressAvg > 50 ? "Moderate" : "Low"
  };

  // FIX 3: Multi-Factor AI Recommendations
  let advancedAI = "";
  if (bmiNum > 25) advancedAI += "Based on your BMI, focusing on a slight caloric deficit alongside daily activity could improve overall metabolic health. ";
  if (riskProfile.str === "High") advancedAI += "Elevated stress detected; integrating 5-10 minutes of mindfulness or deep breathing daily is highly recommended. ";
  
  if (card?.activePercent) {
    const ap = card.activePercent;
    const lowest = Math.min(ap.waterPct, ap.foodPct, ap.exercisePct, ap.medicinePct);
    if (lowest === ap.waterPct) advancedAI += `Hydration adherence is notably low (${ap.waterPct}%). Increase intake to at least 2.5L/day to boost cellular recovery and your active score.`;
    else if (lowest === ap.foodPct) advancedAI += `Nutrition logging consistency is at ${ap.foodPct}%. Daily logging is crucial for accurate AI macronutrient mapping.`;
    else if (lowest === ap.medicinePct) advancedAI += `Medicine adherence is critical but currently at ${ap.medicinePct}%. Please enable app reminders to avoid missed doses.`;
    else advancedAI += `Physical activity is your lowest metric (${ap.exercisePct}%). Adding just 20 mins of brisk walking can significantly elevate your health score.`;
  }
  if (!advancedAI) advancedAI = aiSugg?.healthTip || "Maintain current routines. Your multi-factor health profile indicates strong consistency.";

  const handleDownload = async () => {
    setDl(true);
    try {
      const html = buildReportHtml(card, company, reportType, dateRange, generatedAt, profile, stressData, dietChart, aiSugg, weeklyNutrition, rangeScore, stableReportId, riskProfile, advancedAI);
      await Print.printAsync({ html });
    } catch {
      Alert.alert("Error", "Could not export PDF.");
    } finally {
      setDl(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F0F4F8" }}>
      <ScrollView contentContainerStyle={{ paddingTop: topPad + 12, paddingBottom: 100, paddingHorizontal: 12 }}>

        {/* Nav Header */}
        <View style={s.navRow}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}><Ionicons name="arrow-back" size={18} color={P} /></TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.navTitle}>Health Report</Text>
            <Text style={s.navSub}>Production-Grade Medical PDF</Text>
          </View>
          <TouchableOpacity onPress={() => loadData()} style={s.refreshBtn}><Ionicons name="refresh" size={16} color={P} /></TouchableOpacity>
        </View>

        <View style={s.toggle}>
          {(["weekly", "monthly"] as const).map(t => (
            <TouchableOpacity key={t} onPress={() => setReportType(t)} style={[s.toggleBtn, reportType === t && { backgroundColor: P }]}>
              <Text style={[s.toggleTxt, reportType === t && { color: "#FFF" }]}>{t === "weekly" ? "Weekly Report" : "Monthly Report"}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={{ paddingTop: 60, alignItems: "center", gap: 14 }}>
            <ActivityIndicator size="large" color={P} />
            <Text style={{ color: "#0D1F33", fontWeight: "600", fontSize: 16 }}>Processing Health Data...</Text>
          </View>
        ) : (
          <>
            {/* ── Document Card Preview (Full UI Parity with PDF) ── */}
            <View style={s.doc}>

              {/* Header */}
              <LinearGradient colors={[P, company.accentColor || "#00B896"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.lh}>
                <View style={s.lhLogo}><Image source={require("../assets/images/icon.png")} style={{ width: 38, height: 38, borderRadius: 9 }} resizeMode="contain" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.lhTitle}>{company.companyName}</Text>
                  {company.tagline && <Text style={s.lhSub}>{company.tagline}</Text>}
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <View style={s.typeBadge}><Text style={s.typeText}>{reportType === "weekly" ? "WEEKLY" : "MONTHLY"}</Text></View>
                  <Text style={s.genDate}>{formatDate(generatedAt)}</Text>
                </View>
              </LinearGradient>

              {/* Meta & Profile */}
              <View style={s.sec}>
                <Text style={[s.secTitle, { color: P, borderLeftColor: P }]}>USER PROFILE</Text>
                <View style={s.profGrid}>
                  <View style={s.profField}><Text style={s.profLbl}>Name</Text><Text style={s.profVal}>{card?.name || "—"}</Text></View>
                  <View style={s.profField}><Text style={s.profLbl}>ID</Text><Text style={s.profVal}>{card?.aoraneId || "—"}</Text></View>
                  <View style={s.profField}><Text style={s.profLbl}>BMI</Text><Text style={s.profVal}>{card?.bmi || "—"} <Text style={{fontSize:9, fontWeight:'normal'}}>{card?.bmiCategory}</Text></Text></View>
                  <View style={s.profField}><Text style={s.profLbl}>Blood</Text><Text style={[s.profVal, {color:"#DC2626"}]}>{card?.bloodGroup || "—"}</Text></View>
                </View>
              </View>
              <View style={s.rule} />

              {/* Score & Risk Analysis (New) */}
              <View style={s.sec}>
                <Text style={[s.secTitle, { color: P, borderLeftColor: P }]}>HEALTH SCORE & RISK ANALYSIS</Text>
                <View style={{ flexDirection: "row", gap: 10, alignItems: 'center' }}>
                  <View style={{ marginRight: 10 }}><PremiumScoreRing score={healthScore} size={110} strokeWidth={8} label="HEALTH" subLabel={activeLabel(healthScore)} textColor="black" /></View>
                  <View style={{ flex: 1, gap: 8 }}>
                    <View style={s.riskRow}>
                      <Text style={s.riskLbl}>Hydration Risk</Text>
                      <Text style={[s.riskVal, {color: riskProfile.hyd === "High" ? "#EF4444" : riskProfile.hyd === "Moderate" ? "#F59E0B" : "#10B981"}]}>{riskProfile.hyd}</Text>
                    </View>
                    <View style={s.riskRow}>
                      <Text style={s.riskLbl}>Nutrition Risk</Text>
                      <Text style={[s.riskVal, {color: riskProfile.nut === "High" ? "#EF4444" : riskProfile.nut === "Moderate" ? "#F59E0B" : "#10B981"}]}>{riskProfile.nut}</Text>
                    </View>
                    <View style={s.riskRow}>
                      <Text style={s.riskLbl}>Stress Risk</Text>
                      <Text style={[s.riskVal, {color: riskProfile.str === "High" ? "#EF4444" : riskProfile.str === "Moderate" ? "#F59E0B" : "#10B981"}]}>{riskProfile.str}</Text>
                    </View>
                  </View>
                </View>
              </View>
              <View style={s.rule} />

              {/* Goal Progress UI (New Parity) */}
              {aiSugg?.targetProgress && (
                <>
                  <View style={s.sec}>
                    <Text style={[s.secTitle, { color: "#6366F1", borderLeftColor: "#6366F1" }]}>GOAL PROGRESS DASHBOARD</Text>
                    <View style={s.goalCard}>
                      <Text style={{fontSize: 24}}>🎯</Text>
                      <View style={{flex: 1, marginLeft: 12}}>
                        <Text style={s.goalTitle}>{aiSugg.targetProgress.weightGoal || "Health Target"}</Text>
                        <Text style={s.goalSub}>{aiSugg.targetProgress.note || "On track to reach your goals."}</Text>
                      </View>
                      <View style={{alignItems: 'flex-end'}}>
                        <Text style={s.goalPct}>{aiSugg.targetProgress.progressPct ?? 0}%</Text>
                        <Text style={s.goalLbl}>ACHIEVED</Text>
                      </View>
                    </View>
                  </View>
                  <View style={s.rule} />
                </>
              )}

              {/* Multi-Factor AI Insights */}
              <View style={s.sec}>
                <Text style={[s.secTitle, { color: "#92400E", borderLeftColor: "#F59E0B" }]}>MULTI-FACTOR AI RECOMMENDATIONS</Text>
                <View style={s.aiBox}>
                  <Text style={s.aiTitle}>🤖 Personalized Health Plan</Text>
                  <Text style={s.aiBody}>{advancedAI}</Text>
                  {aiSugg?.exerciseSuggestion && (
                    <Text style={s.aiAction}>💪 Action: {aiSugg.exerciseSuggestion.name}</Text>
                  )}
                </View>
              </View>
              <View style={s.rule} />

              {/* Footer */}
              <LinearGradient colors={[hexToRgba(P, 0.1), hexToRgba(company.accentColor || "#00B896", 0.1)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.footer}>
                <Text style={{ fontWeight: "700", fontSize: 13, color: P, textAlign: 'center' }}>{company.companyName}</Text>
                <Text style={{ fontSize: 9, color: "#6B7280", textAlign: "center", marginTop: 4 }}>Report ID: {stableReportId}</Text>
              </LinearGradient>

            </View>

            <View style={{ marginTop: 16 }}>
              <TouchableOpacity onPress={handleDownload} disabled={downloading} style={[s.btn, { backgroundColor: P }]}>
                {downloading ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="download-outline" size={18} color="#FFF" />}
                <Text style={[s.btnTxt, { color: "#FFF" }]}>{downloading ? "Generating Document…" : "Export Healthcare PDF"}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  navRow:     { flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 12 },
  backBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,119,182,0.1)", alignItems: "center", justifyContent: "center" },
  refreshBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E5EFF7", alignItems: "center", justifyContent: "center" },
  navTitle:   { color: "#0D1F33", fontWeight: "700", fontFamily: "Inter_700Bold", fontSize: 20 },
  navSub:     { color: "#7A90A4", fontFamily: "Inter_400Regular", fontSize: 12 },
  toggle:     { flexDirection: "row", backgroundColor: "#FFF", borderRadius: 12, padding: 4, marginBottom: 14, gap: 4, borderWidth: 1, borderColor: "#E5EFF7" },
  toggleBtn:  { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center" },
  toggleTxt:  { fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: "#7A90A4" },
  doc:        { backgroundColor: "#FFF", borderRadius: 12, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, elevation: 6 },
  lh:         { padding: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  lhLogo:     { width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" },
  lhTitle:    { color: "#FFF", fontWeight: "700", fontFamily: "Inter_700Bold", fontSize: 17 },
  lhSub:      { color: "rgba(255,255,255,0.7)", fontSize: 10, marginTop: 1 },
  typeBadge:  { backgroundColor: "rgba(255,255,255,0.22)", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 4 },
  typeText:   { color: "#FFF", fontWeight: "700", fontSize: 9, letterSpacing: 0.8 },
  genDate:    { color: "rgba(255,255,255,0.6)", fontSize: 8 },
  rule:       { height: 1, backgroundColor: "#E5EFF7", marginHorizontal: 12 },
  sec:        { padding: 14 },
  secTitle:   { fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, borderLeftWidth: 3, paddingLeft: 8, marginBottom: 12 },
  profGrid:   { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  profField:  { backgroundColor: "#F8FAFD", borderRadius: 8, padding: 9, minWidth: "46%", flex: 1, borderWidth: 1, borderColor: "#E5EFF7" },
  profLbl:    { fontSize: 9, color: "#9CA3AF", textTransform: "uppercase", fontWeight: "500" },
  profVal:    { fontSize: 14, fontWeight: "700", color: "#0D1F33", marginTop: 2 },
  riskRow:    { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#FAFBFC", padding: 8, borderRadius: 6, borderWidth: 1, borderColor: "#E5EFF7" },
  riskLbl:    { fontSize: 11, color: "#6B7280", fontWeight: "500" },
  riskVal:    { fontSize: 11, fontWeight: "700" },
  goalCard:   { backgroundColor: "#F5F3FF", borderWidth: 1, borderColor: "#DDD6FE", borderRadius: 10, padding: 14, flexDirection: "row", alignItems: "center" },
  goalTitle:  { fontSize: 13, fontWeight: "700", color: "#4C1D95" },
  goalSub:    { fontSize: 10, color: "#5B21B6", marginTop: 2 },
  goalPct:    { fontSize: 18, fontWeight: "800", color: "#6D28D9" },
  goalLbl:    { fontSize: 8, color: "#7C3AED", fontWeight: "700", marginTop: 2 },
  aiBox:      { backgroundColor: "#FFFBF0", borderRadius: 10, padding: 14, borderWidth: 1, borderColor: "#FDE68A" },
  aiTitle:    { fontWeight: "700", fontSize: 12, color: "#92400E", marginBottom: 6 },
  aiBody:     { fontSize: 11, color: "#78350F", lineHeight: 16 },
  aiAction:   { fontSize: 10, color: "#92400E", marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderColor: "#FDE68A", fontWeight: "600" },
  footer:     { padding: 16 },
  btn:        { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14 },
  btnTxt:     { fontWeight: "600", fontSize: 14 },
});