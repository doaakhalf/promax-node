import { Router } from "express";
import {
  listConversations,
  startConversation,
  getConversationMeta,
  listMessages,
  sendMessage
} from "../Controller/ChatController.js";

const ChatRouter = Router();

ChatRouter.get("/conversations", listConversations);
ChatRouter.post("/conversations", startConversation);
ChatRouter.get("/conversations/:id", getConversationMeta);
ChatRouter.get("/conversations/:id/messages", listMessages);
ChatRouter.post("/conversations/:id/messages", sendMessage);

export default ChatRouter;
