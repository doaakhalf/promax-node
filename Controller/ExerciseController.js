import mongoose from "mongoose";
import Exercise from "../Models/Exercise.js";
import GymWorkoutSet from "../Models/GymWorkoutSet.js";
import {
  isTargetBodyPart,
  parseTargetBodyPartsQuery,
} from "../utils/targetBodyParts.js";

const PUBLIC_EXERCISE_SOURCES = ["exercisedb", "freepack"];
const BODY_PART_COLLATION = { locale: "en", strength: 2 };

export const  create=async(req, res,next)=> {
    try {
            const file = req.file;
            const imageUrl = file ? `/images/${req.uploadFolder}/${file.filename}` : null;

            const exerciseData = {
            userId: req.userId,
            nameEn: req.body.nameEn.trim(),
            nameAr: req.body.nameAr.trim(),
            type: req.body.type.trim(),
            equipment: req.body.equipment?.trim() || null,
            targetBodyParts: req.body.targetBodyParts,
            descriptionEn: req.body.descriptionEn?.trim() || null,
            descriptionAr: req.body.descriptionAr?.trim() || null,
            image: imageUrl,
            videoUrl: req.body.videoUrl?.trim() || null,
            };
            try{
                  const newExercise = new Exercise(exerciseData);
                  await newExercise.save();
                  
                  res.status(201).json({
                  message: "Exercise created successfully",
                  data: newExercise,
                  });
            }
            catch(err){
                res.status(500).json({ message: "Failed to create exercise", error: err?.message });
            }
        
  } catch (err) {
    res.status(500).json({ message: "Failed to create exercise", error: err?.message });
  }
 
}

export const update = async (req, res, next) => {
  try {
    const exerciseId = req.params.id;
    const exercise = await Exercise.findById(exerciseId);

    if (!exercise) {
      return res.status(404).json({ message: "Exercise not found" });
    }

    if (exercise.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: "You are not authorized to update this exercise" });
    }

    if (PUBLIC_EXERCISE_SOURCES.includes(exercise.source)) {
      return res.status(400).json({ message: "You are not authorized to update this exercise" });
    }

    const updateData = {
      nameEn: req.body.nameEn.trim(),
      nameAr: req.body.nameAr.trim(),
      type: req.body.type.trim(),
      equipment: req.body.equipment?.trim() || null,
      targetBodyParts: req.body.targetBodyParts,
      descriptionEn: req.body.descriptionEn?.trim() || null,
      descriptionAr: req.body.descriptionAr?.trim() || null,
      videoUrl: req.body.videoUrl?.trim() || null,
    };

    if (req.file) {
      updateData.image = `/images/${req.uploadFolder}/${req.file.filename}`;
    }

    const newExercise = await Exercise.findByIdAndUpdate(exerciseId, updateData, {
      returnDocument: "after",
    });

    return res.status(200).json({
      message: "Exercise updated successfully",
      data: newExercise,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update exercise", error: error?.message });
  }
};

export const getAll = async (req, res, next) => {
    try {
        // Get pagination parameters from query string
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        const skip = (page - 1) * pageSize;
        const coachUserId = new mongoose.Types.ObjectId(req.userId);
        const targetBodyParts = parseTargetBodyPartsQuery(req.query.targetBodyParts);
        const unknownParts = targetBodyParts.filter((part) => !isTargetBodyPart(part));
        if (unknownParts.length > 0) {
            return res.status(400).json({
                message: "Invalid target body parts",
                errors: {
                    targetBodyParts: `Unknown values: ${unknownParts.join(", ")}`,
                },
            });
        }

        // Coach-owned exercises OR shared catalog (ExerciseDB + Free Pack).
        // When targetBodyParts is sent, keep exercises that include any of them.
        const filter = {
            $and: [
                {
                    $or: [
                        { userId: coachUserId },
                        { source: { $in: PUBLIC_EXERCISE_SOURCES } },
                    ],
                },
                ...(targetBodyParts.length
                    ? [{ targetBodyParts: { $in: targetBodyParts } }]
                    : []),
            ],
        };

        const countQuery = Exercise.countDocuments(filter);
        const exercisesQuery = Exercise.aggregate([
            { $match: filter },
            {
                $addFields: {
                    _coachFirst: {
                        $cond: [{ $eq: ["$userId", coachUserId] }, 0, 1],
                    },
                },
            },
            { $sort: { _coachFirst: 1, createdAt: -1, _id: -1 } },
            { $skip: skip },
            { $limit: pageSize },
            { $project: { _coachFirst: 0 } },
        ]);

        // Stored values still mix case ("abs" and "Abs") until the next save.
        if (targetBodyParts.length > 0) {
            countQuery.collation(BODY_PART_COLLATION);
            exercisesQuery.collation(BODY_PART_COLLATION);
        }

        const totalExercises = await countQuery;
        const exercises = await exercisesQuery;

        // Calculate pagination metadata
        const totalPages = Math.ceil(totalExercises / pageSize);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        res.status(200).json({
            message: "Exercises retrieved successfully",
            data: exercises,
            pagination: {
                currentPage: page,
                totalPages,
                totalItems: totalExercises,
                itemsPerPage: pageSize,
                hasNextPage,
                hasPrevPage,
            }
        });
    } catch (error) {
        res.status(500).json({ 
            message: "Failed to retrieve exercises", 
            error: error?.message   
        });
    }
};
export const getExternalExercises = async (req, res, next) => {
    try {
        // Get pagination parameters from query string
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        const skip = (page - 1) * pageSize;
        const targetBodyParts = parseTargetBodyPartsQuery(req.query.targetBodyParts);
        const unknownParts = targetBodyParts.filter((part) => !isTargetBodyPart(part));
        if (unknownParts.length > 0) {
            return res.status(400).json({
                message: "Invalid target body parts",
                errors: {
                    targetBodyParts: `Unknown values: ${unknownParts.join(", ")}`,
                },
            });
        }

        const filter = {
            source: { $in: PUBLIC_EXERCISE_SOURCES },
            ...(targetBodyParts.length
                ? { targetBodyParts: { $in: targetBodyParts } }
                : {}),
        };

        const countQuery = Exercise.countDocuments(filter);
        const exercisesQuery = Exercise.find(filter)
            .skip(skip)
            .limit(pageSize)
            .select("-__v -createdAt -updatedAt")
            .sort({ createdAt: -1, _id: -1 })
            .lean();

        if (targetBodyParts.length > 0) {
            countQuery.collation(BODY_PART_COLLATION);
            exercisesQuery.collation(BODY_PART_COLLATION);
        }

        const totalExercises = await countQuery;
        const exercises = await exercisesQuery;


        // Calculate pagination metadata
        const totalPages = Math.ceil(totalExercises / pageSize);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        res.status(200).json({
            message: "Exercises retrieved successfully",
            data: exercises,
            pagination: {
                currentPage: page,
                totalPages,
                totalItems: totalExercises,
                itemsPerPage: pageSize,
                hasNextPage,
                hasPrevPage,
            }
        });
    } catch (error) {
        res.status(500).json({ 
            message: "Failed to retrieve exercises", 
            error: error?.message   
        });
    }
};
export const deleteExercise = async (req, res, next) => {
    try {
        const exerciseId = req.params.id;

        const exercise = await Exercise.findById(exerciseId);
        if (
          PUBLIC_EXERCISE_SOURCES.includes(exercise.source) &&
          exercise.userId.toString() !== req.userId.toString()
        ) {
            return res.status(400).json({ message: "You are not authorized to delete this exercise" });
        }
        if (!exercise) {
            return res.status(404).json({ message: "Exercise not found" });
        }
        // Check if exercise is used in any workout
        const workoutSet = await GymWorkoutSet.findOne({ exerciseId });
        if (workoutSet) {
            return res.status(400).json({ message: "Exercise is used in a workout" });
        }
        if (exercise.userId.toString() !== req.userId.toString()) {
            return res.status(403).json({ message: "You are not authorized to delete this exercise" });
        }
        // Delete the exercise
        await Exercise.findByIdAndDelete(exerciseId);
        
        res.status(200).json({
            message: "Exercise deleted successfully",
        });
    } catch (error) {
        res.status(500).json({ message: "Failed to delete exercise", error: error?.message });
    }
};
