import { getAthletePrice, getAthleteWeeklyPrice, decimalToNumber } from "../../utils/coachNetAmount.js";
import { displayName } from "../../utils/displayName.js";
import { buildShareProfileUrl } from "../../utils/userSlug.js";
import { formatCoachSpecializations } from "../../utils/coachSpecializations.js";
import {
  countOccupiedFromList,
  DEFAULT_MAX_ACTIVE_SUBSCRIPTIONS,
} from "../../utils/coachSubscriptionCapacity.js";

class CoachResourceForAthelete {
     constructor(coach, role={},userId,editMode=false,conversationMap=null, maxActiveSubscriptions = DEFAULT_MAX_ACTIVE_SUBSCRIPTIONS) {


        
         // Flattening nested 'userId' data
        if (coach.userId) {
            const showFullName = editMode || role?.name === 'admin';

            this.name = displayName(coach.userId, { full: showFullName });
            // this.email = coach.userId.email;
            // this.phone = coach.userId.phoneNumber;
            this.gender = coach.userId.gender;
            this.profileImage = coach.userId.profileImage || null;
            this.status = coach.userId.status;
            this.lastSeenAt = coach.userId.lastSeenAt || null;
            this.role = role?role.name:'';
             this.id = coach.userId._id;
            this.isLoggedIn = Array.isArray(coach.userId.fcmTokens) && coach.userId.fcmTokens.length > 0;
            this.slug = coach.userId.slug || null;
            this.shareProfileUrl = buildShareProfileUrl(coach.userId);

        }
        // Renaming and Flattening
       
        this.sport = coach.sport;
        // [{ value: "weight_loss", label: "إنقاص الوزن", labelAr, labelEn }]
        this.specializations = formatCoachSpecializations(coach.specializations);
        this.type = coach.type;
        this.headline = coach.headline;
        this.introduction = coach.introduction;
        this.motivation = coach.motivation;
        this.trainingExperience = coach.trainingExperience;
        this.yearOfExperience = coach.yearOfExperience;
        this.videoUrl = coach.videoUrl;
        // this.instapayLink = coach.instapayLink;
        // this.walletNumber = coach.walletNumber;

      

        // Cleaning up complex types (Decimal/Dates)
        const coachPrice = decimalToNumber(coach.monthlyPriceEgp);
        // this.platformFee = getPlatformFee(this.coachPrice);
        this.price = getAthletePrice(coachPrice);
        this.weeklySubscriptionEnabled = coach.weeklySubscriptionEnabled === true;
        this.weeklyPrice = getAthleteWeeklyPrice(coachPrice);
        this.weeklySubscriptionUsed = false;
        
        // Passing through specific arrays
        this.achievements = coach.achievements || [];
        this.certificates = coach.certificates || [];
        this.galleryImages = coach.galleries || [];
        this.ratingAverage = Number.isFinite(coach.ratingAverage) ? coach.ratingAverage : 0;
        this.ratingCount = Number.isFinite(coach.ratingCount) ? coach.ratingCount : 0;
        // subscription related fields
        // this.subscriptionNumber = coach.subscriptions?.length || 0;
         this.subscriptionStatus = null;
          this.paymentStatus = null;

        const maxLimit =
          Number.isInteger(maxActiveSubscriptions) && maxActiveSubscriptions >= 1
            ? maxActiveSubscriptions
            : DEFAULT_MAX_ACTIVE_SUBSCRIPTIONS;
        const occupiedCount = countOccupiedFromList(coach.subscriptions || []);
        let viewerAlreadySubscribed = false;
          
          
       if (coach.subscriptions && coach.subscriptions.length > 0 && userId) {
            const userSubscriptions = coach.subscriptions.filter(sub => 
                sub.athleteId.toString() === userId.toString()
            );
         
          
            if (userSubscriptions.length > 0) {
                this.weeklySubscriptionUsed = userSubscriptions.some((sub) =>
                    sub.subscriptionPlan === "weekly" &&
                    sub.status !== "rejected" &&
                    sub.deletedAt == null
                );

                const userSubscription =
                    userSubscriptions.find(sub => sub.status === 'active') ||
                    userSubscriptions.find(sub => sub.status === 'pending') ||
                    userSubscriptions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

                if (userSubscription) {
                   this.subscriptionStatus =
                    ['active', 'pending'].includes(userSubscription?.status)
                        ? userSubscription.status
                        : null;
                    this.paymentStatus = userSubscription.paymentStatus;
                }

                viewerAlreadySubscribed = userSubscriptions.some(
                  (sub) =>
                    ["active", "pending"].includes(sub.status) &&
                    sub.deletedAt == null
                );
            }
        }

        this.maxActiveSubscriptions = maxLimit;
        this.activeSubscriptionCount = occupiedCount;
        this.canSubscribe = occupiedCount < maxLimit && !viewerAlreadySubscribed;
        


        // Chat conversation status (for athlete viewer's coach list)
        this.conversationExists = false;
        this.conversationId = null;
        if (conversationMap instanceof Map && coach.userId) {
            const coachKey = coach.userId._id.toString();
            if (conversationMap.has(coachKey)) {
                this.conversationExists = true;
                this.conversationId = conversationMap.get(coachKey);
            }
        }

        // Exclude: __v, updatedAt, password, etc. (simply by not including them here)
    }

    // Helper method if you have an array of coaches
    static collection(coaches,role,userId,editMode=false,conversationMap=null, maxActiveSubscriptions = DEFAULT_MAX_ACTIVE_SUBSCRIPTIONS) {
        return coaches.map(coach => new CoachResourceForAthelete(coach,role,userId,editMode,conversationMap, maxActiveSubscriptions));
    }
}

export default CoachResourceForAthelete;
