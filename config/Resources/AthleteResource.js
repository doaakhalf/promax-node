class AthleteResource {
    constructor(athlete) {
        // Renaming and Flattening
        // this.id = athlete._id;
        this.gender = athlete.gender;
      this.weight = parseFloat(athlete.weight?.$numberDecimal || athlete.weight) || null;
        this.height = parseFloat(athlete.height?.$numberDecimal || athlete.height) || null;
        
        this.trainingFrequency = athlete.trainingFrequency.toString();
        this.inbodyFile = athlete.inbodyFile;
        this.dateOfBirth = athlete.dateOfBirth;
        this.goals = athlete.goals;
        this.injuries = athlete.injuries;

      
        
        
        // Flattening nested 'userId' data
        if (athlete.userId) {
            this.id=athlete.userId._id;
            this.athleteName = `${athlete.userId.firstName} ${athlete.userId.lastName}`;
            this.email = athlete.userId.email;
            this.phone = athlete.userId.phoneNumber;
            this.profileImage = athlete.userId.profileImage || null;
        }

     
//check image
        
    }

    // Helper method if you have an array of athletes
    static collection(athletes) {
        return athletes.map(athlete => new AthleteResource(athlete));
    }
}

export default AthleteResource;