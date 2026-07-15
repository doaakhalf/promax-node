import Subscription from "../Models/Subscription.js";
import Coach from "../Models/Coach.js";
import SubscriptionPayment from "../Models/SubscriptionPayment.js";
import WorkoutCalendar from "../Models/WorkoutCalendar.js";
import WorkoutAssignment from "../Models/WorkoutAssignment.js";
import Athlete from "../Models/Athlete.js";
import AthleteResource from "../config/Resources/AthleteResource.js";
import AthleteWorkoutCalendarResource from "../config/Resources/AthleteWorkoutCalendarResource.js";
import { resetTime } from "../utils/resetTime.js";
import NotificationService from "../services/NotificationService.js";

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
    const startDate = resetTime(new Date());
    const endDate = resetTime(new Date(startDate));
    endDate.setMonth(endDate.getMonth() + 1);

    // لو اليوم اتغير (زي 31 يناير -> 3 مارس)، رجعه لآخر يوم في الشهر الصح
    if (endDate.getDate() !== startDate.getDate()) {
      endDate.setDate(0); // 0 = آخر يوم في الشهر اللي قبله
    }
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
       select: 'firstName lastName email phoneNumber profileImage gender'
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
    
    
    res.status(200).json({
      status: "success",
      message: "Workout calendars retrieved successfully",
      totalCalendars: athleteWorkoutCalendars.length,
      data: AthleteWorkoutCalendarResource.collection(athleteWorkoutCalendars)
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

export const  completeWorkout = async (req,res) =>{

try{
        
        const athleteId=req.userId;
        const {notes,weekNumber,dayNumber,calendarId,workoutId}=req.body;


        const athleteWorkoutAssignee=await WorkoutAssignment.findOne({
            workoutId: workoutId,
            athleteId: athleteId,
            calendarId: calendarId,
            weekNumber: weekNumber,
            dayNumber: dayNumber,
        
            });
        if(!athleteWorkoutAssignee){
            return res.status(404).json({
                status: "error",
                message: "Workout assignment not found"
            });
        }
    // Check if already completed
        if (athleteWorkoutAssignee.status === "completed") {
        return res.status(400).json({
            status: "error",
            message: "Workout already completed"
        });
        }
        athleteWorkoutAssignee.status="completed";
        athleteWorkoutAssignee.athleteFeedback=notes;
        athleteWorkoutAssignee.completedAt=new Date();
        await athleteWorkoutAssignee.save();
       const calender= await WorkoutCalendar.findOneAndUpdate( 
            {
            _id: calendarId,
            "weeks.weekNumber": weekNumber,
            "weeks.trainingDays.dayNumber": dayNumber,
            "weeks.trainingDays.workoutId": workoutId
            }, {
            $set: {
                "weeks.$[week].trainingDays.$[day].completedAt": new Date(),
                "weeks.$[week].trainingDays.$[day].notes": notes

            }
            },
            {
                arrayFilters: [
                    { "week.weekNumber": weekNumber },
                    { "day.dayNumber": dayNumber }
                ],
                returnDocument:'after'
            }
        );


          if (!calender) {
      return res.status(404).json({
        status: "error",
        message: "Calendar or training day not found"
      });
    }
    await calender.populate('athleteId','firstName lastName');
    const atheleteName=calender.athleteId.firstName + ' ' + calender.athleteId.lastName;

      //send notification to athlete
      const notificationMessage = `تم إكمال تدريب لليوم ${dayNumber} في الأسبوع ${weekNumber} من الرياضي ${atheleteName}`;
       NotificationService.sendNotification(
       {
        recipientId: calender.coachId,
        senderId: athleteId,
        type: "workout_completed",
        title: "تم إكمال تدريب",
          message: notificationMessage,
          data: {
            calendarId: calendar._id.toString(),
            weekNumber: weekNumber,
            dayNumber: dayNumber,
            workoutId: workoutId
          }
        }
      );
 
    return res.status(200).json({
      status: "success",
      message: "Workout completed successfully",
      data: {
        assignmentId: athleteWorkoutAssignee._id,
        completedAt: athleteWorkoutAssignee.completedAt,
        notes: athleteWorkoutAssignee.athleteFeedback
      }
    });
 
    }
       
     catch (error) {
       return res.status(500).json({
            status: "error",
            message: error.message
        });
    }
    
};
export const getProfile=async (req,res) => {
    const athleteId=req.params.athleteId ? req.params.athleteId : req.userId;
    const athlete=await Athlete.findOne({userId:athleteId})
    .populate("userId");
    if(!athlete){
        return res.status(404).json(
            {
                status:"error",
                message:"Athlete not exist",

            }
        )
    }
    return res.status(200).json(
        {
            status:"success",
            message:"profile retrieved successfully",
            data:new AthleteResource(athlete)
        }
    )



}
