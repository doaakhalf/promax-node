import { Schema, model } from "mongoose";

const conversationSchema = new Schema(
  {
    coachId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    athleteId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
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
      enum: ["athlete", "coach"],
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
    }
  },
  {
    timestamps: true
  }
);

conversationSchema.index(
  {
    coachId: 1,
    athleteId: 1
  },
  {
    unique: true
  }
);

export default model("Conversation", conversationSchema);