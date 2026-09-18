import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import Conversation from "../Models/Conversation.js";
import { getAllowedCorsOrigins, isAllowedCorsOrigin } from "../utils/corsOrigins.js";

let io;

const idStr = (value) => (value ? value.toString() : null);

const getViewerSide = (conversation, userId) => {
  const vid = userId.toString();
  if (conversation.adminId && idStr(conversation.adminId) === vid) return "admin";
  if (conversation.athleteId && idStr(conversation.athleteId) === vid) return "athlete";
  if (conversation.coachId && idStr(conversation.coachId) === vid) return "coach";
  return null;
};

const getPeerId = (conversation, viewerSide) => {
  const type = conversation.type || "coach_athlete";
  if (type === "coach_athlete") {
    return viewerSide === "athlete" ? conversation.coachId : conversation.athleteId;
  }
  if (type === "admin_coach") {
    return viewerSide === "admin" ? conversation.coachId : conversation.adminId;
  }
  return viewerSide === "admin" ? conversation.athleteId : conversation.adminId;
};

export const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        // Mobile / non-browser clients often omit Origin.
        if (!origin || isAllowedCorsOrigin(origin)) {
          return callback(null, true);
        }
        return callback(new Error("Origin not allowed"));
      },
      methods: ["GET", "POST", "PUT"],
      credentials: true,
    },
  });

  console.log(
    `[socket] CORS origins: ${getAllowedCorsOrigins().join(", ")}`
  );
  // Authentication middleware for Socket.IO
  io.use((socket, next) => {
    const expected = process.env.CLIENT_API_KEY;
    if (expected) {
      const provided =
        socket.handshake.auth?.apiKey ||
        socket.handshake.headers?.["x-api-key"] ||
        "";
      if (provided !== expected) {
        return next(new Error("Invalid or missing API key"));
      }
    }

    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error("Authentication error"));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.role = decoded.role;
      next();
    } catch (error) {
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.userId}`);

    // Join user to their own room for targeted notifications
    socket.join(`user_${socket.userId}`);
    socket.on("chat:typing", async ({ conversationId, isTyping }) => {
      try {
        if (!conversationId) return;

        const conversation = await Conversation.findById(conversationId)
          .select("athleteId coachId adminId type")
          .lean();
        if (!conversation) return;

        const viewerSide = getViewerSide(conversation, socket.userId);
        if (!viewerSide) return;

        const peerId = getPeerId(conversation, viewerSide);
        if (!peerId) return;

        io.to(`user_${peerId}`).emit("chat:typing", {
          conversationId,
          userId: socket.userId,
          isTyping: !!isTyping
        });
      } catch (err) {
        console.error("chat:typing error:", err);
      }
    });

    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.userId}`);
    });
  });

  console.log("Socket.IO initialized ✅");
  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.IO not initialized");
  }
  return io;
};
