import { Schema, model } from "mongoose";

const conversationSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["coach_athlete", "admin_coach", "admin_athlete"],
      default: "coach_athlete",
      required: true
    },

    adminId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    coachId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    athleteId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    // Denormalized counter of athlete-sent messages, used to enforce the
    // free-trial limit without recounting the messages collection each time.
    athleteMessageCount: {
      type: Number,
      default: 0
    },
    coachMessageCount: {
      type: Number,
      default: 0
    },

    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      default: null
    },

    lastMessageText: {
      type: String,
      default: null
    },

    lastMessageAt: {
      type: Date,
      default: null
    },

    lastMessageSenderRole: {
      type: String,
      enum: ["athlete", "coach", "admin"],
      default: null
    },

    // Used to compute unreadCount per viewer.
    athleteLastReadAt: {
      type: Date,
      default: null
    },

    coachLastReadAt: {
      type: Date,
      default: null
    },

    adminLastReadAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

conversationSchema.index(
  { coachId: 1, athleteId: 1 },
  {
    unique: true,
    partialFilterExpression: { type: "coach_athlete" }
  }
);
conversationSchema.index(
  { adminId: 1, coachId: 1 },
  {
    unique: true,
    partialFilterExpression: { type: "admin_coach" }
  }
);
conversationSchema.index(
  { adminId: 1, athleteId: 1 },
  {
    unique: true,
    partialFilterExpression: { type: "admin_athlete" }
  }
);
conversationSchema.index({ athleteId: 1, lastMessageAt: -1, createdAt: -1 });
conversationSchema.index({ coachId: 1, lastMessageAt: -1, createdAt: -1 });
conversationSchema.index({ adminId: 1, lastMessageAt: -1, createdAt: -1 });

export default model("Conversation", conversationSchema);
