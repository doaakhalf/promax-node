import { Router } from "express";
import { createWorkout } from "../Controller/WorkoutController.js";

const WorkoutRouter = Router();

WorkoutRouter.post("/", createWorkout);

export default WorkoutRouter;
