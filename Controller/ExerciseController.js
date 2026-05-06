import Exercise from "../Models/Exercise.js";

export class ExerciseController{
    

        create=async(req, res,next)=> {
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

 update=async(req,res,next)=>{
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
}
