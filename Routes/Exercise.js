import { Router } from "express";
import { createUploader } from "../config/upload.js";
import { ExerciseMiddleware, ExerciseUpdateMiddleware } from "../Middleware/ExerciseMiddleware.js";
import { create,update,getAll,deleteExercise,getExternalExercises } from "../Controller/ExerciseController.js";


const ExerciseRouter = Router();    
   

//create
const uploadExercise = createUploader('exercises');
ExerciseRouter.post('/', uploadExercise.single('image'), ExerciseMiddleware, create);

//get all
ExerciseRouter.get('/', getAll);

//get external exercises
ExerciseRouter.get('/external', getExternalExercises);

//update
ExerciseRouter.put('/:id', uploadExercise.single('image'), ExerciseUpdateMiddleware, update);

//delete
ExerciseRouter.delete('/:id', deleteExercise);

export default ExerciseRouter;
