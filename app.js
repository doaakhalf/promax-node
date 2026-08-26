import "dotenv/config";
import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
import express from "express";
import os from "os";
import fs from "fs";
import { connectToMongo } from "./db.js";
import registerModels from "./registerModels.js";
import apiRouter from "./Routes/api.js";
import signUpRouter from "./Routes/signUp.js";
import path from "path";
import { fileURLToPath } from "url";
import ExerciseRouter from "./Routes/Exercise.js";
import { initializeFirebase } from "./config/firebase.js";
import { initializeSocket } from "./config/socket.js";
import http from "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Allow admin dashboard (and other frontends) on different origins when needed.
const corsOrigins = (process.env.CORS_ORIGINS || "*")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const requestOrigin = req.headers.origin;
  const allowAll = corsOrigins.includes("*");
  const allowedOrigin = allowAll
    ? requestOrigin || "*"
    : corsOrigins.find((origin) => origin === requestOrigin);

  if (allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With"
  );
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  return next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.use("/api", signUpRouter);
app.use("/api", apiRouter);
app.use("/api/exercise", ExerciseRouter);

// Admin dashboard (same Railway service) — built into this folder by Dockerfile / npm run build:admin
const adminDist = path.join(
  __dirname,
  "admin-dashboard-angular",
  "dist",
  "admin-dashboard-angular",
  "browser"
);
const adminIndex = path.join(adminDist, "index.html");
const hasAdminDashboard = fs.existsSync(adminIndex);

if (hasAdminDashboard) {
  app.use(express.static(adminDist, { index: false }));

  // Prefer dashboard favicon over SPA fallback / missing public icon
  app.get("/favicon.ico", (req, res, next) => {
    const file = path.join(adminDist, "favicon.ico");
    if (fs.existsSync(file)) return res.sendFile(file);
    return next();
  });

  app.get(/^(?!\/api(?:\/|$)|\/images(?:\/|$)|\/socket\.io(?:\/|$)).*/, (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    // Never return index.html for real asset requests (favicon, js, css, …)
    if (path.extname(req.path)) return next();
    return res.sendFile(adminIndex);
  });
} else {
  app.get("/", (req, res) => {
    res.send("API WORKING");
  });
}

// Centralized error handler. ApiError instances (thrown from services/
// controllers) carry their own statusCode + user-facing message; anything
// else is treated as an unexpected 500.
app.use((err, req, res, next) => {
  console.error("Error:", err);
  const statusCode = err?.isOperational ? err.statusCode : 500;
  res.status(statusCode).json({
    success: false,
    message: err?.isOperational ? err.message : "Server error",
    error: process.env.NODE_ENV === "development" ? err?.message || err : undefined,
    stack: process.env.NODE_ENV === "development" ? err?.stack : undefined,
  });
});

const PORT = process.env.PORT || 3000;

async function start() {
  await connectToMongo();
  registerModels();
  initializeFirebase();
  initializeSocket(server);

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    if (hasAdminDashboard) {
      console.log("Admin dashboard served from /");
    }
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
