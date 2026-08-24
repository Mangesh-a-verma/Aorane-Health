// lib/reports/reportLogic.ts
//
// ─────────────────────────────────────────────────────────────────────────
// SHARED REPORT LOGIC — single source of truth
// ─────────────────────────────────────────────────────────────────────────
// These are pure functions (no HTML, no side effects) extracted from
// `buildHealthReport.ts`. Both the PDF report (buildHealthReport.ts) and
// the native Health Report summary screen (app/health-report.tsx) import
// from here, so the two surfaces NEVER show different numbers for the
// same ReportData.
//
// IMPORTANT: if you change a threshold or wording here, both the PDF and
// the native summary screen update automatically — that's the point.
// ─────────────────────────────────────────────────────────────────────────

import { ReportData } from "./reportTypes";

export type RiskLevel = "Low" | "Moderate" | "High";

// ─── Score → Grade / Status / Color ────────────────────────────────────

export function getGrade(score: number): string {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 50) return "C";
  return "D";
}

export function getStatus(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 76) return "Good";
  if (score >= 61) return "Fair";
  if (score >= 41) return "Below Average";
  return "Needs Attention";
}

export function scoreColor(score: number): string {
  if (score >= 90) return "#059669";
  if (score >= 76) return "#0EA5E9";
  if (score >= 61) return "#F59E0B";
  if (score >= 41) return "#F97316";
  return "#EF4444";
}

export function riskColor(r: RiskLevel): string {
  if (r === "Low") return "#059669";
  if (r === "Moderate") return "#F59E0B";
  return "#EF4444";
}

// ─── Health Age ─────────────────────────────────────────────────────────

export function calcHealthAge(
  actualAge: number | null,
  avgScore: number,
  stressRisk: RiskLevel,
  bmiCategory: string | null,
  medPct: number,
  activePct: number
): number {
  if (!actualAge) return 0;
  let adjustment = 0;
  adjustment += (avgScore - 70) * -0.08;
  if (stressRisk === "High") adjustment += 2;
  else if (stressRisk === "Low") adjustment -= 1;
  if (bmiCategory === "Obese") adjustment += 3;
  else if (bmiCategory === "Overweight") adjustment += 1.5;
  else if (bmiCategory === "Normal") adjustment -= 1;
  if (medPct >= 90) adjustment -= 1;
  else if (medPct < 60) adjustment += 1.5;
  if (activePct >= 80) adjustment -= 1.5;
  else if (activePct < 40) adjustment += 1.5;

  return Math.max(Math.round(actualAge + adjustment), actualAge - 10);
}

// ─── Derived risk levels (sleep / activity / medication) ──────────────
// Hydration, Nutrition, and Stress risk already come from the API
// (ReportData.risks). Sleep/Activity/Medication risk are derived here
// from period percentages, same thresholds as buildHealthReport.ts.

export function deriveSleepRisk(sleepPct: number): RiskLevel {
  return sleepPct >= 80 ? "Low" : sleepPct >= 50 ? "Moderate" : "High";
}

export function deriveActivityRisk(activePct: number): RiskLevel {
  return activePct >= 70 ? "Low" : activePct >= 40 ? "Moderate" : "High";
}

// hasSchedule distinguishes "0% because nothing was scheduled" (neutral —
// nothing to be non-compliant with) from "0% despite an active schedule"
// (genuinely poor adherence). Without this, a user who has never added a
// medicine gets flagged "High risk / 0% compliance", which the PDF report
// (buildHealthReport.ts) already special-cased correctly — this brings the
// native summary screen in line with it instead of the other way around.
export function deriveMedicationRisk(medPct: number, hasSchedule: boolean = true): RiskLevel {
  if (!hasSchedule) return "Low";
  return medPct >= 85 ? "Low" : medPct >= 60 ? "Moderate" : "High";
}

// ─── Risk cards (Hydration / Nutrition / Stress / Sleep / Activity / Medication) ──

export type RiskCard = {
  key: "hydration" | "nutrition" | "stress" | "sleep" | "activity" | "medication";
  name: string;
  risk: RiskLevel;
  score: number; // 0-100
  tip: string;
};

export function buildRiskCards(d: ReportData, medPct: number): RiskCard[] {
  const hr = d.risks?.hydrationRisk || "Low";
  const nr = d.risks?.nutritionRisk || "Low";
  const sr = d.risks?.stressRisk || "Low";
  const sleepPct = d.scores?.sleepPct || 0;
  const activePct = d.scores?.activePercent || 0;
  const sleepRisk = deriveSleepRisk(sleepPct);
  const activityRisk = deriveActivityRisk(activePct);
  const medsTotal = (d.dailyLogs || []).reduce((s, l) => s + (l?.medicinesTotal || 0), 0);
  const hasMedSchedule = medsTotal > 0;
  const medRisk = deriveMedicationRisk(medPct, hasMedSchedule);

  return [
    {
      key: "hydration",
      name: "Hydration",
      risk: hr,
      score: d.risks?.hydrationScore || 0,
      tip:
        hr === "High"
          ? "Critical dehydration. Increase fluid intake to 8+ glasses immediately."
          : hr === "Moderate"
          ? "Slightly dehydrated. Add 2–3 more glasses daily."
          : "Hydration levels are optimal.",
    },
    {
      key: "nutrition",
      name: "Nutrition",
      risk: nr,
      score: d.risks?.nutritionScore || 0,
      tip:
        nr === "High"
          ? "Poor nutritional tracking. Start logging all meals consistently."
          : nr === "Moderate"
          ? "Diet imbalance detected. Focus on balanced macro intake."
          : "Nutritional habits are on track.",
    },
    {
      key: "stress",
      name: "Stress",
      risk: sr,
      score: Math.max(0, 100 - (d.risks?.stressScore || 0)),
      tip:
        sr === "High"
          ? "Elevated stress markers. Consider mindfulness and professional guidance."
          : sr === "Moderate"
          ? "Moderate stress. Short breaks and breathing exercises can help."
          : "Stress well-managed.",
    },
    {
      key: "sleep",
      name: "Sleep Quality",
      risk: sleepRisk,
      score: sleepPct,
      tip:
        sleepRisk === "High"
          ? "Poor sleep detected. Aim for 7–9 hours nightly."
          : sleepRisk === "Moderate"
          ? "Sleep duration below optimal. Improve sleep hygiene."
          : "Sleep patterns are healthy.",
    },
    {
      key: "activity",
      name: "Activity",
      risk: activityRisk,
      score: activePct,
      tip:
        activityRisk === "High"
          ? "Sedentary lifestyle detected. Add 30 min exercise daily."
          : activityRisk === "Moderate"
          ? "Activity slightly below target. Increase movement gradually."
          : "Activity levels are excellent.",
    },
    {
      key: "medication",
      name: "Medication",
      risk: medRisk,
      score: medPct,
      tip: !hasMedSchedule
        ? "No medication schedules found in the app."
        : medRisk === "High"
          ? `Only ${medPct}% compliance. Follow your prescribed schedule strictly.`
          : medRisk === "Moderate"
          ? "Some missed doses detected. Set daily reminders."
          : "Medication adherence is excellent.",
    },
  ];
}

// ─── AI Key Findings (used as "AI Health Insight" on the summary screen) ──

export function buildAiKeyFindings(d: ReportData, avgEx: number): string[] {
  const avgScore = d.scores?.periodAvgScore || 0;
  const activePct = d.scores?.activePercent || 0;
  const hr = d.risks?.hydrationRisk || "Low";

  return [
    avgScore >= 70
      ? `Health score of ${avgScore}/100 indicates ${getStatus(avgScore).toLowerCase()} overall wellness.`
      : `Health score of ${avgScore}/100 requires focused improvement across key lifestyle areas.`,
    activePct >= 70
      ? `Active participation at ${activePct}% reflects consistent engagement with daily health goals.`
      : `Activity rate of ${activePct}% is below the recommended 70% threshold.`,
    hr === "Low"
      ? "Hydration is well-maintained throughout the reporting period."
      : `Hydration risk flagged as ${hr} — water intake requires immediate attention.`,
    avgEx > 30
      ? `Average exercise duration of ${avgEx} minutes per session is clinically beneficial.`
      : `Exercise duration averages only ${avgEx || 0} minutes — increase gradually toward the 30-minute daily target.`,
  ];
}

// ─── A single one-line "AI Health Insight" banner (short form of the above) ──
// Used at the top of the native summary screen (one sentence, not a bulleted list).

export function buildAiHealthInsight(d: ReportData): string {
  const avgScore = d.scores?.periodAvgScore || 0;
  const hr = d.risks?.hydrationRisk || "Low";
  const sleepPct = d.scores?.sleepPct || 0;
  const nr = d.risks?.nutritionRisk || "Low";
  const activePct = d.scores?.activePercent || 0;

  const good: string[] = [];
  const bad: string[] = [];

  if (hr === "Low") good.push("Hydration"); else bad.push("hydration");
  if (sleepPct >= 70) good.push("sleep"); else bad.push("sleep");
  if (nr === "Low") good.push("nutrition"); else bad.push("protein intake");
  if (activePct >= 70) good.push("activity"); else bad.push("daily activity");

  const trend = avgScore >= 70 ? "improved" : avgScore >= 50 ? "held steady" : "needs attention";
  const goodPart = good.length ? `${good.join(" and ")} ${good.length > 1 ? "are" : "is"} excellent.` : "";
  const badPart = bad.length ? `Focus on improving ${bad.slice(0, 2).join(" and ")}.` : "Keep up the great work!";

  return `Your health ${trend} this period. ${goodPart} ${badPart}`.replace(/\s+/g, " ").trim();
}

// ─── Positive Trends / Areas for Improvement ───────────────────────────

export function buildPositiveTrends(d: ReportData, medPct: number): string[] {
  const activePct = d.scores?.activePercent || 0;
  const waterPct = d.scores?.waterPct || 0;
  const hr = d.risks?.hydrationRisk || "Low";
  const sleepPct = d.scores?.sleepPct || 0;

  return [
    activePct >= 70 ? "Consistent daily activity engagement" : null,
    hr === "Low" && waterPct >= 70 ? "Excellent hydration habits" : null,
    medPct >= 80 ? "Excellent medication adherence" : null,
    sleepPct >= 70 ? "Sleep quality within healthy range" : null,
  ].filter((x): x is string => Boolean(x)).slice(0, 3);
}

export function buildAreasForImprovement(d: ReportData): string[] {
  const activePct = d.scores?.activePercent || 0;
  const waterPct = d.scores?.waterPct || 0;
  const foodPct = d.scores?.foodPct || 0;
  const sleepPct = d.scores?.sleepPct || 0;
  const stressPct = d.scores?.stressPct || 0;

  return [
    activePct < 60 ? "Increase daily physical activity" : null,
    waterPct < 70 ? "Improve daily water intake" : null,
    foodPct < 60 ? "Track nutrition consistently" : null,
    sleepPct < 60 ? "Prioritize 7–9 hours of sleep" : null,
    stressPct < 60 ? "Implement stress management techniques" : null,
  ].filter((x): x is string => Boolean(x)).slice(0, 3);
}

// ─── Personalized Recommendations ──────────────────────────────────────

export function buildRecommendations(d: ReportData): string[] {
  const activePct = d.scores?.activePercent || 0;
  const waterPct = d.scores?.waterPct || 0;
  const foodPct = d.scores?.foodPct || 0;
  const stressPct = d.scores?.stressPct || 0;

  return [
    activePct < 60
      ? "Schedule 30-minute walks at a fixed time daily to build exercise habit."
      : "Maintain your activity level — consider adding strength training 2x weekly.",
    waterPct < 70
      ? "Use Aorane water reminders — drink one glass every 2 hours."
      : "Excellent hydration — continue tracking to maintain consistency.",
    foodPct < 60
      ? "Log all meals, even snacks, for accurate nutritional analysis."
      : "Explore Aorane's meal planner for optimized nutrition targets.",
    stressPct < 60
      ? "Practice 5-minute breathing exercises each morning to reduce cortisol."
      : "Maintain stress management routines that are clearly working.",
  ];
}

// ─── AI Predictions (30-day / 90-day) ──────────────────────────────────

export type Predictions = {
  trend30Score: number;
  trend90Score: number;
  predictedWeight30: string | null;
  predictedWeight90: string | null;
  lifestyleRisk: RiskLevel;
  weightRisk: RiskLevel;
  wellnessRisk: RiskLevel;
};

export function buildPredictions(d: ReportData): Predictions {
  const avgScore = d.scores?.periodAvgScore || 0;
  const activePct = d.scores?.activePercent || 0;
  const hr = d.risks?.hydrationRisk || "Low";
  const nr = d.risks?.nutritionRisk || "Low";
  const cW = d.goals?.currentWeight || 0;
  const gType = d.goals?.goalType || "maintain";

  const trend30Score = Math.min(100, Math.max(0, Math.round(avgScore + (activePct >= 60 ? 3 : -2) + (hr === "Low" ? 2 : -1))));
  const trend90Score = Math.min(100, Math.max(0, Math.round(avgScore + (activePct >= 60 ? 8 : -5) + (nr === "Low" ? 4 : -2))));

  const predictedWeight30 =
    cW > 0
      ? gType === "lose_weight" ? (cW - 1.5).toFixed(1)
      : gType === "gain_weight" ? (cW + 1.2).toFixed(1)
      : cW.toFixed(1)
      : null;
  const predictedWeight90 =
    cW > 0
      ? gType === "lose_weight" ? (cW - 4.0).toFixed(1)
      : gType === "gain_weight" ? (cW + 3.5).toFixed(1)
      : cW.toFixed(1)
      : null;

  const lifestyleRisk: RiskLevel = avgScore >= 70 ? "Low" : avgScore >= 50 ? "Moderate" : "High";
  const weightRisk: RiskLevel =
    d.profile?.bmiCategory === "Normal" ? "Low" : d.profile?.bmiCategory === "Overweight" ? "Moderate" : "High";
  const wellnessRisk: RiskLevel = avgScore >= 75 ? "Low" : avgScore >= 55 ? "Moderate" : "High";

  return { trend30Score, trend90Score, predictedWeight30, predictedWeight90, lifestyleRisk, weightRisk, wellnessRisk };
}

// ─── Medicine compliance % (used across multiple sections) ────────────

export function calcMedPct(d: ReportData): number {
  const medsTaken = (d.dailyLogs || []).reduce((s, l) => s + (l?.medicinesTaken || 0), 0);
  const medsTotal = (d.dailyLogs || []).reduce((s, l) => s + (l?.medicinesTotal || 0), 0);
  return medsTotal > 0 ? Math.round((medsTaken / medsTotal) * 100) : 0;
}

// ─── Average exercise minutes per active session (used in AI findings) ──

export function calcAvgExerciseMinutes(d: ReportData): number {
  const validLogs = (d.dailyLogs || []).filter((l) => (l?.healthScore || 0) > 0);
  const vc = validLogs.length || 1;
  return Math.round(validLogs.reduce((s, l) => s + (l?.exerciseMinutes || 0), 0) / vc);
}