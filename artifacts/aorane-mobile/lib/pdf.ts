import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

function formatDate(d?: string | Date): string {
  if (!d) return new Date().toLocaleDateString("en-IN");
  return new Date(d).toLocaleDateString("en-IN");
}

function statusColor(status: string): string {
  return status === "normal" ? "#16A34A" : status === "high" || status === "critical_high" ? "#DC2626" : status === "low" || status === "critical_low" ? "#B45309" : "#374151";
}

// ── Medical Report PDF ─────────────────────────────────────────────
interface ReportFinding {
  testName: string; value: string; normalRange: string; status: string; interpretation?: string;
}
interface ScanAnalysis {
  reportType?: string; reportDate?: string; labName?: string;
  findings?: ReportFinding[];
  criticalValues?: Array<{ testName: string; value: string; urgency: string }>;
  overallAssessment?: string; aiAdvice?: string;
  dietRecommendations?: string[]; urgencyLevel?: string;
}

export async function exportMedicalReportPDF(analysis: ScanAnalysis, userName?: string): Promise<void> {
  const findingRows = (analysis.findings || []).map((f) => `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;font-weight:600;color:#1a1a2e">${f.testName}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;font-weight:700;color:${statusColor(f.status)}">${f.value}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;color:#6b7280">${f.normalRange}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0">
        <span style="background:${f.status === "normal" ? "#dcfce7" : f.status.includes("high") ? "#fee2e2" : "#fef9c3"};color:${statusColor(f.status)};padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;text-transform:uppercase">${f.status.replace(/_/g, " ")}</span>
      </td>
    </tr>
    ${f.interpretation ? `<tr><td colspan="4" style="padding:4px 14px 12px;color:#6b7280;font-size:13px;border-bottom:1px solid #f0f0f0;font-style:italic">${f.interpretation}</td></tr>` : ""}
  `).join("");

  const criticalHtml = analysis.criticalValues?.length ? `
    <div style="background:#fef2f2;border:1.5px solid #fca5a5;border-radius:10px;padding:16px;margin:18px 0">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <span style="font-size:20px">⚠️</span>
        <span style="font-weight:700;color:#dc2626;font-size:15px">Critical Values — Doctor se Turant Milein</span>
      </div>
      ${analysis.criticalValues.map(cv => `
        <div style="background:#fff;border-radius:8px;padding:10px 14px;margin-top:8px;display:flex;justify-content:space-between">
          <span style="font-weight:600;color:#1a1a2e">${cv.testName}: <span style="color:#dc2626">${cv.value}</span></span>
          <span style="background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700">${cv.urgency?.toUpperCase()}</span>
        </div>
      `).join("")}
    </div>` : "";

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Medical Report — AORANE</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, Arial, sans-serif; background: #f8fafc; color: #1a1a2e; }
    .page { max-width: 800px; margin: 0 auto; background: #fff; min-height: 100vh; }
    .header { background: linear-gradient(135deg, #0077B6, #1B998B); padding: 28px 32px; color: #fff; }
    .logo { font-size: 26px; font-weight: 800; letter-spacing: 2px; }
    .tagline { font-size: 12px; opacity: 0.8; margin-top: 2px; }
    .report-info { margin-top: 16px; display: flex; gap: 24px; flex-wrap: wrap; }
    .info-item { font-size: 13px; opacity: 0.9; }
    .info-item strong { display: block; opacity: 0.7; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    .content { padding: 28px 32px; }
    .section-title { font-size: 16px; font-weight: 700; color: #0077B6; margin: 22px 0 12px; border-left: 4px solid #0077B6; padding-left: 10px; }
    .summary-box { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 10px; padding: 16px 20px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #f8fafc; padding: 10px 14px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
    .advice-box { background: linear-gradient(135deg, rgba(0,119,182,0.07), rgba(27,153,139,0.07)); border: 1px solid rgba(0,119,182,0.2); border-radius: 10px; padding: 16px 20px; margin-top: 18px; }
    .diet-list { list-style: none; margin-top: 10px; }
    .diet-list li { padding: 5px 0; font-size: 13px; color: #374151; }
    .diet-list li::before { content: "🥗 "; }
    .footer { border-top: 1px solid #e5e7eb; margin: 28px 32px 0; padding: 16px 0 28px; text-align: center; font-size: 11px; color: #9ca3af; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; }
    .urgent-badge { background: #fef9c3; color: #b45309; }
    .emergency-badge { background: #fee2e2; color: #dc2626; }
    .normal-badge { background: #dcfce7; color: #16a34a; }
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="logo">AORANE</div>
    <div class="tagline">Your Health Coach — Medical Report Analysis</div>
    <div class="report-info">
      <div class="info-item"><strong>Patient</strong>${userName || "AORANE User"}</div>
      <div class="info-item"><strong>Report Type</strong>${analysis.reportType?.replace(/_/g, " ")?.toUpperCase() || "Medical Report"}</div>
      ${analysis.labName ? `<div class="info-item"><strong>Lab</strong>${analysis.labName}</div>` : ""}
      <div class="info-item"><strong>Report Date</strong>${formatDate(analysis.reportDate)}</div>
      <div class="info-item"><strong>Generated</strong>${formatDate()}</div>
      ${analysis.urgencyLevel ? `<div class="info-item"><strong>Urgency</strong><span class="${analysis.urgencyLevel === "emergency" ? "emergency-badge" : analysis.urgencyLevel === "urgent" ? "urgent-badge" : "normal-badge"} badge">${analysis.urgencyLevel.toUpperCase()}</span></div>` : ""}
    </div>
  </div>

  <div class="content">
    ${analysis.overallAssessment ? `
    <div class="summary-box">
      <div style="font-weight:700;color:#0077B6;margin-bottom:6px">Overall Assessment</div>
      <div style="font-size:14px;color:#374151;line-height:1.6">${analysis.overallAssessment}</div>
    </div>` : ""}

    ${criticalHtml}

    ${(analysis.findings || []).length > 0 ? `
    <div class="section-title">Test Results</div>
    <table>
      <thead><tr>
        <th>Test Name</th><th>Your Value</th><th>Normal Range</th><th>Status</th>
      </tr></thead>
      <tbody>${findingRows}</tbody>
    </table>` : ""}

    ${analysis.aiAdvice ? `
    <div class="advice-box">
      <div style="font-weight:700;color:#0077B6;margin-bottom:8px;font-size:14px">🤖 AI Health Advice</div>
      <div style="font-size:13px;color:#374151;line-height:1.6">${analysis.aiAdvice}</div>
    </div>` : ""}

    ${(analysis.dietRecommendations || []).length > 0 ? `
    <div class="section-title">Diet Recommendations</div>
    <ul class="diet-list">
      ${analysis.dietRecommendations!.map(r => `<li>${r}</li>`).join("")}
    </ul>` : ""}
  </div>

  <div class="footer">
    Generated by AORANE Health App · AI-powered analysis · Always consult a doctor for medical advice<br>
    Report Date: ${formatDate()} · This report is for informational purposes only
  </div>
</div>
</body>
</html>`;

  await sharePDF(html, "medical_report");
}

// ── Diet Plan PDF ──────────────────────────────────────────────────
interface MealItem { name: string; nameHindi?: string; quantityDesc: string; calories: number; proteinG: number; carbsG: number; fatG: number; }
interface MealSection { items: MealItem[]; totalCalories: number }
interface DayPlan {
  day: number; dayName: string; totalCalories: number;
  meals: { breakfast: MealSection; lunch: MealSection; dinner: MealSection; snacks: MealSection };
  waterIntakeMl: number; tip?: string;
}
interface DietPlan {
  targetCalories: number; targetProteinG: number; targetCarbsG: number; targetFatG: number;
  days: DayPlan[]; generalTips?: string[];
}

const MEAL_LABELS: Record<string, string> = {
  breakfast: "🌅 Breakfast", lunch: "🍱 Lunch", dinner: "🌙 Dinner", snacks: "☕ Snacks"
};

export async function exportDietPlanPDF(plan: DietPlan, userName?: string): Promise<void> {
  const dayHtml = plan.days.map((day) => {
    const mealsHtml = (["breakfast", "lunch", "dinner", "snacks"] as const).map((mealKey) => {
      const meal = day.meals[mealKey];
      if (!meal?.items?.length) return "";
      return `
        <div style="margin-bottom:14px">
          <div style="font-weight:700;color:#0077B6;font-size:13px;margin-bottom:6px">${MEAL_LABELS[mealKey]} · ${meal.totalCalories} kcal</div>
          ${meal.items.map(item => `
            <div style="display:flex;justify-content:space-between;padding:5px 10px;background:#f8fafc;border-radius:6px;margin-bottom:3px;font-size:12px">
              <div>
                <span style="font-weight:600;color:#1a1a2e">${item.name}</span>
                ${item.nameHindi ? `<span style="color:#9ca3af"> · ${item.nameHindi}</span>` : ""}
                <span style="color:#6b7280;margin-left:6px">(${item.quantityDesc})</span>
              </div>
              <div style="color:#0077B6;font-weight:700;white-space:nowrap;margin-left:8px">
                ${item.calories} kcal | P:${Math.round(item.proteinG)}g C:${Math.round(item.carbsG)}g F:${Math.round(item.fatG)}g
              </div>
            </div>
          `).join("")}
        </div>`;
    }).join("");

    return `
      <div style="margin-bottom:24px;page-break-inside:avoid">
        <div style="background:linear-gradient(135deg,#0077B6,#1B998B);color:#fff;padding:10px 16px;border-radius:10px 10px 0 0;display:flex;justify-content:space-between;align-items:center">
          <span style="font-weight:700;font-size:15px">${day.dayName}</span>
          <span style="font-size:12px;opacity:0.85">Total: ${day.totalCalories} kcal · Water: ${day.waterIntakeMl / 1000}L</span>
        </div>
        <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;padding:16px">
          ${mealsHtml}
          ${day.tip ? `<div style="background:#f0fdf4;border-left:3px solid #16a34a;padding:8px 12px;border-radius:0 6px 6px 0;font-size:12px;color:#15803d;margin-top:8px">💡 ${day.tip}</div>` : ""}
        </div>
      </div>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Diet Plan — AORANE</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, Arial, sans-serif; background: #f8fafc; color: #1a1a2e; }
    .page { max-width: 800px; margin: 0 auto; background: #fff; min-height: 100vh; }
    .header { background: linear-gradient(135deg, #0077B6, #1B998B); padding: 28px 32px; color: #fff; }
    .logo { font-size: 26px; font-weight: 800; letter-spacing: 2px; }
    .content { padding: 28px 32px; }
    .targets { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 24px; }
    .target-card { flex: 1; min-width: 100px; background: linear-gradient(135deg, rgba(0,119,182,0.08), rgba(27,153,139,0.06)); border: 1px solid rgba(0,119,182,0.15); border-radius: 10px; padding: 12px; text-align: center; }
    .target-val { font-size: 22px; font-weight: 800; color: #0077B6; }
    .target-label { font-size: 11px; color: #6b7280; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px; }
    .footer { border-top: 1px solid #e5e7eb; margin: 0 32px; padding: 16px 0 28px; text-align: center; font-size: 11px; color: #9ca3af; }
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="logo">AORANE</div>
    <div style="font-size:12px;opacity:0.8;margin-top:2px">Your Health Coach — Personalized Indian Diet Plan</div>
    <div style="display:flex;gap:20px;margin-top:14px;flex-wrap:wrap">
      <div style="font-size:13px;opacity:0.9"><strong style="display:block;font-size:11px;opacity:0.7;text-transform:uppercase">Patient</strong>${userName || "AORANE User"}</div>
      <div style="font-size:13px;opacity:0.9"><strong style="display:block;font-size:11px;opacity:0.7;text-transform:uppercase">Plan Days</strong>${plan.days.length} Days</div>
      <div style="font-size:13px;opacity:0.9"><strong style="display:block;font-size:11px;opacity:0.7;text-transform:uppercase">Generated</strong>${formatDate()}</div>
    </div>
  </div>

  <div class="content">
    <div style="font-weight:700;color:#0077B6;font-size:15px;margin-bottom:12px;border-left:4px solid #0077B6;padding-left:10px">Daily Nutrition Targets</div>
    <div class="targets">
      <div class="target-card"><div class="target-val">${plan.targetCalories}</div><div class="target-label">Calories</div></div>
      <div class="target-card"><div class="target-val" style="color:#1B998B">${Math.round(plan.targetProteinG)}g</div><div class="target-label">Protein</div></div>
      <div class="target-card"><div class="target-val" style="color:#F97316">${Math.round(plan.targetCarbsG)}g</div><div class="target-label">Carbs</div></div>
      <div class="target-card"><div class="target-val" style="color:#7C3AED">${Math.round(plan.targetFatG)}g</div><div class="target-label">Fat</div></div>
    </div>

    <div style="font-weight:700;color:#0077B6;font-size:15px;margin:20px 0 14px;border-left:4px solid #0077B6;padding-left:10px">Your Meal Plan</div>
    ${dayHtml}

    ${(plan.generalTips || []).length > 0 ? `
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:16px 20px;margin-top:8px">
      <div style="font-weight:700;color:#15803d;margin-bottom:10px;font-size:14px">🌿 General Health Tips</div>
      ${plan.generalTips!.map(t => `<div style="font-size:12px;color:#374151;padding:3px 0">• ${t}</div>`).join("")}
    </div>` : ""}
  </div>

  <div class="footer">
    Generated by AORANE Health App · Powered by Gemini AI · ${formatDate()}<br>
    Consult a certified nutritionist or doctor before making major dietary changes
  </div>
</div>
</body>
</html>`;

  await sharePDF(html, "diet_plan");
}

// ── Helper ─────────────────────────────────────────────────────────
async function sharePDF(html: string, namePrefix: string): Promise<void> {
  if (Platform.OS === "web") {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${namePrefix}_${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: "Report Share Karein",
      UTI: "com.adobe.pdf",
    });
  } else {
    await Print.printAsync({ html });
  }
}
