import { Schema, model } from "mongoose";

const macroSchema = new Schema(
  {
    calories: { type: Number, default: 0 },
    protein: { type: Number, default: 0 },
    carbs: { type: Number, default: 0 },
    fat: { type: Number, default: 0 },
  },
  { _id: false }
);

const planItemSchema = new Schema(
  {
    foodId: { type: Schema.Types.ObjectId, ref: "FoodItem", default: null },
    nameAr: { type: String, required: true },
    nameEn: { type: String, default: null },
    quantityGrams: { type: Number, required: true },
    calories: { type: Number, required: true },
    protein: { type: Number, required: true },
    carbs: { type: Number, required: true },
    fat: { type: Number, required: true },
  },
  { _id: false }
);

const planMealSchema = new Schema(
  {
    mealTemplateId: { type: Schema.Types.ObjectId, ref: "MealTemplate", default: null },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    mealType: {
      type: String,
      enum: ["breakfast", "lunch", "dinner", "snack"],
      required: true,
    },
    coachNote: { type: String, default: "" },
    image: { type: String, default: null },
    items: { type: [planItemSchema], default: [] },
    totals: { type: macroSchema, default: () => ({}) },
  },
  { _id: false }
);

const planDaySchema = new Schema(
  {
    dayNumber: { type: Number, required: true, min: 1, max: 7 },
    note: { type: String, default: "" },
    meals: { type: [planMealSchema], default: [] },
    totals: { type: macroSchema, default: () => ({}) },
  },
  { _id: false }
);

const nutritionPlanSchema = new Schema(
  {
    coachId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true },
    goal: {
      type: String,
      enum: ["cutting", "bulking", "maintenance"],
      required: true,
    },
    targetCalories: { type: Number, default: null },
    isTemplate: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["draft", "assigned"],
      default: "draft",
    },
    days: { type: [planDaySchema], required: true },
    totals: { type: macroSchema, default: () => ({}) },
  },
  { timestamps: true }
);

nutritionPlanSchema.index({ coachId: 1, isTemplate: 1, updatedAt: -1 });

export default model("NutritionPlan", nutritionPlanSchema);
