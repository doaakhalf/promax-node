import { Router } from "express";
import { createUploader } from "../config/upload.js";
import { ExerciseMiddleware } from "../Middleware/ExerciseMiddleware.js";
import { ExerciseController } from "../Controller/ExerciseController.js";


const ExerciseRouter = Router();    
const exerciseController = new ExerciseController();


const uploadExercise = createUploader('exercises');
ExerciseRouter.post('/', uploadExercise.single('image'), ExerciseMiddleware, exerciseController.create);

ExerciseRouter.put('/:id', uploadExercise.single('image'), exerciseController.update);

export default ExerciseRouter;
