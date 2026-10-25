import { getAthletePrice, getAthleteWeeklyPrice, getPlatformFee } from "../../utils/coachNetAmount.js";
import { displayName } from "../../utils/displayName.js";
import { buildShareProfileUrl } from "../../utils/userSlug.js";
import { formatCoachSpecializations } from "../../utils/coachSpecializations.js";

class CoachResource {
     constructor(coach, role={},editMode=false, {
       athletePrice = false,
       viewerId = null,
       maxActiveSubscriptions = null,
       activeSubscriptionCount = null,
       canSubscribe = null,
     } = {}) {

         // Flattening nested 'userId' data
        if (coach.userId) {
            const ownerId = coach.userId._id?.toString?.() ?? coach.userId._id;
            const isOwner = viewerId != null && ownerId?.toString() === viewerId.toString();
            const showFullName = editMode || role?.name === 'admin' || isOwner;

            this.name = displayName(coach.userId, { full: showFullName });
            this.email = coach.userId.email;
            this.phone = coach.userId.phoneNumber;
            this.gender = coach.userId.gender;
            this.profileImage = coach.userId.profileImage || null;
            this.status = coach.userId.status;
            this.lastSeenAt = coach.userId.lastSeenAt || null;
            this.role = role?role.name:'';
            this.isLoggedIn = Array.isArray(coach.userId.fcmTokens) && coach.userId.fcmTokens.length > 0;
            this.slug = coach.userId.slug || null;
            this.shareProfileUrl = buildShareProfileUrl(coach.userId);

        }
        // Renaming and Flattening
        this.id = coach.userId._id;
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
        this.instapayLink = coach.instapayLink;
        this.walletNumber = coach.walletNumber;
        this.AcceptTermsAndConditions = coach.AcceptTermsAndConditions;
        this.weeklySubscriptionEnabled = coach.weeklySubscriptionEnabled === true;

        // Cleaning up complex types (Decimal/Dates)
        const registeredPrice = parseFloat(coach.monthlyPriceEgp?.$numberDecimal ?? coach.monthlyPriceEgp ?? 0);
        
        this.coachPrice = registeredPrice;
        this.platformFee = getPlatformFee(registeredPrice);
        this.price = athletePrice ? getAthletePrice(registeredPrice) : registeredPrice;
        this.weeklyPrice = getAthleteWeeklyPrice(registeredPrice);
        
        
        // Passing through specific arrays
        this.achievements = coach.achievements || [];
        this.certificates = coach.certificates || [];
        this.galleryImages = coach.galleryImages || [];
        this.ratingAverage = Number.isFinite(coach.ratingAverage) ? coach.ratingAverage : 0;
        this.ratingCount = Number.isFinite(coach.ratingCount) ? coach.ratingCount : 0;

        if (
          Number.isInteger(maxActiveSubscriptions) &&
          maxActiveSubscriptions >= 1 &&
          typeof activeSubscriptionCount === "number" &&
          typeof canSubscribe === "boolean"
        ) {
          this.maxActiveSubscriptions = maxActiveSubscriptions;
          this.activeSubscriptionCount = activeSubscriptionCount;
          this.canSubscribe = canSubscribe;
        }

        // Exclude: __v, updatedAt, password, etc. (simply by not including them here)
    }

    // Helper method if you have an array of coaches
    static collection(coaches, role = {}, userId, editMode = false, options = {}) {
        return coaches.map(coach => new CoachResource(coach, role, editMode, { ...options, viewerId: userId }));
    }
}

export default CoachResource;
