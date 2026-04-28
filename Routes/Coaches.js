import { Router } from "express";
import { getCoaches, completeCoachProfile ,register} from "../Controller/CoachController.js";
import { createUploader } from "../config/upload.js";
import { RegisterCoachMiddleware } from "../Middleware/RegisterCoachMiddleware.js";
import validateRegister from "../Middleware/validateRegister.js";

const CoachesRouter = Router();
const uploadCoach=createUploader('coaches')



// Public routes

CoachesRouter.get("/", getCoaches);

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