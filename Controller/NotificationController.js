import Notification from "../Models/Notification.js";
import User from "../Models/User.js";

// Get all notifications for authenticated user
export const getNotifications = async (req, res) => {
  try {
    const userId = req.userId;
    const { page = 1, limit = 20, unreadOnly = false } = req.query;

    const query = { recipientId: userId };
    if (unreadOnly === 'true') {
      query.isRead = false;
    }

    const notifications = await Notification.find(query)
      .populate('senderId', 'firstName lastName profileImage')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ 
      recipientId: userId, 
      isRead: false 
    });

    const formattedNotifications = notifications.map(notif => ({
      id: notif._id,
      type: notif.type,
      title: notif.title,
      message: notif.message,
      data: notif.data,
      isRead: notif.isRead,
      sender: notif.senderId ? {
        id: notif.senderId._id,
        name: `${notif.senderId.firstName} ${notif.senderId.lastName}`,
        profileImage: notif.senderId.profileImage
      } : null,
      createdAt: notif.createdAt,
      readAt: notif.readAt
    }));

    res.status(200).json({
      status: "success",
      data: formattedNotifications,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      },
      unreadCount
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to retrieve notifications",
      error: error.message
    });
  }
};

// Mark notification as read
export const markAsRead = async (req, res) => {
  try {
    const userId = req.userId;
    const { notificationId } = req.params;

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipientId: userId },
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        status: "error",
        message: "Notification not found"
      });
    }

    res.status(200).json({
      status: "success",
      message: "Notification marked as read",
      data: notification
    });
  } catch (error) {
    console.error("Mark as read error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to mark notification as read",
      error: error.message
    });
  }
};

// Mark all notifications as read
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.userId;

    await Notification.updateMany(
      { recipientId: userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.status(200).json({
      status: "success",
      message: "All notifications marked as read"
    });
  } catch (error) {
    console.error("Mark all as read error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to mark all notifications as read",
      error: error.message
    });
  }
};

// Delete notification
export const deleteNotification = async (req, res) => {
  try {
    const userId = req.userId;
    const { notificationId } = req.params;

    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      recipientId: userId
    });

    if (!notification) {
      return res.status(404).json({
        status: "error",
        message: "Notification not found"
      });
    }

    res.status(200).json({
      status: "success",
      message: "Notification deleted"
    });
  } catch (error) {
    console.error("Delete notification error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to delete notification",
      error: error.message
    });
  }
};

// Get unread count
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.userId;

    const count = await Notification.countDocuments({
      recipientId: userId,
      isRead: false
    });

    res.status(200).json({
      status: "success",
      unreadCount: count
    });
  } catch (error) {
    console.error("Get unread count error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to get unread count",
      error: error.message
    });
  }
};

// Register/Update FCM token
export const registerFCMToken = async (req, res) => {
  try {
    const userId = req.userId;
    const { token, deviceId, platform = 'android' } = req.body;

    if (!token) {
      return res.status(400).json({
        status: "error",
        message: "FCM token is required"
      });
    }

    // Remove old token if exists, then add new one
    await User.findByIdAndUpdate(userId, {
      $pull: { fcmTokens: { token: token } }
    });

    await User.findByIdAndUpdate(userId, {
      $push: {
        fcmTokens: {
          token,
          deviceId,
          platform,
          addedAt: new Date()
        }
      }
    });

    res.status(200).json({
      status: "success",
      message: "FCM token registered successfully"
    });
  } catch (error) {
    console.error("Register FCM token error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to register FCM token",
      error: error.message
    });
  }
};

// Remove FCM token (on logout)
export const removeFCMToken = async (req, res) => {
  try {
    const userId = req.userId;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        status: "error",
        message: "FCM token is required"
      });
    }

    await User.findByIdAndUpdate(userId, {
      $pull: { fcmTokens: { token: token } }
    });

    res.status(200).json({
      status: "success",
      message: "FCM token removed successfully"
    });
  } catch (error) {
    console.error("Remove FCM token error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to remove FCM token",
      error: error.message
    });
  }
};