import Subscription from "../Models/Subscription.js";
import Coach from "../Models/Coach.js";
import SubscriptionPayment from "../Models/SubscriptionPayment.js";

export const Subscribe = async (req, res) => {
  try {
    const coachId = req.params.coachId;
    const athleteId = req.userId;

    const { subscriptionPlan, paymentMethod, transactionId } = req.body;

 
    // Verify coach exists
    const coach = await Coach.findOne({ userId: coachId }).lean();
    if (!coach) {
      return res.status(404).json({ message: "Coach not found" });
    }

    // Check if athlete already has an active subscription with this coach
    const existingSubscription = await Subscription.findOne({
      coachId,
      athleteId,
      status: { $in: ["active", "pending"] }
    });

    if (existingSubscription) {
      return res.status(400).json({ 
        message: "You already have an active or pending subscription with this coach" 
      });
    }

    // Calculate subscription dates (1 month)
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);
 // instapay payments receipt
    const file = req.file;
    const imageUrl = file ? `/images/${req.uploadFolder}/${file.filename}` : null;
   
    // Create subscription
    const {subscription, subscriptionPayment} = await Subscription.create({
      coachId,
      athleteId,
      subscriptionPlan: subscriptionPlan || "monthly",
      amount: coach.monthlyPriceEgp,
      currency: "EGP",
      paymentMethod: paymentMethod || 'instapay',
      paymentStatus: "pending",
      transactionId: transactionId || null,
      startDate,
      endDate,
      status: "pending"
    }).then(async (subscription) => {
      const subscriptionPayment = await SubscriptionPayment.create({
        subscriptionId: subscription._id,
        paymentMethod: paymentMethod || 'instapay',
        paymentStatus: "pending",
        transactionId: transactionId || null,
        paymentImage: imageUrl
      });
      return {subscription, subscriptionPayment};
    });

  

    return res.status(201).json({
      message: "Subscription created successfully",
      subscription: {
        id: subscription._id,
        coachId: subscription.coachId,
        subscriptionPlan: subscription.subscriptionPlan,
        amount: parseFloat(subscription.amount.$numberDecimal ?? subscription.amount),
        currency: subscription.currency,
        paymentStatus: subscription.paymentStatus,
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        paymentMethod: subscriptionPayment.paymentMethod,
        transactionId: subscriptionPayment.transactionId,
        paymentImage: subscriptionPayment.paymentImage
      }
    });

  } catch (error) {
    console.error('Subscribe error:', error);
    return res.status(500).json({ 
      message: "Failed to create subscription", 
      error: error?.message 
    });
  }
};


