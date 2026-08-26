import { Router } from "express";
import auth from "../Middleware/auth.js";
import { WorkoutMiddleware } from "../Middleware/WorkoutMiddleware.js";
import { createWorkout } from "../Controller/WorkoutController.js";
import ExerciseRouter from "../Routes/Exercise.js";
import CoachesRouter from "../Routes/Coaches.js";
import WorkoutRouter from "../Routes/Workout.js";
import AthleteRouter from "../Routes/Athlete.js";
import AdminRouter from "../Routes/Admin.js";
import AdminSubscriptionsRouter from "../Routes/AdminSubscriptions.js";
import UserRouter from "../Routes/User.js";
import PasswordResetRouter from "../Routes/PasswordReset.js";
import NotificationRouter from "../Routes/Notification.js";
import ChatRouter from "../Routes/Chat.js";
import GalleryRouter from "../Routes/Gallery.js";



// import NotificationRouter from "./Notification.js";
import { getCoaches ,getCoachesWithSubscription} from "../Controller/CoachController.js";
import { getAppVersion } from "../Controller/AdminController.js";

const router = Router();



// router.get("/coaches", getCoaches);
router.get("/coaches", getCoachesWithSubscription);
router.get("/app/version", getAppVersion);

router.use("/user", UserRouter);
router.use("/password", PasswordResetRouter);

// Protected routes (require authentication)
router.use(auth);

//admin
router.use("/admin", AdminRouter);
router.use("/admin", AdminSubscriptionsRouter);
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

//chat
router.use("/chat", ChatRouter);

// //gallery
// router.use("/users/gallery", GalleryRouter);

// router.get("/user", async (req, res) => {
//   // In Laravel this returns the authenticated user.
//   // TODO: once auth is implemented, return the real user document.
//   res.json({ user: req.user });
// });









export default router;

