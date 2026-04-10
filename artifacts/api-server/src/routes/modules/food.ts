import { Router } from "express";
import { db, foodLogsTable, foodItemsTable, foodScanCacheTable } from "@workspace/db";
import { eq, and, gte, lte, ilike } from "drizzle-orm";
import { requireAuth } from "../../middlewares/user-auth";
import type { AuthRequest } from "../../middlewares/user-auth";

const router = Router();

router.get("/food/logs", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { date, startDate, endDate } = req.query as Record<string, string>;
    const conditions = [eq(foodLogsTable.userId, req.userId!)];
    if (date) {
      conditions.push(gte(foodLogsTable.loggedAt, new Date(date + "T00:00:00Z")));
      conditions.push(lte(foodLogsTable.loggedAt, new Date(date + "T23:59:59Z")));
    } else if (startDate && endDate) {
      conditions.push(gte(foodLogsTable.loggedAt, new Date(startDate)));
      conditions.push(lte(foodLogsTable.loggedAt, new Date(endDate)));
    }
    const logs = await db.select().from(foodLogsTable).where(and(...conditions)).orderBy(foodLogsTable.loggedAt);
    res.json({ logs });
  } catch {
    res.status(500).json({ error: "Failed to fetch food logs" });
  }
});

router.post("/food/log", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { foodNameEn, mealType, quantityG, quantityDescription, calories, proteinG, carbsG, fatG, fiberG, inputMethod, foodItemId, loggedAt } = req.body as Record<string, unknown>;
    const [log] = await db.insert(foodLogsTable).values({
      userId: req.userId!,
      foodNameEn: foodNameEn as string,
      mealType: mealType as "breakfast" | "lunch" | "dinner" | "snack" | "other",
      quantityG: quantityG ? String(quantityG) : undefined,
      quantityDescription: quantityDescription as string | undefined,
      calories: String(calories),
      proteinG: proteinG ? String(proteinG) : undefined,
      carbsG: carbsG ? String(carbsG) : undefined,
      fatG: fatG ? String(fatG) : undefined,
      fiberG: fiberG ? String(fiberG) : undefined,
      inputMethod: (inputMethod as "photo" | "text" | "voice" | "manual") || "text",
      foodItemId: foodItemId as string | undefined,
      loggedAt: loggedAt ? new Date(loggedAt as string) : new Date(),
    }).returning();
    res.status(201).json({ log });
  } catch {
    res.status(500).json({ error: "Failed to log food" });
  }
});

router.delete("/food/log/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    await db.delete(foodLogsTable)
      .where(and(eq(foodLogsTable.id, req.params.id), eq(foodLogsTable.userId, req.userId!)));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete food log" });
  }
});

router.get("/food/search", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { q, limit = "20" } = req.query as { q: string; limit?: string };
    if (!q || q.length < 2) { res.json({ items: [] }); return; }
    const items = await db.select().from(foodItemsTable)
      .where(ilike(foodItemsTable.foodNameEn, `%${q}%`))
      .limit(parseInt(limit));
    res.json({ items });
  } catch {
    res.status(500).json({ error: "Food search failed" });
  }
});

// ─────────────────────────────────────────────────────────
// AI Food Analysis — DB first, then Gemini with full nutrition
// ─────────────────────────────────────────────────────────
router.post("/food/scan", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { foodName, imageBase64 } = req.body as { foodName?: string; imageBase64?: string };
    const searchTerm = foodName?.toLowerCase().trim();

    // 1. Check local DB first
    if (searchTerm) {
      const [dbItem] = await db.select().from(foodItemsTable)
        .where(ilike(foodItemsTable.foodNameEn, searchTerm))
        .limit(1);

      if (dbItem) {
        return res.json({
          result: {
            foodNameEn: dbItem.foodNameEn,
            calories: Number(dbItem.calories),
            proteinG: Number(dbItem.proteinG || 0),
            carbsG: Number(dbItem.carbsG || 0),
            fatG: Number(dbItem.fatG || 0),
            fiberG: Number(dbItem.fiberG || 0),
            servingSizeG: Number(dbItem.servingSizeG || 100),
            servingDescription: dbItem.servingDescription || "100g",
            category: dbItem.category || "food",
            dietaryTags: (dbItem.dietaryTags as string[]) || [],
            vitamins: {},
          },
          fromDb: true,
          fromCache: false,
        });
      }

      // 2. Check scan cache
      const [cached] = await db.select().from(foodScanCacheTable)
        .where(eq(foodScanCacheTable.foodNameEn, searchTerm));
      if (cached) {
        await db.update(foodScanCacheTable)
          .set({ hitCount: cached.hitCount + 1, lastUsedAt: new Date() })
          .where(eq(foodScanCacheTable.id, cached.id));
        return res.json({ result: cached.aiResult, fromCache: true, fromDb: false });
      }
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return res.status(503).json({ error: "AI service not configured" });
    }

    // 3. Gemini AI — full nutritional breakdown
    let promptText = "";
    if (searchTerm) {
      promptText = `You are a certified Indian dietitian. Analyze this Indian/common food: "${searchTerm}".
Return ONLY a valid JSON object (no markdown, no extra text) with these exact fields:
{
  "foodNameEn": "string",
  "calories": number (per 100g),
  "proteinG": number,
  "carbsG": number,
  "fatG": number,
  "fiberG": number,
  "sodiumMg": number,
  "sugarG": number,
  "servingSizeG": number,
  "servingDescription": "string (e.g. 1 bowl / 1 roti / 1 cup)",
  "category": "string (grain/protein/vegetable/fruit/dairy/snack/beverage/sweet)",
  "dietaryTags": ["veg" or "nonveg" or "vegan" or "jain" or "gluten-free"],
  "vitamins": {
    "vitaminA_mcg": number,
    "vitaminC_mg": number,
    "vitaminD_mcg": number,
    "vitaminB12_mcg": number,
    "iron_mg": number,
    "calcium_mg": number,
    "potassium_mg": number,
    "zinc_mg": number
  },
  "glycemicIndex": number or null,
  "healthTip": "string (1 sentence health tip in English)"
}`;
    } else if (imageBase64) {
      promptText = `You are a certified Indian dietitian. Analyze this food image.
Return ONLY a valid JSON object with: foodNameEn, calories (per 100g), proteinG, carbsG, fatG, fiberG, sodiumMg, sugarG, servingSizeG, servingDescription, category, dietaryTags (array), vitamins (object with vitaminA_mcg, vitaminC_mg, vitaminD_mcg, vitaminB12_mcg, iron_mg, calcium_mg, potassium_mg, zinc_mg), glycemicIndex, healthTip.`;
    }

    const geminiBody: Record<string, unknown> = imageBase64
      ? {
          contents: [{
            parts: [
              { text: promptText },
              { inline_data: { mime_type: "image/jpeg", data: imageBase64 } }
            ]
          }]
        }
      : { contents: [{ parts: [{ text: promptText }] }] };

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(geminiBody) }
    );
    const geminiData = await geminiRes.json() as {
      candidates?: Array<{ content: { parts: Array<{ text: string }> } }>;
    };

    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text, calories: 100, proteinG: 0, carbsG: 0, fatG: 0 };

    if (searchTerm) {
      await db.insert(foodScanCacheTable).values({
        foodNameEn: searchTerm,
        aiResult: result,
      }).onConflictDoNothing();
    }

    return res.json({ result, fromCache: false, fromDb: false });
  } catch (err) {
    res.status(500).json({ error: "Food scan failed" });
  }
});

router.get("/food/summary/:date", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { date } = req.params;
    const logs = await db.select().from(foodLogsTable).where(
      and(
        eq(foodLogsTable.userId, req.userId!),
        gte(foodLogsTable.loggedAt, new Date(date + "T00:00:00Z")),
        lte(foodLogsTable.loggedAt, new Date(date + "T23:59:59Z"))
      )
    );
    const summary = {
      date,
      totalCalories: logs.reduce((sum, l) => sum + Number(l.calories), 0),
      totalProteinG: logs.reduce((sum, l) => sum + Number(l.proteinG || 0), 0),
      totalCarbsG: logs.reduce((sum, l) => sum + Number(l.carbsG || 0), 0),
      totalFatG: logs.reduce((sum, l) => sum + Number(l.fatG || 0), 0),
      mealCount: logs.length,
      breakdown: {
        breakfast: logs.filter((l) => l.mealType === "breakfast"),
        lunch: logs.filter((l) => l.mealType === "lunch"),
        dinner: logs.filter((l) => l.mealType === "dinner"),
        snack: logs.filter((l) => l.mealType === "snack"),
      },
    };
    res.json({ summary });
  } catch {
    res.status(500).json({ error: "Failed to fetch food summary" });
  }
});

export default router;
