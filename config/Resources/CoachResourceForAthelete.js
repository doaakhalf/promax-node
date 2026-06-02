class CoachResourceForAthelete {
     constructor(coach, role={},userId) {

        
         // Flattening nested 'userId' data
        if (coach.userId) {

            
            const lastNameInitial = coach.userId.lastName ? coach.userId.lastName.charAt(0).toUpperCase() + '.' : '';

            this.name = `${coach.userId.firstName} ${lastNameInitial}`;
            this.email = coach.userId.email;
            this.phone = coach.userId.phoneNumber;
            this.profileImage = coach.userId.profileImage || null;
            this.status = coach.userId.status;
            this.role = role?role.name:'';
             this.id = coach.userId._id;

        }
        // Renaming and Flattening
       
        this.sport = coach.sport;
        this.type = coach.type;
        this.headline = coach.headline;
        this.introduction = coach.introduction;
        this.motivation = coach.motivation;
        this.trainingExperience = coach.trainingExperience;
        this.videoUrl = coach.videoUrl;
        this.instapayLink = coach.instapayLink;
      

        // Cleaning up complex types (Decimal/Dates)
        this.price = parseFloat(coach.monthlyPriceEgp?.$numberDecimal ?? coach.monthlyPriceEgp ?? 0);
        
        // Passing through specific arrays
        this.achievements = coach.bestRecord || [];
        this.certificates = coach.certificates || [];
        // subscription related fields
        this.subscriptionNumber = coach.subscriptions?.length || 0;
         this.subscriptionStatus = null;
          this.paymentStatus = null;
          
          
       if (coach.subscriptions && coach.subscriptions.length > 0 && userId) {
            const userSubscription = coach.subscriptions.find(sub => 
                sub.athleteId.toString() === userId.toString()
            );
            
            if (userSubscription) {
                this.subscriptionStatus = userSubscription.status;
                this.paymentStatus = userSubscription.paymentStatus;
            }
        }
        


        // Exclude: __v, updatedAt, password, etc. (simply by not including them here)
    }

    // Helper method if you have an array of coaches
    static collection(coaches,role,userId) {
        return coaches.map(coach => new CoachResourceForAthelete(coach,role,userId));
    }
}

export default CoachResourceForAthelete;