class CoachResource {
    constructor(coach) {
        // Renaming and Flattening
        this.id = coach._id;
        this.sport = coach.sport;
        this.type = coach.type;
        this.headline = coach.headline;
        this.introduction = coach.introduction;
        this.motivation = coach.motivation;
        this.trainingExperience = coach.trainingExperience;
        this.videoUrl = coach.videoUrl;
        
        
        // Flattening nested 'userId' data
        if (coach.userId) {
            this.coachName = `${coach.userId.firstName} ${coach.userId.lastName}`;
            this.email = coach.userId.email;
            this.phone = coach.userId.phoneNumber;
            this.profileImage = coach.userId.profileImage || null;
        }

        // Cleaning up complex types (Decimal/Dates)
        this.price = coach.monthlyPriceEgp?.$numberDecimal || coach.monthlyPriceEgp;
        
        // Passing through specific arrays
        this.achievements = coach.bestRecord || [];
        this.certificates = coach.certificates || [];


        // Exclude: __v, updatedAt, password, etc. (simply by not including them here)
    }

    // Helper method if you have an array of coaches
    static collection(coaches) {
        return coaches.map(coach => new CoachResource(coach));
    }
}

export default CoachResource;