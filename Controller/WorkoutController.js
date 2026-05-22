import Coach from "../Models/Coach.js";
import Workout from "../Models/Workout.js";
import GymWorkoutSet from "../Models/GymWorkoutSet.js";
import GymWorkoutSetDetail from "../Models/GymWorkoutSetDetail.js";
import WorkoutAssignment from "../Models/WorkoutAssignment.js";
import User from "../Models/User.js";

export const createWorkout = async (req, res) => {
  // TODO: implement workout controller
 let data = req.body;
 const userId = req.userId;
 const coach=await Coach.findOne({userId}).lean();

 
 if (typeof data.sets === 'string') {
      try {
        data.sets = JSON.parse(data.sets);
       
      } catch (e) {
        return res.status(400).json({ 
          message: "Invalid sets format. Must be valid JSON array." 
        });
      }
    }
 const workoutData = {
    userId,
    workoutType: coach.type,
    name: data.name,
    description: data.description,
    // instructions: data.instructi ons,
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
          weight: WorkoutSet.weight,
        });
        res.status(201).json(
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

// export const getAll=async(req, res) => {
//     try {
//        const page=req.query.page || 1;
//        const pageSize=req.query.pageSize || 10;
//        const skip=(page-1)*pageSize;
//         const workouts = await Workout.find({userId:req.userId}).skip(skip).limit(pageSize).lean();

//         const totalWorkouts = await Workout.countDocuments({userId:req.userId});

//         // Calculate pagination metadata
//         const totalPages = Math.ceil(totalWorkouts / pageSize);
//         const hasNextPage = page < totalPages;
//         const hasPrevPage = page > 1;
//         res.status(200).json({
//             message: "Workouts retrieved successfully",
//             data: workouts,
//             pagination: {
//                 page,
//                 pageSize,
//                 totalPages,
//                 totalItems: totalWorkouts,
//                 hasNextPage,
//                 hasPrevPage,
//             }
           
//         });
//     } catch (error) {
//         res.status(500).json({ 
//             message: "Failed to retrieve workouts", 
//             error: error?.message   
//         });
//     }
// }

// Main controller - routes to appropriate function
export const getAll = async (req, res) => {
    try {
        const coach = await Coach.findOne({ userId: req.userId }).lean();
        
        if (!coach) {
            return res.status(404).json({ message: "Coach profile not found" });
        }

        // Route to appropriate function based on coach type
        if (coach.type === "gym") {
            return await getGymWorkouts(req, res, coach);
        } else {
            return await getNormalWorkouts(req, res, coach);
        }
        
    } catch (error) {
        console.error('Get workouts error:', error);
        res.status(500).json({ 
            message: "Failed to retrieve workouts", 
            error: error?.message   
        });
    }
};

// Gym coach workouts
const getGymWorkouts = async (req, res, coach) => {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const skip = (page - 1) * pageSize;

    const pipeline = [
        { $match: { userId: req.userId } },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: pageSize },
        {
            $lookup: {
                from: "gymworkoutsets",
                localField: "_id",
                foreignField: "workoutId",
                as: "sets",
                pipeline: [
                    { $sort: { order: 1 } },
                    {
                        $lookup: {
                            from: "exercises",
                            localField: "exerciseId",
                            foreignField: "_id",
                            as: "exercise"
                        }
                    },
                    { $unwind: { path: "$exercise", preserveNullAndEmptyArrays: true } },
                    {
                        $lookup: {
                            from: "gymworkoutsetdetails",
                            localField: "_id",
                            foreignField: "setId",
                            as: "details"
                        }
                    },
                    { $unwind: { path: "$details", preserveNullAndEmptyArrays: true } },
                    {
                        $project: {
                            createdAt: 0,
                            updatedAt: 0,
                            __v: 0,
                            "exercise.createdAt": 0,
                            "exercise.updatedAt": 0,
                            "exercise.__v": 0,
                            "details.createdAt": 0,
                            "details.updatedAt": 0,
                            "details.__v": 0
                        }
                    }
                ]
            }
        },
        {
            $project: {
                createdAt: 0,
                updatedAt: 0,
                __v: 0
            }
        }
    ];

    const [workouts, totalCount] = await Promise.all([
        Workout.aggregate(pipeline),
        Workout.countDocuments({ userId: req.userId })
    ]);

    const totalPages = Math.ceil(totalCount / pageSize);

    return res.status(200).json({
        message: "Workouts retrieved successfully",
        data: workouts,
        pagination: {
            currentPage: page,
            totalPages,
            totalItems: totalCount,
            itemsPerPage: pageSize,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
        }
    });
};

// Normal coach workouts
const getNormalWorkouts = async (req, res, coach) => {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const skip = (page - 1) * pageSize;

    const pipeline = [
        { $match: { userId: req.userId } },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: pageSize },
        {
            $lookup: {
                from: "coachworkoutsections",
                localField: "_id",
                foreignField: "workoutId",
                as: "sections",
                pipeline: [
                    { $sort: { order: 1 } },
                    {
                        $lookup: {
                            from: "coachworkoutsteps",
                            localField: "_id",
                            foreignField: "sectionId",
                            as: "steps",
                            pipeline: [
                                { $sort: { order: 1 } },
                                {
                                    $lookup: {
                                        from: "coachworkoutstepdetails",
                                        localField: "_id",
                                        foreignField: "stepId",
                                        as: "details"
                                    }
                                },
                                { $unwind: { path: "$details", preserveNullAndEmptyArrays: true } },
                                {
                                    $project: {
                                        createdAt: 0,
                                        updatedAt: 0,
                                        __v: 0,
                                        "details.createdAt": 0,
                                        "details.updatedAt": 0,
                                        "details.__v": 0
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $project: {
                            createdAt: 0,
                            updatedAt: 0,
                            __v: 0
                        }
                    }
                ]
            }
        },
        {
            $project: {
                createdAt: 0,
                updatedAt: 0,
                __v: 0
            }
        }
    ];

    const [workouts, totalCount] = await Promise.all([
        Workout.aggregate(pipeline),
        Workout.countDocuments({ userId: req.userId })
    ]);

    const totalPages = Math.ceil(totalCount / pageSize);

    return res.status(200).json({
        message: "Workouts retrieved successfully",
        data: workouts,
        pagination: {
            currentPage: page,
            totalPages,
            totalItems: totalCount,
            itemsPerPage: pageSize,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
        }
    });
};

export const deleteWorkout = async (req, res) => {
    try {
        const workoutId = req.params.id;
        
        // Check if workout exists and belongs to the user
        const workout = await Workout.findOne({ _id: workoutId, userId: req.userId });
        
        if (!workout) {
            return res.status(404).json({ message: "Workout not found" });
        }
        //check if it assigned to athelete or not
        const assignment = await WorkoutAssignment.findOne({ workoutId });
        if (assignment) {
            return res.status(400).json({ message: "Workout is assigned to an athlete" });
        }

        // Delete based on workout type
        if (workout.workoutType === "gym") {
            // Get all gym workout sets for this workout
            const sets = await GymWorkoutSet.find({ workoutId }).lean();
            const setIds = sets.map(set => set._id);
            
            // Delete gym workout set details
            await GymWorkoutSetDetail.deleteMany({ setId: { $in: setIds } });
            
            // Delete gym workout sets
            await GymWorkoutSet.deleteMany({ workoutId });
        } else {
            // Normal coach workout - delete sections and their steps
            const sections = await CoachWorkoutSection.find({ workoutId }).lean();
            const sectionIds = sections.map(section => section._id);
            
            // Get all steps
            const steps = await CoachWorkoutStep.find({ sectionId: { $in: sectionIds } }).lean();
            const stepIds = steps.map(step => step._id);
            
            // Delete step details
            await CoachWorkoutStepDetail.deleteMany({ stepId: { $in: stepIds } });
            
            // Delete steps
            await CoachWorkoutStep.deleteMany({ sectionId: { $in: sectionIds } });
            
            // Delete sections
            await CoachWorkoutSection.deleteMany({ workoutId });
        }
        
        // Finally, delete the workout itself
        await Workout.findByIdAndDelete(workoutId);
        
        return res.status(200).json({ 
            message: "Workout and all related data deleted successfully" 
        });
        
    } catch (error) {
        console.error('Delete workout error:', error);
        res.status(500).json({ 
            message: "Failed to delete workout", 
            error: error?.message   
        });
    }
};