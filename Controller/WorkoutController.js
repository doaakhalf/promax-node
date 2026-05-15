import Coach from "../Models/Coach.js";
import Workout from "../Models/Workout.js";
import GymWorkoutSet from "../Models/GymWorkoutSet.js";
import GymWorkoutSetDetail from "../Models/GymWorkoutSetDetail.js";

export const createWorkout = async (req, res) => {
  // TODO: implement workout controller
 let data = req.body;
 const userId = req.userId;
 const coach=await Coach.findById(userId).lean();
 const workoutData = {
    userId,
    workoutType: coach.type,
    name: data.name,
    description: data.description,
    // instructions: data.instructions,
    // isTemplate: data.isTemplate,
 };
 
 try {
   Workout.create(workoutData).then((workout) => {
        for (const WorkoutSet of data.sets) {
        GymWorkoutSet.create({
          workoutId: workout._id,
          exerciseId: WorkoutSet.exerciseId,
          order: WorkoutSet.order,
          notes: WorkoutSet.notes,
        })
        .then((gymWorkoutSet) => {
          GymWorkoutSetDetail.create({
          setId: gymWorkoutSet._id,
          durationType: WorkoutSet.durationType,
          durationValue: WorkoutSet.durationValue,
          sets: WorkoutSet.sets,
          reps: WorkoutSet.reps,
          restSeconds: WorkoutSet.restSeconds,
          weightType: WorkoutSet.weightType,
          weightKg: WorkoutSet.weightKg,
        });
        res.status(200).json(
        {
          message: "Workout created successfully",
          workoutId: workout._id
        });
        });
      }
 }).catch((error) => {
  res.status(500).json({ message: error.message });
 });

} catch (error) {
  res.status(500).json({ message: error.message });
}
}

