import { Schema, model } from "mongoose";

const publishedSchema = new Schema(
  {
    url: { type: String, required: true },
    fileName: { type: String, required: true },
    durationSeconds: { type: Number, required: true },
    sizeBytes: { type: Number, required: true },
    approvedAt: { type: Date, default: null },
  },
  { _id: false }
);

const submissionSchema = new Schema(
  {
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "changes_requested"],
      required: true,
    },
    url: { type: String, required: true },
    fileName: { type: String, required: true },
    durationSeconds: { type: Number, required: true },
    sizeBytes: { type: Number, required: true },
    submittedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reason: { type: String, default: null },
    needsTranscode: { type: Boolean, default: false },
    transcodeAttempts: { type: Number, default: 0 },
  },
  { _id: false }
);

const CoachIntroVideoSchema = new Schema(
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
    published: {
      type: publishedSchema,
      default: null,
    },
    submission: {
      type: submissionSchema,
      default: null,
    },
  },
  { timestamps: true }
);

CoachIntroVideoSchema.index({ userId: 1 }, { unique: true });
CoachIntroVideoSchema.index({ "submission.status": 1, "submission.submittedAt": -1 });

export default model("CoachIntroVideo", CoachIntroVideoSchema);
