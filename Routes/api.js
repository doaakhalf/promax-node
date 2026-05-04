import { Router } from "express";
import auth from "../Middleware/auth.js";
import { WorkoutMiddleware } from "../Middleware/WorkoutMiddleware.js";
import { WorkoutController } from "../Controller/WorkoutController.js";
import CoachesRouter from "../Routes/Coaches.js";


const router = Router();


router.use("/coaches", CoachesRouter);
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

