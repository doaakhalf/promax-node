import Exercise from "../Models/Exercise.js";
import GymWorkoutSet from "../Models/GymWorkoutSet.js";

export const  create=async(req, res,next)=> {
    try {
            const file = req.file;
            const imageUrl = file ? `/images/${req.uploadFolder}/${file.filename}` : null;

            const exerciseData = {
            userId: req.userId,
            nameEn: req.body.nameEn.trim(),
            nameAr: req.body.nameAr.trim(),
            type: req.body.type.trim(),
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

export const update=async(req,res,next)=>{
    try{
            const exerciseId=req.params.id;
            const exercise=await Exercise.findById(exerciseId);
            let imageUrl=''
            if(!exercise){
                return res.status(404).json({message:"Exercise not found"});
            }
          
            if(req.file&&req.file.image){
                 imageUrl = `/images/${req.uploadFolder}/${req.file.image.filename}`;
            }
            const $newData={
             
                 
                    nameAr:req.body.nameAr.trim(),
                    nameEn:req.body.nameEn.trim(),
                    type:req.body.type.trim(),
                    targetBodyParts:req.body.targetBodyParts,
                    descriptionEn:req.body.descriptionEn?.trim() || null,
                    descriptionAr:req.body.descriptionAr?.trim() || null,
                    image:imageUrl,
                    videoUrl:req.body.videoUrl
            }
             let newExercise=await Exercise.findByIdAndUpdate(exerciseId, $newData);

                res.status(200).json({
                message: "Exercise updated successfully",
                data: newExercise,
                });
    } catch (error) {
        res.status(500).json({ message: "Failed to update exercise", error: error?.message });
    }
}

export const getAll = async (req, res, next) => {
    try {
        // Get pagination parameters from query string
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        const skip = (page - 1) * pageSize;

        // Get total count for pagination metadata
        const totalExercises = await Exercise.find({userId:req.userId}).countDocuments();
        
        // Fetch paginated exercises
        const exercises = await Exercise.find({userId:req.userId})
            .skip(skip)
            .limit(pageSize)
            .lean();

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