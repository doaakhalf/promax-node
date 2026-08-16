import { Router } from "express";
import {
  listConversations,
  startConversation,
  getConversationMeta,
  listMessages,
  sendMessage,
  getUnreadMessagesCount
} from "../Controller/ChatController.js";
import {createUploader} from "../config/upload.js";

const uploadMiddleware = createUploader('chats');

const ChatRouter = Router();

ChatRouter.get("/conversations", listConversations);
ChatRouter.post("/conversations", startConversation);
ChatRouter.get("/conversations/:id", getConversationMeta);
ChatRouter.get("/conversations/:id/messages", listMessages);
ChatRouter.post("/conversations/:id/messages", uploadMiddleware.fields([{name: 'attachments', maxCount: 10}]), sendMessage);
ChatRouter.get("/unread-count", getUnreadMessagesCount);

export default ChatRouter;
