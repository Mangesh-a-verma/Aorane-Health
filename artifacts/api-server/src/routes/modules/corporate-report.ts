/**
 * Corporate Monthly Health Report
 * - GET  /business/report/data?month=YYYY-MM    → aggregated health data
 * - GET  /business/report/insights?month=YYYY-MM → AI health guide (NVIDIA LLaMA)
 * - POST /business/report/email                  → send report to org email
 * Monthly auto-email cron: 1st of every month at 9 AM IST
 */

import { Router } from "express";
import { db, organizationsTable, orgAdminsTable, orgMembersTable, dailyHealthScoresTable } from "@workspace/db";
import { eq, and, inArray, gte, lte } from "drizzle-orm";
import { requireBusinessAuth } from "../../middlewares/business-auth";
import type { BusinessRequest } from "../../middlewares/business-auth";
import { Resend } from "resend";
import { logger } from "../../lib/logger";
import { callDeepSeek } from "../../lib/nvidia";
import cron from "node-cron";

const router = Router();
const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = "AORANE Reports <reports@aorane.com>";
const NVIDIA_KEY = process.env.NVIDIA_API_KEY ?? "";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMonthRange(month: string): { start: string; end: string } {
  const [yearStr, monStr] = month.split("-");
  const year = parseInt(yearStr, 10);
  const mon = parseInt(monStr, 10);
  const start = `${month}-01`;
  const lastDay = new Date(year, mon, 0).getDate();
  const end = `${month}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

function avgArr(arr: number[]): number {
  return arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
}

function getGrade(score: number): { grade: string; label: string; color: string } {
  if (score >= 90) return { grade: "A+", label: "Excellent",          color: "#10b981" };
  if (score >= 75) return { grade: "A",  label: "Very Good",          color: "#3b82f6" };
  if (score >= 60) return { grade: "B",  label: "Good",               color: "#0077B6" };
  if (score >= 45) return { grade: "C",  label: "Average",            color: "#f59e0b" };
  if (score >= 30) return { grade: "D",  label: "Needs Improvement",  color: "#ef4444" };
  return             { grade: "F",  label: "Critical",             color: "#7f1d1d" };
}

function formatMonthLabel(month: string): string {
  const [year, mon] = month.split("-");
  const months = ["January","February","March","April","May","June",
                  "July","August","September","October","November","December"];
  return `${months[parseInt(mon, 10) - 1]} ${year}`;
}

// ─── Data Aggregation ─────────────────────────────────────────────────────────

export interface ReportData {
  org: { id: string; name: string; orgType: string; industry: string | null; companySize: string | null; contactEmail: string; city: string | null; state: string | null };
  month: string;
  totalMembers: number;
  activeMembers: number;
  dataPoints: number;
  averages: {
    healthScore: number;
    exerciseScore: number;
    foodScore: number;
    waterScore: number;
    sleepScore: number;
    stressScore: number;
    medicineScore: number;
  } | null;
  compliance: { exercisePct: number; waterPct: number };
  gradeDistribution: { excellent: number; veryGood: number; good: number; average: number; needsImprovement: number } | null;
  grade: string | null;
  gradeLabel: string | null;
  gradeColor: string | null;
}

async function buildReportData(orgId: string, month: string): Promise<ReportData> {
  const { start, end } = getMonthRange(month);

  const [org] = await db
    .select({
      id: organizationsTable.id,
      name: organizationsTable.name,
      orgType: organizationsTable.orgType,
      industry: organizationsTable.industry,
      companySize: organizationsTable.companySize,
      contactEmail: organizationsTable.contactEmail,
      city: organizationsTable.city,
      state: organizationsTable.state,
    })
    .from(organizationsTable)
    .where(eq(organizationsTable.id, orgId))
    .limit(1);

  if (!org) throw new Error("Organization not found");

  const members = await db
    .select({ userId: orgMembersTable.userId })
    .from(orgMembersTable)
    .where(and(eq(orgMembersTable.orgId, orgId), eq(orgMembersTable.isActive, true)));

  const memberIds = members.map((m) => m.userId);

  if (memberIds.length === 0) {
    return { org, month, totalMembers: 0, activeMembers: 0, dataPoints: 0, averages: null, compliance: { exercisePct: 0, waterPct: 0 }, gradeDistribution: null, grade: null, gradeLabel: null, gradeColor: null };
  }

  const scores = await db
    .select({
      userId: dailyHealthScoresTable.userId,
      healthScore: dailyHealthScoresTable.healthScore,
      exerciseScore: dailyHealthScoresTable.exerciseScore,
      foodScore: dailyHealthScoresTable.foodScore,
      waterScore: dailyHealthScoresTable.waterScore,
      sleepScore: dailyHealthScoresTable.sleepScore,
      stressScore: dailyHealthScoresTable.stressScore,
      medicineScore: dailyHealthScoresTable.medicineScore,
      exerciseMinutes: dailyHealthScoresTable.exerciseMinutes,
      waterGlasses: dailyHealthScoresTable.waterGlasses,
    })
    .from(dailyHealthScoresTable)
    .where(
      and(
        inArray(dailyHealthScoresTable.userId, memberIds),
        gte(dailyHealthScoresTable.scoreDate, start),
        lte(dailyHealthScoresTable.scoreDate, end),
      ),
    );

  const n = (arr: (number | null | undefined)[]) => arr.filter((v): v is number => v != null && v > 0);

  const hs     = n(scores.map((s) => s.healthScore));
  const avgHealth = avgArr(hs);
  const { grade, label: gradeLabel, color: gradeColor } = getGrade(avgHealth);

  const activeUserIds = new Set(scores.map((s) => s.userId));
  const exerciseCompliant = scores.filter((s) => (s.exerciseMinutes ?? 0) >= 30).length;
  const waterCompliant    = scores.filter((s) => (s.waterGlasses    ?? 0) >= 8).length;
  const total = scores.length || 1;

  return {
    org,
    month,
    totalMembers: memberIds.length,
    activeMembers: activeUserIds.size,
    dataPoints: scores.length,
    averages: {
      healthScore:   avgHealth,
      exerciseScore: avgArr(n(scores.map((s) => s.exerciseScore))),
      foodScore:     avgArr(n(scores.map((s) => s.foodScore))),
      waterScore:    avgArr(n(scores.map((s) => s.waterScore))),
      sleepScore:    avgArr(n(scores.map((s) => s.sleepScore))),
      stressScore:   avgArr(n(scores.map((s) => s.stressScore))),
      medicineScore: avgArr(n(scores.map((s) => s.medicineScore))),
    },
    compliance: {
      exercisePct: Math.round((exerciseCompliant / total) * 100),
      waterPct:    Math.round((waterCompliant    / total) * 100),
    },
    gradeDistribution: {
      excellent:        hs.filter((s) => s >= 90).length,
      veryGood:         hs.filter((s) => s >= 75 && s < 90).length,
      good:             hs.filter((s) => s >= 60 && s < 75).length,
      average:          hs.filter((s) => s >= 45 && s < 60).length,
      needsImprovement: hs.filter((s) => s  < 45).length,
    },
    grade,
    gradeLabel,
    gradeColor,
  };
}

// ─── AI Health Guide ──────────────────────────────────────────────────────────

async function generateAIInsights(report: ReportData): Promise<string | null> {
  if (!report.averages || !NVIDIA_KEY) return null;
  const { averages, gradeDistribution: gd, org } = report;

  const prompt = `You are a senior corporate wellness consultant for India. Analyze this monthly health report and write a professional health guide for the HR/management team.

Company: ${org.name}
Industry: ${org.industry || org.orgType}
Size: ${org.companySize || `${report.totalMembers} employees`}
Location: ${org.city ? `${org.city}, ${org.state}` : org.state || "India"}
Report Period: ${formatMonthLabel(report.month)}

HEALTH METRICS (Average scores out of 100):
- Overall Health Score: ${averages.healthScore}/100 (Grade: ${report.grade} — ${report.gradeLabel})
- Physical Activity (Exercise): ${averages.exerciseScore}/100
- Nutrition & Diet: ${averages.foodScore}/100
- Hydration (Water Intake): ${averages.waterScore}/100
- Sleep Quality: ${averages.sleepScore}/100
- Stress Management: ${averages.stressScore}/100
- Medicine Adherence: ${averages.medicineScore}/100

EMPLOYEE DISTRIBUTION:
- Total Enrolled: ${report.totalMembers} | Active This Month: ${report.activeMembers}
- Excellent Health (90+): ${gd?.excellent ?? 0} employees
- Very Good (75-89): ${gd?.veryGood ?? 0} employees
- Good (60-74): ${gd?.good ?? 0} employees
- Average (45-59): ${gd?.average ?? 0} employees
- Needs Improvement (<45): ${gd?.needsImprovement ?? 0} employees

Write a structured health guide with EXACTLY these sections (use these exact headings):

## Executive Summary
(2-3 sentences on overall team health status and key takeaway)

## Top 3 Health Concerns
(Bullet points — specific to the lowest scoring areas above)

## Immediate Action Plan
(5 specific, actionable steps HR can implement this month — practical for Indian workplaces)

## 30-Day Wellness Program
(Specific activities: yoga, pranayama, group walks, nutrition sessions, stress relief practices — suitable for Indian corporate culture)

## Target Metrics for Next Month
(3-4 measurable improvement targets based on current weak areas)

Be direct, specific, and evidence-based. Reference ICMR/WHO guidelines where relevant. Write in professional English.`;

  try {
    return await callDeepSeek(
      [
        { role: "system", content: "You are a senior corporate wellness consultant specializing in Indian workplace health programs. Provide structured, actionable guidance." },
        { role: "user", content: prompt },
      ],
      NVIDIA_KEY,
      2048,
      0.5,
    );
  } catch (err) {
    logger.error({ err }, "Corporate AI insights generation failed");
    return null;
  }
}

// ─── Email HTML Template ──────────────────────────────────────────────────────

function buildReportEmailHtml(report: ReportData, insights: string | null): string {
  const { org, averages, gradeDistribution: gd } = report;
  const monthLabel = formatMonthLabel(report.month);
  const gradeColor = report.gradeColor || "#0077B6";

  const pillarRow = (icon: string, label: string, score: number) => {
    const col = score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
    const bar = Math.round(score);
    return `
    <tr>
      <td style="padding:8px 12px;font-size:13px;color:#374151;">${icon} ${label}</td>
      <td style="padding:8px 12px;">
        <div style="background:#f3f4f6;border-radius:6px;height:8px;overflow:hidden;">
          <div style="width:${bar}%;height:8px;background:${col};border-radius:6px;"></div>
        </div>
      </td>
      <td style="padding:8px 12px;font-size:13px;font-weight:700;color:${col};text-align:right;">${score}/100</td>
    </tr>`;
  };

  const insightHtml = insights
    ? insights
        .replace(/## (.*)/g, '<h3 style="font-size:15px;font-weight:700;color:#0d1f33;margin:20px 0 8px;border-bottom:2px solid #e5e7eb;padding-bottom:6px;">$1</h3>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/^- (.*)/gm, '<li style="margin:4px 0;font-size:13px;color:#374151;">$1</li>')
        .replace(/\n\n/g, '<br/><br/>')
    : '<p style="color:#6b7280;font-style:italic;">AI insights not available for this report.</p>';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>AORANE Corporate Health Report — ${org.name} (${monthLabel})</title></head>
<body style="margin:0;padding:0;background:#f0f7ff;font-family:'Inter',Arial,sans-serif;">
<div style="max-width:680px;margin:32px auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,119,182,0.12);">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#0077B6 0%,#023E8A 55%,#1B998B 100%);padding:40px 40px 36px;position:relative;overflow:hidden;">
    <div style="position:absolute;top:-40px;right:-40px;width:200px;height:200px;background:rgba(255,255,255,0.05);border-radius:50%;"></div>
    <div style="position:absolute;bottom:-60px;left:-30px;width:160px;height:160px;background:rgba(255,255,255,0.04);border-radius:50%;"></div>
    <div style="font-size:32px;font-weight:900;color:#ffffff;letter-spacing:-0.03em;">AORANE</div>
    <div style="font-size:11px;color:rgba(255,255,255,0.7);letter-spacing:0.1em;margin-top:2px;">INDIA'S HEALTH INTELLIGENCE PLATFORM</div>
    <div style="margin-top:24px;padding:16px 20px;background:rgba(255,255,255,0.12);border-radius:12px;border:1px solid rgba(255,255,255,0.2);backdrop-filter:blur(10px);">
      <div style="font-size:20px;font-weight:800;color:#ffffff;">${org.name}</div>
      <div style="font-size:12px;color:rgba(255,255,255,0.8);margin-top:4px;">${org.city ? `${org.city}, ${org.state}` : org.state || "India"} &nbsp;•&nbsp; ${org.industry || org.orgType}</div>
    </div>
    <div style="margin-top:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
      <div style="font-size:14px;color:rgba(255,255,255,0.9);font-weight:600;">Monthly Health Report — ${monthLabel}</div>
      <div style="background:${gradeColor};padding:6px 16px;border-radius:20px;font-size:15px;font-weight:800;color:#fff;">${report.grade} &nbsp; ${report.gradeLabel}</div>
    </div>
  </div>

  <!-- Summary Stats -->
  <div style="padding:28px 40px 0;">
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">
      <div style="background:#f0f9ff;border-radius:14px;padding:20px;border:1px solid #bae6fd;text-align:center;">
        <div style="font-size:32px;font-weight:900;color:#0077B6;">${averages?.healthScore ?? 0}</div>
        <div style="font-size:11px;color:#6b7280;margin-top:4px;font-weight:600;">AVG HEALTH SCORE</div>
      </div>
      <div style="background:#f0fdf4;border-radius:14px;padding:20px;border:1px solid #bbf7d0;text-align:center;">
        <div style="font-size:32px;font-weight:900;color:#10b981;">${report.activeMembers}</div>
        <div style="font-size:11px;color:#6b7280;margin-top:4px;font-weight:600;">ACTIVE MEMBERS</div>
      </div>
      <div style="background:#fdf4ff;border-radius:14px;padding:20px;border:1px solid #e9d5ff;text-align:center;">
        <div style="font-size:32px;font-weight:900;color:#7c3aed;">${report.totalMembers}</div>
        <div style="font-size:11px;color:#6b7280;margin-top:4px;font-weight:600;">TOTAL ENROLLED</div>
      </div>
    </div>
  </div>

  <!-- Health Pillars -->
  <div style="padding:28px 40px 0;">
    <div style="font-size:14px;font-weight:700;color:#0d1f33;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.05em;">Health Pillars</div>
    <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:12px;overflow:hidden;">
      <tbody>
        ${pillarRow("🏃", "Physical Activity",  averages?.exerciseScore  ?? 0)}
        ${pillarRow("🥗", "Nutrition & Diet",    averages?.foodScore      ?? 0)}
        ${pillarRow("💧", "Hydration",           averages?.waterScore     ?? 0)}
        ${pillarRow("😴", "Sleep Quality",       averages?.sleepScore     ?? 0)}
        ${pillarRow("🧘", "Stress Management",   averages?.stressScore    ?? 0)}
        ${pillarRow("💊", "Medicine Adherence",  averages?.medicineScore  ?? 0)}
      </tbody>
    </table>
  </div>

  <!-- Grade Distribution -->
  <div style="padding:28px 40px 0;">
    <div style="font-size:14px;font-weight:700;color:#0d1f33;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.05em;">Employee Grade Distribution</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      ${[
        { label: "A+ Excellent", count: gd?.excellent ?? 0, bg: "#d1fae5", color: "#065f46" },
        { label: "A Very Good",  count: gd?.veryGood  ?? 0, bg: "#dbeafe", color: "#1e40af" },
        { label: "B Good",       count: gd?.good      ?? 0, bg: "#e0f2fe", color: "#0369a1" },
        { label: "C Average",    count: gd?.average   ?? 0, bg: "#fef3c7", color: "#92400e" },
        { label: "D/F Low",      count: gd?.needsImprovement ?? 0, bg: "#fee2e2", color: "#7f1d1d" },
      ].map(g => `<div style="padding:10px 14px;background:${g.bg};border-radius:10px;text-align:center;flex:1;min-width:80px;">
        <div style="font-size:22px;font-weight:800;color:${g.color};">${g.count}</div>
        <div style="font-size:10px;color:${g.color};margin-top:2px;font-weight:600;">${g.label}</div>
      </div>`).join("")}
    </div>
  </div>

  <!-- AI Health Guide -->
  <div style="padding:28px 40px;">
    <div style="font-size:14px;font-weight:700;color:#0d1f33;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.05em;">AI Health Guide</div>
    <div style="font-size:11px;color:#6b7280;margin-bottom:16px;">Powered by NVIDIA LLaMA 3.3 — 1 analysis per month</div>
    <div style="background:#f9fafb;border-radius:14px;padding:20px;border:1px solid #e5e7eb;font-size:13px;line-height:1.7;color:#374151;">
      ${insightHtml}
    </div>
  </div>

  <!-- Footer -->
  <div style="background:#0d1f33;padding:20px 40px;text-align:center;">
    <div style="font-size:16px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">AORANE</div>
    <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-top:4px;">This report is confidential and intended only for authorized organization administrators.</div>
    <div style="font-size:10px;color:rgba(255,255,255,0.4);margin-top:8px;">Data aggregated per DPDP Act 2023 — Individual privacy protected &nbsp;•&nbsp; aorane.com</div>
  </div>

</div>
</body>
</html>`;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

router.get("/business/report/data", requireBusinessAuth, async (req: BusinessRequest, res) => {
  try {
    const orgId = req.orgId!;
    const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ error: "Invalid month format. Use YYYY-MM." });
      return;
    }
    const report = await buildReportData(orgId, month);
    res.json({ report });
  } catch (err) {
    logger.error({ err }, "Corporate report data failed");
    res.status(500).json({ error: "Failed to generate report" });
  }
});

router.get("/business/report/insights", requireBusinessAuth, async (req: BusinessRequest, res) => {
  try {
    const orgId = req.orgId!;
    const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
    const report = await buildReportData(orgId, month);
    if (!report.averages) {
      res.json({ insights: null });
      return;
    }
    const insights = await generateAIInsights(report);
    res.json({ insights });
  } catch (err) {
    logger.error({ err }, "Corporate AI insights failed");
    res.status(500).json({ error: "Failed to generate insights" });
  }
});

router.post("/business/report/email", requireBusinessAuth, async (req: BusinessRequest, res) => {
  try {
    const orgId = req.orgId!;
    const month = (req.body.month as string) || new Date().toISOString().slice(0, 7);

    const report = await buildReportData(orgId, month);
    const insights = report.averages ? await generateAIInsights(report) : null;
    const html = buildReportEmailHtml(report, insights);

    const [adminRow] = await db
      .select({ email: orgAdminsTable.email, fullName: orgAdminsTable.fullName })
      .from(orgAdminsTable)
      .where(eq(orgAdminsTable.orgId, orgId))
      .limit(1);

    const toEmail = adminRow?.email || report.org.contactEmail;
    const toName  = adminRow?.fullName || report.org.name;

    await resend.emails.send({
      from: FROM_EMAIL,
      to: `${toName} <${toEmail}>`,
      subject: `AORANE Monthly Health Report — ${report.org.name} (${formatMonthLabel(month)})`,
      html,
    });

    res.json({ success: true, sentTo: toEmail });
  } catch (err) {
    logger.error({ err }, "Corporate report email failed");
    res.status(500).json({ error: "Failed to send report email" });
  }
});

export default router;

// ─── Monthly Auto-Email Cron ──────────────────────────────────────────────────
// Runs at 9:00 AM IST (3:30 AM UTC) on the 1st of every month

cron.schedule("30 3 1 * *", async () => {
  logger.info("Running monthly corporate health report cron");
  try {
    const prevMonth = (() => {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    })();

    const orgs = await db
      .select({
        id: organizationsTable.id,
        name: organizationsTable.name,
        contactEmail: organizationsTable.contactEmail,
      })
      .from(organizationsTable)
      .where(eq(organizationsTable.isActive, true));

    for (const org of orgs) {
      try {
        const report   = await buildReportData(org.id, prevMonth);
        if (!report.activeMembers) continue;
        const insights = report.averages ? await generateAIInsights(report) : null;
        const html     = buildReportEmailHtml(report, insights);

        const [adminRow] = await db
          .select({ email: orgAdminsTable.email, fullName: orgAdminsTable.fullName })
          .from(orgAdminsTable)
          .where(eq(orgAdminsTable.orgId, org.id))
          .limit(1);

        const toEmail = adminRow?.email || org.contactEmail;
        const toName  = adminRow?.fullName || org.name;

        await resend.emails.send({
          from: FROM_EMAIL,
          to: `${toName} <${toEmail}>`,
          subject: `AORANE Monthly Health Report — ${org.name} (${formatMonthLabel(prevMonth)})`,
          html,
        });

        logger.info({ orgId: org.id, month: prevMonth }, "Auto report sent");
      } catch (err) {
        logger.error({ err, orgId: org.id }, "Auto report send failed for org");
      }
    }
  } catch (err) {
    logger.error({ err }, "Monthly cron job failed");
  }
}, { timezone: "Asia/Kolkata" });
