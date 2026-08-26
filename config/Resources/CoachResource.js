import { getAthletePrice, getPlatformFee } from "../../utils/coachNetAmount.js";

class CoachResource {
     constructor(coach, role={},editMode=false, { athletePrice = false } = {}) {

         // Flattening nested 'userId' data
        if (coach.userId) {
          
            
            const lastNameInitial = coach.userId.lastName ? coach.userId.lastName.charAt(0).toUpperCase() : '';

            this.name = editMode==false?`${coach.userId.firstName} ${lastNameInitial}`:`${coach.userId.firstName} ${coach.userId.lastName}`;
            this.email = coach.userId.email;
            this.phone = coach.userId.phoneNumber;
            this.gender = coach.userId.gender;
            this.profileImage = coach.userId.profileImage || null;
            this.status = coach.userId.status;
            this.role = role?role.name:'';

        }
        // Renaming and Flattening
        this.id = coach.userId._id;
        this.sport = coach.sport;
        this.type = coach.type;
        this.headline = coach.headline;
        this.introduction = coach.introduction;
        this.motivation = coach.motivation;
        this.trainingExperience = coach.trainingExperience;
        this.yearOfExperience = coach.yearOfExperience;
        this.videoUrl = coach.videoUrl;
        this.instapayLink = coach.instapayLink;
        this.walletNumber = coach.walletNumber;
      

        // Cleaning up complex types (Decimal/Dates)
        const registeredPrice = parseFloat(coach.monthlyPriceEgp?.$numberDecimal ?? coach.monthlyPriceEgp ?? 0);
        
        this.coachPrice = registeredPrice;
        this.platformFee = getPlatformFee(registeredPrice);
        this.price = athletePrice ? getAthletePrice(registeredPrice) : registeredPrice;
        
        // Passing through specific arrays
        this.achievements = coach.achievements || [];
        this.certificates = coach.certificates || [];
        this.galleryImages = coach.galleryImages || [];




        // Exclude: __v, updatedAt, password, etc. (simply by not including them here)
    }

    // Helper method if you have an array of coaches
    static collection(coaches, role = {}, _userId, editMode = false, options = {}) {
        return coaches.map(coach => new CoachResource(coach, role, editMode, options));
    }
}

export default CoachResource;