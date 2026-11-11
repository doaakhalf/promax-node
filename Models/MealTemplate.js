import { Schema, model } from "mongoose";

const ingredientSchema = new Schema(
  {
    foodId: { type: Schema.Types.ObjectId, ref: "FoodItem", required: true },
    quantityGrams: { type: Number, required: true },
  },
  { _id: false }
);

const mealTemplateSchema = new Schema(
  {
    seedId: { type: String },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    source: {
      type: String,
      enum: ["library", "coach"],
      required: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    image: { type: String, default: null },
    imageSource: { type: String, default: null },
    mealType: {
      type: String,
      enum: ["breakfast", "lunch", "dinner", "snack"],
      required: true,
    },
    goal: {
      type: String,
      enum: ["cutting", "bulking", "maintenance"],
      required: true,
    },
    ingredients: { type: [ingredientSchema], required: true },
    coachNote: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

mealTemplateSchema.index(
  { seedId: 1 },
  { unique: true, partialFilterExpression: { seedId: { $type: "string" } } }
);
mealTemplateSchema.index({ userId: 1, source: 1 });
mealTemplateSchema.index({ source: 1, isActive: 1, mealType: 1, goal: 1 });

export default model("MealTemplate", mealTemplateSchema);
