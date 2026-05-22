import { Router } from "express";
import { createUploader } from "../config/upload.js";
import { ExerciseMiddleware } from "../Middleware/ExerciseMiddleware.js";
import { create,update,getAll,deleteExercise } from "../Controller/ExerciseController.js";


const ExerciseRouter = Router();    
   

//create
const uploadExercise = createUploader('exercises');
ExerciseRouter.post('/', uploadExercise.single('image'), ExerciseMiddleware, create);

//get all
ExerciseRouter.get('/', getAll);

//update
ExerciseRouter.put('/:id', uploadExercise.single('image'), update);

//delete
ExerciseRouter.delete('/:id', deleteExercise);

export default ExerciseRouter;
