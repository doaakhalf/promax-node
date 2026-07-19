class CoachResourceForAthelete {
     constructor(coach, role={},userId,editMode=false,conversationMap=null) {


        
         // Flattening nested 'userId' data
        if (coach.userId) {

            
            const lastNameInitial = coach.userId.lastName ? coach.userId.lastName.charAt(0).toUpperCase() + '.' : '';

            this.name = `${coach.userId.firstName} ${editMode ? coach.userId.lastName : lastNameInitial}`;
            this.email = coach.userId.email;
            this.phone = coach.userId.phoneNumber;
            this.gender = coach.userId.gender;
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
        this.yearOfExperience = coach.yearOfExperience;
        this.videoUrl = coach.videoUrl;
        this.instapayLink = coach.instapayLink;
      

        // Cleaning up complex types (Decimal/Dates)
        this.price = parseFloat(coach.monthlyPriceEgp?.$numberDecimal ?? coach.monthlyPriceEgp ?? 0);
        
        // Passing through specific arrays
        this.achievements = coach.achievements || [];
        this.certificates = coach.certificates || [];
        // subscription related fields
        this.subscriptionNumber = coach.subscriptions?.length || 0;
         this.subscriptionStatus = null;
          this.paymentStatus = null;
          
          
       if (coach.subscriptions && coach.subscriptions.length > 0 && userId) {
            const userSubscriptions = coach.subscriptions.filter(sub => 
                sub.athleteId.toString() === userId.toString()
            );
         
          
            if (userSubscriptions.length > 0) {
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
            }
        }
        


        // Chat conversation status (for athlete viewer's coach list)
        this.conversationExists = false;
        this.conversationId = null;
        if (conversationMap && coach.userId) {
            const coachKey = coach.userId._id.toString();
            if (conversationMap.has(coachKey)) {
                this.conversationExists = true;
                this.conversationId = conversationMap.get(coachKey);
            }
        }

        // Exclude: __v, updatedAt, password, etc. (simply by not including them here)
    }

    // Helper method if you have an array of coaches
    static collection(coaches,role,userId,editMode=false,conversationMap=null) {
        return coaches.map(coach => new CoachResourceForAthelete(coach,role,userId,editMode,conversationMap));
    }
}

export default CoachResourceForAthelete;