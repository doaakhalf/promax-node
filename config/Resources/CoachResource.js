class CoachResource {
     constructor(coach, role={},editMode=false) {

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
      

        // Cleaning up complex types (Decimal/Dates)
        this.price = parseFloat(coach.monthlyPriceEgp?.$numberDecimal ?? coach.monthlyPriceEgp ?? 0);
        
        // Passing through specific arrays
        this.achievements = coach.achievements || [];
        this.certificates = coach.certificates || [];



        // Exclude: __v, updatedAt, password, etc. (simply by not including them here)
    }

    // Helper method if you have an array of coaches
    static collection(coaches) {
        return coaches.map(coach => new CoachResource(coach));
    }
}

export default CoachResource;