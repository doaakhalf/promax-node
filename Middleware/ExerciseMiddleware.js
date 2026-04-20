export const ExerciseMiddleware = async (req, res, next) => {
  const data = req.body;
  const file = req.file;
  


  const errors = {};

  if (!data.nameEn || typeof data.nameEn !== "string" || data.nameEn.trim().length === 0) {
    errors.nameEn = "English name is required";
  }

  if (!data.nameAr || typeof data.nameAr !== "string" || data.nameAr.trim().length === 0) {
    errors.nameAr = "Arabic name is required";
  }

  if (!data.type || typeof data.type !== "string" || data.type.trim().length === 0) {
    errors.type = "Type is required";
  }

  if (!data.targetBodyParts) {
    errors.targetBodyParts = "Target body parts are required";
  } else {
    try {
      const parts = typeof data.targetBodyParts === "string" 
        ? JSON.parse(data.targetBodyParts) 
        : data.targetBodyParts;
      
      if (!Array.isArray(parts) || parts.length === 0) {
        errors.targetBodyParts = "Target body parts must be a non-empty array";
      } else {
        req.body.targetBodyParts = parts;
      }
    } catch (e) {
      errors.targetBodyParts = "Invalid target body parts format";
    }
  }

  if (!file) {
    errors.image = "Image file is required";
  }

  if (Object.keys(errors).length > 0) {
    return res.status(422).json({
      message: "Validation error",
      errors,
    });
  }

  next();
};