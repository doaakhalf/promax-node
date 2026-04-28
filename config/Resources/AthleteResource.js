class AthleteResource {
    constructor(athlete) {
        // Renaming and Flattening
        this.id = athlete._id;
        this.gender = athlete.gender;
        this.weight = athlete.weight?.$numberDecimal || athlete.weight;
        this.height = athlete.height || null;
        
        this.trainingFrequency = athlete.trainingFrequency.toString();
        this.inbodyFile = athlete.inbodyFile;
      
        
        
        // Flattening nested 'userId' data
        if (athlete.userId) {
            this.athleteName = `${athlete.userId.firstName} ${athlete.userId.lastName}`;
            this.email = athlete.userId.email;
            this.phone = athlete.userId.phoneNumber;
            this.profileImage = athlete.userId.profileImage || null;
        }

     

        
    }

    // Helper method if you have an array of athletes
    static collection(athletes) {
        return athletes.map(athlete => new AthleteResource(athlete));
    }
}

export default AthleteResource;