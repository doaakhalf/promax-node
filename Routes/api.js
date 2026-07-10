import { Router } from "express";
import auth from "../Middleware/auth.js";
import { WorkoutMiddleware } from "../Middleware/WorkoutMiddleware.js";
import { createWorkout } from "../Controller/WorkoutController.js";
import ExerciseRouter from "../Routes/Exercise.js";
import CoachesRouter from "../Routes/Coaches.js";
import WorkoutRouter from "../Routes/Workout.js";
import AthleteRouter from "../Routes/Athlete.js";
import AdminRouter from "../Routes/Admin.js";
import UserRouter from "../Routes/User.js";
import PasswordResetRouter from "../Routes/PasswordReset.js";
import NotificationRouter from "../Routes/Notification.js";



// import NotificationRouter from "./Notification.js";
import { getCoaches ,getCoachesWithSubscription} from "../Controller/CoachController.js";

const router = Router();



// router.get("/coaches", getCoaches);
router.get("/coaches", getCoachesWithSubscription);


router.use("/user", UserRouter);
router.use("/password", PasswordResetRouter);

// Protected routes (require authentication)
router.use(auth);

//admin
router.use("/admin", AdminRouter);
// COACHES
router.use("/coaches", CoachesRouter);
// EXERCISE
router.use("/exercise",ExerciseRouter)
// WORKOUT
router.use("/workout", WorkoutRouter)

//athelete
router.use("/athlete", AthleteRouter)


//notifications
router.use("/notifications", NotificationRouter);

// router.get("/user", async (req, res) => {
//   // In Laravel this returns the authenticated user.
//   // TODO: once auth is implemented, return the real user document.
//   res.json({ user: req.user });
// });









export default router;

