import { Schema, model } from "mongoose";

const exerciseSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    nameEn: {
      type: String,
      required: true,
    },
    nameAr: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
    },
    targetBodyParts: {
      type: [String],
      required: true,
    },
    descriptionEn: {
      type: String,
      default: null,
    },
    descriptionAr: {
      type: String,
      default: null,
    },
    image: {
      type: String,
      required: true,
    },
    videoUrl: {
      type: String,
      default: null,
    },
    source: {
      type: String,
      default: "coachcreator",
    },
    // Only set for imported exercises (e.g. ExerciseDB). Omit for coach-created ones.
    // Do NOT use default: null — Mongo unique indexes treat multiple nulls as duplicates
    // even with sparse:true when the field is present.
    externalId: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

exerciseSchema.index({ userId: 1 });
// Unique only when externalId is a real string (imports). Coach creates omit the field.
exerciseSchema.index(
  { externalId: 1 },
  {
    unique: true,
    partialFilterExpression: { externalId: { $type: "string" } },
  }
);

export default model("Exercise", exerciseSchema);
