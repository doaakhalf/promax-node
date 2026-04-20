import { Router } from "express";
import auth from "../Middleware/auth.js";
import { createUploader } from "../config/upload.js";
import { CompleteCoachProfileMiddleware } from "../Middleware/CompleteCoachProfileMiddleware.js";
import completeCoachProfileController from "../Controller/completeCoachProfileController.js";
import { WorkoutMiddleware } from "../Middleware/WorkoutMiddleware.js";
import { WorkoutController } from "../Controller/WorkoutController.js";
import ExerciseRouter from "../Routes/Exercise.js";

import Coach from "../Models/Coach.js";

const router = Router();


router.get("/coaches", async (req, res, next) => {
  try {
    const coaches = await Coach.find().populate("userId").lean();
    res.json(coaches);
  } catch (err) {
    next(err);
  }
});

// Protected routes (require authentication)
router.use(auth);

router.get("/user", async (req, res) => {
  // In Laravel this returns the authenticated user.
  // TODO: once auth is implemented, return the real user document.
  res.json({ user: req.user });
});

router.post("/complete-athlete-profile", async (req, res) => {
  // TODO: implement athlete profile completion
  res.status(501).json({ message: "Not implemented" });
});

const uploadCoach=createUploader('coaches')
router.post(
  "/complete-coach-profile",
  uploadCoach.fields([
    { name: "photo", maxCount: 1 },
    { name: "certificate_images", maxCount: 10 }
  ]),
  CompleteCoachProfileMiddleware,
  completeCoachProfileController
);

// WORKOUT
router.post("/workout", WorkoutMiddleware, WorkoutController);




router.get("/exercise/:id", async (req, res) => {
  
  // TODO: implement exercise show
  res.status(501).json({ message: "Not implemented" });
});

router.delete("/exercise/:id", async (req, res) => {
  // TODO: implement exercise delete
  res.status(501).json({ message: "Not implemented" });
});

export default router;

