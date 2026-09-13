import { Router } from "express";
import {
  listConversations,
  startConversation,
  getConversationMeta,
  listMessages,
  markConversationRead,
  sendMessage,
  getUnreadMessagesCount,
  listAdmins,
  listCoachAthleteConversationsForAdmin,
  listCoachAthleteMessagesForAdmin
} from "../Controller/ChatController.js";
import { createUploader } from "../config/upload.js";
import { checkRole } from "../Middleware/checkRole.js";

const uploadMiddleware = createUploader("chats");

const ChatRouter = Router();

ChatRouter.get("/admins", listAdmins);
ChatRouter.get("/conversations", listConversations);
ChatRouter.post("/conversations", startConversation);
ChatRouter.get("/conversations/:id", getConversationMeta);
ChatRouter.get("/conversations/:id/messages", listMessages);
ChatRouter.put("/conversations/:id/read", markConversationRead);
ChatRouter.post(
  "/conversations/:id/messages",
  uploadMiddleware.fields([{ name: "attachments", maxCount: 10 }]),
  sendMessage
);
ChatRouter.get("/unread-count", getUnreadMessagesCount);

// Admin revision: all coach ↔ athlete threads (read-only)
ChatRouter.get(
  "/admin/coach-athlete",
  checkRole("admin"),
  listCoachAthleteConversationsForAdmin
);
ChatRouter.get(
  "/admin/coach-athlete/:id/messages",
  checkRole("admin"),
  listCoachAthleteMessagesForAdmin
);

export default ChatRouter;
