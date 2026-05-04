import { Router } from "express";
import { getCoaches,activateCoach } from "../Controller/CoachController.js";
import { createUploader } from "../config/upload.js";
import { checkRole } from "../Middleware/checkRole.js";
import auth from "../Middleware/auth.js";

const CoachesRouter = Router();
const uploadCoach=createUploader('coaches')



// Public routes

CoachesRouter.get("/", getCoaches);


CoachesRouter.put("/:id/activate", auth, checkRole("admin"), activateCoach);

// CoachesRouter.post(
//   "/complete-profile",
//   uploadCoach.fields([
//     { name: "photo", maxCount: 1 },
//     { name: "certificate_images", maxCount: 10 }
//   ]),
//   CompleteCoachProfileMiddleware,
//   completeCoachProfile
// );
export default CoachesRouter;