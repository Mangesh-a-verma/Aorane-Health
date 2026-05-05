import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, Alert, Dimensions, ActivityIndicator, Image,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
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
  reportHeaderText: string | null; reportFooterText: string | null;
  reportLogoUrl: string | null;
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
  reportHeaderText: null, reportFooterText: null, reportLogoUrl: null,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
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
  if (pct >= 90) return "Excellent";
  if (pct >= 70) return "Good";
  if (pct >= 50) return "Average";
  if (pct >= 30) return "Low";
  return "Inactive";
}
function activeColor(pct: number): string {
  if (pct >= 70) return "#10B981";
  if (pct >= 40) return "#F59E0B";
  return "#EF4444";
}
function stressColor(s: number): string {
  if (s < 26) return "#10B981";
  if (s < 51) return "#F59E0B";
  if (s < 76) return "#F97316";
  return "#EF4444";
}
function stressLabel(s: number): string {
  if (s < 26) return "Low";
  if (s < 51) return "Moderate";
  if (s < 76) return "Elevated";
  return "High Risk";
}
function healthGrade(score: number): string {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B+";
  if (score >= 60) return "B";
  if (score >= 50) return "C";
  return "D";
}
function stripHindi(text: string): string {
  return text.replace(/[\u0900-\u097F]/g, "").trim();
}

// ── HTML Report Builder ────────────────────────────────────────────────────────

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
): string {
  const P  = company.primaryColor || "#0077B6";
  const A  = company.accentColor  || "#00B896";
  const overall     = card?.activePercent?.overall ?? 0;
  const healthScore = rangeScore !== null ? rangeScore : (card?.healthScore ?? overall);
  const stressAvg   = stress?.weekAvg ?? 0;
  const heightCm    = profile?.height_cm ? Number(profile.height_cm) : null;
  const weightKg    = profile?.weight_kg ? Number(profile.weight_kg) : null;
  const reportNo    = Math.floor(Math.random() * 900000 + 100000);

  const weeklyCalories = dietChart
    ? dietChart.days.reduce((sum, d) => sum + (d.totalCalories || 0), 0) : 0;
  const proteinG = Math.round((weeklyCalories * 0.15) / 4);
  const carbsG   = Math.round((weeklyCalories * 0.55) / 4);
  const fatG     = Math.round((weeklyCalories * 0.30) / 9);

  const wn = weeklyNutrition?.weeklyTotals;
  const calciumMgW    = wn ? Math.round(wn.totalCalciumMg)      : null;
  const vitB12McgW    = wn ? Math.round(wn.totalVitaminB12Mcg * 100) / 100 : null;
  const vitCMgW       = wn ? Math.round(wn.totalVitaminCMg)     : null;
  const ironMgW       = wn ? Math.round(wn.totalIronMg * 10) / 10  : null;
  const calciumPct    = calciumMgW ? Math.min(100, Math.round((calciumMgW / 7000) * 100))  : null;
  const vitB12Pct     = vitB12McgW ? Math.min(100, Math.round((vitB12McgW / 16.8) * 100))  : null;
  const vitCPct       = vitCMgW   ? Math.min(100, Math.round((vitCMgW / 455) * 100))   : null;
  const ironPct       = ironMgW   ? Math.min(100, Math.round((ironMgW / 126) * 100))   : null;
  const micStatus = (pct: number | null) => pct === null ? "—" : pct >= 80 ? "Sufficient" : pct >= 50 ? "Moderate" : "Low";
  const micColor  = (pct: number | null) => pct === null ? "#9CA3AF" : pct >= 80 ? "#10B981" : pct >= 50 ? "#F59E0B" : "#EF4444";

  const rawInsight = [ai?.healthTip, ai?.motivation].filter(Boolean).join("\n");
  const aiInsight  = stripHindi(rawInsight) ||
    (overall >= 70
      ? `Your health activity score is ${activeLabel(overall).toLowerCase()} at ${overall}%. Keep maintaining your current habits — consistency is the key to long-term health improvement. Stay hydrated, log your meals daily, and ensure you exercise at least 30 minutes each day.`
      : `Your health activity score of ${overall}% shows room for improvement. Focus on ${(card?.activePercent?.waterPct ?? 0) < 50 ? "drinking more water" : (card?.activePercent?.foodPct ?? 0) < 50 ? "logging your meals regularly" : "daily exercise"}. Small, consistent daily improvements lead to significant health gains over time.`);

  const exSug = ai?.exerciseSuggestion;
  const exText = exSug
    ? `${exSug.name || "Exercise"} for ${exSug.duration || "30 min"} — ${exSug.benefit || "Improves overall fitness."}`
    : "Aim for at least 30 minutes of moderate exercise daily. Walking, yoga, or cycling are excellent choices.";

  const dietRows = dietChart && dietChart.days.length > 0
    ? dietChart.days.map(d => `
      <tr>
        <td style="font-weight:bold;padding:7px 8px;font-size:10px;background:#F8FAFC">${d.day.slice(0,3)}<br/><span style="font-weight:normal;font-size:8px;color:#9CA3AF">${d.date}</span></td>
        <td style="padding:7px 8px;font-size:9px">${d.breakfast.items.slice(0,2).join(", ") || "—"}<br/><span style="color:#9CA3AF">${d.breakfast.calories} kcal</span></td>
        <td style="padding:7px 8px;font-size:9px">${d.lunch.items.slice(0,2).join(", ") || "—"}<br/><span style="color:#9CA3AF">${d.lunch.calories} kcal</span></td>
        <td style="padding:7px 8px;font-size:9px">${d.dinner.items.slice(0,2).join(", ") || "—"}<br/><span style="color:#9CA3AF">${d.dinner.calories} kcal</span></td>
        <td style="padding:7px 8px;font-size:9px;font-weight:bold;color:${P}">${d.totalCalories} kcal</td>
        <td style="padding:7px 8px;font-size:9px;color:#0EA5E9">${d.water || "8 gl."}</td>
      </tr>`).join("")
    : `<tr><td colspan="6" style="padding:16px;text-align:center;color:#9CA3AF;font-size:10px">No diet chart data. Generate AI Diet Chart from the app to populate this section.</td></tr>`;

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=70x70&data=${encodeURIComponent("https://aorane.com")}&color=0077B6&bgcolor=FFFFFF&qzone=1`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:'Helvetica Neue',Arial,sans-serif;background:#E5EFF8;padding:14px}
.page{background:#fff;max-width:700px;margin:0 auto;border-radius:10px;overflow:hidden;box-shadow:0 6px 32px rgba(0,0,0,0.12)}
.hdr{background:linear-gradient(135deg,${P},${A});padding:18px 22px;display:flex;align-items:center;gap:14px}
.hdr-logo{width:52px;height:52px;border-radius:14px;background:rgba(255,255,255,0.22);display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:900;color:#fff;flex-shrink:0;text-align:center;line-height:52px}
.hdr h1{color:#fff;font-size:19px;font-weight:800;letter-spacing:0.4px}
.hdr p{color:rgba(255,255,255,0.72);font-size:10.5px;margin-top:2px}
.hdr small{color:rgba(255,255,255,0.52);font-size:9px}
.hdr-r{margin-left:auto;text-align:right}
.badge{background:rgba(255,255,255,0.22);border:1px solid rgba(255,255,255,0.35);border-radius:8px;padding:4px 12px;display:inline-block;margin-bottom:4px}
.badge span{color:#fff;font-size:11px;font-weight:700;letter-spacing:1px}
.rno{color:rgba(255,255,255,0.55);font-size:8px}
.mbar{display:flex;border-bottom:1px solid #E5EFF7;background:#FAFCFF}
.mc{flex:1;padding:9px 12px}
.mc+.mc{border-left:1px solid #E5EFF7}
.ml{font-size:7.5px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.6px}
.mv{font-size:9.5px;color:#0D1F33;font-weight:700;margin-top:2px}
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
.sg{font-size:9.5px;font-weight:700;border-radius:20px;padding:2px 8px;display:inline-block;margin-top:4px}
.ss{font-size:8px;color:#9CA3AF;margin-top:3px}
.mbr{margin-bottom:10px}
.mh{display:flex;justify-content:space-between;font-size:10px;margin-bottom:4px;font-weight:600}
.bb{height:7px;background:#EEF2F7;border-radius:4px;overflow:hidden}
.bf{height:7px;border-radius:4px}
.ng{display:flex;gap:8px;margin-bottom:4px}
.nc{flex:1;background:linear-gradient(135deg,${P}0D,${A}0D);border:1px solid ${P}22;border-radius:10px;padding:10px;text-align:center}
.nv{font-size:16px;font-weight:800;color:${P}}
.nu{font-size:8px;color:#6B7280;margin-top:1px}
.nn{font-size:8.5px;font-weight:600;color:#374151;margin-top:4px;text-transform:uppercase}
table{width:100%;border-collapse:collapse;font-size:10px}
th{background:${P}18;padding:7px 9px;text-align:left;font-size:8.5px;text-transform:uppercase;font-weight:700;letter-spacing:0.4px;color:#374151}
td{padding:7px 9px;border-bottom:1px solid #F0F4F8;color:#1F2937;vertical-align:middle}
tr:nth-child(even) td{background:#FAFBFC}
.pill{border-radius:20px;padding:2px 8px;font-size:8px;font-weight:700;display:inline-block}
.ibox{background:linear-gradient(135deg,#FFF8F0,#FFFBF4);border:1px solid #FDE68A;border-radius:10px;padding:14px}
.it{font-size:11px;font-weight:700;color:#92400E;margin-bottom:7px}
.ib{font-size:10px;color:#78350F;line-height:1.7}
.isub{font-size:9px;color:#6B7280;margin-top:9px;padding-top:9px;border-top:1px solid #FDE68A}
.ftr{background:linear-gradient(135deg,${P}12,${A}12);border-top:2px solid ${P}1A;padding:0}
.fm{display:flex;align-items:flex-start;gap:18px;padding:16px 20px}
.fc{flex:1}
.fcn{font-size:13px;font-weight:800;color:${P};letter-spacing:0.3px}
.fct{font-size:9.5px;color:#6B7280;margin-top:3px}
.fcc{margin-top:9px;font-size:9px;color:#374151;line-height:1.85}
.fcc b{color:${P}}
.fqr{text-align:center}
.fqr img{border:2px solid ${P}33;border-radius:8px;padding:3px;background:#fff}
.fqr p{font-size:8px;color:#6B7280;margin-top:4px}
.decl{background:${P}08;padding:9px 20px;font-size:8px;color:#6B7280;line-height:1.6;border-top:1px solid ${P}15;text-align:center}
.fbar{display:flex;justify-content:space-between;padding:7px 20px;border-top:1px solid ${P}15;font-size:7.5px;color:#9CA3AF}
</style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div class="hdr">
    <div class="hdr-logo"><img src="${AORANE_LOGO_DATAURI}" alt="Aorane" style="width:42px;height:42px;border-radius:10px"/></div>
    <div>
      <h1>${company.companyName}</h1>
      ${company.tagline ? `<p>${company.tagline}</p>` : ""}
      ${company.website ? `<small>🌐 ${company.website}</small>` : ""}
    </div>
    <div class="hdr-r">
      <div class="badge"><span>${reportType === "weekly" ? "WEEKLY" : "MONTHLY"} HEALTH REPORT</span></div>
      <div class="rno">Report #HR-${reportNo}</div>
    </div>
  </div>

  <!-- META BAR -->
  <div class="mbar">
    <div class="mc"><div class="ml">Report Period</div><div class="mv">${formatDate(dateRange.from)} — ${formatDate(dateRange.to)}</div></div>
    <div class="mc"><div class="ml">Generated On</div><div class="mv">${formatDate(generatedAt)} · ${generatedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div></div>
    <div class="mc"><div class="ml">Type</div><div class="mv">${reportType === "weekly" ? "7-Day Summary" : "Monthly Overview"}</div></div>
    <div class="mc"><div class="ml">Plan</div><div class="mv">${(card?.plan || "FREE").toUpperCase()}</div></div>
  </div>

  <!-- 1. USER PROFILE -->
  <div class="sec">
    <div class="st">User Profile</div>
    <div class="pgrid">
      <div class="pf"><div class="pl">Full Name</div><div class="pv">${card?.name || "—"}</div></div>
      <div class="pf"><div class="pl">USER ID (AORANE)</div><div class="pv" style="font-size:10px;letter-spacing:1px">${card?.aoraneId ? card.aoraneId.toUpperCase().replace(/(.{4})(.{4})(.{4})/, "$1 $2 $3") : "—"}</div></div>
      <div class="pf"><div class="pl">Age</div><div class="pv">${card?.age ? `${card.age} Years` : "—"}</div></div>
      <div class="pf"><div class="pl">Gender</div><div class="pv">${card?.gender ? card.gender.charAt(0).toUpperCase() + card.gender.slice(1) : "—"}</div></div>
      <div class="pf"><div class="pl">Height</div><div class="pv">${heightCm ? `${heightCm} cm` : "—"}</div></div>
      <div class="pf"><div class="pl">Weight</div><div class="pv">${weightKg ? `${weightKg} kg` : "—"}</div></div>
      <div class="pf"><div class="pl">Blood Group</div><div class="pv" style="color:#DC2626">${card?.bloodGroup || "—"}</div></div>
      <div class="pf"><div class="pl">BMI</div><div class="pv">${card?.bmi || "—"} <span style="font-size:10px;font-weight:normal;color:#6B7280">(${card?.bmiCategory || ""})</span></div></div>
      <div class="pf"><div class="pl">Location</div><div class="pv">${card?.city ? `${card.city}${card.state ? `, ${card.state}` : ""}` : "—"}</div></div>
      <div class="pf"><div class="pl">Member Since</div><div class="pv">${card?.memberSince ? new Date(card.memberSince).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : "—"}</div></div>
    </div>
  </div>
  <div class="rule"></div>

  <!-- 2. HEALTH SCORE OVERVIEW -->
  <div class="sec">
    <div class="st">Health Score Overview</div>
    <div class="srow">
      <div class="sc" style="border-color:${activeColor(healthScore)}33;background:${activeColor(healthScore)}07">
        <div class="sb" style="color:${activeColor(healthScore)}">${healthScore}</div>
        <div class="sl" style="color:${activeColor(healthScore)}">Health Score</div>
        <div class="sg" style="background:${activeColor(healthScore)}18;color:${activeColor(healthScore)}">${healthGrade(healthScore)}</div>
        <div class="ss">${activeLabel(healthScore)}</div>
      </div>
      <div class="sc" style="border-color:#6366F133;background:#6366F108">
        <div class="sb" style="color:#6366F1">${overall}%</div>
        <div class="sl" style="color:#6366F1">Active Score</div>
        <div class="sg" style="background:#6366F118;color:#6366F1">${healthGrade(overall)}</div>
        <div class="ss">${activeLabel(overall)}</div>
      </div>
      <div class="sc" style="border-color:${stressColor(stressAvg)}33;background:${stressColor(stressAvg)}07">
        <div class="sb" style="color:${stressColor(stressAvg)}">${stressAvg > 0 ? stressAvg : "—"}</div>
        <div class="sl" style="color:${stressColor(stressAvg)}">Stress Level</div>
        ${stressAvg > 0 ? `<div class="sg" style="background:${stressColor(stressAvg)}18;color:${stressColor(stressAvg)}">${stressLabel(stressAvg)}</div>` : ""}
        <div class="ss">${stress?.totalLogs ?? 0} check-ins</div>
      </div>
    </div>
  </div>
  <div class="rule"></div>

  <!-- 3. ACTIVE SCORE BREAKDOWN -->
  <div class="sec">
    <div class="st">Active Score Breakdown</div>
    ${[
      { label: "Nutrition (Food Logging)", value: card?.activePercent?.foodPct ?? 0, weight: "35%" },
      { label: "Hydration (Water Intake)", value: card?.activePercent?.waterPct ?? 0, weight: "30%" },
      { label: "Exercise (Physical Activity)", value: card?.activePercent?.exercisePct ?? 0, weight: "25%" },
      { label: "Medicine Adherence", value: card?.activePercent?.medicinePct ?? 0, weight: "10%" },
    ].map(m => `
      <div class="mbr">
        <div class="mh">
          <span>${m.label} <span style="font-size:8px;color:#9CA3AF;font-weight:normal">(Weight: ${m.weight})</span></span>
          <span style="color:${activeColor(m.value)}">${m.value}% — ${activeLabel(m.value)}</span>
        </div>
        <div class="bb"><div class="bf" style="width:${Math.max(m.value,2)}%;background:${activeColor(m.value)}"></div></div>
      </div>`).join("")}
  </div>
  <div class="rule"></div>

  <!-- 4. WEEKLY NUTRITION SUMMARY -->
  <div class="sec">
    <div class="st">Weekly Nutrition Summary</div>
    <div class="ng">
      <div class="nc"><div class="nv">${weeklyCalories > 0 ? weeklyCalories.toLocaleString() : "—"}</div><div class="nu">kcal / week</div><div class="nn">Total Calories</div></div>
      <div class="nc"><div class="nv">${proteinG > 0 ? proteinG : "—"}</div><div class="nu">grams (est.)</div><div class="nn">Protein</div></div>
      <div class="nc"><div class="nv">${carbsG > 0 ? carbsG : "—"}</div><div class="nu">grams (est.)</div><div class="nn">Carbs</div></div>
      <div class="nc"><div class="nv">${fatG > 0 ? fatG : "—"}</div><div class="nu">grams (est.)</div><div class="nn">Fats</div></div>
      <div class="nc"><div class="nv">${dietChart?.targetCalories ? Math.round(dietChart.targetCalories) : "—"}</div><div class="nu">kcal / day</div><div class="nn">Daily Target</div></div>
    </div>
    <p style="font-size:8px;color:#9CA3AF;margin-top:7px">* Protein, Carbs, and Fat are estimates based on standard Indian dietary ratios (15% : 55% : 30%). Actual values vary based on specific foods consumed.</p>
  </div>
  <div class="rule"></div>

  <!-- 4b. MICRONUTRIENTS -->
  <div class="sec">
    <div class="st">Micronutrient Tracking (7-Day)</div>
    ${wn ? `
    <div class="ng" style="grid-template-columns:repeat(4,1fr)">
      ${[
        { label: "Calcium", val: calciumMgW, unit: "mg", pct: calciumPct, rdv: "1000mg/day" },
        { label: "Vitamin C", val: vitCMgW, unit: "mg", pct: vitCPct, rdv: "65mg/day" },
        { label: "Vitamin B12", val: vitB12McgW, unit: "mcg", pct: vitB12Pct, rdv: "2.4mcg/day" },
        { label: "Iron", val: ironMgW, unit: "mg", pct: ironPct, rdv: "18mg/day" },
      ].map(m => `
        <div class="nc">
          <div class="nv" style="color:${micColor(m.pct)}">${m.val ?? "—"}</div>
          <div class="nu">${m.unit} / week</div>
          <div class="nn">${m.label}</div>
          <div style="font-size:8px;color:${micColor(m.pct)};font-weight:600;margin-top:2px">${micStatus(m.pct)}</div>
          <div style="font-size:7px;color:#9CA3AF">RDV: ${m.rdv}</div>
        </div>`).join("")}
    </div>
    <div style="height:6px"></div>
    ${[
      { label: "Calcium", pct: calciumPct },
      { label: "Vitamin C", pct: vitCPct },
      { label: "Vitamin B12", pct: vitB12Pct },
      { label: "Iron", pct: ironPct },
    ].map(m => `
      <div class="mbr">
        <div class="mh">
          <span>${m.label} — 7-day % of Recommended</span>
          <span style="color:${micColor(m.pct)}">${m.pct ?? 0}% of RDV</span>
        </div>
        <div class="bb"><div class="bf" style="width:${Math.max(m.pct ?? 0, 2)}%;background:${micColor(m.pct)}"></div></div>
      </div>`).join("")}
    <p style="font-size:8px;color:#9CA3AF;margin-top:6px">RDV = Recommended Daily Value. Micronutrient data sourced from AI-identified food logs only. Actual intake may be higher.</p>
    ` : `<p style="font-size:9px;color:#9CA3AF;text-align:center;padding:12px 0">No food log data available for micronutrient tracking. Start logging meals in the Food tab to see Calcium, Vitamin C, B12 and Iron data here.</p>`}
  </div>
  <div class="rule"></div>

  <!-- 5. HEALTH METRICS SUMMARY -->
  <div class="sec">
    <div class="st">Health Metrics Summary</div>
    <table>
      <thead><tr><th style="width:38%">Parameter</th><th>Value</th><th>Status</th><th>Remarks</th></tr></thead>
      <tbody>
        ${[
          { p: "BMI (Body Mass Index)", v: card?.bmi ? `${card.bmi}` : "N/A", s: card?.bmiCategory || "N/A", r: "From profile data" },
          { p: "Blood Group", v: card?.bloodGroup || "N/A", s: "Recorded", r: "Emergency reference" },
          { p: "Height / Weight", v: `${heightCm ? `${heightCm}cm` : "—"} / ${weightKg ? `${weightKg}kg` : "—"}`, s: "Recorded", r: "From profile" },
          { p: "Health Score", v: `${healthScore}/100`, s: activeLabel(healthScore), r: `Grade: ${healthGrade(healthScore)}` },
          { p: "Overall Active Score", v: `${overall}%`, s: activeLabel(overall), r: `${reportType} composite` },
          { p: "Nutrition Adherence", v: `${card?.activePercent?.foodPct ?? 0}%`, s: activeLabel(card?.activePercent?.foodPct ?? 0), r: "35% weight" },
          { p: "Hydration Score", v: `${card?.activePercent?.waterPct ?? 0}%`, s: activeLabel(card?.activePercent?.waterPct ?? 0), r: "30% weight" },
          { p: "Exercise Adherence", v: `${card?.activePercent?.exercisePct ?? 0}%`, s: activeLabel(card?.activePercent?.exercisePct ?? 0), r: "25% weight" },
          { p: "Medicine Adherence", v: `${card?.activePercent?.medicinePct ?? 0}%`, s: activeLabel(card?.activePercent?.medicinePct ?? 0), r: "10% weight" },
          { p: "Stress Index (Weekly Avg)", v: stress?.totalLogs ? `${stressAvg}/100` : "No Data", s: stress?.totalLogs ? stressLabel(stressAvg) : "—", r: `${stress?.totalLogs ?? 0} check-ins` },
          { p: "Burnout Risk", v: stress?.burnoutRisk ? "Risk Detected" : "Not Detected", s: stress?.burnoutRisk ? "Caution" : "Safe", r: `${stress?.highStreakDays ?? 0} high-stress days` },
          { p: "Weekly Calories Consumed", v: weeklyCalories > 0 ? `${weeklyCalories.toLocaleString()} kcal` : "N/A", s: weeklyCalories > 0 ? "Logged" : "No Data", r: "AI diet plan data" },
          { p: "Estimated Weekly Protein", v: proteinG > 0 ? `${proteinG} g` : "N/A", s: "Estimated", r: "15% of calories" },
          { p: "Estimated Weekly Carbs", v: carbsG > 0 ? `${carbsG} g` : "N/A", s: "Estimated", r: "55% of calories" },
        ].map((r, i) => `
          <tr ${i % 2 === 0 ? 'style="background:#FAFBFC"' : ""}>
            <td style="font-weight:600;font-size:10px">${r.p}</td>
            <td style="font-weight:700">${r.v}</td>
            <td>${r.s}</td>
            <td style="color:#6B7280;font-size:9px">${r.r}</td>
          </tr>`).join("")}
      </tbody>
    </table>
  </div>
  <div class="rule"></div>

  <!-- 6. AI HEALTH INSIGHTS -->
  <div class="sec">
    <div class="st" style="color:#92400E;border-color:#F59E0B">AI Health Insights</div>
    <div class="ibox">
      <div class="it">🤖 Personalised Health Analysis</div>
      <div class="ib">${aiInsight.replace(/\n/g, "<br/>")}</div>
      <div class="isub">💪 <b>Exercise Recommendation:</b> ${exText}</div>
      ${ai?.targetProgress ? `<div class="isub">🎯 <b>Goal Progress:</b> ${stripHindi(ai.targetProgress.note || "Tracking in progress.")} ${ai.targetProgress.progressPct != null ? `(${ai.targetProgress.progressPct}% achieved)` : ""}</div>` : ""}
    </div>
    ${dietChart?.weeklyTips && dietChart.weeklyTips.length > 0 ? `
    <div style="margin-top:10px;padding:11px;background:#F0FDF4;border-radius:8px;border:1px solid #D1FAE5">
      <div style="font-size:10px;font-weight:700;color:#065F46;margin-bottom:5px">🌿 Weekly Health Tips</div>
      ${dietChart.weeklyTips.slice(0, 4).map(tip => `<div style="font-size:9px;color:#047857;margin-bottom:3px">• ${stripHindi(tip)}</div>`).join("")}
    </div>` : ""}
  </div>
  <div class="rule"></div>

  <!-- 7. WEEKLY DIET CHART -->
  <div class="sec">
    <div class="st" style="color:#065F46;border-color:#10B981">Weekly Diet Chart</div>
    <p style="font-size:9px;color:#6B7280;margin-bottom:9px">AI-personalised meal plan based on your health profile and wellness goals.</p>
    <table>
      <thead><tr><th style="width:55px">Day</th><th>Breakfast</th><th>Lunch</th><th>Dinner</th><th style="width:70px">Total kcal</th><th style="width:55px">Water</th></tr></thead>
      <tbody>${dietRows}</tbody>
    </table>
    ${dietChart?.weekStart ? `<p style="font-size:8px;color:#9CA3AF;margin-top:6px">Week from: ${new Date(dietChart.weekStart).toLocaleDateString("en-GB", { day:"2-digit", month:"long", year:"numeric" })} · Daily target: ${dietChart.targetCalories || "—"} kcal</p>` : ""}
  </div>

  <!-- FOOTER -->
  <div class="ftr">
    <div class="fm">
      <div class="fc">
        <div class="fcn">🏥 ${company.companyName}</div>
        ${company.tagline ? `<div class="fct">${company.tagline}</div>` : ""}
        <div class="fcc">
          ${company.supportEmail ? `<div>📧 <b>Email:</b> ${company.supportEmail}</div>` : ""}
          ${company.supportPhone ? `<div>📞 <b>Phone:</b> ${company.supportPhone}</div>` : ""}
          ${company.website ? `<div>🌐 <b>Website:</b> ${company.website}</div>` : ""}
          ${company.address ? `<div>📍 <b>Address:</b> ${company.address}</div>` : ""}
        </div>
      </div>
      <div class="fqr">
        <img src="${qrUrl}" width="70" height="70" alt="QR"/>
        <p>Scan to visit<br/>aorane.com</p>
      </div>
    </div>
    <div class="decl">
      <b>LEGAL DECLARATION:</b> This report is auto-generated by the ${company.companyName} platform from self-reported data.
      It is for personal awareness only and does not constitute medical advice, diagnosis, or treatment.
      Please consult a qualified medical professional before making health decisions.
      ${company.companyName} accepts no liability for actions taken based on this document.
    </div>
    <div class="fbar">
      <span>© ${new Date().getFullYear()} ${company.companyName} · All Rights Reserved</span>
      <span>Generated: ${formatDate(generatedAt)} · Report #HR-${reportNo}</span>
    </div>
  </div>

</div>
</body>
</html>`;
}

// ── PDF Download ───────────────────────────────────────────────────────────────

async function downloadPdfNative(html: string): Promise<void> {
  try {
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Share Health Report", UTI: "com.adobe.pdf" });
    } else {
      Alert.alert("Saved!", "Report saved as PDF to your device.");
    }
  } catch {
    Alert.alert("Error", "Could not generate PDF. Please try again.");
  }
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
  const [loading, setLoading]       = useState(true);
  const [downloading, setDl]        = useState(false);
  const [rangeScore, setRangeScore] = useState<number | null>(null);

  useEffect(() => { loadData(); }, [reportType]);

  const loadData = async () => {
    setLoading(true);
    try {
      const dr = getDateRange(reportType);
      const startDate = dr.from.toLocaleDateString("en-CA");
      const endDate   = dr.to.toLocaleDateString("en-CA");
      const [scRes, coRes, stRes, prRes, dtRes, aiRes, wnRes, srRes] = await Promise.allSettled([
        api.getScorecard(),
        api.getCompanySettings(),
        api.getStressWeekly(),
        api.getProfile(),
        api.getWeeklyDietChart(),
        api.getDailySuggestions(),
        api.getWeeklyFoodNutrition(),
        api.getScoreRange(startDate, endDate),
      ]);
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
      if (wnRes.status === "fulfilled") {
        setWeeklyNutrition(wnRes.value as WeeklyNutrition);
      }
      if (srRes.status === "fulfilled") {
        setRangeScore((srRes.value as { score: number }).score ?? null);
      }
    } catch { }
    setLoading(false);
  };

  const dateRange   = getDateRange(reportType);
  const generatedAt = new Date();
  const P           = company.primaryColor || "#0077B6";
  const overall     = card?.activePercent?.overall ?? 0;
  const healthScore = rangeScore !== null ? rangeScore : (card?.healthScore ?? overall);
  const stressAvg   = stressData?.weekAvg ?? 0;
  const heightCm    = profile?.height_cm ? Number(profile.height_cm) : null;
  const weightKg    = profile?.weight_kg ? Number(profile.weight_kg) : null;
  const weeklyCalories = dietChart ? dietChart.days.reduce((s, d) => s + (d.totalCalories || 0), 0) : 0;
  const proteinG    = Math.round((weeklyCalories * 0.15) / 4);
  const carbsG      = Math.round((weeklyCalories * 0.55) / 4);

  const handleDownload = async () => {
    setDl(true);
    const html = buildReportHtml(card, company, reportType, dateRange, generatedAt, profile, stressData, dietChart, aiSugg, weeklyNutrition, rangeScore);
    await downloadPdfNative(html);
    setDl(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F0F4F8" }}>
      <ScrollView contentContainerStyle={{ paddingTop: topPad + 12, paddingBottom: 100, paddingHorizontal: 12 }}>

        {/* Nav Header */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={18} color={P} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#0D1F33", fontFamily: "Inter_700Bold", fontSize: 20 }}>Health Report</Text>
            <Text style={{ color: "#7A90A4", fontFamily: "Inter_400Regular", fontSize: 12 }}>
              Comprehensive PDF health summary
            </Text>
          </View>
          <TouchableOpacity onPress={loadData} style={s.refreshBtn}>
            <Ionicons name="refresh" size={16} color={P} />
          </TouchableOpacity>
        </View>

        {/* Report Type Toggle */}
        <View style={s.toggle}>
          {(["weekly", "monthly"] as const).map(t => (
            <TouchableOpacity key={t} onPress={() => setReportType(t)}
              style={[s.toggleBtn, reportType === t && { backgroundColor: P }]}>
              <Text style={[s.toggleTxt, reportType === t && { color: "#FFF" }]}>
                {t === "weekly" ? "Weekly Report" : "Monthly Report"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={{ paddingTop: 60, alignItems: "center", gap: 14 }}>
            <ActivityIndicator size="large" color={P} />
            <Text style={{ color: "#7A90A4", fontFamily: "Inter_400Regular", fontSize: 13 }}>Loading health data…</Text>
          </View>
        ) : (
          <>
            {/* ── Document Card ── */}
            <View style={s.doc}>

              {/* Letterhead */}
              <LinearGradient colors={[P, company.accentColor || "#00B896"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.lh}>
                <View style={s.lhLogo}>
                  <Image
                    source={require("../assets/images/icon.png")}
                    style={{ width: 38, height: 38, borderRadius: 9 }}
                    resizeMode="contain"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.lhTitle}>{company.companyName}</Text>
                  {company.tagline ? <Text style={s.lhSub}>{company.tagline}</Text> : null}
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <View style={s.typeBadge}>
                    <Text style={s.typeText}>{reportType === "weekly" ? "WEEKLY" : "MONTHLY"}</Text>
                  </View>
                  <Text style={s.genDate}>{formatDate(generatedAt)}</Text>
                </View>
              </LinearGradient>

              {/* Meta row */}
              <View style={s.metaBar}>
                {[
                  { l: "Period", v: `${formatDate(dateRange.from).slice(0,6)} — ${formatDate(dateRange.to)}` },
                  { l: "Generated", v: formatDate(generatedAt) },
                  { l: "Plan", v: (card?.plan || "FREE").toUpperCase() },
                ].map(m => (
                  <View key={m.l} style={s.metaCell}>
                    <Text style={s.metaLbl}>{m.l}</Text>
                    <Text style={s.metaVal}>{m.v}</Text>
                  </View>
                ))}
              </View>
              <View style={s.rule} />

              {/* 1. User Profile */}
              <View style={s.sec}>
                <Text style={[s.secTitle, { color: P, borderColor: P }]}>USER PROFILE</Text>
                <View style={s.profGrid}>
                  {[
                    { l: "Full Name",   v: card?.name || "—" },
                    { l: "AORANE ID",   v: card?.aoraneId || "—" },
                    { l: "Age",         v: card?.age ? `${card.age} yrs` : "—" },
                    { l: "Gender",      v: card?.gender ? card.gender.charAt(0).toUpperCase() + card.gender.slice(1) : "—" },
                    { l: "Height",      v: heightCm ? `${heightCm} cm` : "—" },
                    { l: "Weight",      v: weightKg ? `${weightKg} kg` : "—" },
                    { l: "Blood Group", v: card?.bloodGroup || "—", red: true },
                    { l: "BMI",         v: card?.bmi ? `${card.bmi} (${card.bmiCategory})` : "—" },
                  ].map(f => (
                    <View key={f.l} style={s.profField}>
                      <Text style={s.profLbl}>{f.l}</Text>
                      <Text style={[s.profVal, f.red && { color: "#DC2626" }]}>{f.v}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View style={s.rule} />

              {/* 2. Score Summary */}
              <View style={s.sec}>
                <Text style={[s.secTitle, { color: P, borderColor: P }]}>HEALTH SCORE OVERVIEW</Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  {[
                    { label: "Health Score", val: healthScore, unit: "/100", color: activeColor(healthScore), sub: activeLabel(healthScore) },
                    { label: "Active Score",  val: overall,     unit: "%",    color: "#6366F1",              sub: activeLabel(overall) },
                    { label: "Stress Level",  val: stressAvg,   unit: "/100", color: stressColor(stressAvg), sub: stressLabel(stressAvg) },
                  ].map(sc => (
                    <View key={sc.label} style={[s.scoreCard, { borderColor: sc.color + "30", backgroundColor: sc.color + "08" }]}>
                      <Text style={[s.scoreBig, { color: sc.color }]}>
                        {sc.val > 0 ? `${sc.val}${sc.unit}` : "—"}
                      </Text>
                      <Text style={[s.scoreLbl, { color: sc.color }]}>{sc.label}</Text>
                      <Text style={s.scoreSub}>{sc.sub}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View style={s.rule} />

              {/* 3. Active Score Breakdown */}
              <View style={s.sec}>
                <Text style={[s.secTitle, { color: P, borderColor: P }]}>ACTIVE SCORE BREAKDOWN</Text>
                {[
                  { l: "Nutrition (Food Logging)",     v: card?.activePercent?.foodPct ?? 0,     w: "35%" },
                  { l: "Hydration (Water Intake)",     v: card?.activePercent?.waterPct ?? 0,    w: "30%" },
                  { l: "Exercise (Physical Activity)", v: card?.activePercent?.exercisePct ?? 0, w: "25%" },
                  { l: "Medicine Adherence",           v: card?.activePercent?.medicinePct ?? 0, w: "10%" },
                ].map(m => (
                  <View key={m.l} style={{ marginBottom: 10 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                      <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: "#0D1F33" }}>
                        {m.l}{" "}
                        <Text style={{ fontSize: 9, color: "#9CA3AF" }}>({m.w})</Text>
                      </Text>
                      <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: activeColor(m.v) }}>
                        {m.v}%
                      </Text>
                    </View>
                    <View style={{ height: 7, backgroundColor: "#EEF2F7", borderRadius: 4, overflow: "hidden" }}>
                      <View style={{ height: 7, width: `${Math.max(m.v, 2)}%` as `${number}%`, backgroundColor: activeColor(m.v), borderRadius: 4 }} />
                    </View>
                    <Text style={{ fontSize: 9, color: activeColor(m.v), fontFamily: "Inter_600SemiBold", marginTop: 1 }}>
                      {activeLabel(m.v)}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={s.rule} />

              {/* 4. Weekly Nutrition */}
              <View style={s.sec}>
                <Text style={[s.secTitle, { color: P, borderColor: P }]}>WEEKLY NUTRITION SUMMARY</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                  {[
                    { l: "Total Calories",  v: weeklyCalories > 0 ? `${weeklyCalories.toLocaleString()}` : "—", u: "kcal/week" },
                    { l: "Protein",         v: proteinG > 0 ? `${proteinG}` : "—", u: "g (est.)" },
                    { l: "Carbohydrates",   v: carbsG > 0 ? `${carbsG}` : "—", u: "g (est.)" },
                    { l: "Fats",            v: Math.round((weeklyCalories * 0.30) / 9) > 0 ? `${Math.round((weeklyCalories * 0.30) / 9)}` : "—", u: "g (est.)" },
                    { l: "Daily Target",    v: dietChart?.targetCalories ? `${Math.round(dietChart.targetCalories)}` : "—", u: "kcal/day" },
                  ].map(n => (
                    <View key={n.l} style={[s.nutCard, { borderColor: P + "20", backgroundColor: P + "06" }]}>
                      <Text style={[s.nutVal, { color: P }]}>{n.v}</Text>
                      <Text style={s.nutUnit}>{n.u}</Text>
                      <Text style={s.nutLbl}>{n.l}</Text>
                    </View>
                  ))}
                </View>
                <Text style={{ fontSize: 9, color: "#9CA3AF", fontFamily: "Inter_400Regular" }}>
                  * Protein, Carbs, and Fat are estimates (Indian diet ratios: 15%:55%:30%). Generate AI Diet Chart for precision.
                </Text>
              </View>
              <View style={s.rule} />

              {/* 4b. Micronutrients */}
              <View style={s.sec}>
                <Text style={[s.secTitle, { color: P, borderColor: P }]}>MICRONUTRIENT TRACKING (7-DAY)</Text>
                {weeklyNutrition ? (
                  <>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                      {[
                        { l: "Calcium",     v: Math.round(weeklyNutrition.weeklyTotals.totalCalciumMg),            u: "mg/week",  rdv: 7000,  color: "#0ea5e9" },
                        { l: "Vitamin C",   v: Math.round(weeklyNutrition.weeklyTotals.totalVitaminCMg),           u: "mg/week",  rdv: 455,   color: "#f59e0b" },
                        { l: "Vitamin B12", v: Math.round(weeklyNutrition.weeklyTotals.totalVitaminB12Mcg * 100) / 100, u: "mcg/week", rdv: 16.8, color: "#8b5cf6" },
                        { l: "Iron",        v: Math.round(weeklyNutrition.weeklyTotals.totalIronMg * 10) / 10,     u: "mg/week",  rdv: 126,   color: "#ef4444" },
                      ].map(n => {
                        const pct = n.rdv > 0 ? Math.min(100, Math.round((n.v / n.rdv) * 100)) : 0;
                        const status = pct >= 80 ? "Sufficient" : pct >= 50 ? "Moderate" : "Low";
                        const statusColor = pct >= 80 ? "#10B981" : pct >= 50 ? "#F59E0B" : "#EF4444";
                        return (
                          <View key={n.l} style={[s.nutCard, { borderColor: n.color + "30", backgroundColor: n.color + "08", minWidth: "46%" }]}>
                            <Text style={[s.nutVal, { color: n.color }]}>{n.v > 0 ? n.v : "—"}</Text>
                            <Text style={s.nutUnit}>{n.u}</Text>
                            <Text style={s.nutLbl}>{n.l}</Text>
                            {n.v > 0 && (
                              <>
                                <View style={{ height: 3, backgroundColor: "#E5E7EB", borderRadius: 2, marginTop: 4 }}>
                                  <View style={{ height: 3, width: `${pct}%` as `${number}%`, backgroundColor: statusColor, borderRadius: 2 }} />
                                </View>
                                <Text style={{ fontSize: 8, color: statusColor, fontFamily: "Inter_600SemiBold", marginTop: 2 }}>
                                  {status} · {pct}% RDV
                                </Text>
                              </>
                            )}
                          </View>
                        );
                      })}
                    </View>
                    <Text style={{ fontSize: 9, color: "#9CA3AF", fontFamily: "Inter_400Regular" }}>
                      RDV = Recommended Daily Value × 7 days. Sourced from AI-identified food logs only.
                    </Text>
                  </>
                ) : (
                  <View style={{ paddingVertical: 16, alignItems: "center" }}>
                    <Text style={{ fontSize: 12, color: "#9CA3AF", fontFamily: "Inter_400Regular", textAlign: "center" }}>
                      Log meals in the Food tab to track{"\n"}Calcium, Vitamin C, B12 & Iron
                    </Text>
                  </View>
                )}
              </View>
              <View style={s.rule} />

              {/* 5. Health Metrics Summary */}
              <View style={s.sec}>
                <Text style={[s.secTitle, { color: P, borderColor: P }]}>HEALTH METRICS SUMMARY</Text>
                <View style={s.table}>
                  <View style={[s.trow, { backgroundColor: P + "12" }]}>
                    <Text style={[s.th, { flex: 2 }]}>PARAMETER</Text>
                    <Text style={s.th}>VALUE</Text>
                    <Text style={s.th}>STATUS</Text>
                  </View>
                  {[
                    { p: "BMI",                  v: card?.bmi ? `${card.bmi} (${card.bmiCategory})` : "N/A", st: card?.bmiCategory || "—" },
                    { p: "Blood Group",           v: card?.bloodGroup || "N/A", st: "Recorded" },
                    { p: "Height / Weight",       v: `${heightCm ? `${heightCm}cm` : "—"} / ${weightKg ? `${weightKg}kg` : "—"}`, st: "Recorded" },
                    { p: "Health Score",          v: `${healthScore}/100`, st: activeLabel(healthScore) },
                    { p: "Active Score",          v: `${overall}%`, st: activeLabel(overall) },
                    { p: "Nutrition Adherence",   v: `${card?.activePercent?.foodPct ?? 0}%`, st: activeLabel(card?.activePercent?.foodPct ?? 0) },
                    { p: "Hydration Score",       v: `${card?.activePercent?.waterPct ?? 0}%`, st: activeLabel(card?.activePercent?.waterPct ?? 0) },
                    { p: "Exercise Adherence",    v: `${card?.activePercent?.exercisePct ?? 0}%`, st: activeLabel(card?.activePercent?.exercisePct ?? 0) },
                    { p: "Medicine Adherence",    v: `${card?.activePercent?.medicinePct ?? 0}%`, st: activeLabel(card?.activePercent?.medicinePct ?? 0) },
                    { p: "Stress Index (Avg)",    v: stressData?.totalLogs ? `${stressAvg}/100` : "No Data", st: stressData?.totalLogs ? stressLabel(stressAvg) : "—" },
                    { p: "Burnout Risk",          v: stressData?.burnoutRisk ? "Detected" : "Not Detected", st: stressData?.burnoutRisk ? "Caution" : "Safe" },
                    { p: "Weekly Calories",       v: weeklyCalories > 0 ? `${weeklyCalories.toLocaleString()} kcal` : "N/A", st: weeklyCalories > 0 ? "Logged" : "No Data" },
                    { p: "Est. Weekly Protein",   v: proteinG > 0 ? `${proteinG} g` : "N/A", st: "Estimated" },
                    { p: "Est. Weekly Carbs",     v: carbsG > 0 ? `${carbsG} g` : "N/A", st: "Estimated" },
                  ].map((row, i) => (
                    <View key={i} style={[s.trow, i % 2 === 0 && { backgroundColor: "#FAFBFC" }]}>
                      <Text style={[s.td, { flex: 2, fontFamily: "Inter_500Medium" }]}>{row.p}</Text>
                      <Text style={[s.td, { fontFamily: "Inter_600SemiBold" }]}>{row.v}</Text>
                      <Text style={[s.td, { fontSize: 9 }]}>{row.st}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View style={s.rule} />

              {/* 6. AI Health Insights */}
              <View style={s.sec}>
                <Text style={[s.secTitle, { color: "#92400E", borderColor: "#F59E0B" }]}>AI HEALTH INSIGHTS</Text>
                <View style={s.insight}>
                  <Text style={s.insightTitle}>🤖 Personalised AI Analysis</Text>
                  <Text style={s.insightBody}>
                    {stripHindi([aiSugg?.healthTip, aiSugg?.motivation].filter(Boolean).join("\n")) ||
                      (overall >= 70
                        ? `Your health activity is ${activeLabel(overall).toLowerCase()} at ${overall}%. Maintain your current habits — consistency drives long-term health gains.`
                        : `Your score of ${overall}% shows room to improve. Focus on ${(card?.activePercent?.waterPct ?? 0) < 50 ? "water intake" : (card?.activePercent?.foodPct ?? 0) < 50 ? "meal logging" : "daily exercise"} for the quickest gains.`)}
                  </Text>
                  {aiSugg?.exerciseSuggestion && (
                    <Text style={s.insightSub}>
                      💪 {aiSugg.exerciseSuggestion.name} · {aiSugg.exerciseSuggestion.duration || "30 min"} · {stripHindi(aiSugg.exerciseSuggestion.benefit || "")}
                    </Text>
                  )}
                </View>
                {dietChart?.weeklyTips && dietChart.weeklyTips.length > 0 && (
                  <View style={[s.insight, { marginTop: 10, backgroundColor: "#F0FDF4", borderColor: "#D1FAE5" }]}>
                    <Text style={[s.insightTitle, { color: "#065F46" }]}>🌿 Weekly Health Tips</Text>
                    {dietChart.weeklyTips.slice(0, 3).map((tip, i) => (
                      <Text key={i} style={[s.insightBody, { color: "#047857", marginBottom: 4 }]}>
                        • {stripHindi(tip)}
                      </Text>
                    ))}
                  </View>
                )}
              </View>

              {/* 7. Weekly Diet Chart */}
              {dietChart && dietChart.days.length > 0 && (
                <>
                  <View style={s.rule} />
                  <View style={s.sec}>
                    <Text style={[s.secTitle, { color: "#065F46", borderColor: "#10B981" }]}>WEEKLY DIET CHART</Text>
                    <Text style={{ fontSize: 11, color: "#6B7280", fontFamily: "Inter_400Regular", marginBottom: 10 }}>
                      AI-personalised meal plan based on your profile and goals.
                    </Text>
                    {dietChart.days.map((d, di) => (
                      <View key={di} style={s.dayCard}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8, alignItems: "center" }}>
                          <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13, color: "#0D1F33" }}>{d.day}</Text>
                          <Text style={{ fontFamily: "Inter_700Bold", fontSize: 12, color: P }}>{d.totalCalories} kcal · {d.water || "8 gl."}</Text>
                        </View>
                        {[
                          { icon: "🌅", label: "Breakfast", data: d.breakfast },
                          { icon: "☀️", label: "Lunch",     data: d.lunch },
                          { icon: "🌙", label: "Dinner",    data: d.dinner },
                        ].map(({ icon, label, data }) => (
                          <View key={label} style={{ flexDirection: "row", marginBottom: 4 }}>
                            <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#374151", width: 78 }}>{icon} {label}</Text>
                            <Text style={{ fontSize: 10, color: "#4B5563", flex: 1, fontFamily: "Inter_400Regular" }} numberOfLines={2}>
                              {data.items.slice(0, 3).join(", ") || "—"}
                              <Text style={{ color: "#9CA3AF" }}> ({data.calories} kcal)</Text>
                            </Text>
                          </View>
                        ))}
                        {d.tip ? (
                          <Text style={{ fontSize: 9, color: "#6B7280", fontFamily: "Inter_400Regular", marginTop: 4, fontStyle: "italic" }}>
                            💡 {stripHindi(d.tip)}
                          </Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                </>
              )}

              {/* Footer / Declaration */}
              <View style={s.rule} />
              <LinearGradient colors={[P + "12", (company.accentColor || "#00B896") + "12"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.footer}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13, color: P }}>{company.companyName}</Text>
                    {company.tagline ? <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#6B7280", marginTop: 2 }}>{company.tagline}</Text> : null}
                    <View style={{ marginTop: 6, gap: 2 }}>
                      {company.supportEmail && <Text style={{ fontSize: 10, color: "#374151", fontFamily: "Inter_400Regular" }}>📧 {company.supportEmail}</Text>}
                      {company.supportPhone && <Text style={{ fontSize: 10, color: "#374151", fontFamily: "Inter_400Regular" }}>📞 {company.supportPhone}</Text>}
                      {company.website && <Text style={{ fontSize: 10, color: P, fontFamily: "Inter_400Regular" }}>🌐 {company.website}</Text>}
                      {company.address && <Text style={{ fontSize: 9, color: "#6B7280", fontFamily: "Inter_400Regular" }}>📍 {company.address}</Text>}
                    </View>
                  </View>
                </View>
                <View style={{ backgroundColor: "#FFF8F1", borderRadius: 8, padding: 10, borderWidth: 1, borderColor: "#FDE68A", marginBottom: 8 }}>
                  <Text style={{ fontSize: 9, fontFamily: "Inter_700Bold", color: "#92400E", marginBottom: 3 }}>⚖️ LEGAL DECLARATION</Text>
                  <Text style={{ fontSize: 8.5, color: "#78350F", fontFamily: "Inter_400Regular", lineHeight: 13 }}>
                    This report is auto-generated by the {company.companyName} platform from self-reported user data. It is for personal health awareness only and does not constitute medical advice, diagnosis, or treatment. Please consult a qualified medical professional before making any health decisions. {company.companyName} accepts no liability for actions based on this document.
                  </Text>
                </View>
                <Text style={{ fontSize: 8, color: "#9CA3AF", textAlign: "center", fontFamily: "Inter_400Regular" }}>
                  © {new Date().getFullYear()} {company.companyName} · {company.website || "aorane.com"} · {formatDate(generatedAt)}
                </Text>
              </LinearGradient>

            </View>

            {/* Download/Share Buttons */}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <TouchableOpacity onPress={handleDownload} disabled={downloading}
                style={[s.btn, { flex: 1, backgroundColor: P }]}>
                {downloading ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="download-outline" size={18} color="#FFF" />}
                <Text style={s.btnTxt}>{downloading ? "Generating…" : "Download PDF"}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDownload} disabled={downloading}
                style={[s.btn, { flex: 1, backgroundColor: company.accentColor || "#00B896" }]}>
                <Ionicons name="share-social-outline" size={18} color="#FFF" />
                <Text style={s.btnTxt}>Share Report</Text>
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
  backBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,119,182,0.1)", alignItems: "center", justifyContent: "center" },
  refreshBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E5EFF7", alignItems: "center", justifyContent: "center" },
  toggle:     { flexDirection: "row", backgroundColor: "#FFF", borderRadius: 12, padding: 4, marginBottom: 14, gap: 4, borderWidth: 1, borderColor: "#E5EFF7" },
  toggleBtn:  { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center" },
  toggleTxt:  { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#7A90A4" },
  doc:        { backgroundColor: "#FFF", borderRadius: 12, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 16, elevation: 6 },
  lh:         { padding: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  lhLogo:     { width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" },
  lhTitle:    { color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 17, letterSpacing: 0.3 },
  lhSub:      { color: "rgba(255,255,255,0.7)", fontFamily: "Inter_400Regular", fontSize: 10, marginTop: 1 },
  typeBadge:  { backgroundColor: "rgba(255,255,255,0.22)", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 4 },
  typeText:   { color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 9, letterSpacing: 0.8 },
  genDate:    { color: "rgba(255,255,255,0.6)", fontFamily: "Inter_400Regular", fontSize: 8 },
  metaBar:    { flexDirection: "row", borderBottomWidth: 1, borderColor: "#E5EFF7" },
  metaCell:   { flex: 1, padding: 9, borderRightWidth: 1, borderColor: "#E5EFF7" },
  metaLbl:    { fontSize: 7, color: "#9CA3AF", textTransform: "uppercase", fontFamily: "Inter_400Regular", letterSpacing: 0.5 },
  metaVal:    { fontSize: 9, color: "#0D1F33", fontFamily: "Inter_600SemiBold", marginTop: 2 },
  rule:       { height: 1, backgroundColor: "#E5EFF7", marginHorizontal: 12 },
  sec:        { padding: 14 },
  secTitle:   { fontSize: 9, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 1, borderLeftWidth: 3, paddingLeft: 8, marginBottom: 12 },
  profGrid:   { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  profField:  { backgroundColor: "#F8FAFD", borderRadius: 8, padding: 9, minWidth: 120, flex: 1, borderWidth: 1, borderColor: "#E5EFF7" },
  profLbl:    { fontSize: 7, color: "#9CA3AF", textTransform: "uppercase", fontFamily: "Inter_400Regular", letterSpacing: 0.4 },
  profVal:    { fontSize: 12, fontFamily: "Inter_700Bold", color: "#0D1F33", marginTop: 2 },
  scoreCard:  { flex: 1, borderRadius: 10, padding: 12, borderWidth: 1, alignItems: "center" },
  scoreBig:   { fontSize: 20, fontFamily: "Inter_700Bold" },
  scoreLbl:   { fontSize: 9, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.3, marginTop: 2 },
  scoreSub:   { fontSize: 9, color: "#6B7280", fontFamily: "Inter_400Regular", marginTop: 3 },
  nutCard:    { flex: 1, minWidth: "28%", borderRadius: 10, padding: 10, borderWidth: 1, alignItems: "center" },
  nutVal:     { fontSize: 16, fontFamily: "Inter_700Bold" },
  nutUnit:    { fontSize: 8, color: "#6B7280", fontFamily: "Inter_400Regular", marginTop: 1 },
  nutLbl:     { fontSize: 8, fontFamily: "Inter_600SemiBold", color: "#374151", marginTop: 3, textTransform: "uppercase", textAlign: "center" },
  table:      { borderWidth: 1, borderColor: "#E5EFF7", borderRadius: 8, overflow: "hidden" },
  trow:       { flexDirection: "row" },
  th:         { flex: 1, padding: 7, fontSize: 8, fontFamily: "Inter_700Bold", color: "#374151", textTransform: "uppercase" },
  td:         { flex: 1, padding: 7, fontSize: 10, fontFamily: "Inter_400Regular", color: "#0D1F33", borderTopWidth: 1, borderColor: "#F0F4F8" },
  insight:    { backgroundColor: "#FFFBF0", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#FDE68A" },
  insightTitle:{ fontFamily: "Inter_700Bold", fontSize: 11, color: "#92400E", marginBottom: 6 },
  insightBody:{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#78350F", lineHeight: 16 },
  insightSub: { fontFamily: "Inter_400Regular", fontSize: 10, color: "#6B7280", marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderColor: "#FDE68A" },
  dayCard:    { backgroundColor: "#FAFBFC", borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: "#E5EFF7" },
  footer:     { padding: 14 },
  btn:        { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14 },
  btnTxt:     { color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 14 },
});
