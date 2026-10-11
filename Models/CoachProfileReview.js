import { Schema, model } from "mongoose";

const userSnapshotSchema = new Schema(
  {
    firstName: { type: String, default: null },
    lastName: { type: String, default: null },
    email: { type: String, default: null },
    gender: { type: String, default: null },
    phoneNumber: { type: String, default: null },
    profileImage: { type: String, default: null },
  },
  { _id: false }
);

const coachSnapshotSchema = new Schema(
  {
    headline: { type: String, default: null },
    introduction: { type: String, default: null },
    sport: { type: String, default: null },
    trainingExperience: { type: String, default: null },
    yearOfExperience: { type: Number, default: null },
    motivation: { type: String, default: null },
    videoUrl: { type: String, default: null },
    monthlyPriceEgp: { type: Number, default: null },
    instapayLink: { type: String, default: null },
    walletNumber: { type: String, default: null },
  },
  { _id: false }
);

const certificateSnapshotSchema = new Schema(
  {
    existingId: { type: Schema.Types.ObjectId, default: null },
    name: { type: String, default: null },
    year: { type: Number, default: null },
    image: { type: String, default: null },
  },
  { _id: false }
);

const achievementSnapshotSchema = new Schema(
  {
    existingId: { type: Schema.Types.ObjectId, default: null },
    name: { type: String, default: null },
    rank: { type: String, default: null },
    image: { type: String, default: null },
  },
  { _id: false }
);

const galleryAddSchema = new Schema(
  {
    imageUrl: { type: String, required: true },
    fileName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    mimeType: { type: String, default: "image/webp" },
  },
  { _id: false }
);

const CoachProfileReviewSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    coachId: {
      type: Schema.Types.ObjectId,
      ref: "Coach",
      required: true,
    },
    status: {
      type: String,
      enum: ["in_review", "approved", "rejected"],
      default: "in_review",
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    proposedUser: {
      type: userSnapshotSchema,
      required: true,
    },
    proposedCoach: {
      type: coachSnapshotSchema,
      required: true,
    },
    certificates: {
      type: [certificateSnapshotSchema],
      default: [],
    },
    achievements: {
      type: [achievementSnapshotSchema],
      default: [],
    },
    galleryAdds: {
      type: [galleryAddSchema],
      default: [],
    },
    galleryRemoveIds: {
      type: [Schema.Types.ObjectId],
      default: [],
    },
  },
  { timestamps: true }
);

CoachProfileReviewSchema.index({ status: 1, submittedAt: -1 });
CoachProfileReviewSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { status: "in_review" } }
);

export default model("CoachProfileReview", CoachProfileReviewSchema);
