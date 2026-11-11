import { Schema, model } from "mongoose";

const nutritionPer100gSchema = new Schema(
  {
    calories: { type: Number, required: true },
    protein: { type: Number, required: true },
    carbs: { type: Number, required: true },
    fat: { type: Number, required: true },
  },
  { _id: false }
);

const foodItemSchema = new Schema(
  {
    seedId: { type: String },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    source: {
      type: String,
      enum: ["library", "coach"],
      required: true,
    },
    nameAr: { type: String, required: true, trim: true },
    nameEn: { type: String, default: null, trim: true },
    mealType: {
      type: String,
      enum: ["breakfast", "lunch", "dinner", "snack"],
      required: true,
    },
    nutritionPer100g: { type: nutritionPer100gSchema, required: true },
    defaultServingGrams: { type: Number, required: true },
    tags: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    image: { type: String, default: null },
  },
  { timestamps: true }
);

foodItemSchema.index(
  { seedId: 1 },
  { unique: true, partialFilterExpression: { seedId: { $type: "string" } } }
);
foodItemSchema.index({ userId: 1, source: 1 });
foodItemSchema.index({ source: 1, isActive: 1, mealType: 1 });

export default model("FoodItem", foodItemSchema);
