import { Router } from "express";
import { Subscribe } from "../Controller/AtheleteController.js";
import auth from "../Middleware/auth.js";
import { checkRole } from "../Middleware/checkRole.js";
import { createUploader } from "../config/upload.js";

const AthleteRouter = Router();

const upload = createUploader("subscription-payments");

// Subscribe to a coach (athlete only)
AthleteRouter.post("/subscribe/:coachId", auth, checkRole("athlete"),upload.single("paymentImage"), Subscribe);

export default AthleteRouter;