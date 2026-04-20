import { Router } from "express";
import signUpController from "../Controller/signUpController.js";
import validateRegister from "../Middleware/validateRegister.js";
import validateLogin from "../Middleware/validateLogin.js";
import LoginController from "../Controller/LoginController.js";

const router = Router();

// Public routes
router.post("/register", validateRegister, signUpController);

router.post("/login",validateLogin,LoginController); 


export default router;