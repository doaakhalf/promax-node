import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { connectToMongo, disconnectFromMongo } from "../db.js";
import registerModels from "../registerModels.js";
import FoodItem from "../Models/FoodItem.js";
import MealTemplate from "../Models/MealTemplate.js";

const seedPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "trainify_food_library_seed_ar_eg (1).json"
);

async function upsertFood(food) {
  const existing = await FoodItem.findOne({ seedId: food.id });
  const payload = {
    seedId: food.id,
    source: "library",
    nameAr: String(food.nameAr || "").trim(),
    nameEn: food.nameEn ? String(food.nameEn).trim() : null,
    mealType: food.mealType,
    nutritionPer100g: {
      calories: Number(food.nutritionPer100g.calories),
      protein: Number(food.nutritionPer100g.protein),
      carbs: Number(food.nutritionPer100g.carbs),
      fat: Number(food.nutritionPer100g.fat),
    },
    defaultServingGrams: Number(food.defaultServingGrams),
    tags: Array.isArray(food.tags) ? food.tags : [],
    image: null,
    isActive: existing ? existing.isActive : food.isActive !== false,
  };
  await FoodItem.findOneAndUpdate(
    { seedId: food.id },
    { $set: payload, $unset: { userId: 1 } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );
}

async function seedNutritionLibrary() {
  const raw = JSON.parse(fs.readFileSync(seedPath, "utf8"));
  await connectToMongo();
  registerModels();

  for (const food of raw.foods) {
    await upsertFood(food);
  }

  const foods = await FoodItem.find({ seedId: { $type: "string" } }).select("_id seedId");
  const foodIds = new Map(foods.map((food) => [food.seedId, food._id]));

  for (const meal of raw.mealTemplates) {
    const ingredients = meal.ingredients.map((row) => {
      const foodId = foodIds.get(row.foodId);
      if (!foodId) {
        throw new Error(`Meal ${meal.id} references missing food ${row.foodId}`);
      }
      return { foodId, quantityGrams: Number(row.quantityGrams) };
    });
    const existing = await MealTemplate.findOne({ seedId: meal.id });
    const payload = {
      seedId: meal.id,
      source: "library",
      name: String(meal.name || "").trim(),
      description: meal.description || "",
      image: meal.image || null,
      imageSource: meal.imageSource || null,
      mealType: meal.mealType,
      goal: meal.goal,
      ingredients,
      coachNote: meal.coachNote || "",
      isActive: existing ? existing.isActive : meal.isActive !== false,
    };
    await MealTemplate.findOneAndUpdate(
      { seedId: meal.id },
      { $set: payload, $unset: { userId: 1 } },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
  }

  const [foodCount, mealCount] = await Promise.all([
    FoodItem.countDocuments({ source: "library" }),
    MealTemplate.countDocuments({ source: "library" }),
  ]);
  console.log(`Nutrition library ready: ${foodCount} foods, ${mealCount} meals`);
}

seedNutritionLibrary()
  .then(async () => {
    await disconnectFromMongo();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err);
    try {
      await disconnectFromMongo();
    } catch {
      // ignore
    }
    process.exit(1);
  });
