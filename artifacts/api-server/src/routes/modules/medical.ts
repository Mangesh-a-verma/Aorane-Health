import { Router } from "express";
import { db, medicalReportsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../../middlewares/user-auth";
import type { AuthRequest } from "../../middlewares/user-auth";
import { aiRateLimit } from "../../middlewares/ai-rate-limit";
import { requireFeature } from "../../middlewares/feature-check";
import { checkAndUseAILimit } from "../../lib/aiLimiter";

const router = Router();

// ─────────────────────────────────────────────────────────
// GET — all medical reports for user
// ─────────────────────────────────────────────────────────
router.get("/medical/reports", requireAuth, async (req: AuthRequest, res) => {
  try {
    const reports = await db.select().from(medicalReportsTable)
      .where(eq(medicalReportsTable.userId, req.userId!))
      .orderBy(desc(medicalReportsTable.createdAt))
      .limit(50);
    res.json({ reports });
  } catch {
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

// ─────────────────────────────────────────────────────────
// GET — single report
// ─────────────────────────────────────────────────────────
router.get("/medical/reports/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [report] = await db.select().from(medicalReportsTable)
      .where(eq(medicalReportsTable.id, String(req.params.id)));
    if (!report) { res.status(404).json({ error: "Report not found" }); return; }
    res.json({ report });
  } catch {
    res.status(500).json({ error: "Failed to fetch report" });
  }
});

// ─────────────────────────────────────────────────────────
// POST — scan + analyse medical report image via Gemini Vision
// ─────────────────────────────────────────────────────────
router.post("/medical/scan", requireAuth, requireFeature("medical_report"), aiRateLimit("medical_scan", 5), async (req: AuthRequest, res) => {
  try {
    const planType = req.userPlan || "free";
    const limitCheck = await checkAndUseAILimit(req.userId!, "ai_medical_scan_daily", planType);
    if (!limitCheck.allowed) {
      if (limitCheck.planRequired) {
        res.status(403).json({
          error: `Medical Report Scan is not available on the ${planType.toUpperCase()} plan. Upgrade to ${limitCheck.planRequired.toUpperCase()} to unlock it.`,
          feature: "ai_medical_scan_daily",
          reason: "plan_not_supported",
          currentPlan: planType,
          planRequired: limitCheck.planRequired,
          upgradeSuggested: true,
        });
      } else {
        res.status(429).json({
          error: `Aaj ki medical scan limit khatam ho gayi! Limit: ${limitCheck.limit}/day on ${planType.toUpperCase()} plan.`,
          feature: "ai_medical_scan_daily",
          limitPerDay: limitCheck.limit,
          usedToday: limitCheck.usedToday,
          currentPlan: planType,
          resetsAt: "midnight IST",
          upgradeSuggested: planType === "free",
        });
      }
      return;
    }

    const { imageBase64, reportType = "blood_test", mimeType = "image/jpeg" } = req.body as {
      imageBase64?: string;
      reportType?: string;
      mimeType?: string;
    };

    if (!imageBase64) {
      res.status(400).json({ error: "imageBase64 required" }); return;
    }

    const geminiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!geminiKey) {
      res.status(503).json({ error: "AI service not configured" }); return;
    }

    const prompt = `You are a senior Indian pathologist and healthcare expert. Analyze this medical report image carefully. Extract precise key-value pairs of the results (e.g., "Sugar (Fasting)": "100 mg/dL"). Append a strict medical disclaimer to the overall assessment, stating that this is an AI analysis and not a substitute for professional medical advice.

Return ONLY a valid JSON object with NO markdown or extra text:
{
  "reportType": "blood_test | urine_test | lipid_profile | thyroid | diabetes | liver | kidney | vitamin | other",
  "reportDate": "YYYY-MM-DD or null",
  "labName": "lab name or null",
  "patientName": "name if visible or null",
  "findings": [
    {
      "testName": "string",
      "value": "string (number + unit e.g. '12.5 g/dL')",
      "numericValue": number or null,
      "unit": "string or null",
      "normalRange": "string e.g. '13.5-17.5 g/dL'",
      "status": "normal | high | low | critical_high | critical_low",
      "interpretation": "1-2 sentence plain English explanation"
    }
  ],
  "criticalValues": [
    { "testName": "string", "value": "string", "urgency": "immediate | urgent | monitor" }
  ],
  "overallAssessment": "2-3 sentence overall summary of the report. MUST INCLUDE A MEDICAL DISCLAIMER at the end.",
  "aiAdvice": "Practical health advice based on these results in 2-3 sentences",
  "dietRecommendations": ["array of 3-5 specific diet tips based on results"],
  "followUpRequired": true or false,
  "urgencyLevel": "routine | soon | urgent | emergency"
}

Be accurate with Indian medical reference ranges. Flag anything outside normal range.`;

    const geminiBody = {
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: imageBase64 } }
        ]
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
    };

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(geminiBody) }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      res.status(502).json({ error: `AI API Error: Failed to analyze medical report. Details: ${errText ? errText.substring(0, 100) : "Timeout or unknown error"}` }); return;
    }

    const geminiData = await geminiRes.json() as {
      candidates?: Array<{ content: { parts: Array<{ text: string }> } }>;
    };

    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      res.status(502).json({ error: "AI API Error: Could not parse AI response. The model output was not valid JSON." }); return;
    }

    const analysisResult = JSON.parse(jsonMatch[0]) as {
      reportType: string;
      reportDate?: string;
      labName?: string;
      findings: Array<Record<string, unknown>>;
      criticalValues?: Array<Record<string, unknown>>;
      overallAssessment?: string;
      aiAdvice?: string;
      dietRecommendations?: string[];
      urgencyLevel?: string;
    };

    // Save to database
    const [saved] = await db.insert(medicalReportsTable).values({
      userId: req.userId!,
      reportType: analysisResult.reportType || reportType,
      reportDate: analysisResult.reportDate || null,
      labName: analysisResult.labName || null,
      findings: analysisResult.findings as Record<string, unknown>[],
      criticalValues: (analysisResult.criticalValues || []) as Record<string, unknown>[],
      aiAdvice: analysisResult.aiAdvice || analysisResult.overallAssessment || null,
      dietRecommendations: analysisResult.dietRecommendations || [],
    }).returning();

    res.status(201).json({
      report: saved,
      analysis: analysisResult,
    });
  } catch (err) {
    res.status(500).json({ error: "Medical scan failed" });
  }
});

// ─────────────────────────────────────────────────────────
// DELETE — delete a report
// ─────────────────────────────────────────────────────────
router.delete("/medical/reports/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    await db.delete(medicalReportsTable)
      .where(eq(medicalReportsTable.id, String(req.params.id)));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete report" });
  }
});

export default router;
