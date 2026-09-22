import express from "express";
import {
  forgotPassword,
  verifyOtp,
  resetPassword,
  verifyResetToken,
} from "../Controller/PasswordResetController.js";
import { authLimiter } from "../Middleware/rateLimiters.js";

const PasswordResetRouter = express.Router();

PasswordResetRouter.post("/forgot", authLimiter, forgotPassword);
PasswordResetRouter.post("/verify-otp", authLimiter, verifyOtp);
PasswordResetRouter.post("/reset", authLimiter, resetPassword);
PasswordResetRouter.get("/verify/:token", authLimiter, verifyResetToken);

export default PasswordResetRouter;
