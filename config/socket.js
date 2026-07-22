import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import Conversation from "../Models/Conversation.js";

let io;

export const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*", // Configure based on your frontend URL
      methods: ["GET", "POST","PUT"],
      credentials: true
    }
  });

  // Authentication middleware for Socket.IO
  io.use((socket, next) => {
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
        .select("athleteId coachId")
        .lean();
      if (!conversation) return;
 
      const isAthlete = conversation.athleteId.toString() === socket.userId.toString();
      const isCoach = conversation.coachId.toString() === socket.userId.toString();
      if (!isAthlete && !isCoach) return;
 
      const peerId = isAthlete ? conversation.coachId : conversation.athleteId;
 
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

  console.log('Socket.IO initialized ✅');
  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.IO not initialized");
  }
  return io;
};