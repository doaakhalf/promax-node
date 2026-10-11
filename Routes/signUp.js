import { Router } from "express";
import { getPriceWithPercentage } from "../Controller/signUpController.js";
import validateLogin from "../Middleware/validateLogin.js";
import LoginController from "../Controller/LoginController.js";
import { createUploader } from "../config/upload.js";
import validateGoogleAuth from "../Middleware/validateGoogleAuth.js";
import validateGoogleComplete from "../Middleware/validateGoogleComplete.js";
import { googleAuth, completeGoogleSignup } from "../Controller/GoogleAuthController.js";
import validateAppleAuth from "../Middleware/validateAppleAuth.js";
import validateAppleComplete from "../Middleware/validateAppleComplete.js";
import { appleAuth, completeAppleSignup } from "../Controller/AppleAuthController.js";
import { authLimiter } from "../Middleware/rateLimiters.js";

const router = Router();

const uploadUser = createUploader("users");
const uploadMiddleware = uploadUser.fields([
  { name: "profileImage", maxCount: 1 },
  { name: "certificates", maxCount: 10 },
  { name: "achievements", maxCount: 10 },
  { name: "inbodyFile", maxCount: 1 },
  { name: "galleryImages", maxCount: 10 },
]);

router.post("/register", authLimiter, (req, res) => {
  return res.status(403).json({
    status: "error",
    message: "Registration is only available with Google or Apple",
  });
});

router.post("/login", authLimiter, validateLogin, LoginController);

router.post("/auth/google", authLimiter, validateGoogleAuth, googleAuth);
router.post(
  "/auth/google/complete",
  authLimiter,
  uploadMiddleware,
  validateGoogleComplete,
  completeGoogleSignup
);

router.post("/auth/apple", authLimiter, validateAppleAuth, appleAuth);
router.post(
  "/auth/apple/complete",
  authLimiter,
  uploadMiddleware,
  validateAppleComplete,
  completeAppleSignup
);

router.post("/calculate-percentage", getPriceWithPercentage);

export default router;
