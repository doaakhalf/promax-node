import { Router } from "express";
import { createUploader } from "../config/upload.js";
import { ExerciseMiddleware } from "../Middleware/ExerciseMiddleware.js";
import { create,update } from "../Controller/ExerciseController.js";


const ExerciseRouter = Router();    
   

const uploadExercise = createUploader('exercises');
ExerciseRouter.post('/', uploadExercise.single('image'), ExerciseMiddleware, create);

ExerciseRouter.put('/:id', uploadExercise.single('image'), update);

export default ExerciseRouter;
