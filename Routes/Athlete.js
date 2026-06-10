import { Router } from "express";
import { Subscribe ,getWorkouts,completeWorkout,getProfile} from "../Controller/AtheleteController.js";
import auth from "../Middleware/auth.js";
import { checkRole } from "../Middleware/checkRole.js";
import { createUploader } from "../config/upload.js";

const AthleteRouter = Router();

const upload = createUploader("subscription-payments");

// Subscribe to a coach (athlete only)
AthleteRouter.post("/subscribe/:coachId", auth, checkRole("athlete"),upload.single("paymentImage"), Subscribe);


// Get all active workout calendars for athlete
AthleteRouter.get("/my-workouts", auth, checkRole("athlete"), getWorkouts);

//complete Workout
AthleteRouter.put('/complete-workout', auth, checkRole("athlete"), completeWorkout);

//my profile
AthleteRouter.get('/my-profile{/:athleteId}',auth,checkRole('athlete','admin'),getProfile);

export default AthleteRouter;