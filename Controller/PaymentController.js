
import subscription from "../Models/Subscription.js";
import SubscriptionPayment from "../Models/SubscriptionPayment.js";
import SubscriptionPaymentResource from "../config/Resources/SubscriptionPaymentResource.js";
import {fetchAthleteCalendarData} from "./WorkoutCalendarController.js";
import NotificationService from "../services/NotificationService.js";
import { resetTime } from "../utils/resetTime.js";

// خريطة رسائل الإشعارات لكل حالة اشتراك
const STATUS_NOTIFICATIONS = {
    active: {
        athlete: {
            type:"subscription_approved",
            title: "🎉 اشتراكك أصبح فعالًا!",
            message: ({ coachName }) => `💪 مبروك! تم تأكيد اشتراكك مع المدرب ${coachName}. استعد لبدء رحلتك وتحقيق أهدافك الرياضية! 🚀`
        },
        coach: {
            type:"subscription_approved",
            title: "🎉 متدرب جديد انضم إليك!",
            message: ({ athleteName }) => `🏆 مبروك! انضم المتدرب ${athleteName} إلى قائمة متدربيك. نتمنى لكم رحلة تدريبية مليئة بالنجاح والإنجازات! 💪`
        }
    },
    rejected: {
        athlete: {
            type:"subscription_rejected",
            title: "❌ تم رفض الاشتراك",
            message: ({ coachName, rejectionReason }) =>
                `تم رفض طلب اشتراكك مع المدرب ${coachName}${rejectionReason ? ` - السبب: ${rejectionReason}` : ''}. يمكنك التواصل مع الدعم لمزيد من التفاصيل.`
        }
    },
    refunded: {
        athlete: {
            type:"subscription_refunded",
            title: "💰 تم استرداد المبلغ",
            message: ({ coachName }) => `تم استرداد مبلغ اشتراكك مع المدرب ${coachName} بنجاح.`
        }
    }
};

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

        const notificationsConfig = STATUS_NOTIFICATIONS[req.body.status];
        if (notificationsConfig) {
            try {
                if (req.body.status === "active") {
                    await fetchAthleteCalendarData(subscriptionRecord.coachId, subscriptionRecord.athleteId);
                }

                const coachName = subscriptionRecord.coachId.firstName + " " + (subscriptionRecord.coachId.lastName?.charAt(0).toUpperCase() || '');
                const athleteName = subscriptionRecord.athleteId.firstName + " " + (subscriptionRecord.athleteId.lastName || '');
                const rejectionReason = req.body.rejectionReason || null;

                const baseData = {
                    subscriptionId: subscriptionRecord._id.toString(),
                    coachId: subscriptionRecord.coachId._id.toString(),
                    athleteId: subscriptionRecord.athleteId._id.toString(),
                    coachName,
                    athleteName
                };

                const notificationPromises = [];

                if (notificationsConfig.athlete) {
                    notificationPromises.push(NotificationService.sendNotification({
                        recipientId: subscriptionRecord.athleteId._id,
                        senderId: req.userId,
                        type: notificationsConfig.athlete.type,
                        title: notificationsConfig.athlete.title,
                        message: notificationsConfig.athlete.message({ coachName, athleteName, rejectionReason }),
                        data: baseData
                    }));
                }

                if (notificationsConfig.coach) {
                    notificationPromises.push(NotificationService.sendNotification({
                        recipientId: subscriptionRecord.coachId._id,
                        senderId: req.userId,
                        type: notificationsConfig.coach.type,
                        title: notificationsConfig.coach.title,
                        message: notificationsConfig.coach.message({ coachName, athleteName, rejectionReason }),
                        data: baseData
                    }));
                }

                await Promise.all(notificationPromises);

            } catch (error) {
                console.error('Error sending subscription status notification:', error);
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