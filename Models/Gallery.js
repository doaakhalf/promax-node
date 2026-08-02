import { Schema, model } from "mongoose";

// Gallery: one document per uploaded image, many documents per user (max enforced in service layer).
const GallerySchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Fast "list my gallery, newest first" queries.
GallerySchema.index({ userId: 1, createdAt: -1 });
// Enforces no-duplicate-image-per-user at the database level (defense in depth).
GallerySchema.index({ userId: 1, imageUrl: 1 }, { unique: true });

export default model("Gallery", GallerySchema);
