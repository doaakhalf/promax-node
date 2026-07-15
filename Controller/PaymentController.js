
import subscription from "../Models/Subscription.js";
import SubscriptionPayment from "../Models/SubscriptionPayment.js";
import SubscriptionPaymentResource from "../config/Resources/SubscriptionPaymentResource.js";
import {fetchAthleteCalendarData} from "./WorkoutCalendarController.js";
import NotificationService from "../services/NotificationService.js";
import { resetTime } from "../utils/dateUtils.js";

export const activatePayment=async(req,res)=>{
    try {
        const PaymentId=req.params.paymentId;
        const subscriptionRecord=await subscription.findById(PaymentId);
        await subscriptionRecord.populate('coachId');
        await subscriptionRecord.populate('athleteId');
        const today=new Date();
        
     
        subscriptionRecord.paymentStatus = req.body.status;
        subscriptionRecord.status = req.body.status;

        subscriptionRecord.startDate = resetTime(new Date());
        subscriptionRecord.endDate = resetTime(new Date(today.setMonth(today.getMonth() + 1)));
        
        const SubscriptionPaymentRecord=await SubscriptionPayment.findOne({subscriptionId: PaymentId});
        SubscriptionPaymentRecord.status = req.body.status;

        SubscriptionPaymentRecord.verifiedAt = new Date();
        SubscriptionPaymentRecord.verifiedBy = req.userId;
        SubscriptionPaymentRecord.rejectionReason =req.body.rejectionReason || null;
        await subscriptionRecord.save();
        await SubscriptionPaymentRecord.save();

        if(req.body.status === "active") {
            // Send notification to coach and athlete
            try {
                await fetchAthleteCalendarData(subscriptionRecord.coachId, subscriptionRecord.athleteId);
                
                const coachName = subscriptionRecord.coachId.firstName + " " + (subscriptionRecord.coachId.lastName?.charAt(0).toUpperCase() || '');
                const athleteName = subscriptionRecord.athleteId.firstName + " " + (subscriptionRecord.athleteId.lastName || '');
                
                // رسالة موحدة توضح الطرفين
                const notificationMessage = `تم قبول الاشتراك بين المدرب ${coachName} والمتدرب ${athleteName}`;
                
                NotificationService.sendBulkNotification(
                    [subscriptionRecord.athleteId._id, subscriptionRecord.coachId._id],
                    {
                        senderId: req.userId,
                        type: "subscription_approved",
                        title: "تم قبول الاشتراك",
                        message: notificationMessage,
                        data: {
                            subscriptionId: subscriptionRecord._id.toString(),
                            coachId: subscriptionRecord.coachId._id.toString(),
                            athleteId: subscriptionRecord.athleteId._id.toString(),
                            coachName: coachName,
                            athleteName: athleteName
                        }
                    }
                );

            } catch (error) {
                console.error('Error fetching athlete calendar data:', error);
            }
        }

        return res.status(200).json({success:true,data:subscriptionRecord});


        
    } catch (error) {
        return res.status(500).json({success:false,message:error.message});
    }
}

export const getAllSubscriptionPayments=async(req,res)=>{
    try {
           const subscriptionPayments = await SubscriptionPayment.find({ status: "pending" })
            .populate({
                path: 'subscriptionId',
               populate: [
                { path: 'coachId' },
                { path: 'athleteId' }
               ]
            })
            .lean();
        
        return res.status(200).json(
        {   success:true,
            data:SubscriptionPaymentResource.collection(subscriptionPayments)
        });
    } catch (error) {
        return res.status(500).json({success:false,message:error.message});
    }
}