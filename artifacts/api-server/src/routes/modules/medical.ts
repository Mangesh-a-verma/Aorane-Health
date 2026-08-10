import { Router } from "express";
import { db, medicalReportsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth } from "../../middlewares/user-auth";
import type { AuthRequest } from "../../middlewares/user-auth";
import { requireFeature } from "../../middlewares/feature-check";
import { checkAndUseAILimit } from "../../lib/aiLimiter";
import { callAI, type AIMedia } from "../../lib/ai";
import { logger } from "../../lib/logger";

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
// SECURITY FIX: this previously had NO ownership check at all — any
// authenticated user could fetch ANY other user's medical report just by
// knowing/guessing the report's UUID. Medical data is about as sensitive
// as data gets; this is now scoped to the requesting user.
// ─────────────────────────────────────────────────────────
router.get("/medical/reports/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [report] = await db.select().from(medicalReportsTable)
      .where(and(eq(medicalReportsTable.id, String(req.params.id)), eq(medicalReportsTable.userId, req.userId!)));
    if (!report) { res.status(404).json({ error: "Report not found" }); return; }
    res.json({ report });
  } catch (err) {
    logger.error({ err }, "[Medical] Failed to fetch report");
    res.status(500).json({ error: "Failed to fetch report" });
  }
});

// ─────────────────────────────────────────────────────────
// POST — scan + analyse medical report (supports MULTIPLE PAGES in one call)
//
// BUGS FIXED (production-hardening pass):
// 1. Multi-page support: a lab report is very rarely a single page — this
//    previously accepted exactly ONE image, so any additional pages were
//    silently never seen by the AI, producing an incomplete analysis with
//    no indication to the user that anything was missing. Now accepts up
//    to MAX_PAGES images in one request and asks the AI to treat them as
//    one combined document.
// 2. Routed through callAI("medical_ai", ...) instead of a hardcoded raw
//    Gemini fetch() — Admin Panel > AI Config > "Medical AI Assistant" can
//    now actually control the provider/model/enable-toggle for this
//    feature (previously that admin control existed in the UI but had
//    ZERO effect on this route). Also gets the shared retry/timeout logic
//    from lib/ai.ts for free.
// 3. patientName / urgencyLevel / followUpRequired were extracted from the
//    AI's JSON but never saved to the database — fixed (data-loss bug).
// 4. Findings shape is now validated before insert instead of trusting the
//    AI's output blindly.
// ─────────────────────────────────────────────────────────
const MAX_PAGES = 5;

router.post("/medical/scan", requireAuth, requireFeature("medical_report"), async (req: AuthRequest, res) => {
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
          error: `Your medical scan limit for this month is over! Limit: ${limitCheck.limit}/month on ${planType.toUpperCase()} plan.`,
          feature: "ai_medical_scan_daily",
          limitPerDay: limitCheck.limit,
          usedToday: limitCheck.usedToday,
          currentPlan: planType,
          resetsAt: "1st of next month (IST)",
          upgradeSuggested: planType === "free",
        });
      }
      return;
    }

    const body = req.body as {
      imageBase64?: string;                                   // legacy single-page
      images?: Array<{ data: string; mimeType?: string }>;    // new multi-page
      reportType?: string;
      mimeType?: string;
    };

    // Normalize input — accept either the legacy single-image field or the
    // new multi-page array, so existing app builds keep working unchanged.
    const pages: AIMedia[] = body.images?.length
      ? body.images.map((p) => ({ mimeType: p.mimeType || "image/jpeg", data: p.data }))
      : body.imageBase64
        ? [{ mimeType: body.mimeType || "image/jpeg", data: body.imageBase64 }]
        : [];

    if (pages.length === 0) {
      res.status(400).json({ error: "At least one image (imageBase64 or images[]) is required" }); return;
    }
    if (pages.length > MAX_PAGES) {
      res.status(400).json({ error: `Maximum ${MAX_PAGES} pages allowed per scan. Please split into multiple scans.` }); return;
    }

    const reportType = body.reportType || "blood_test";

    const prompt = `You are a senior Indian pathologist and healthcare expert. You will be shown ${pages.length} image${pages.length > 1 ? "s, which are MULTIPLE PAGES of the SAME medical report" : ""}. Analyze ${pages.length > 1 ? "all pages together as one combined document" : "this medical report image"} carefully. Extract precise key-value pairs of the results (e.g., "Sugar (Fasting)": "100 mg/dL") from across ${pages.length > 1 ? "every page" : "the report"}. Append a strict medical disclaimer to the overall assessment, stating that this is an AI analysis and not a substitute for professional medical advice.

Return ONLY a valid JSON object with NO markdown or extra text:
{
  "reportType": "blood_test | urine_test | lipid_profile | thyroid | diabetes | liver | kidney | vitamin | other",
  "reportDate": "YYYY-MM-DD or null",
  "labName": "lab name or null",
  "patientName": "name if visible or null",
  "pagesAnalyzed": ${pages.length},
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

Be accurate with Indian medical reference ranges. Flag anything outside normal range.${pages.length > 1 ? " If the same test appears on more than one page (e.g. a repeat/duplicate), include it only once using the most complete value." : ""}`;

    let jsonStr: string;
    try {
      jsonStr = await callAI(
        "medical_ai",
        [{ role: "user", content: prompt, media: pages }],
        { maxTokens: 4096, temperature: 0.1 },
      );
    } catch (aiErr) {
      logger.error({ err: aiErr, userId: req.userId, pageCount: pages.length }, "[Medical] AI analysis failed");
      res.status(502).json({ error: `AI analysis failed: ${aiErr instanceof Error ? aiErr.message : "Unknown error"}. Please try again.` });
      return;
    }

    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn({ text: jsonStr.slice(0, 300), userId: req.userId }, "[Medical] AI response had no parseable JSON");
      res.status(502).json({ error: "Could not parse AI response. Please try again." });
      return;
    }

    let analysisResult: {
      reportType?: string;
      reportDate?: string;
      labName?: string;
      patientName?: string;
      findings?: Array<Record<string, unknown>>;
      criticalValues?: Array<Record<string, unknown>>;
      overallAssessment?: string;
      aiAdvice?: string;
      dietRecommendations?: string[];
      urgencyLevel?: string;
      followUpRequired?: boolean;
    };
    try {
      analysisResult = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      logger.warn({ err: parseErr, userId: req.userId }, "[Medical] AI returned malformed JSON");
      res.status(502).json({ error: "AI returned an invalid response. Please try again." });
      return;
    }

    // Validate the shape we actually depend on before trusting it into the DB —
    // the AI can occasionally omit fields despite the prompt's instructions.
    if (!Array.isArray(analysisResult.findings)) {
      analysisResult.findings = [];
    }

    // Save to database
    const [saved] = await db.insert(medicalReportsTable).values({
      userId: req.userId!,
      reportType: analysisResult.reportType || reportType,
      reportDate: analysisResult.reportDate || null,
      labName: analysisResult.labName || null,
      patientName: analysisResult.patientName || null,
      findings: analysisResult.findings as Record<string, unknown>[],
      criticalValues: (analysisResult.criticalValues || []) as Record<string, unknown>[],
      aiAdvice: analysisResult.aiAdvice || analysisResult.overallAssessment || null,
      dietRecommendations: analysisResult.dietRecommendations || [],
      urgencyLevel: analysisResult.urgencyLevel || null,
      followUpRequired: analysisResult.followUpRequired ?? false,
      pageCount: pages.length,
    }).returning();

    res.status(201).json({
      report: saved,
      analysis: analysisResult,
    });
  } catch (err) {
    logger.error({ err, userId: req.userId }, "[Medical] Unexpected error in /medical/scan");
    res.status(500).json({ error: "Medical scan failed. Please try again." });
  }
});

// ─────────────────────────────────────────────────────────
// DELETE — delete a report
// SECURITY FIX: same IDOR issue as GET above — any authenticated user
// could previously delete ANY other user's medical report. Now scoped.
// ─────────────────────────────────────────────────────────
router.delete("/medical/reports/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const deleted = await db.delete(medicalReportsTable)
      .where(and(eq(medicalReportsTable.id, String(req.params.id)), eq(medicalReportsTable.userId, req.userId!)))
      .returning({ id: medicalReportsTable.id });
    if (deleted.length === 0) { res.status(404).json({ error: "Report not found" }); return; }
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "[Medical] Failed to delete report");
    res.status(500).json({ error: "Failed to delete report" });
  }
});

export default router;
