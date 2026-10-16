import { Schema, model } from "mongoose";

const blockedChatAttemptSchema = new Schema(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    senderRole: {
      type: String,
      enum: ["athlete", "coach"],
      required: true
    },
    reason: {
      type: String,
      enum: ["social", "email", "handle", "phone"],
      required: true
    },
    excerpt: {
      type: String,
      default: "",
      maxlength: 500
    }
  },
  { timestamps: true }
);

blockedChatAttemptSchema.index({ conversationId: 1, createdAt: -1 });

export default model("BlockedChatAttempt", blockedChatAttemptSchema);
