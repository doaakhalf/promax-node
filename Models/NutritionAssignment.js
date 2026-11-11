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

const itemSchema = new Schema(
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

const mealSchema = new Schema(
  {
    mealTemplateId: { type: Schema.Types.ObjectId, default: null },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    mealType: { type: String, required: true },
    coachNote: { type: String, default: "" },
    image: { type: String, default: null },
    items: { type: [itemSchema], default: [] },
    totals: { type: macroSchema, default: () => ({}) },
  },
  { _id: false }
);

const daySchema = new Schema(
  {
    dayNumber: { type: Number, required: true },
    note: { type: String, default: "" },
    meals: { type: [mealSchema], default: [] },
    totals: { type: macroSchema, default: () => ({}) },
  },
  { _id: false }
);

const nutritionAssignmentSchema = new Schema(
  {
    subscriptionId: { type: Schema.Types.ObjectId, ref: "Subscription", required: true },
    coachId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    athleteId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sourcePlanId: { type: Schema.Types.ObjectId, ref: "NutritionPlan", default: null },
    name: { type: String, required: true },
    goal: { type: String, required: true },
    targetCalories: { type: Number, default: null },
    days: { type: [daySchema], required: true },
    totals: { type: macroSchema, default: () => ({}) },
    assignedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

nutritionAssignmentSchema.index({ subscriptionId: 1 }, { unique: true });

export default model("NutritionAssignment", nutritionAssignmentSchema);
