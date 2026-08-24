import { resetTime } from "./resetTime.js";
import { decimalToNumber } from "./coachNetAmount.js";

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
  amount: decimalToNumber(sub.amount),
  platformFee: decimalToNumber(sub.platformFee),
  coachNetAmount: decimalToNumber(sub.coachNetAmount),
  currency: sub.currency,
  startDate: resetTime(sub.startDate),
  endDate: resetTime(sub.endDate),
  paymentStatus: sub.paymentStatus,
  status: sub.status,
});
