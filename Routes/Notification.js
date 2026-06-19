import { Router } from "express";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount,
  registerFCMToken,
  removeFCMToken
} from "../Controller/NotificationController.js";
import auth from "../Middleware/auth.js";

const NotificationRouter = Router();

// All routes require authentication
NotificationRouter.use(auth);

// Get all notifications
NotificationRouter.get("/", getNotifications);

// Get unread count
NotificationRouter.get("/unread-count", getUnreadCount);

// Register FCM token
NotificationRouter.post("/register-token", registerFCMToken);

// Remove FCM token
NotificationRouter.post("/remove-token", removeFCMToken);

// Mark notification as read
NotificationRouter.put("/:notificationId/read", markAsRead);

// Mark all as read
NotificationRouter.put("/mark-all-read", markAllAsRead);

// Delete notification
NotificationRouter.delete("/:notificationId", deleteNotification);

export default NotificationRouter;