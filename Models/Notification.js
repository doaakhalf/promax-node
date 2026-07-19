import { Schema, model } from "mongoose";

const notificationSchema = new Schema({
  recipientId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  senderId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  type: {
    type: String,
    enum: [
      "workout_assigned",
      "workout_completed",
      "subscription_approved",
      "subscription_rejected",
      "subscription_refunded",
      "subscription_request",
      "payment_verified",
      "coach_activated",
      "coach_registered",
      "chat_message",
      "general"
    ],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  data: {
    type: Schema.Types.Mixed,
    default: {}
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

notificationSchema.index({ recipientId: 1, isRead: 1 });
notificationSchema.index({ recipientId: 1, createdAt: -1 });

const Notification = model("Notification", notificationSchema);

export default Notification;