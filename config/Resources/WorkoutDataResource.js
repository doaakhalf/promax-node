class WorkoutDataResource {
  constructor(gymWorkoutSet, setDetails) {
    // this.id = gymWorkoutSet._id;
    
    // Workout details
    this.workout = {
      id: gymWorkoutSet.workoutId._id,
      userId: gymWorkoutSet.workoutId.userId,
      workoutType: gymWorkoutSet.workoutId.workoutType,
      name: gymWorkoutSet.workoutId.name,
      description: gymWorkoutSet.workoutId.description,
      instructions: gymWorkoutSet.workoutId.instructions,
      isTemplate: gymWorkoutSet.workoutId.isTemplate
    };
    
    // Exercise details
    this.exercise = {
      id: gymWorkoutSet.exerciseId._id,
      userId: gymWorkoutSet.exerciseId.userId,
      nameEn: gymWorkoutSet.exerciseId.nameEn,
      nameAr: gymWorkoutSet.exerciseId.nameAr,
      type: gymWorkoutSet.exerciseId.type,
      targetBodyParts: gymWorkoutSet.exerciseId.targetBodyParts,
      descriptionEn: gymWorkoutSet.exerciseId.descriptionEn,
      descriptionAr: gymWorkoutSet.exerciseId.descriptionAr,
      image: gymWorkoutSet.exerciseId.image,
      videoUrl: gymWorkoutSet.exerciseId.videoUrl
    };
    
    this.order = gymWorkoutSet.order;
    this.notes = gymWorkoutSet.notes;
     // Set details
    this.setDetails = setDetails.map(detail => ({
      id: detail._id,
      durationType: detail.durationType,
      durationValue: detail.durationValue 
        ? parseFloat(detail.durationValue.$numberDecimal || detail.durationValue) 
        : null,
      sets: detail.sets || null,
      reps: detail.reps || null,
      restSeconds: detail.restSeconds,
      weightType: detail.weightType,
      weight: detail.weight 
        ? parseFloat(detail.weight.$numberDecimal || detail.weight) 
        : null
    }));
  }

  static single(gymWorkoutSet, setDetails) {
    return new WorkoutDataResource(gymWorkoutSet, setDetails);
  }
}

export default WorkoutDataResource;