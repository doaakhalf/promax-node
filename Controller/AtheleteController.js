import Subscription from "../Models/Subscription.js";
import Coach from "../Models/Coach.js";
import SubscriptionPayment from "../Models/SubscriptionPayment.js";
import WorkoutCalendar from "../Models/WorkoutCalendar.js";

export const Subscribe = async (req, res) => {
  try {
    const coachId = req.params.coachId;
    const athleteId = req.userId;

    const { subscriptionPlan, paymentMethod, transactionId } = req.body;

 
    // Verify coach exists
    const coach = await Coach.findOne({ userId: coachId }).lean();
    if (!coach) {
      return res.status(404).json({ message: "Coach not found" });
    }

    // Check if athlete already has an active subscription with this coach
    const existingSubscription = await Subscription.findOne({
      coachId,
      athleteId,
      status: { $in: ["active", "pending"] }
    });

    if (existingSubscription) {
      return res.status(400).json({ 
        message: "You already have an active or pending subscription with this coach" 
      });
    }

    // Calculate subscription dates (1 month)
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);
 // instapay payments receipt
    const file = req.file;
    const imageUrl = file ? `/images/${req.uploadFolder}/${file.filename}` : null;
   
    // Create subscription
    const {subscription, subscriptionPayment} = await Subscription.create({
      coachId,
      athleteId,
      subscriptionPlan: subscriptionPlan || "monthly",
      amount: coach.monthlyPriceEgp,
      currency: "EGP",
      paymentMethod: paymentMethod || 'instapay',
      paymentStatus: "pending",
      transactionId: transactionId || null,
      startDate,
      endDate,
      status: "pending"
    }).then(async (subscription) => {
      const subscriptionPayment = await SubscriptionPayment.create({
        subscriptionId: subscription._id,
        paymentMethod: paymentMethod || 'instapay',
        paymentStatus: "pending",
        transactionId: transactionId || null,
        paymentImage: imageUrl
      });
      return {subscription, subscriptionPayment};
    });

  

    return res.status(201).json({
      message: "Subscription created successfully",
      subscription: {
        id: subscription._id,
        coachId: subscription.coachId,
        subscriptionPlan: subscription.subscriptionPlan,
        amount: parseFloat(subscription.amount.$numberDecimal ?? subscription.amount),
        currency: subscription.currency,
        paymentStatus: subscription.paymentStatus,
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        paymentMethod: subscriptionPayment.paymentMethod,
        transactionId: subscriptionPayment.transactionId,
        paymentImage: subscriptionPayment.paymentImage
      }
    });

  } catch (error) {
    console.error('Subscribe error:', error);
    return res.status(500).json({ 
      message: "Failed to create subscription", 
      error: error?.message 
    });
  }
};

export const getWorkouts = async (req, res) => {
  try {
    const athleteId = req.userId;
    
    // Find all active subscriptions for the athlete
    const activeSubscriptions = await Subscription.find({
      athleteId,
      status: "active"
    }).lean();
    
    if (!activeSubscriptions || activeSubscriptions.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "No active subscriptions found"
      });
    }
    
    // Get all workout calendars for active subscriptions
    const subscriptionIds = activeSubscriptions.map(sub => sub._id);
    
    const athleteWorkoutCalendars = await WorkoutCalendar.find({
      athleteId,
      subscriptionId: { $in: subscriptionIds },
      status: "active"
    })
    .populate({
      path: 'subscriptionId',
      select: 'startDate endDate subscriptionPlan amount status'
    })
    .populate({
      path: 'coachId',
       select: 'firstName lastName email phoneNumber profileImage'
    })
    .populate({
      path: 'weeks.trainingDays.workoutId',
      select: 'name description workoutType'
    })
    .lean();
    
    if (!athleteWorkoutCalendars || athleteWorkoutCalendars.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "No workout calendars found for active subscriptions"
      });
    }
    
    // Format response
    const formattedCalendars = athleteWorkoutCalendars.map(calendar => ({
      calendarId: calendar._id,
      coach: {
        id: calendar.coachId._id,
        name: `${calendar.coachId.firstName} ${calendar.coachId.lastName}`,
        email: calendar.coachId.email,
        phoneNumber: calendar.coachId.phoneNumber,
        profileImage: calendar.coachId.profileImage,
        coachType: calendar.coachId.coachType,
        specialization: calendar.coachId.specialization
      },
      subscription: {
        id: calendar.subscriptionId._id,
        plan: calendar.subscriptionId.subscriptionPlan,
        amount: parseFloat(calendar.subscriptionId.amount.$numberDecimal ?? calendar.subscriptionId.amount),
        startDate: calendar.subscriptionId.startDate,
        endDate: calendar.subscriptionId.endDate,
        status: calendar.subscriptionId.status
      },
      trainingFrequency: calendar.trainingFrequency,
      totalWeeks: calendar.weeks.length,
      weeks: calendar.weeks.map(week => ({
        weekNumber: week.weekNumber,
        startDate: week.startDate,
        endDate: week.endDate,
        isOpen: week.isOpen,
        trainingDays: week.trainingDays.map(day => ({
          dayNumber: day.dayNumber,
          date: day.date,
          isAssigned: day.isAssigned,
          completedAt: day.completedAt,
          workout: day.workoutId ? {
            id: day.workoutId._id,
            name: day.workoutId.name,
            description: day.workoutId.description,
            type: day.workoutId.workoutType
          } : null
        }))
      }))
    }));
    
    res.status(200).json({
      status: "success",
      message: "Workout calendars retrieved successfully",
      totalCalendars: formattedCalendars.length,
      data: formattedCalendars
    });
    
  } catch (error) {
    console.error('Get athlete workouts error:', error);
    res.status(500).json({
      status: "error",
      message: "Failed to retrieve workout calendars",
      error: error.message
    });
  }
};

