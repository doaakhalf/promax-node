import Coach from "../Models/Coach.js";
import Workout from "../Models/Workout.js";
import GymWorkoutSet from "../Models/GymWorkoutSet.js";
import GymWorkoutSetDetail from "../Models/GymWorkoutSetDetail.js";
import WorkoutAssignment from "../Models/WorkoutAssignment.js";
import Subscription from "../Models/Subscription.js";
import User from "../Models/User.js";
import WorkoutDataResource from "../config/Resources/WorkoutDataResource.js";
import { displayName } from "../utils/displayName.js";

const getActiveAssignmentImpact = async (workoutId, coachUserId) => {
  const assignments = await WorkoutAssignment.find({
    workoutId,
    deletedAt: null,
  }).lean();

  if (!assignments.length) {
    return { assignmentCount: 0, affectedAthletes: [] };
  }

  const athleteIds = [
    ...new Set(assignments.map((a) => a.athleteId.toString())),
  ];

  const activeSubs = await Subscription.find({
    coachId: coachUserId,
    athleteId: { $in: athleteIds },
    status: "active",
    deletedAt: null,
  })
    .select("athleteId")
    .lean();

  if (!activeSubs.length) {
    return { assignmentCount: 0, affectedAthletes: [] };
  }

  const activeAthleteIds = [
    ...new Set(activeSubs.map((s) => s.athleteId.toString())),
  ];

  const activeAssignmentCount = assignments.filter((a) =>
    activeAthleteIds.includes(a.athleteId.toString())
  ).length;

  const users = await User.find({ _id: { $in: activeAthleteIds } })
    .select("firstName lastName email")
    .lean();

  const affectedAthletes = users.map((u) => ({
    id: u._id.toString(),
    name: displayName(u, { full: true }),
    email: u.email || null,
  }));

  return {
    assignmentCount: activeAssignmentCount,
    affectedAthletes,
  };
};

export const createWorkout = async (req, res) => {
  let data = req.body;
  console.log(data, "workout data creation");
  const userId = req.userId;
  const coach = await Coach.findOne({ userId }).lean();

  if (!coach) {
    return res.status(404).json({ message: "Coach profile not found" });
  }

  if (typeof data.sets === "string") {
    try {
      data.sets = JSON.parse(data.sets);
    } catch (e) {
      return res.status(400).json({
        message: "Invalid sets format. Must be valid JSON array.",
      });
    }
  }

  if (!Array.isArray(data.sets) || data.sets.length === 0) {
    return res.status(400).json({ message: "sets must be a non-empty array." });
  }

  const workoutData = {
    userId,
    workoutType: coach.type,
    name: data.name,
    description: data.description,
  };

  try {
    const workout = await Workout.create(workoutData);
    const gymWorkoutSets = [];
    const setDetails = [];

    for (const workoutSet of data.sets) {
      const gymWorkoutSet = await GymWorkoutSet.create({
        workoutId: workout._id,
        exerciseId: workoutSet.exerciseId,
        order: workoutSet.order,
        notes: workoutSet.notes,
      });

      const detail = await GymWorkoutSetDetail.create({
        setId: gymWorkoutSet._id,
        durationType: workoutSet.durationType,
        durationValue: workoutSet.durationValue,
        sets: workoutSet.sets,
        reps: workoutSet.reps,
        restSeconds: workoutSet.rest,
        weight: workoutSet.weight,
      });

      gymWorkoutSets.push(gymWorkoutSet);
      setDetails.push(detail);
    }

    return res.status(201).json({
      message: "Workout created successfully",
      data: {
        workout,
        gymWorkoutSets,
        setDetails,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateWorkout = async (req, res) => {
  let data = req.body;

  const userId = req.userId;
  const workoutId = req.params.id;
  const coach = await Coach.findOne({ userId }).lean();

  if (!coach) {
    return res.status(404).json({ message: "Coach profile not found" });
  }

  if (typeof data.sets === "string") {
    try {
      data.sets = JSON.parse(data.sets);
    } catch (e) {
      return res.status(400).json({
        message: "Invalid sets format. Must be valid JSON array.",
      });
    }
  }

  if (!Array.isArray(data.sets) || data.sets.length === 0) {
    return res.status(400).json({ message: "sets must be a non-empty array." });
  }

  try {
    const workout = await Workout.findOne({ _id: workoutId, userId });
    if (!workout) {
      return res.status(404).json({ message: "Workout not found" });
    }

    const confirmed =
      data.confirmAssignedEdit === true || data.confirmAssignedEdit === "true";

    if (!confirmed) {
      const impact = await getActiveAssignmentImpact(workoutId, userId);
      if (impact.affectedAthletes.length > 0) {
        return res.status(409).json({
          message:
            "هذا التمرين معيّن لرياضيين لديهم اشتراك نشط. أكّد للمتابعة.",
          code: "WORKOUT_ASSIGNED_ACTIVE",
          needsConfirmation: true,
          affectedAthletes: impact.affectedAthletes,
          assignmentCount: impact.assignmentCount,
        });
      }
    }

    if (data.name !== undefined) workout.name = data.name;
    if (data.description !== undefined) workout.description = data.description;
    await workout.save();

    const existingSets = await GymWorkoutSet.find({ workoutId }).lean();
    const existingSetIds = existingSets.map((set) => set._id);
    if (existingSetIds.length) {
      await GymWorkoutSetDetail.deleteMany({ setId: { $in: existingSetIds } });
      await GymWorkoutSet.deleteMany({ workoutId });
    }

    const gymWorkoutSets = [];
    const setDetails = [];

    for (const workoutSet of data.sets) {
      const gymWorkoutSet = await GymWorkoutSet.create({
        workoutId: workout._id,
        exerciseId: workoutSet.exerciseId,
        order: workoutSet.order,
        notes: workoutSet.notes,
      });

      const detail = await GymWorkoutSetDetail.create({
        setId: gymWorkoutSet._id,
        durationType: workoutSet.durationType,
        durationValue: workoutSet.durationValue,
        sets: workoutSet.sets,
        reps: workoutSet.reps,
        restSeconds: workoutSet.rest,
        weight: workoutSet.weight,
      });

      gymWorkoutSets.push(gymWorkoutSet);
      setDetails.push(detail);
    }

    return res.status(200).json({
      message: "Workout updated successfully",
      data: {
        workout,
        gymWorkoutSets,
        setDetails,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

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
                        $addFields: {
                            "details.weight": {
                                $convert: {
                                    input: "$details.weight",
                                    to: "double",
                                    onError: null,
                                    onNull: null,
                                },
                            },
                            "details.durationValue": {
                                $convert: {
                                    input: "$details.durationValue",
                                    to: "double",
                                    onError: null,
                                    onNull: null,
                                },
                            },
                        },
                    },
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
export const getWorkout = async (req, res) => {
    try {
        const workoutId = req.params.id;
        
        // Get all gym workout sets for this workout with populated exercise data
        const gymWorkoutSets = await GymWorkoutSet.find({ workoutId: workoutId })
            .populate('exerciseId')
            .populate('workoutId')
            .sort({ order: 1 })
            .lean();
        
        if (!gymWorkoutSets || gymWorkoutSets.length === 0) {
            return res.status(404).json({ message: "Workout not found" });
        }
        
        // Get all set details for these workout sets
        const setIds = gymWorkoutSets.map(set => set._id);
        const setDetails = await GymWorkoutSetDetail.find({ setId: { $in: setIds } }).lean();
        
        // Group data by exercise
        const exercisesMap = new Map();
        
        gymWorkoutSets.forEach(gymSet => {
            const exerciseId = gymSet.exerciseId._id.toString();
            
            // Get set details for this gym workout set
            const setsForThisExercise = setDetails.filter(
                detail => detail.setId.toString() === gymSet._id.toString()
            );
            
            if (!exercisesMap.has(exerciseId)) {
                exercisesMap.set(exerciseId, {
                    exercise: gymSet.exerciseId,
                    order: gymSet.order,
                    notes: gymSet.notes,
                    sets: []
                });
            }
            
            // Add this gym workout set with its details
            exercisesMap.get(exerciseId).sets.push({
                gymWorkoutSetId: gymSet._id,
                order: gymSet.order,
                notes: gymSet.notes,
                setDetails: setsForThisExercise.map(detail => ({
                    id: detail._id,
                    durationType: detail.durationType,
                    durationValue: detail.durationValue ? parseFloat(detail.durationValue.toString()) : null,
                    sets: detail.sets,
                    reps: detail.reps,
                    restSeconds: detail.restSeconds,
                    weightType: detail.weightType,
                    weight: detail.weight ? parseFloat(detail.weight.toString()) : null
                }))
            });
        });
        
        // Convert map to array and sort by order
        const exercises = Array.from(exercisesMap.values()).sort((a, b) => a.order - b.order);

        return res.status(200).json({ 
            message: "Workout retrieved successfully",
            data: {
                workoutId: workoutId,
                workout: gymWorkoutSets[0]?.workoutId || null,
                exercises: exercises
            }
        });
        
    } catch (error) {
        console.error('Get workout error:', error);
        res.status(500).json({ 
            message: "Failed to get workout", 
            error: error?.message   
        });
    }
};
