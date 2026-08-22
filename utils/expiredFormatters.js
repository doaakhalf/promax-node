import { resetTime } from "./resetTime.js";

export const formatExpiredUser = (user) => {
  if (!user?._id) return null;
  return {
    id: user._id,
    name: `${user.firstName} ${user.lastName || ""}`.trim(),
    email: user.email,
    phoneNumber: user.phoneNumber,
    profileImage: user.profileImage,
    gender: user.gender || null,
  };
};

export const formatExpiredSubscription = (sub) => ({
  id: sub._id,
  plan: sub.subscriptionPlan,
  amount: parseFloat(sub.amount?.$numberDecimal ?? sub.amount),
  currency: sub.currency,
  startDate: resetTime(sub.startDate),
  endDate: resetTime(sub.endDate),
  paymentStatus: sub.paymentStatus,
  status: sub.status,
});
