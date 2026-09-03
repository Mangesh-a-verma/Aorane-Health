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

import { ReportData, RiskLevel, PillarScore } from "./reportTypes";

// RiskLevel now lives in reportTypes.ts so the report data and the
// screens that render it cannot drift apart on what a risk can be —
// notably on whether "Unknown" is expressible.
export type { RiskLevel };

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

export function deriveSleepRisk(sleepPct: number | null): RiskLevel {
  if (sleepPct == null) return "Unknown";
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
  /** null = never logged in this period, which is not the same as 0. */
  score: number | null;
  tip: string;
};

export function buildRiskCards(d: ReportData, medPct: number): RiskCard[] {
  // `|| "Low"` here used to turn every missing measurement into a clean bill
  // of health. An absent risk is Unknown.
  const hr = d.risks?.hydrationRisk ?? "Unknown";
  const nr = d.risks?.nutritionRisk ?? "Unknown";
  const sr = d.risks?.stressRisk ?? "Unknown";
  const sleepPct = d.scores?.sleep?.pct ?? null;
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
      score: d.risks?.hydrationScore ?? null,
      tip:
        hr === "Unknown"
          ? "No water logged this period — start logging to see your hydration score."
          : hr === "High"
          ? "Critical dehydration. Increase fluid intake to 8+ glasses immediately."
          : hr === "Moderate"
          ? "Slightly dehydrated. Add 2–3 more glasses daily."
          : "Hydration levels are optimal.",
    },
    {
      key: "nutrition",
      name: "Nutrition",
      risk: nr,
      score: d.risks?.nutritionScore ?? null,
      tip:
        nr === "Unknown"
          ? "No meals logged this period — start logging to see your nutrition score."
          : nr === "High"
          ? "Nutrient intake is well below target. Focus on balanced meals."
          : nr === "Moderate"
          ? "Diet imbalance detected. Focus on balanced macro intake."
          : "Nutritional habits are on track.",
    },
    {
      key: "stress",
      name: "Stress",
      risk: sr,
      score: d.risks?.stressScore == null ? null : Math.max(0, 100 - d.risks.stressScore),
      tip:
        sr === "Unknown"
          ? "No stress check-ins this period."
          : sr === "High"
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
        sleepRisk === "Unknown"
          ? "No sleep logged this period — start logging to see your sleep score."
          : sleepRisk === "High"
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
  const hr = d.risks?.hydrationRisk ?? "Unknown";

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


// ─── Pillar averaging ───────────────────────────────────────────────────

/**
 * Average one pillar's per-day sub-score from GET /health/score/:date across
 * the period.
 *
 * These four pillars used to be computed in health-report.tsx as
 * `days with any log / days in period` — a tracking-consistency number
 * presented as a health verdict. Logging a meal every day scored Nutrition
 * 100/100 whatever was eaten; logging four hours of sleep nightly scored
 * Sleep 100/100 "healthy". The graded numbers were already on the wire and
 * being discarded.
 *
 * Days with no log are EXCLUDED rather than averaged in as zero: a zero
 * reads as "did badly", which is a different claim from "did not log".
 * `days` reports the coverage so callers can state their own denominator.
 */
export function averagePillar(
  scoreByDate: Map<string, Record<string, unknown>>,
  dates: string[],
  key: "foodScore" | "waterScore" | "exerciseScore" | "sleepScore",
): PillarScore {
  const vals = dates
    .map((d) => scoreByDate.get(d)?.[key])
    .filter((v): v is number => typeof v === "number");
  return vals.length
    ? { pct: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length), days: vals.length }
    : { pct: null, days: 0 };
}

// ─── Threshold helpers for nullable pillar scores ──────────────────────
// A pillar the user never logged has a null score. `|| 0` used to turn that
// into a hard zero, which then read as "did badly" — so a report could
// advise someone to fix their sleep on the strength of no sleep data at all.
// These two make absence unable to pass EITHER test: it is not evidence of
// good and not evidence of bad.
const atLeast = (v: number | null | undefined, n: number): boolean => v != null && v >= n;
const below   = (v: number | null | undefined, n: number): boolean => v != null && v < n;
const untracked = (v: number | null | undefined): boolean => v == null;

// ─── A single one-line "AI Health Insight" banner (short form of the above) ──
// Used at the top of the native summary screen (one sentence, not a bulleted list).

export function buildAiHealthInsight(d: ReportData): string {
  const avgScore = d.scores?.periodAvgScore || 0;
  const hr = d.risks?.hydrationRisk ?? "Unknown";
  const sleepPct = d.scores?.sleep?.pct ?? null;
  const nr = d.risks?.nutritionRisk ?? "Unknown";
  const activePct = d.scores?.activePercent || 0;

  const good: string[] = [];
  const bad: string[] = [];

  // An untracked pillar goes in NEITHER list. It used to fall through to
  // `bad`, so a user who simply had not logged water was told to focus on
  // improving their hydration.
  if (hr === "Low") good.push("Hydration"); else if (hr !== "Unknown") bad.push("hydration");
  if (atLeast(sleepPct, 70)) good.push("sleep"); else if (below(sleepPct, 70)) bad.push("sleep");
  if (nr === "Low") good.push("nutrition"); else if (nr !== "Unknown") bad.push("nutrition");
  if (activePct >= 70) good.push("activity"); else bad.push("daily activity");

  const trend = avgScore >= 70 ? "improved" : avgScore >= 50 ? "held steady" : "needs attention";
  const goodPart = good.length ? `${good.join(" and ")} ${good.length > 1 ? "are" : "is"} excellent.` : "";
  const badPart = bad.length ? `Focus on improving ${bad.slice(0, 2).join(" and ")}.` : "Keep up the great work!";

  return `Your health ${trend} this period. ${goodPart} ${badPart}`.replace(/\s+/g, " ").trim();
}

// ─── Positive Trends / Areas for Improvement ───────────────────────────

export function buildPositiveTrends(d: ReportData, medPct: number): string[] {
  const activePct = d.scores?.activePercent || 0;
  const waterPct = d.scores?.water?.pct ?? null;
  const hr = d.risks?.hydrationRisk ?? "Unknown";
  const sleepPct = d.scores?.sleep?.pct ?? null;

  return [
    activePct >= 70 ? "Consistent daily activity engagement" : null,
    hr === "Low" && atLeast(waterPct, 70) ? "Excellent hydration habits" : null,
    medPct >= 80 ? "Excellent medication adherence" : null,
    atLeast(sleepPct, 70) ? "Sleep quality within healthy range" : null,
  ].filter((x): x is string => Boolean(x)).slice(0, 3);
}

export function buildAreasForImprovement(d: ReportData): string[] {
  const activePct = d.scores?.activePercent || 0;
  const waterPct = d.scores?.water?.pct ?? null;
  const foodPct = d.scores?.food?.pct ?? null;
  const sleepPct = d.scores?.sleep?.pct ?? null;
  const stressPct = d.scores?.stressPct || 0;

  // Two distinct messages per pillar: one for a score that IS low, and one
  // for a pillar with no data. Telling someone to prioritise 7-9 hours of
  // sleep because they never opened the sleep log is not advice, it is a
  // guess dressed as a finding.
  return [
    activePct < 60 ? "Increase daily physical activity" : null,
    untracked(waterPct) ? "Start logging water to track hydration"
      : below(waterPct, 70) ? "Improve daily water intake" : null,
    untracked(foodPct) ? "Start logging meals to track nutrition"
      : below(foodPct, 60) ? "Improve meal balance and nutrient intake" : null,
    untracked(sleepPct) ? "Start logging sleep to track rest quality"
      : below(sleepPct, 60) ? "Prioritize 7–9 hours of sleep" : null,
    stressPct < 60 ? "Implement stress management techniques" : null,
  ].filter((x): x is string => Boolean(x)).slice(0, 3);
}

// ─── Personalized Recommendations ──────────────────────────────────────

export function buildRecommendations(d: ReportData): string[] {
  const activePct = d.scores?.activePercent || 0;
  const waterPct = d.scores?.water?.pct ?? null;
  const foodPct = d.scores?.food?.pct ?? null;
  const stressPct = d.scores?.stressPct || 0;

  return [
    activePct < 60
      ? "Schedule 30-minute walks at a fixed time daily to build exercise habit."
      : "Maintain your activity level — consider adding strength training 2x weekly.",
    // The "else" arm of each of these is praise. Without an untracked case a
    // null score would fall into it and congratulate the user on hydration
    // they never recorded.
    untracked(waterPct)
      ? "Start logging your water intake — Aorane's reminders can prompt you hourly."
      : below(waterPct, 70)
      ? "Use Aorane water reminders — drink one glass every 2 hours."
      : "Excellent hydration — continue tracking to maintain consistency.",
    untracked(foodPct)
      ? "Log all meals, even snacks, for accurate nutritional analysis."
      : below(foodPct, 60)
      ? "Focus on balanced meals — your logged intake is below nutrient targets."
      : "Explore Aorane's meal planner for optimized nutrition targets.",
    stressPct < 60
      ? "Practice 5-minute breathing exercises each morning to reduce cortisol."
      : "Maintain stress management routines that are clearly working.",
  ];
}

// ─── AI Predictions — REMOVED ──────────────────────────────────────────
// buildPredictions() lived here and returned "forecasts" that were plain
// arithmetic on the current score: trend30 = avgScore + 3 if active, and a
// 30-day predicted weight of currentWeight - 1.5 for anybody with a
// lose_weight goal, regardless of their actual rate of change. Presented in
// a health report under an "AI Prediction" heading, that is invented
// clinical information, so it is gone rather than relabelled. Nothing
// imported it — the PDF builder carried its own inline copy, now also
// removed. A real forecast needs a fitted trend over enough history to
// justify one; until that exists the report states measured facts only.


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