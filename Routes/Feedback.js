import { Router } from "express";
import auth from "../Middleware/auth.js";
import { checkRole } from "../Middleware/checkRole.js";
import { createFeedback } from "../Controller/FeedbackController.js";

const FeedbackRouter = Router();

FeedbackRouter.post("/", auth, checkRole("athlete", "coach"), createFeedback);

export default FeedbackRouter;
