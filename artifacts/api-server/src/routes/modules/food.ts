import { Router } from "express";
import { db, foodLogsTable, foodItemsTable, foodScanCacheTable, userProfilesTable } from "@workspace/db";
import { eq, and, gte, lte, ilike, desc, sql } from "drizzle-orm";
import { requireAuth } from "../../middlewares/user-auth";
import type { AuthRequest } from "../../middlewares/user-auth";
import { callAI } from "../../lib/ai";
import { getWeatherContext } from "../../lib/weather";

const router = Router();

// ── Food Logs ──────────────────────────────────────────────────────────────────
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
    if (!foodNameEn || !calories) {
      res.status(400).json({ error: "foodNameEn and calories are required" });
      return;
    }
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
      .where(and(eq(foodLogsTable.id, String(req.params.id)), eq(foodLogsTable.userId, req.userId!)));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete food log" });
  }
});

// ── DB Search ─────────────────────────────────────────────────────────────────
router.get("/food/search", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { q, limit = "15" } = req.query as { q: string; limit?: string };
    if (!q || q.length < 2) { res.json({ items: [] }); return; }
    const items = await db.select().from(foodItemsTable)
      .where(ilike(foodItemsTable.foodNameEn, `%${q}%`))
      .limit(parseInt(limit));
    res.json({ items });
  } catch {
    res.status(500).json({ error: "Food search failed" });
  }
});

// ── Personal History Search (search in user's own logs — ZERO AI cost) ───────
router.get("/food/history-search", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { q } = req.query as { q: string };
    if (!q || q.length < 1) { res.json({ items: [] }); return; }

    // Get distinct foods from user's history matching the query
    const rows = await db.select({
      foodNameEn: foodLogsTable.foodNameEn,
      calories: sql<number>`AVG(${foodLogsTable.calories}::numeric)`.as("calories"),
      proteinG: sql<number>`AVG(${foodLogsTable.proteinG}::numeric)`.as("proteinG"),
      carbsG: sql<number>`AVG(${foodLogsTable.carbsG}::numeric)`.as("carbsG"),
      fatG: sql<number>`AVG(${foodLogsTable.fatG}::numeric)`.as("fatG"),
      fiberG: sql<number>`AVG(${foodLogsTable.fiberG}::numeric)`.as("fiberG"),
      count: sql<number>`COUNT(*)`.as("count"),
      lastEaten: sql<Date>`MAX(${foodLogsTable.loggedAt})`.as("lastEaten"),
    })
      .from(foodLogsTable)
      .where(and(
        eq(foodLogsTable.userId, req.userId!),
        ilike(foodLogsTable.foodNameEn, `%${q}%`)
      ))
      .groupBy(foodLogsTable.foodNameEn)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(10);

    res.json({ items: rows });
  } catch {
    res.status(500).json({ error: "History search failed" });
  }
});

// ── Favorites — top 12 most frequently eaten foods ────────────────────────────
router.get("/food/favorites", requireAuth, async (req: AuthRequest, res) => {
  try {
    const rows = await db.select({
      foodNameEn: foodLogsTable.foodNameEn,
      calories: sql<number>`AVG(${foodLogsTable.calories}::numeric)`.as("calories"),
      proteinG: sql<number>`AVG(${foodLogsTable.proteinG}::numeric)`.as("proteinG"),
      carbsG: sql<number>`AVG(${foodLogsTable.carbsG}::numeric)`.as("carbsG"),
      fatG: sql<number>`AVG(${foodLogsTable.fatG}::numeric)`.as("fatG"),
      fiberG: sql<number>`AVG(${foodLogsTable.fiberG}::numeric)`.as("fiberG"),
      count: sql<number>`COUNT(*)`.as("count"),
      lastEaten: sql<Date>`MAX(${foodLogsTable.loggedAt})`.as("lastEaten"),
    })
      .from(foodLogsTable)
      .where(eq(foodLogsTable.userId, req.userId!))
      .groupBy(foodLogsTable.foodNameEn)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(12);

    res.json({ favorites: rows });
  } catch {
    res.status(500).json({ error: "Failed to get favorites" });
  }
});

// ── AI Food Scan — 4-level lookup: History → DB → AI-Cache → Gemini AI ───────
// This is the core of AI cost reduction: personal history is checked FIRST
router.post("/food/scan", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { foodName, imageBase64, mimeType } = req.body as { foodName?: string; imageBase64?: string; mimeType?: string };
    const searchTerm = foodName?.toLowerCase().trim();

    if (!searchTerm && !imageBase64) {
      res.status(400).json({ error: "foodName or imageBase64 is required" });
      return;
    }

    // ── Level 1: Personal History (ZERO AI cost — fastest) ──────────────────
    if (searchTerm) {
      const [historyMatch] = await db.select({
        foodNameEn: foodLogsTable.foodNameEn,
        calories: sql<number>`AVG(${foodLogsTable.calories}::numeric)`.as("calories"),
        proteinG: sql<number>`AVG(${foodLogsTable.proteinG}::numeric)`.as("proteinG"),
        carbsG: sql<number>`AVG(${foodLogsTable.carbsG}::numeric)`.as("carbsG"),
        fatG: sql<number>`AVG(${foodLogsTable.fatG}::numeric)`.as("fatG"),
        fiberG: sql<number>`AVG(${foodLogsTable.fiberG}::numeric)`.as("fiberG"),
        count: sql<number>`COUNT(*)`.as("count"),
      })
        .from(foodLogsTable)
        .where(and(
          eq(foodLogsTable.userId, req.userId!),
          ilike(foodLogsTable.foodNameEn, searchTerm)
        ))
        .groupBy(foodLogsTable.foodNameEn)
        .limit(1);

      if (historyMatch) {
        res.json({
          result: {
            foodNameEn: historyMatch.foodNameEn,
            calories: Math.round(Number(historyMatch.calories)),
            proteinG: Math.round(Number(historyMatch.proteinG || 0) * 10) / 10,
            carbsG: Math.round(Number(historyMatch.carbsG || 0) * 10) / 10,
            fatG: Math.round(Number(historyMatch.fatG || 0) * 10) / 10,
            fiberG: Math.round(Number(historyMatch.fiberG || 0) * 10) / 10,
            servingSizeG: 100,
            servingDescription: "100g / 1 serving",
            category: "food",
            dietaryTags: [],
            vitamins: {},
            healthTip: `You have eaten this ${historyMatch.count} times before — data loaded from your history.`,
          },
          fromHistory: true,
          fromDb: false,
          fromCache: false,
          historyCount: Number(historyMatch.count),
        }); return;
      }

      // ── Level 2: Main Curated DB ─────────────────────────────────────────
      const [dbItem] = await db.select().from(foodItemsTable)
        .where(ilike(foodItemsTable.foodNameEn, `%${searchTerm}%`))
        .limit(1);

      if (dbItem) {
        res.json({
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
          fromHistory: false,
          fromCache: false,
        }); return;
      }

      // ── Level 3: AI-Discovered Foods Cache (saved from previous AI calls) ─
      const [cached] = await db.select().from(foodScanCacheTable)
        .where(ilike(foodScanCacheTable.foodNameEn, searchTerm));
      if (cached) {
        await db.update(foodScanCacheTable)
          .set({ hitCount: cached.hitCount + 1, lastUsedAt: new Date() })
          .where(eq(foodScanCacheTable.id, cached.id));
        res.json({ result: cached.aiResult, fromCache: true, fromDb: false, fromHistory: false, hitCount: cached.hitCount + 1 }); return;
      }
    }

    // ── Level 4: AI fallback ──────────────────────────────────────────────────
    // Text search → NVIDIA LLaMA 3.3 70B (fast, no quota issues)
    // Image scan → Gemini (vision support needed, food images only, no personal data)
    let result: Record<string, unknown>;

    if (searchTerm) {
      const prompt = `You are a certified Indian dietitian. The user typed "${searchTerm}" — this could be in Hindi, Hinglish, regional language or English. Identify the food and provide complete nutrition data.

Return ONLY a valid JSON object (no markdown) with these exact fields:
{
  "foodNameEn": "string (English name of the food)",
  "calories": number (per 100g),
  "proteinG": number,
  "carbsG": number,
  "fatG": number,
  "fiberG": number,
  "sodiumMg": number,
  "sugarG": number,
  "servingSizeG": number,
  "servingDescription": "string (e.g. 1 bowl = 200g)",
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
  "healthTip": "1 sentence health tip in Hinglish"
}`;

      const jsonStr = await callAI("food_ai", [{ role: "user", content: prompt }], { maxTokens: 1500, temperature: 0.3 });
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : { foodNameEn: searchTerm, calories: 100, proteinG: 0, carbsG: 25, fatG: 2, fiberG: 0, servingSizeG: 100, servingDescription: "100g", category: "food", dietaryTags: [], vitamins: {} };
    } else if (imageBase64) {
      // Image-based food scan — Gemini only (NVIDIA LLaMA does not support vision)
      const geminiKey = process.env["GOOGLE_GEMINI_API_KEY"];
      if (!geminiKey) { res.status(503).json({ error: "Image AI service not configured" }); return; }

      const promptText = `You are a certified Indian dietitian. Identify this food from the image and provide complete nutrition data. Return ONLY valid JSON with: foodNameEn, calories (per 100g), proteinG, carbsG, fatG, fiberG, sodiumMg, sugarG, servingSizeG, servingDescription, category, dietaryTags (array), vitamins (object with vitaminA_mcg, vitaminC_mg, vitaminD_mcg, vitaminB12_mcg, iron_mg, calcium_mg, potassium_mg, zinc_mg), glycemicIndex, healthTip.`;
      const geminiBody = { contents: [{ parts: [{ text: promptText }, { inline_data: { mime_type: mimeType || "image/jpeg", data: imageBase64 } }] }] };
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(geminiBody) }
      );
      const geminiData = await geminiRes.json() as { candidates?: Array<{ content: { parts: Array<{ text: string }> } }> };
      const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : { foodNameEn: "Unknown Food", calories: 100, proteinG: 0, carbsG: 25, fatG: 2, fiberG: 0, servingSizeG: 100, servingDescription: "100g", category: "food", dietaryTags: [], vitamins: {} };
    } else {
      res.status(400).json({ error: "searchTerm or imageBase64 required" }); return;
    }

    // Save to AI-discovered foods cache so it's NEVER called again for this food
    if (searchTerm) {
      await db.insert(foodScanCacheTable).values({
        foodNameEn: searchTerm,
        aiResult: result,
      }).onConflictDoNothing();
    }

    res.json({ result, fromCache: false, fromDb: false, fromHistory: false });
  } catch (err) {
    console.error("Food scan error:", err);
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
    };
    res.json({ summary });
  } catch {
    res.status(500).json({ error: "Failed to fetch food summary" });
  }
});

// ── Weather-based Food Suggestions ───────────────────────────────────────────
router.post("/food/weather-suggestions", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { city, state } = req.body as { city?: string; state?: string };

    const [profile] = await db
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.userId, req.userId!))
      .limit(1);

    const profileData = profile as unknown as Record<string, string>;
    const userCity = profileData?.city ?? city ?? "India";
    const userState = profileData?.state ?? state ?? "";

    const weather = await getWeatherContext(userCity, userState || undefined);

    const prompt = `You are a certified Indian dietitian. Based on the current weather and season, suggest 6 ideal Indian foods for an Indian person.

Weather & Season Context: ${weather}

Return ONLY valid JSON:
{
  "weatherContext": "short description of current weather/season",
  "season": "Winter|Summer|Monsoon|Autumn",
  "suggestions": [
    {
      "name": "Food name in English",
      "nameHindi": "Hindi name",
      "emoji": "single food emoji",
      "reason": "Why this food is ideal right now (1 sentence in Hinglish)",
      "calories": number,
      "benefit": "Main health benefit",
      "category": "breakfast|lunch|dinner|snack|beverage",
      "isSeasonalSpecial": true
    }
  ],
  "weatherTip": "1 practical weather-appropriate health tip in Hinglish"
}`;

    try {
      const jsonStr = await callAI("food_ai", [{ role: "user", content: prompt }], { maxTokens: 1200 });
      const result = JSON.parse(jsonStr);
      res.json({ ...result, weatherContext: weather });
    } catch {
      const month = new Date().getMonth() + 1;
      let season = "Autumn";
      let suggestions: unknown[] = [];

      if ([12, 1, 2].includes(month)) {
        season = "Winter";
        suggestions = [
          { name: "Sarson Ka Saag", nameHindi: "सरसों का साग", emoji: "🥬", reason: "Sardiyon mein body ko warm rakhta hai", calories: 120, benefit: "Iron & Vitamin A", category: "lunch", isSeasonalSpecial: true },
          { name: "Makki Di Roti", nameHindi: "मक्की की रोटी", emoji: "🌽", reason: "Winter mein energy deta hai", calories: 180, benefit: "Complex carbs", category: "lunch", isSeasonalSpecial: true },
          { name: "Tilgud Laddoo", nameHindi: "तिलगुड लड्डू", emoji: "🍡", reason: "Sesame body ko warm karta hai", calories: 220, benefit: "Calcium & healthy fats", category: "snack", isSeasonalSpecial: true },
          { name: "Masala Chai", nameHindi: "मसाला चाय", emoji: "☕", reason: "Adrak aur elaichi sardiyon mein best hain", calories: 60, benefit: "Anti-inflammatory ginger", category: "beverage", isSeasonalSpecial: true },
          { name: "Gajar Halwa", nameHindi: "गाजर का हलवा", emoji: "🥕", reason: "Carrots are peak in winter, Vitamin A se bhare", calories: 300, benefit: "Vitamin A & antioxidants", category: "snack", isSeasonalSpecial: true },
          { name: "Moong Dal Khichdi", nameHindi: "मूंग दाल खिचड़ी", emoji: "🍲", reason: "Easy to digest, winter mein body ko sustain karta hai", calories: 280, benefit: "Protein & minerals", category: "dinner", isSeasonalSpecial: false },
        ];
      } else if ([3, 4, 5].includes(month)) {
        season = "Summer";
        suggestions = [
          { name: "Aam Panna", nameHindi: "आम पन्ना", emoji: "🥭", reason: "Garmi mein heatstroke se bachata hai", calories: 80, benefit: "Electrolytes & Vitamin C", category: "beverage", isSeasonalSpecial: true },
          { name: "Lassi", nameHindi: "लस्सी", emoji: "🥛", reason: "Body ko cool rakhti hai", calories: 150, benefit: "Probiotics & calcium", category: "beverage", isSeasonalSpecial: true },
          { name: "Watermelon / Tarbuz", nameHindi: "तरबूज", emoji: "🍉", reason: "95% paani, body hydrated rakhta hai", calories: 30, benefit: "Hydration & lycopene", category: "snack", isSeasonalSpecial: true },
          { name: "Coconut Water", nameHindi: "नारियल पानी", emoji: "🥥", reason: "Natural electrolytes, garmi mein best", calories: 45, benefit: "Potassium & hydration", category: "beverage", isSeasonalSpecial: true },
          { name: "Raita", nameHindi: "रायता", emoji: "🥗", reason: "Dahi body ko andar se thanda karta hai", calories: 90, benefit: "Probiotics & cooling", category: "lunch", isSeasonalSpecial: true },
          { name: "Sattu Sharbat", nameHindi: "सत्तू शर्बत", emoji: "🧊", reason: "Bihar-UP mein garmi ka traditional drink", calories: 120, benefit: "Protein & energy", category: "beverage", isSeasonalSpecial: true },
        ];
      } else if ([6, 7, 8, 9].includes(month)) {
        season = "Monsoon";
        suggestions = [
          { name: "Khichdi", nameHindi: "खिचड़ी", emoji: "🍲", reason: "Monsoon mein digestive system ke liye best", calories: 280, benefit: "Easy to digest & warming", category: "dinner", isSeasonalSpecial: true },
          { name: "Ginger Tea", nameHindi: "अदरक की चाय", emoji: "☕", reason: "Immunity boost karta hai barsaat mein", calories: 50, benefit: "Anti-inflammatory", category: "beverage", isSeasonalSpecial: true },
          { name: "Haldi Doodh", nameHindi: "हल्दी दूध", emoji: "🥛", reason: "Infection se bachata hai monsoon mein", calories: 120, benefit: "Immunity & anti-bacterial", category: "beverage", isSeasonalSpecial: true },
          { name: "Corn Bhutta", nameHindi: "भुट्टा", emoji: "🌽", reason: "Barsaat aur bhutta — classic Indian combo!", calories: 130, benefit: "Fiber & antioxidants", category: "snack", isSeasonalSpecial: true },
          { name: "Pakora", nameHindi: "पकोड़ा", emoji: "🍘", reason: "Baarish mein pakoda — ultimate comfort food", calories: 200, benefit: "Energy boost (occasionally)", category: "snack", isSeasonalSpecial: true },
          { name: "Moong Dal Soup", nameHindi: "मूंग दाल सूप", emoji: "🍵", reason: "Light aur nutritious, monsoon mein digestion easy", calories: 150, benefit: "Protein & easy digestion", category: "dinner", isSeasonalSpecial: true },
        ];
      } else {
        season = "Autumn";
        suggestions = [
          { name: "Pomegranate", nameHindi: "अनार", emoji: "🍎", reason: "Sharad mein blood purifier, peak season", calories: 80, benefit: "Iron & antioxidants", category: "snack", isSeasonalSpecial: true },
          { name: "Guava", nameHindi: "अमरूद", emoji: "🍐", reason: "Vitamin C se bhara, immunity badhata hai", calories: 60, benefit: "Vitamin C & fiber", category: "snack", isSeasonalSpecial: true },
          { name: "Apple", nameHindi: "सेब", emoji: "🍏", reason: "Sharad mein fresh apples available, ek roz ka doctor dur", calories: 80, benefit: "Fiber & quercetin", category: "snack", isSeasonalSpecial: true },
          { name: "Pumpkin Sabzi", nameHindi: "कद्दू की सब्जी", emoji: "🎃", reason: "Seasonal vegetable, kaafi nutritious hai", calories: 90, benefit: "Beta-carotene & fiber", category: "dinner", isSeasonalSpecial: true },
          { name: "Bajra Roti", nameHindi: "बाजरे की रोटी", emoji: "🫓", reason: "Winter shuru hoti hai, bajra body warm rakhta hai", calories: 170, benefit: "Iron & magnesium", category: "lunch", isSeasonalSpecial: false },
          { name: "Moong Dal Khichdi", nameHindi: "मूंग दाल खिचड़ी", emoji: "🍲", reason: "Light aur nutritious, autumn mein digestive health", calories: 250, benefit: "Protein & minerals", category: "lunch", isSeasonalSpecial: false },
        ];
      }

      res.json({
        weatherContext: weather,
        season,
        suggestions,
        weatherTip: "Mausam ke hisaab se khana khao — seasonal foods sabse zyada nutritious hote hain! 🌿",
        fallback: true,
      });
    }
  } catch (err) {
    console.error("Weather suggestions error:", err);
    res.status(500).json({ error: "Failed to get weather suggestions" });
  }
});

export default router;
