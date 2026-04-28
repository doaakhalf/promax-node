
import User from "../Models/User.js";
import Coach from "../Models/Coach.js";
import Certificate from "../Models/Certificate.js";
import CoachResource from "../config/Resources/CoachResource.js";

export const register = async (req, res, next) => {
  try {
    
  } catch (err) {
    next(err);
  }
}

export const getCoaches = async (req, res, next) => {
  try {
   
    const coaches = await Coach.find({ type: "gym" }).populate("userId").lean();

    res.json(CoachResource.collection(coaches));
  } catch (err) {
    next(err);
  }
};


export async function completeCoachProfile(req, res) {
  try {
    
    
    const user = req.user;
    const body = req.body;
    const files = req.files || {};

   

    // Handle photo upload
    let photoUrl = null;
    if (files.photo && files.photo[0]) {
      const photoFile = files.photo[0];
      photoUrl = `/images/${req.uploadFolder}/${photoFile.filename}`;
    }

    // Update user basic info
    await User.findByIdAndUpdate(user._id, {
      firstName: body.first_name.trim(),
      lastName: body.last_name.trim(),
      phoneNumber: body.phone_number.trim(),
      status: "pending",
    });

    // Parse best_record if provided
    let bestRecord = null;
    if (body.best_record) {
      try {
        bestRecord = typeof body.best_record === "string" 
          ? JSON.parse(body.best_record) 
          : body.best_record;
      } catch (e) {
        bestRecord = body.best_record;
      }
    }

    // Update or create coach profile
    const coach = await Coach.findOneAndUpdate(
      { userId: user._id },
      {
        userId: user._id,
        type: body.type,
        sport: body.sport.trim(),
        bestRecord: bestRecord,
        introduction: body.introduction?.trim() || null,
        trainingExperience: body.training_experience.trim(),
        motivation: body.motivation.trim(),
        headline: body.headline.trim(),
        photo: photoUrl,
        videoUrl: body.video_url?.trim() || null,
        monthlyPriceEgp: parseFloat(body.monthly_price_egp),
        instapayLink: body.instapay_link.trim(),
        
      },
      { upsert: true, new: true, runValidators: true }
    );

    // Handle certifications if provided
    if (body.certifications && Array.isArray(body.certifications)) {
      // Delete existing certificates to avoid duplicates
      await Certificate.deleteMany({ userId: user._id });

      // Create new certificates
      const certificateDocs = body.certifications.map((cert) => ({
        userId: user._id,
        certificateName: cert.certificate_name.trim(),
        year: parseInt(cert.year),
        certificateImage: cert.certificate_image || "",
      }));

      if (certificateDocs.length > 0) {
        await Certificate.insertMany(certificateDocs);
      }
    }

    // Fetch updated user with populated data
    const updatedUser = await User.findById(user._id)
      .populate("role_id")
      .lean();

    const coachProfile = await Coach.findOne({ userId: user._id }).lean();
    const certificates = await Certificate.find({ userId: user._id }).lean();

    return res.json({
      message: "Coach profile completed successfully",
      user: {
        ...updatedUser,
        coachProfile: {
          ...coachProfile,
          certificates,
        },
      },
      profile_complete: true,
      coach_type: coachType,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Failed to complete coach profile",
      error: err?.message || err,
    });
  }
}