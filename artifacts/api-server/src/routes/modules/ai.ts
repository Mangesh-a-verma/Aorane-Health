import { Router } from "express";
import { db, usersTable, userProfilesTable, userPreferencesTable, userMedicalConditionsTable, aiConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../../middlewares/user-auth";
import { requireAdmin } from "../../middlewares/admin-auth";
import type { AuthRequest } from "../../middlewares/user-auth";
import { requireFeature } from "../../middlewares/feature-check";
import { callAI, AIProviderError } from "../../lib/ai";
import { checkAndUseAILimit, refundAIUsage } from "../../lib/aiLimiter";
import { cache } from "../../lib/redis";
import crypto from "crypto";

const SMART_SCAN_CACHE_TTL_SECONDS = 24 * 60 * 60; // 24h — same photo re-scanned (by same or different user) skips the Gemini call entirely

const router = Router();

// ── Helper: standard "limit blocked" response ────────────────────────────────
function sendLimitBlocked(res: import("express").Response, feature: string, usedToday: number, limit: number, planType: string, planRequired?: string): void {
  if (planRequired) {
    res.status(403).json({
      error: `This feature is not available on the ${planType.toUpperCase()} plan. Upgrade to ${planRequired.toUpperCase()} to unlock it.`,
      feature,
      reason: "plan_not_supported",
      currentPlan: planType,
      planRequired,
      upgradeSuggested: true,
    });
  } else {
    res.status(429).json({
      error: `You've reached today's limit! Please try again tomorrow. Limit: ${limit}/day on ${planType.toUpperCase()} plan.`,
      feature,
      limitPerDay: limit,
      usedToday,
      currentPlan: planType,
      resetsAt: "midnight IST",
      upgradeSuggested: planType === "free",
    });
  }
}

// ── Diagnostic: AI Connection Test ───────────────────────────────────────────
router.get("/test-ai-connection", requireAdmin, async (req, res) => {
  try {
    const messages = [
      { role: "system" as const, content: "You are a helpful assistant." },
      { role: "user" as const, content: "Say hello and confirm you are working." }
    ];
    const responseText = await callAI("test_connection", messages, { maxTokens: 50, temperature: 0.1 });
    res.json({ success: true, response: responseText });
  } catch (error: any) {
    console.error("AI Connection Test Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── AI Diet Plan ─────────────────────────────────────────────────────────────
router.post("/ai/diet-plan", requireAuth, requireFeature("meal_planner"), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const planType = req.userPlan || "free";

    const limitCheck = await checkAndUseAILimit(userId, "ai_meal_planner_daily", planType);
    if (!limitCheck.allowed) {
      sendLimitBlocked(res, "ai_meal_planner_daily", limitCheck.usedToday, limitCheck.limit, planType, limitCheck.planRequired);
      return;
    }

    const { days = 1, preferences = {} } = req.body as { days?: number; preferences?: Record<string, unknown> };

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId)).limit(1);
    const [prefs] = await db.select().from(userPreferencesTable).where(eq(userPreferencesTable.userId, userId)).limit(1);
    const conditions = await db.select().from(userMedicalConditionsTable).where(eq(userMedicalConditionsTable.userId, userId));

    const now = new Date();
    const age = profile?.dateOfBirth
      ? Math.floor((now.getTime() - new Date(profile.dateOfBirth as string).getTime()) / (1000 * 60 * 60 * 24 * 365))
      : null;

    const weightKg = profile?.weightKg ? Number(profile.weightKg) : null;
    const heightCm = profile?.heightCm ? Number(profile.heightCm) : null;
    const gender = profile?.gender || "other";
    const conditionsList = conditions.map((c: any) => c.condition).join(", ") || "none";
    const dietaryPref = (preferences.dietaryPref as string) || profile?.foodPreference || "vegetarian";
    const activityLevel = (preferences.activityLevel as string) || profile?.activityLevel || "moderate";
    const goalsList = ((preferences.healthGoals as string[]) || []).join(", ") || "general wellness";
    const language = (preferences.language as string) || prefs?.languageCode || user?.languageCode || "en";

    let bmr = 0;
    if (weightKg && heightCm && age) {
      bmr = gender === "female"
        ? 655 + 9.6 * weightKg + 1.8 * heightCm - 4.7 * age
        : 66 + 13.7 * weightKg + 5 * heightCm - 6.8 * age;
    }
    const tdee = bmr
      ? Math.round(bmr * ({ sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 }[activityLevel] || 1.55))
      : 1800;
    const targetCalories = goalsList.includes("weight_loss") ? Math.round(tdee * 0.8) : goalsList.includes("muscle_gain") ? Math.round(tdee * 1.1) : tdee;
    const planDays = Math.min(Math.max(Number(days) || 1, 1), 7);

    const prompt = `You are a certified Indian dietitian and nutritionist. Create a ${planDays}-day personalized Indian diet plan.

User profile:
- Age: ${age || "unknown"}, Gender: ${gender}, Weight: ${weightKg ? weightKg + " kg" : "unknown"}, Height: ${heightCm ? heightCm + " cm" : "unknown"}
- Dietary preference: ${dietaryPref}
- Activity level: ${activityLevel}
- Health goals: ${goalsList}
- Medical conditions: ${conditionsList}
- Target daily calories: ${targetCalories} kcal

Rules:
1. Use ONLY authentic Indian foods (dal, roti, rice, sabzi, etc.)
2. Include regional variety (North Indian, South Indian, etc.)
3. Respect dietary preferences (${dietaryPref})
4. Consider medical conditions (${conditionsList})
5. Each meal should have name, portion/quantity in grams, and macros
6. Language hint: ${language}

Return ONLY valid JSON (no markdown, no extra text):
{
  "targetCalories": ${targetCalories},
  "targetProteinG": number,
  "targetCarbsG": number,
  "targetFatG": number,
  "days": [
    {
      "day": 1,
      "dayName": "Day 1",
      "totalCalories": number,
      "meals": {
        "breakfast": { "items": [{ "name": "string", "nameHindi": "string", "quantityG": number, "quantityDesc": "string", "calories": number, "proteinG": number, "carbsG": number, "fatG": number }], "totalCalories": number },
        "lunch": { "items": [...], "totalCalories": number },
        "dinner": { "items": [...], "totalCalories": number },
        "snacks": { "items": [...], "totalCalories": number }
      },
      "waterIntakeMl": number,
      "tip": "string (1 health tip for the day in English)"
    }
  ],
  "generalTips": ["tip1", "tip2", "tip3"]
}`;

    const payload: import("../../lib/ai").AIMessage[] = [{ role: "user", content: prompt }];

    let jsonStr;
    try {
      jsonStr = await callAI("meal_planner", payload, { maxTokens: 2000 });
    } catch (apiErr: any) {
      await refundAIUsage(userId, "ai_meal_planner_daily");
      res.status(502).json({ error: "AI Provider failed to generate response", details: apiErr.message || String(apiErr) });
      return;
    }
    let plan;
    try {
      plan = JSON.parse(jsonStr);
    } catch (parseErr) {
      await refundAIUsage(userId, "ai_meal_planner_daily");
      req.log.error({ jsonStrPreview: jsonStr?.slice(0, 500) }, "diet-plan: AI returned non-JSON");
      res.status(502).json({ error: "AI response could not be read. Please try again." });
      return;
    }
    res.json({
      plan,
      generatedAt: new Date().toISOString(),
      userId,
      aiUsage: { remaining: limitCheck.remaining, limit: limitCheck.limit },
    });
  } catch (err) {
    req.log.error({ err }, "Diet plan error");
    res.status(500).json({ error: "Failed to generate diet plan" });
  }
});

// ── AI Health Tip ─────────────────────────────────────────────────────────────
router.post("/ai/health-tip", requireAuth, requireFeature("health_suggestions"), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const planType = req.userPlan || "free";

    const limitCheck = await checkAndUseAILimit(userId, "ai_health_coach_daily", planType);
    if (!limitCheck.allowed) {
      sendLimitBlocked(res, "ai_health_coach_daily", limitCheck.usedToday, limitCheck.limit, planType, limitCheck.planRequired);
      return;
    }

    const { context = "" } = req.body as { context?: string };

    const prompt = `You are a certified Indian health coach. Give ONE practical, culturally relevant daily health tip for an Indian person${context ? ` who ${context}` : ""}.

Return ONLY valid JSON:
{
  "tip": "string (max 2 sentences, practical, specific)",
  "tipHindi": "string (same tip in Hindi)",
  "category": "nutrition|exercise|sleep|stress|hydration|ayurveda",
  "explanation": "Why this suggestion matters for your specific condition/goals."
}`;

    const payload: import("../../lib/ai").AIMessage[] = [{ role: "user", content: prompt }];

    let jsonStr;
    try {
      jsonStr = await callAI("health_suggestions", payload, { maxTokens: 500 });
    } catch (apiErr: any) {
      await refundAIUsage(userId, "ai_health_coach_daily");
      res.status(502).json({ error: "AI Provider failed to generate response", details: apiErr.message || String(apiErr) });
      return;
    }
    let result;
    try {
      result = JSON.parse(jsonStr);
    } catch {
      await refundAIUsage(userId, "ai_health_coach_daily");
      res.status(502).json({ error: "AI response could not be read. Please try again." });
      return;
    }
    res.json({ ...result, aiUsage: { remaining: limitCheck.remaining, limit: limitCheck.limit } });
  } catch {
    res.status(500).json({ error: "Failed to generate health tip" });
  }
});

// ── AI Meal Swap ──────────────────────────────────────────────────────────────
router.post("/ai/meal-swap", requireAuth, requireFeature("meal_planner"), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const planType = req.userPlan || "free";

    const limitCheck = await checkAndUseAILimit(userId, "ai_meal_swap_daily", planType);
    if (!limitCheck.allowed) {
      sendLimitBlocked(res, "ai_meal_swap_daily", limitCheck.usedToday, limitCheck.limit, planType, limitCheck.planRequired);
      return;
    }

    const { mealName, reason, dietaryPref = "vegetarian" } = req.body as { mealName: string; reason?: string; dietaryPref?: string };
    if (!mealName) { res.status(400).json({ error: "mealName required" }); return; }

    const prompt = `You are an Indian dietitian. Suggest 3 healthier Indian food swaps for "${mealName}"${reason ? ` because ${reason}` : ""}.
Dietary preference: ${dietaryPref}.

Return ONLY valid JSON:
{
  "original": "${mealName}",
  "swaps": [
    { "name": "string", "nameHindi": "string", "reason": "string (why it's better)", "calories": number, "benefit": "string" }
  ],
  "tips": "Tips for preparation"
}`;

    const payload: import("../../lib/ai").AIMessage[] = [{ role: "user", content: prompt }];

    let jsonStr;
    try {
      jsonStr = await callAI("meal_planner", payload, { maxTokens: 800 });
    } catch (apiErr: any) {
      await refundAIUsage(userId, "ai_meal_swap_daily");
      res.status(502).json({ error: "AI Provider failed to generate response", details: apiErr.message || String(apiErr) });
      return;
    }
    let result;
    try {
      result = JSON.parse(jsonStr);
    } catch {
      await refundAIUsage(userId, "ai_meal_swap_daily");
      res.status(502).json({ error: "AI response could not be read. Please try again." });
      return;
    }
    res.json({ ...result, aiUsage: { remaining: limitCheck.remaining, limit: limitCheck.limit } });
  } catch {
    res.status(500).json({ error: "Failed to generate meal swaps" });
  }
});

// ── AI Smart Scan (vision — food / medical report / medicine) ─────────────────
router.post("/ai/smart-scan", requireAuth, requireFeature("smart_scan"), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const planType = req.userPlan || "free";

    let { imageBase64, mimeType = "image/jpeg" } = req.body as { imageBase64?: string; mimeType?: string };
    if (!imageBase64) { res.status(400).json({ error: "imageBase64 required" }); return; }

    // Clean Data URI prefix if present
    if (imageBase64.includes("base64,")) {
      imageBase64 = imageBase64.split("base64,")[1];
    }

    // ── Input hardening for photo scans ─────────────────────────────────────
    // Same checks food.ts/medical.ts already apply to their scan endpoints —
    // catches malformed/oversized/wrong-type uploads before they burn an AI
    // call and quota.
    {
      const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"]);
      if (mimeType && !ALLOWED_MIME_TYPES.has(mimeType.toLowerCase())) {
        res.status(400).json({ error: `Unsupported image type "${mimeType}". Please use JPEG, PNG, WEBP, or HEIC.` });
        return;
      }
      const MAX_BASE64_LENGTH = 12 * 1024 * 1024;
      if (imageBase64.length > MAX_BASE64_LENGTH) {
        res.status(413).json({ error: "Image is too large. Please use a smaller photo (under ~9MB)." });
        return;
      }
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(imageBase64.replace(/\s/g, ""))) {
        res.status(400).json({ error: "Image data is corrupted or not valid base64. Please try taking the photo again." });
        return;
      }
    }

    // Check photo scan limit before calling AI (input already validated above,
    // so quota is only consumed for requests that will actually reach the AI)
    const limitCheck = await checkAndUseAILimit(userId, "ai_food_scan_photo_daily", planType);
    if (!limitCheck.allowed) {
      sendLimitBlocked(res, "ai_food_scan_photo_daily", limitCheck.usedToday, limitCheck.limit, planType, limitCheck.planRequired);
      return;
    }

    // Exact-duplicate check: same image bytes (same packaged product/medicine
    // photo, scanned again by this or any other user) — skip the Gemini call
    // entirely and reuse the previous analysis. Cache key is content-based only
    // (no userId), so this also helps across different users scanning the same
    // product. Saves real Gemini free-tier quota, not just server latency.
    const imageHash = crypto.createHash("sha256").update(imageBase64).digest("hex");
    const cacheKey = `smartscan:${imageHash}`;
    const cachedResult = await cache.get(cacheKey);
    if (cachedResult) {
      try {
        const parsedCached = JSON.parse(cachedResult) as Record<string, unknown>;
        res.json({ ...parsedCached, aiUsage: { remaining: limitCheck.remaining, limit: limitCheck.limit }, cached: true });
        return;
      } catch {
        // Corrupt cache entry — fall through and re-analyze normally.
        await cache.delete(cacheKey);
      }
    }

    const prompt = `You are an expert AI health assistant. Carefully analyze this image and determine what type of content it shows.

TASK: First identify the type, then provide detailed analysis.

TYPE DETECTION:
- If it shows food, meal, dish, beverage, snack, ingredients → type = "food"
- If it shows a medical/lab report, blood test, prescription, X-ray, scan, health document → type = "medical_report"
- If it shows a medicine packet, pill bottle, tablet strip → type = "medicine"
- Otherwise → type = "unknown"

RESPONSE FORMAT (return ONLY valid JSON, no markdown):

For food:
{ "type": "food", "foodName": "Name", "confidence": 0.95, "calories": 250, "proteinG": 8, "carbsG": 35, "fatG": 10, "fiberG": 3, "servingSize": "1 bowl (200g)", "healthScore": 7, "tags": ["vegetarian"], "tip": "Health tip", "ingredients": ["ingredient1"] }

For medical_report:
{ "type": "medical_report", "reportType": "Blood Test / CBC / etc.", "confidence": 0.90, "patientName": null, "date": null, "summary": "2-3 sentence summary", "urgencyLevel": "normal|attention|urgent", "keyFindings": [{ "parameter": "Hemoglobin", "value": "13.5 g/dL", "normalRange": "12-17 g/dL", "status": "normal|high|low" }], "recommendations": ["Rec 1"], "disclaimer": "This is an AI analysis only. Please consult your doctor." }

For medicine:
{ "type": "medicine", "confidence": 0.88, "medicineName": "Name", "genericName": "Generic", "uses": "What it treats", "commonDosage": "Typical adult dose", "sideEffects": ["Side effect 1"], "warnings": ["Warning"], "disclaimer": "Always follow your doctor's prescription." }

For unknown (nothing recognizable):
{ "type": "unknown", "message": "No recognized items found." }

Always include a "type" field matching one of: "food", "medical_report", "medicine", "unknown". Never omit it.`;

    const payload: import("../../lib/ai").AIMessage[] = [{
      role: "user",
      content: prompt,
      media: {
        mimeType,
        data: imageBase64
      }
    }];

    let jsonStr;
    try {
      jsonStr = await callAI("smart_scan", payload, { maxTokens: 1500, temperature: 0.2 });
    } catch (apiErr) {
      req.log.error({ err: apiErr, feature: "smart_scan" }, "smart-scan AI call failed");
      await refundAIUsage(userId, "ai_food_scan_photo_daily");
      if (apiErr instanceof AIProviderError) {
        if (apiErr.code === "rate_limited") {
          res.status(503).json({
            error: "AI Smart Scan is busy right now (Gemini free-tier rate limit reached across the app). Please wait a minute and try again.",
            code: "rate_limited",
          });
          return;
        }
        if (apiErr.code === "missing_key") {
          // Ops/config issue, not a user-fixable problem — logged above with full detail.
          res.status(500).json({
            error: "AI Smart Scan is not configured correctly on the server. Please contact support.",
            code: "config_error",
          });
          return;
        }
        if (apiErr.code === "empty_response") {
          res.status(502).json({
            error: "Could not read this image clearly. Try a clearer, well-lit photo.",
            code: "unclear_image",
          });
          return;
        }
      }
      res.status(502).json({ error: "AI Provider failed to analyze the image", details: apiErr instanceof Error ? apiErr.message : String(apiErr) });
      return;
    }

    let result: Record<string, unknown>;
    try {
      result = JSON.parse(jsonStr) as Record<string, unknown>;
    } catch (e) {
      req.log.error({ jsonStrPreview: jsonStr?.slice(0, 500), len: jsonStr?.length }, "smart-scan: AI returned non-JSON or truncated JSON");
      await refundAIUsage(userId, "ai_food_scan_photo_daily");
      res.status(502).json({ error: "AI response could not be read. Please try scanning again.", code: "invalid_ai_response" });
      return;
    }

    const detectedType = result.type as string | undefined;

    // Quota was speculatively charged against the food bucket above (before
    // we knew what the image actually was, since that's the only gate we
    // can apply before spending the real Gemini call). Reconcile now that
    // the type is known:
    let responseUsage = { remaining: limitCheck.remaining, limit: limitCheck.limit };

    if (detectedType === "medical_report" || detectedType === "medicine") {
      // This is a medical-quota consumer (lab report / medicine packet), not
      // a food scan — refund the food unit and charge the correct bucket
      // instead, so a user can't bypass the (much stricter, monthly)
      // medical-scan limit by going through the food-scan path.
      await refundAIUsage(userId, "ai_food_scan_photo_daily");
      const medicalCheck = await checkAndUseAILimit(userId, "ai_medical_scan_daily", planType);
      if (!medicalCheck.allowed) {
        sendLimitBlocked(res, "ai_medical_scan_daily", medicalCheck.usedToday, medicalCheck.limit, planType, medicalCheck.planRequired);
        return;
      }
      responseUsage = { remaining: medicalCheck.remaining, limit: medicalCheck.limit };
    } else if (detectedType !== "food") {
      // "unknown", missing type, or any other unrecognized shape — nothing
      // useful was returned, so this should not be billed and must not be
      // shown to the user as a silent blank result.
      await refundAIUsage(userId, "ai_food_scan_photo_daily");
      res.status(422).json({
        error: "Could not recognize this as food, a medical report, or a medicine. Try a clearer, well-lit photo.",
        code: "unrecognized_image",
      });
      return;
    }

    res.json({ ...result, aiUsage: responseUsage });
    await cache.set(cacheKey, JSON.stringify(result), SMART_SCAN_CACHE_TTL_SECONDS);
  } catch (err) {
    req.log.error({ err }, "smart-scan error");
    res.status(500).json({ error: "Smart scan failed. Please try again with a clearer image." });
  }
});

export default router;