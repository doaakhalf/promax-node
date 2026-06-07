import { Router } from "express";
import signUpController from "../Controller/signUpController.js";
import validateRegister from "../Middleware/validateRegister.js";
import validateLogin from "../Middleware/validateLogin.js";
import LoginController from "../Controller/LoginController.js";
import { RegisterCoachMiddleware } from "../Middleware/RegisterCoachMiddleware.js";
import { createUploader } from "../config/upload.js";
import { getPriceWithPercentage } from "../Controller/signUpController.js";
 

const router = Router();



// Parse multipart FIRST (always, not conditionally)
const uploadUser = createUploader('users');
const uploadMiddleware = uploadUser.fields([
  { name: "profileImage", maxCount: 1 },
  { name: "certificates", maxCount: 10 }
]);
// Conditional middleware wrapper
const conditionalCoachValidation = (req, res, next) => {
  if (req.body.user_type === "coach") {
    return RegisterCoachMiddleware(req, res, next);
  }
  next();
};



// Public routes
router.post("/register", uploadMiddleware, validateRegister, conditionalCoachValidation, signUpController);

router.post("/login",validateLogin,LoginController); 

//calculate percentage
router.post('/calculate-percentage',getPriceWithPercentage)


export default router;