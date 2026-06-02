class SubscriptionPaymentResource {
    constructor(payment) {
        // Payment record fields
        // this.id = payment._id;
        this.paymentImage = payment.paymentImage;
        this.status = payment.status;
        this.verifiedAt = payment.verifiedAt;
        this.verifiedBy = payment.verifiedBy;
        this.rejectionReason = payment.rejectionReason;
        this.uploadedAt = payment.uploadedAt;

        // Subscription details (if populated)
        if (payment.subscriptionId) {
            
                this.id = payment.subscriptionId._id;
                this.subscriptionPlan= payment.subscriptionId.subscriptionPlan;
                this.amount= parseFloat(payment.subscriptionId.amount.$numberDecimal ?? payment.subscriptionId.amount);
                this.currency= payment.subscriptionId.currency;
                this.paymentMethod= payment.subscriptionId.paymentMethod;
                // paymentStatus: payment.subscriptionId.paymentStatus,
                this.transactionId= payment.subscriptionId.transactionId;
                // status: payment.subscriptionId.status,
                this.startDate= payment.subscriptionId.startDate;
                this.endDate= payment.subscriptionId.endDate;
                this.renewalDate= payment.subscriptionId.renewalDate;
            

            // Coach details (if populated)
            if (payment.subscriptionId.coachId) {
                this.coach = {
                    id: payment.subscriptionId.coachId._id || payment.subscriptionId.coachId,
                    name: payment.subscriptionId.coachId.firstName + ' ' + payment.subscriptionId.coachId.lastName || null,
                    email: payment.subscriptionId.coachId.email || null,
                    phoneNumber: payment.subscriptionId.coachId.phoneNumber || null,
                    profileImage: payment.subscriptionId.coachId.profileImage || null
                };
            }

            // Athlete details (if populated)
            if (payment.subscriptionId.athleteId) {
                this.athlete = {
                    id: payment.subscriptionId.athleteId._id || payment.subscriptionId.athleteId,
                    name: payment.subscriptionId.athleteId.firstName + ' ' + payment.subscriptionId.athleteId.lastName || null,
                    email: payment.subscriptionId.athleteId.email || null,
                    phoneNumber: payment.subscriptionId.athleteId.phoneNumber || null,
                    profileImage: payment.subscriptionId.athleteId.profileImage || null
                };
            }
        }
    }

    static collection(payments) {
        return payments.map(payment => new SubscriptionPaymentResource(payment));
    }
}

export default SubscriptionPaymentResource;