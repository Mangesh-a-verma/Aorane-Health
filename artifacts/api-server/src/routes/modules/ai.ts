import { Router } from "express";
import { db, usersTable, userProfilesTable, userPreferencesTable, userMedicalConditionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../../middlewares/user-auth";
import type { AuthRequest } from "../../middlewares/user-auth";
import { callDeepSeek } from "../../lib/nvidia";

const router = Router();

// NVIDIA (LLaMA 3.3 70B) — diet-plan, health-tip, meal-swap ke liye
async function callNvidia(prompt: string, maxTokens = 3000): Promise<string> {
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  if (!nvidiaKey) throw new Error("NVIDIA_API_KEY not set");
  return callDeepSeek([{ role: "user", content: prompt }], nvidiaKey, maxTokens, 0.4);
}

// Gemini — SIRF smart-scan ke liye (image mein medical report aa sakta hai)
async function callGemini(prompt: string, geminiKey: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );
  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
  const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in Gemini response");
  return jsonMatch[0];
}

router.post("/ai/diet-plan", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!process.env.NVIDIA_API_KEY) { res.status(503).json({ error: "AI service not configured" }); return; }

    const userId = req.userId!;
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
    const conditionsList = conditions.map((c) => c.condition).join(", ") || "none";
    const dietaryPref = (preferences.dietaryPref as string) || "vegetarian";
    const activityLevel = (preferences.activityLevel as string) || "moderate";
    const goalsList = ((preferences.healthGoals as string[]) || []).join(", ") || "general wellness";
    void prefs;
    const language = (preferences.language as string) || user?.languageCode || "en";

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
        "breakfast": {
          "items": [
            { "name": "string", "nameHindi": "string", "quantityG": number, "quantityDesc": "string", "calories": number, "proteinG": number, "carbsG": number, "fatG": number }
          ],
          "totalCalories": number
        },
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

    const jsonStr = await callNvidia(prompt, 4000);
    const plan = JSON.parse(jsonStr);

    res.json({ plan, generatedAt: new Date().toISOString(), userId });
  } catch (err) {
    console.error("Diet plan error:", err);
    res.status(500).json({ error: "Failed to generate diet plan" });
  }
});

router.post("/ai/health-tip", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!process.env.NVIDIA_API_KEY) { res.status(503).json({ error: "AI service not configured" }); return; }

    const { context = "" } = req.body as { context?: string };

    const prompt = `You are a certified Indian health coach. Give ONE practical, culturally relevant daily health tip for an Indian person${context ? ` who ${context}` : ""}.

Return ONLY valid JSON:
{
  "tip": "string (max 2 sentences, practical, specific)",
  "tipHindi": "string (same tip in Hindi)",
  "category": "nutrition|exercise|sleep|stress|hydration|ayurveda",
  "emoji": "single relevant emoji"
}`;

    const jsonStr = await callNvidia(prompt, 500);
    const result = JSON.parse(jsonStr);
    res.json(result);
  } catch {
    res.status(500).json({ error: "Failed to generate health tip" });
  }
});

router.post("/ai/meal-swap", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!process.env.NVIDIA_API_KEY) { res.status(503).json({ error: "AI service not configured" }); return; }

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

    const jsonStr = await callNvidia(prompt, 800);
    const result = JSON.parse(jsonStr);
    res.json(result);
  } catch {
    res.status(500).json({ error: "Failed to generate meal swaps" });
  }
});

router.post("/ai/smart-scan", requireAuth, async (req: AuthRequest, res) => {
  try {
    const geminiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!geminiKey) { res.status(503).json({ error: "AI service not configured" }); return; }

    const { imageBase64, mimeType = "image/jpeg" } = req.body as { imageBase64?: string; mimeType?: string };
    if (!imageBase64) { res.status(400).json({ error: "imageBase64 required" }); return; }

    const prompt = `You are an expert AI health assistant. Carefully analyze this image and determine what type of content it shows.

TASK: First identify the type, then provide detailed analysis.

TYPE DETECTION:
- If it shows food, meal, dish, beverage, snack, ingredients → type = "food"
- If it shows a medical/lab report, blood test, prescription, X-ray, scan, health document → type = "medical_report"
- If it shows a medicine packet, pill bottle, tablet strip → type = "medicine"
- Otherwise → type = "unknown"

RESPONSE FORMAT (return ONLY valid JSON, no markdown):

For food:
{
  "type": "food",
  "foodName": "Name of the food",
  "confidence": 0.95,
  "calories": 250,
  "proteinG": 8,
  "carbsG": 35,
  "fatG": 10,
  "fiberG": 3,
  "servingSize": "1 bowl (200g)",
  "healthScore": 7,
  "tags": ["vegetarian", "high-protein"],
  "tip": "A brief health tip about this food",
  "ingredients": ["main ingredient 1", "main ingredient 2"]
}

For medical_report:
{
  "type": "medical_report",
  "reportType": "Blood Test / CBC / Lipid Profile / Thyroid / etc.",
  "confidence": 0.90,
  "patientName": "if visible, else null",
  "date": "if visible, else null",
  "summary": "2-3 sentence plain-language summary of the report",
  "urgencyLevel": "normal | attention | urgent",
  "keyFindings": [
    { "parameter": "Hemoglobin", "value": "13.5 g/dL", "normalRange": "12-17 g/dL", "status": "normal | high | low" }
  ],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "disclaimer": "This is an AI analysis only. Please consult your doctor."
}

For medicine:
{
  "type": "medicine",
  "confidence": 0.88,
  "medicineName": "Name if readable",
  "genericName": "Generic name if known",
  "uses": "What it is typically used for",
  "commonDosage": "Typical adult dosage",
  "sideEffects": ["Common side effect 1", "Common side effect 2"],
  "warnings": ["Warning 1"],
  "disclaimer": "Always follow your doctor's prescription."
}

For unknown:
{ "type": "unknown", "message": "Could not identify health-related content in this image." }`;

    const geminiBody = JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: imageBase64 } }
        ]
      }],
      generationConfig: { temperature: 0.2 }
    });

    let geminiRes: Response | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: geminiBody }
      );
      if (geminiRes.status === 429 && attempt < 3) {
        await new Promise(r => setTimeout(r, attempt * 2000));
        continue;
      }
      break;
    }

    if (!geminiRes || !geminiRes.ok) {
      const status = geminiRes?.status;
      if (status === 429) { res.status(429).json({ error: "AI is busy right now. Please try again in a moment." }); return; }
      throw new Error(`Gemini error: ${status}`);
    }

    const data = await geminiRes.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    const result = JSON.parse(jsonMatch[0]);
    res.json(result);
  } catch (err) {
    console.error("smart-scan error:", err);
    res.status(500).json({ error: "Smart scan failed. Please try again with a clearer image." });
  }
});

export default router;
