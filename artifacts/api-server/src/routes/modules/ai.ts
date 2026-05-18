import { Router } from "express";
import { db, usersTable, userProfilesTable, userPreferencesTable, userMedicalConditionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../../middlewares/user-auth";
import type { AuthRequest } from "../../middlewares/user-auth";
import { aiRateLimit, planAiRateLimit } from "../../middlewares/ai-rate-limit";
import { requireFeature } from "../../middlewares/feature-check";
import { callAI } from "../../lib/ai";
import { checkAndUseAILimit } from "../../lib/aiLimiter";

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
      error: `Aaj ki limit khatam ho gayi! Kal dobara try karein. Limit: ${limit}/day on ${planType.toUpperCase()} plan.`,
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
router.get("/test-ai-connection", async (req, res) => {
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
router.post("/ai/diet-plan", requireAuth, requireFeature("meal_planner"), aiRateLimit("meal_planner", 5), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const planType = req.userPlan || "free";

    const limitCheck = await checkAndUseAILimit(userId, "ai_diet_plan_daily", planType);
    if (!limitCheck.allowed) {
      sendLimitBlocked(res, "ai_diet_plan_daily", limitCheck.usedToday, limitCheck.limit, planType, limitCheck.planRequired);
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

    const jsonStr = await callAI("meal_planner", [{ role: "user", content: prompt }], { maxTokens: 2000 });
    const plan = JSON.parse(jsonStr);
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
router.post("/ai/health-tip", requireAuth, requireFeature("health_suggestions"), aiRateLimit("health_tip", 10), async (req: AuthRequest, res) => {
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
  "emoji": "single relevant emoji"
}`;

    const jsonStr = await callAI("health_suggestions", [{ role: "user", content: prompt }], { maxTokens: 500 });
    const result = JSON.parse(jsonStr);
    res.json({ ...result, aiUsage: { remaining: limitCheck.remaining, limit: limitCheck.limit } });
  } catch {
    res.status(500).json({ error: "Failed to generate health tip" });
  }
});

// ── AI Meal Swap ──────────────────────────────────────────────────────────────
router.post("/ai/meal-swap", requireAuth, requireFeature("meal_planner"), aiRateLimit("meal_swap", 20), async (req: AuthRequest, res) => {
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
  ]
}`;

    const jsonStr = await callAI("meal_planner", [{ role: "user", content: prompt }], { maxTokens: 800 });
    const result = JSON.parse(jsonStr);
    res.json({ ...result, aiUsage: { remaining: limitCheck.remaining, limit: limitCheck.limit } });
  } catch {
    res.status(500).json({ error: "Failed to generate meal swaps" });
  }
});

// ── AI Smart Scan (vision — food / medical report / medicine) ─────────────────
router.post("/ai/smart-scan", requireAuth, requireFeature("smart_scan"), aiRateLimit("smart_scan", 10), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const planType = req.userPlan || "free";

    // Check photo scan limit before calling AI
    const limitCheck = await checkAndUseAILimit(userId, "ai_food_scan_photo_daily", planType);
    if (!limitCheck.allowed) {
      sendLimitBlocked(res, "ai_food_scan_photo_daily", limitCheck.usedToday, limitCheck.limit, planType, limitCheck.planRequired);
      return;
    }

    let { imageBase64, mimeType = "image/jpeg" } = req.body as { imageBase64?: string; mimeType?: string };
    if (!imageBase64) { res.status(400).json({ error: "imageBase64 required" }); return; }

    // Clean Data URI prefix if present
    if (imageBase64.includes("base64,")) {
      imageBase64 = imageBase64.split("base64,")[1];
    }

    const proxyBaseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
    const proxyKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
    const userGeminiKey = process.env.GOOGLE_GEMINI_API_KEY;

    const geminiBaseUrl = proxyBaseUrl || "https://generativelanguage.googleapis.com";
    const geminiKey = proxyBaseUrl ? proxyKey : userGeminiKey;

    if (!geminiKey) { res.status(503).json({ error: "Smart Scan AI is not configured. Contact support." }); return; }

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

For unknown:
{ "type": "unknown", "message": "Could not identify health-related content in this image." }`;

    const geminiBody = JSON.stringify({
      contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: imageBase64 } }] }],
      generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
    });

    let geminiRes: globalThis.Response | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      geminiRes = await fetch(
        `${geminiBaseUrl}/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: geminiBody },
      );
      if (geminiRes.status === 429 && attempt < 3) {
        await new Promise((r: any) => setTimeout(r, attempt * 2000));
        continue;
      }
      break;
    }

    if (!geminiRes || !geminiRes.ok) {
      const status = geminiRes?.status;
      const errText = await geminiRes?.text().catch(() => "");
      req.log.error({ status, body: errText?.slice(0, 300) }, "Gemini smart-scan HTTP error");
      if (status === 429) { res.status(429).json({ error: "AI is busy right now. Please try again in a moment." }); return; }
      throw new Error(`Gemini error: ${status} - ${errText?.slice(0, 100)}`);
    }

    const data = await geminiRes.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    let result: Record<string, unknown>; try { result = JSON.parse(rawText) as Record<string, unknown>; } catch(e) { throw new Error("Invalid JSON"); }

    res.json({ ...result, aiUsage: { remaining: limitCheck.remaining, limit: limitCheck.limit } });
  } catch (err) {
    req.log.error({ err }, "smart-scan error");
    res.status(500).json({ error: "Smart scan failed. Please try again with a clearer image." });
  }
});

export default router;
