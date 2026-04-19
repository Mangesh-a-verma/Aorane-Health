/**
 * AORANE — New Foods Seed Database
 *
 * This file is SEPARATE from the original 1,101 curated Indian foods
 * (which are seeded via the startup migration SQL statements).
 *
 * Add newly curated foods HERE so original data stays clean and auditable.
 *
 * Format must match food_items table:
 *   food_name_en  — English name (unique key)
 *   category      — vegetable / fruit / grain / protein / dairy / legume / fat / snack / beverage / sweet / spice
 *   cuisine_type  — indian / global
 *   calories      — per 100g
 *   protein_g     — grams per 100g
 *   carbs_g       — grams per 100g
 *   fat_g         — grams per 100g
 *   fiber_g       — grams per 100g
 *   sodium_mg     — mg per 100g (optional)
 *   potassium_mg  — mg per 100g (optional)
 *   calcium_mg    — mg per 100g (optional)
 *   iron_mg       — mg per 100g (optional)
 *   vitamin_c_mg  — mg per 100g (optional)
 *   serving_size_g  — typical serving in grams
 *   serving_description — e.g. "1 medium fruit", "1 tbsp"
 *   dietary_tags  — array: vegetarian / vegan / gluten-free / high-protein / high-fiber / low-fat / etc.
 *   is_global     — true for non-Indian foods
 */

export type NewFood = {
  foodNameEn: string;
  category: string;
  cuisineType: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sodiumMg?: number;
  potassiumMg?: number;
  calciumMg?: number;
  ironMg?: number;
  vitaminCMg?: number;
  vitaminDMcg?: number;
  servingSizeG: number;
  servingDescription: string;
  dietaryTags: string[];
  isGlobal?: boolean;
};

export const newFoods: NewFood[] = [
  // ── FRUITS (gap in original DB) ─────────────────────────────────────────────
  {
    foodNameEn: "Mango",
    category: "fruit", cuisineType: "indian",
    calories: 60, proteinG: 0.82, carbsG: 14.98, fatG: 0.38, fiberG: 1.6,
    sodiumMg: 1, potassiumMg: 168, calciumMg: 11, ironMg: 0.16, vitaminCMg: 36.4,
    servingSizeG: 150, servingDescription: "1 medium mango (150g)",
    dietaryTags: ["vegetarian", "vegan", "gluten-free"],
  },
  {
    foodNameEn: "Banana",
    category: "fruit", cuisineType: "indian",
    calories: 89, proteinG: 1.09, carbsG: 22.84, fatG: 0.33, fiberG: 2.6,
    sodiumMg: 1, potassiumMg: 358, calciumMg: 5, ironMg: 0.26, vitaminCMg: 8.7,
    servingSizeG: 118, servingDescription: "1 medium banana (118g)",
    dietaryTags: ["vegetarian", "vegan", "gluten-free", "high-fiber"],
  },
  {
    foodNameEn: "Papaya",
    category: "fruit", cuisineType: "indian",
    calories: 43, proteinG: 0.47, carbsG: 10.82, fatG: 0.26, fiberG: 1.7,
    sodiumMg: 8, potassiumMg: 182, calciumMg: 20, ironMg: 0.25, vitaminCMg: 60.9,
    servingSizeG: 145, servingDescription: "1 cup papaya (145g)",
    dietaryTags: ["vegetarian", "vegan", "gluten-free", "low-fat"],
  },
  {
    foodNameEn: "Guava",
    category: "fruit", cuisineType: "indian",
    calories: 68, proteinG: 2.55, carbsG: 14.32, fatG: 0.95, fiberG: 5.4,
    sodiumMg: 2, potassiumMg: 417, calciumMg: 18, ironMg: 0.26, vitaminCMg: 228.3,
    servingSizeG: 100, servingDescription: "1 medium guava (100g)",
    dietaryTags: ["vegetarian", "vegan", "gluten-free", "high-fiber"],
  },
  {
    foodNameEn: "Watermelon",
    category: "fruit", cuisineType: "indian",
    calories: 30, proteinG: 0.61, carbsG: 7.55, fatG: 0.15, fiberG: 0.4,
    sodiumMg: 1, potassiumMg: 112, calciumMg: 7, ironMg: 0.24, vitaminCMg: 8.1,
    servingSizeG: 280, servingDescription: "2 cups diced watermelon (280g)",
    dietaryTags: ["vegetarian", "vegan", "gluten-free", "low-fat"],
  },
  {
    foodNameEn: "Pomegranate",
    category: "fruit", cuisineType: "indian",
    calories: 83, proteinG: 1.67, carbsG: 18.7, fatG: 1.17, fiberG: 4,
    sodiumMg: 3, potassiumMg: 236, calciumMg: 10, ironMg: 0.3, vitaminCMg: 10.2,
    servingSizeG: 87, servingDescription: "½ cup pomegranate seeds (87g)",
    dietaryTags: ["vegetarian", "vegan", "gluten-free"],
  },
  {
    foodNameEn: "Litchi",
    category: "fruit", cuisineType: "indian",
    calories: 66, proteinG: 0.83, carbsG: 16.53, fatG: 0.44, fiberG: 1.3,
    sodiumMg: 1, potassiumMg: 171, calciumMg: 5, ironMg: 0.31, vitaminCMg: 71.5,
    servingSizeG: 100, servingDescription: "10 litchis (100g)",
    dietaryTags: ["vegetarian", "vegan", "gluten-free"],
  },
  {
    foodNameEn: "Chikoo (Sapota)",
    category: "fruit", cuisineType: "indian",
    calories: 83, proteinG: 0.44, carbsG: 19.96, fatG: 1.1, fiberG: 5.3,
    potassiumMg: 193, calciumMg: 21, ironMg: 0.8, vitaminCMg: 14.7,
    servingSizeG: 100, servingDescription: "1 medium chikoo (100g)",
    dietaryTags: ["vegetarian", "vegan", "gluten-free", "high-fiber"],
  },

  // ── LEGUMES / DAL (gap in original DB) ─────────────────────────────────────
  {
    foodNameEn: "Moong Dal (Yellow Lentil)",
    category: "legume", cuisineType: "indian",
    calories: 347, proteinG: 23.86, carbsG: 62.62, fatG: 1.15, fiberG: 16.3,
    sodiumMg: 15, potassiumMg: 789, calciumMg: 132, ironMg: 6.74,
    servingSizeG: 30, servingDescription: "2 tbsp dry moong dal (30g)",
    dietaryTags: ["vegetarian", "vegan", "gluten-free", "high-protein", "high-fiber"],
  },
  {
    foodNameEn: "Chana Dal (Bengal Gram)",
    category: "legume", cuisineType: "indian",
    calories: 364, proteinG: 20.47, carbsG: 60.61, fatG: 5.01, fiberG: 17.4,
    sodiumMg: 24, potassiumMg: 846, calciumMg: 105, ironMg: 5.58,
    servingSizeG: 30, servingDescription: "2 tbsp dry chana dal (30g)",
    dietaryTags: ["vegetarian", "vegan", "gluten-free", "high-protein", "high-fiber"],
  },
  {
    foodNameEn: "Toor Dal (Pigeon Pea)",
    category: "legume", cuisineType: "indian",
    calories: 343, proteinG: 21.7, carbsG: 62.78, fatG: 1.49, fiberG: 15,
    sodiumMg: 17, potassiumMg: 1392, calciumMg: 130, ironMg: 5.23,
    servingSizeG: 30, servingDescription: "2 tbsp dry toor dal (30g)",
    dietaryTags: ["vegetarian", "vegan", "gluten-free", "high-protein"],
  },
  {
    foodNameEn: "Rajma (Kidney Beans)",
    category: "legume", cuisineType: "indian",
    calories: 333, proteinG: 23.58, carbsG: 60.01, fatG: 0.83, fiberG: 24.9,
    sodiumMg: 24, potassiumMg: 1406, calciumMg: 143, ironMg: 8.2,
    servingSizeG: 30, servingDescription: "2 tbsp dry rajma (30g)",
    dietaryTags: ["vegetarian", "vegan", "gluten-free", "high-protein", "high-fiber"],
  },
  {
    foodNameEn: "Kala Chana (Black Chickpea)",
    category: "legume", cuisineType: "indian",
    calories: 364, proteinG: 19.3, carbsG: 60.65, fatG: 6.04, fiberG: 17,
    sodiumMg: 24, potassiumMg: 875, calciumMg: 105, ironMg: 6.24,
    servingSizeG: 30, servingDescription: "2 tbsp dry kala chana (30g)",
    dietaryTags: ["vegetarian", "vegan", "gluten-free", "high-protein"],
  },
  {
    foodNameEn: "Masoor Dal (Red Lentil)",
    category: "legume", cuisineType: "indian",
    calories: 353, proteinG: 24.63, carbsG: 63.35, fatG: 1.06, fiberG: 10.7,
    sodiumMg: 6, potassiumMg: 677, calciumMg: 56, ironMg: 7.54,
    servingSizeG: 30, servingDescription: "2 tbsp dry masoor dal (30g)",
    dietaryTags: ["vegetarian", "vegan", "gluten-free", "high-protein"],
  },
  {
    foodNameEn: "Urad Dal (Black Gram)",
    category: "legume", cuisineType: "indian",
    calories: 341, proteinG: 25.21, carbsG: 58.99, fatG: 1.64, fiberG: 18.3,
    sodiumMg: 38, potassiumMg: 983, calciumMg: 138, ironMg: 7.57,
    servingSizeG: 30, servingDescription: "2 tbsp dry urad dal (30g)",
    dietaryTags: ["vegetarian", "vegan", "gluten-free", "high-protein", "high-fiber"],
  },

  // ── FATS & OILS (gap in original DB) ───────────────────────────────────────
  {
    foodNameEn: "Ghee (Clarified Butter)",
    category: "fat", cuisineType: "indian",
    calories: 900, proteinG: 0, carbsG: 0, fatG: 99.8, fiberG: 0,
    vitaminDMcg: 1.2,
    servingSizeG: 10, servingDescription: "1 tsp ghee (10g)",
    dietaryTags: ["vegetarian", "gluten-free", "high-fat"],
  },
  {
    foodNameEn: "Coconut Oil",
    category: "fat", cuisineType: "indian",
    calories: 892, proteinG: 0, carbsG: 0, fatG: 99.1, fiberG: 0,
    servingSizeG: 14, servingDescription: "1 tbsp coconut oil (14g)",
    dietaryTags: ["vegetarian", "vegan", "gluten-free", "high-fat"],
  },
  {
    foodNameEn: "Mustard Oil",
    category: "fat", cuisineType: "indian",
    calories: 884, proteinG: 0, carbsG: 0, fatG: 100, fiberG: 0,
    servingSizeG: 14, servingDescription: "1 tbsp mustard oil (14g)",
    dietaryTags: ["vegetarian", "vegan", "gluten-free"],
  },
  {
    foodNameEn: "Groundnut Oil (Peanut Oil)",
    category: "fat", cuisineType: "indian",
    calories: 884, proteinG: 0, carbsG: 0, fatG: 100, fiberG: 0,
    servingSizeG: 14, servingDescription: "1 tbsp groundnut oil (14g)",
    dietaryTags: ["vegetarian", "vegan", "gluten-free"],
  },
  {
    foodNameEn: "Sesame Oil (Til Oil)",
    category: "fat", cuisineType: "indian",
    calories: 884, proteinG: 0, carbsG: 0, fatG: 100, fiberG: 0,
    servingSizeG: 14, servingDescription: "1 tbsp sesame oil (14g)",
    dietaryTags: ["vegetarian", "vegan", "gluten-free"],
  },

  // ── GLOBAL FOODS (gap in original DB) ──────────────────────────────────────
  {
    foodNameEn: "Oats (Rolled)",
    category: "grain", cuisineType: "global",
    calories: 389, proteinG: 16.89, carbsG: 66.27, fatG: 6.9, fiberG: 10.6,
    sodiumMg: 2, potassiumMg: 429, calciumMg: 54, ironMg: 4.72,
    servingSizeG: 40, servingDescription: "½ cup dry oats (40g)",
    dietaryTags: ["vegetarian", "vegan", "high-protein", "high-fiber"],
    isGlobal: true,
  },
  {
    foodNameEn: "Whole Wheat Bread",
    category: "grain", cuisineType: "global",
    calories: 247, proteinG: 13, carbsG: 41.3, fatG: 3.4, fiberG: 6.8,
    sodiumMg: 400, potassiumMg: 248, calciumMg: 73, ironMg: 3.01,
    servingSizeG: 30, servingDescription: "1 slice (30g)",
    dietaryTags: ["vegetarian", "vegan", "high-fiber"],
    isGlobal: true,
  },
  {
    foodNameEn: "Boiled Egg",
    category: "protein", cuisineType: "global",
    calories: 155, proteinG: 12.58, carbsG: 1.12, fatG: 10.61, fiberG: 0,
    sodiumMg: 124, potassiumMg: 126, calciumMg: 50, ironMg: 1.19, vitaminDMcg: 2.0,
    servingSizeG: 50, servingDescription: "1 medium boiled egg (50g)",
    dietaryTags: ["gluten-free", "high-protein", "low-carb"],
    isGlobal: true,
  },
  {
    foodNameEn: "Greek Yogurt",
    category: "dairy", cuisineType: "global",
    calories: 59, proteinG: 10.19, carbsG: 3.6, fatG: 0.39, fiberG: 0,
    sodiumMg: 36, potassiumMg: 141, calciumMg: 111, ironMg: 0,
    servingSizeG: 150, servingDescription: "¾ cup Greek yogurt (150g)",
    dietaryTags: ["vegetarian", "gluten-free", "high-protein", "low-fat"],
    isGlobal: true,
  },
  {
    foodNameEn: "Almonds",
    category: "protein", cuisineType: "global",
    calories: 579, proteinG: 21.15, carbsG: 21.55, fatG: 49.93, fiberG: 12.5,
    sodiumMg: 1, potassiumMg: 733, calciumMg: 264, ironMg: 3.71, vitaminCMg: 0,
    servingSizeG: 28, servingDescription: "1 handful / 23 almonds (28g)",
    dietaryTags: ["vegetarian", "vegan", "gluten-free", "high-protein", "high-fiber"],
    isGlobal: true,
  },
];

/**
 * Returns SQL INSERT statements for all new foods.
 * Uses WHERE NOT EXISTS to safely re-run on server restart without needing a unique constraint.
 */
export function buildNewFoodSeedSQL(): string[] {
  return newFoods.map((f) => {
    const safeName = f.foodNameEn.replace(/'/g, "''");
    const tags = `ARRAY[${f.dietaryTags.map((t) => `'${t}'`).join(",")}]`;

    const numOrNull = (v: number | undefined) => v !== undefined ? v : "NULL";

    return `
      INSERT INTO food_items (
        food_name_en, category, cuisine_type,
        calories, protein_g, carbs_g, fat_g, fiber_g,
        sodium_mg, potassium_mg, calcium_mg, iron_mg,
        vitamin_c_mg, vitamin_d_mcg,
        serving_size_g, serving_description, dietary_tags,
        is_verified, added_by_admin, ai_generated, is_global, country_code
      )
      SELECT
        '${safeName}', '${f.category}', '${f.cuisineType}',
        ${f.calories}, ${f.proteinG}, ${f.carbsG}, ${f.fatG}, ${f.fiberG},
        ${numOrNull(f.sodiumMg)}, ${numOrNull(f.potassiumMg)},
        ${numOrNull(f.calciumMg)}, ${numOrNull(f.ironMg)},
        ${numOrNull(f.vitaminCMg)}, ${numOrNull(f.vitaminDMcg)},
        ${f.servingSizeG}, '${f.servingDescription.replace(/'/g, "''")}', ${tags},
        true, false, false,
        ${f.isGlobal ? "true" : "false"},
        '${f.isGlobal ? "GLOBAL" : "IN"}'
      WHERE NOT EXISTS (
        SELECT 1 FROM food_items WHERE food_name_en = '${safeName}'
      )
    `.trim();
  });
}
