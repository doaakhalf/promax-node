import { Router } from "express";
import { getCoaches,activateCoach,getCoachesWithSubscription,getCoachAthletes} from "../Controller/CoachController.js";
import { createUploader } from "../config/upload.js";
import { checkRole } from "../Middleware/checkRole.js";
import auth from "../Middleware/auth.js";
import { EditCoachProfile } from "../Controller/LoginController.js";
import { EditCoachProfileMiddleware } from "../Middleware/EditCoachProfileMiddleware.js";
import { getAthleteCalendar, assignWorkout } from "../Controller/WorkoutCalendarController.js";


const CoachesRouter = Router();
const uploadCoach=createUploader('coaches')



// Public routes

// CoachesRouter.get("/coaches", getCoaches);
CoachesRouter.get("/with-subscription",auth, getCoachesWithSubscription);



CoachesRouter.put("/:id/activate", auth, checkRole("admin"), activateCoach);
CoachesRouter.put("/edit", 
  auth,
  checkRole("coach"),
  uploadCoach.fields([{name: "profileImage", maxCount: 1}]),
  EditCoachProfileMiddleware,
  EditCoachProfile
);

// Add this route (protected, coach only)
CoachesRouter.get("/my-athletes", auth, checkRole("coach"), getCoachAthletes);

// Get athlete's workout calendar
CoachesRouter.get("/athletes/:athleteId/calendar", auth, checkRole("coach"), getAthleteCalendar);

// Assign workout to calendar day
CoachesRouter.post("/calendar/assign-workout", auth, checkRole("coach"), assignWorkout);
export default CoachesRouter;