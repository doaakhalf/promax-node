
import User from "../Models/User.js";
import Coach from "../Models/Coach.js";
import Certificate from "../Models/Certificate.js";
import CoachResource from "../config/Resources/CoachResource.js";
import CoachResourceForAthelete from "../config/Resources/CoachResourceForAthelete.js";

export const register = async (req, res, next) => {
  try {
    
  } catch (err) {
    next(err);
  }
}

export const getCoaches = async (req, res, next) => {
  try {
   const status = req.query?.status || null;
 
    // const matchStage = { type: "gym" };
    
    const coaches = await Coach.aggregate([
      // { $match: matchStage },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "userId"
        }
      },
      
      { $unwind: "$userId" },
      ...(status ? [{ $match: { "userId.status": status } }] : [])
    ]);
    // const coaches = await Coach.find({ type: "gym"}).populate("userId").lean();

    res.status(200).json({
      "status": "success",
      "message": "Retrieved Data successfully.",
      coaches: CoachResource.collection(coaches,{},req.userId)
    });
  } catch (err) {
    next(err);
  }
};

export const getCoachesWithSubscription = async (req, res, next) => {
  
  try {
   const status = req.query?.status || null;
  
    // const matchStage = { type: "gym" };

    
    const coaches = await Coach.aggregate([
      // { $match: matchStage },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "userId"
        }
      },
       { $unwind: "$userId" },
      {
        $lookup: {
          from: "subscriptions",
          localField: "userId._id",
          foreignField: "coachId",
          as: "subscriptions"
        }
      },
      
    
      ...(status ? [{ $match: { "userId.status": status } }] : [])
    ]);

 
  
    res.status(200).json({
      "status": "success",
      "message": "Retrieved Data successfully.",
      coaches: CoachResourceForAthelete.collection(coaches, {}, req.userId)
    });
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

export const activateCoach = async (req, res, next) => {
  try {
    const { id } = req.params;
    const coach = await Coach.findOne({ userId: id }).populate("userId");
    if (!coach) {
      return res.status(404).json({
        message: "Coach not found",
      });
    }
    coach.userId.status = "active";
    await coach.userId.save();
    res.status(200).json({
      message: "Coach activated successfully",
    });
  } catch (err) {
    next(err);
  }
}

import Subscription from "../Models/Subscription.js";

export const getCoachAthletes = async (req, res, next) => {
  try {
    const coachUserId = req.userId;

    // Find active subscriptions for this coach
    const subscriptions = await Subscription.find({
      coachId: coachUserId,
      status: "active"
    })
    .populate({
      path: 'athleteId',
      select: 'firstName lastName email phoneNumber profileImage'
    })
    .lean();

    // Format the response
    const athletes = subscriptions.map(sub => ({
      subscriptionId: sub._id,
      athlete: {
        id: sub.athleteId._id,
        name: `${sub.athleteId.firstName} ${sub.athleteId.lastName || ''}`.trim(),
        email: sub.athleteId.email,
        phoneNumber: sub.athleteId.phoneNumber,
        profileImage: sub.athleteId.profileImage
      },
      subscription: {
        plan: sub.subscriptionPlan,
        amount: parseFloat(sub.amount.$numberDecimal ?? sub.amount),
        currency: sub.currency,
        startDate: sub.startDate,
        endDate: sub.endDate,
        paymentStatus: sub.paymentStatus
      }
    }));

    res.status(200).json({
      status: "success",
      message: "Retrieved athletes successfully",
      count: athletes.length,
      data: athletes
    });

  } catch (err) {
    console.error('Get coach athletes error:', err);
    next(err);
  }
};
