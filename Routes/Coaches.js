import { Router } from "express";
import { getCoaches,activateCoach,getCoachesWithSubscription,getCoachAthletes,getCoachProfile,addNutritionFile} from "../Controller/CoachController.js";
import { createUploader } from "../config/upload.js";
import { checkRole } from "../Middleware/checkRole.js";
import auth from "../Middleware/auth.js";
import { EditCoachProfile } from "../Controller/LoginController.js";
import { EditCoachProfileMiddleware } from "../Middleware/EditCoachProfileMiddleware.js";
import { getAthleteCalendar, assignWorkout } from "../Controller/WorkoutCalendarController.js";


const CoachesRouter = Router();
const uploadCoach=createUploader('coaches')
const coachProfile=createUploader('users')





// Public routes

// CoachesRouter.get("/coaches", getCoaches);
CoachesRouter.get("/with-subscription",auth, getCoachesWithSubscription);



CoachesRouter.put("/:id/activate", auth, checkRole("admin"), activateCoach);
CoachesRouter.put("/edit", 
  auth,
  checkRole("coach"),
  coachProfile.fields([{name: "profileImage", maxCount: 1},{name: "certificates", maxCount: 10},{name: "achievements", maxCount: 10}]),
  EditCoachProfileMiddleware,
  EditCoachProfile
);

CoachesRouter.get('/my-profile{/:id}', auth, getCoachProfile);
// Add this route (protected, coach only)
CoachesRouter.get("/my-athletes", auth, checkRole("coach"), getCoachAthletes);

// Get athlete's workout calendar
CoachesRouter.get("/athletes/:athleteId/calendar", auth, checkRole("coach"), getAthleteCalendar);

// Assign workout to calendar day
CoachesRouter.post("/calendar/assign-workout", auth, checkRole("coach"), assignWorkout);

//add nutration file
CoachesRouter.post("/:subscriptionId/nutrition-file", auth, checkRole("coach"), uploadCoach.single("nutritionFile"), addNutritionFile);
export default CoachesRouter;