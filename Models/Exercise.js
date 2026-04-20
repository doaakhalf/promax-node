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
  },
  {
    timestamps: true,
  }
);

exerciseSchema.index({ userId: 1 });

export default model("Exercise", exerciseSchema);
