
import subscription from "../Models/Subscription.js";
import SubscriptionPayment from "../Models/SubscriptionPayment.js";
import SubscriptionPaymentResource from "../config/Resources/SubscriptionPaymentResource.js";
import {fetchAthleteCalendarData} from "./WorkoutCalendarController.js";
import NotificationService from "../services/NotificationService.js";

export const activatePayment=async(req,res)=>{
    try {
        const PaymentId=req.params.paymentId;
        const subscriptionRecord=await subscription.findById(PaymentId);
        const today=new Date();
        
     
        subscriptionRecord.paymentStatus = req.body.status;
        subscriptionRecord.status = req.body.status;

        subscriptionRecord.startDate = new Date();
        subscriptionRecord.endDate = today.setMonth(today.getMonth() + 1);
        
        const SubscriptionPaymentRecord=await SubscriptionPayment.findOne({subscriptionId: PaymentId});
        SubscriptionPaymentRecord.status = req.body.status;

        SubscriptionPaymentRecord.verifiedAt = new Date();
        SubscriptionPaymentRecord.verifiedBy = req.userId;
        SubscriptionPaymentRecord.rejectionReason =req.body.rejectionReason || null;
        await subscriptionRecord.save();
        await SubscriptionPaymentRecord.save();

        if(req.body.status === "active") {
            // TODO: Send notification to coach and athlete
            try {
                await fetchAthleteCalendarData(subscriptionRecord.coachId, subscriptionRecord.athleteId);
                NotificationService.sendNotification({
                    recipientId: subscriptionRecord.athleteId,
                    senderId: req.userId,
                    type: "subscription_activated",
                    title: "Subscription Activated",
                    message: "Your subscription has been activated successfully",
                    data: {
                        subscriptionId: subscriptionRecord._id
                    }
                });
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