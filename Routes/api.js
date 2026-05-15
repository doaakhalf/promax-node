import { Router } from "express";
import auth from "../Middleware/auth.js";
import { WorkoutMiddleware } from "../Middleware/WorkoutMiddleware.js";
import { createWorkout } from "../Controller/WorkoutController.js";
import ExerciseRouter from "../Routes/Exercise.js";
import CoachesRouter from "../Routes/Coaches.js";
import WorkoutRouter from "../Routes/Workout.js";


const router = Router();



// Protected routes (require authentication)
router.use(auth);

// COACHES
router.use("/coaches", CoachesRouter);
// EXERCISE
router.use("/exercise",ExerciseRouter)
// WORKOUT
router.use("/workout", WorkoutRouter)

router.get("/user", async (req, res) => {
  // In Laravel this returns the authenticated user.
  // TODO: once auth is implemented, return the real user document.
  res.json({ user: req.user });
});








router.get("/exercise/:id", async (req, res) => {
  
  // TODO: implement exercise show
  res.status(501).json({ message: "Not implemented" });
});

router.delete("/exercise/:id", async (req, res) => {
  // TODO: implement exercise delete
  res.status(501).json({ message: "Not implemented" });
});

export default router;

