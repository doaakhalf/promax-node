import { Schema, model } from "mongoose";

const certificateSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  certificateName: {
    type: String,
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  certificateImage: {
    type: String,
    required: true
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

certificateSchema.index({ userId: 1 });

export default model("Certificate", certificateSchema);