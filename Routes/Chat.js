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
  listCoachAthleteMessagesForAdmin,
  setCoachAthleteChatBlock
} from "../Controller/ChatController.js";
import { createChatUploader } from "../config/upload.js";
import { checkRole } from "../Middleware/checkRole.js";

const chatUploader = createChatUploader("chats");

const uploadChatAttachments = (req, res, next) => {
  chatUploader.fields([{ name: "attachments", maxCount: 10 }])(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        status: "error",
        message: "Maximum file size is 50 MB."
      });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        status: "error",
        message: "Too many attachments."
      });
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        status: "error",
        message: "Unsupported file type."
      });
    }
    return next(err);
  });
};

const ChatRouter = Router();

ChatRouter.get("/admins", listAdmins);
ChatRouter.get("/conversations", listConversations);
ChatRouter.post("/conversations", startConversation);
ChatRouter.get("/conversations/:id", getConversationMeta);
ChatRouter.get("/conversations/:id/messages", listMessages);
ChatRouter.put("/conversations/:id/read", markConversationRead);
ChatRouter.post(
  "/conversations/:id/messages",
  uploadChatAttachments,
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
ChatRouter.patch(
  "/admin/coach-athlete/:id/block",
  checkRole("admin"),
  setCoachAthleteChatBlock
);

export default ChatRouter;
