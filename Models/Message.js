import { Schema, model } from "mongoose";
const replyToSchema = new Schema(
  {
    messageId: { type: Schema.Types.ObjectId, required: true },
    senderRole: {
      type: String,
      enum: ["athlete", "coach", "admin"],
      required: true
    },
    text: { type: String, default: "" }
  },
  { _id: false }
);
const attachmentSchema = new Schema(
  {
    url: { type: String, required: true },
    type: { type: String, enum: ["image", "pdf", "audio", "video"], required: true },
    originalName: { type: String, default: null },
    mimeType: { type: String, default: null },
    size: { type: Number, default: null }
  },
  { _id: false }
);
const messageSchema = new Schema(
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
      enum: ["athlete", "coach", "admin"],
      required: true
    },
    text: {
      type: String,
      default: "",
      trim: true
    },
    attachments: {
      type: [attachmentSchema],
      default: []
    },
    replyTo: {
      type: replyToSchema,
      default: null
    }
  },
  {
    timestamps: true
  }
);

messageSchema.index({ conversationId: 1, createdAt: 1 });
messageSchema.index({ conversationId: 1, senderRole: 1, createdAt: 1 });

export default model("Message", messageSchema);
