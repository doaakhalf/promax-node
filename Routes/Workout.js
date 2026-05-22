import { Router } from "express";
import { createWorkout, getAll ,deleteWorkout} from "../Controller/WorkoutController.js";
import { createUploader } from "../config/upload.js";

const WorkoutRouter = Router();

const uploader=createUploader('workouts')

//create
WorkoutRouter.post("/", uploader.none(), createWorkout);

//get all
WorkoutRouter.get("/", getAll);

//delete
WorkoutRouter.delete("/:id", deleteWorkout);

export default WorkoutRouter;

