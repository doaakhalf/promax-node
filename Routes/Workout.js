import { Router } from "express";
import { createWorkout, updateWorkout, getAll ,deleteWorkout,getWorkout} from "../Controller/WorkoutController.js";
import { createUploader } from "../config/upload.js";

const WorkoutRouter = Router();

const uploader=createUploader('workouts')

//create
WorkoutRouter.post("/", uploader.none(), createWorkout);

//get all
WorkoutRouter.get("/", getAll);

// get details
WorkoutRouter.get("/:id", getWorkout);

//edit
WorkoutRouter.put("/:id", uploader.none(), updateWorkout);

//delete
WorkoutRouter.delete("/:id", deleteWorkout);

export default WorkoutRouter;

