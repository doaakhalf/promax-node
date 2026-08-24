const WEEKS_PER_MONTH = 4;

export const getPlatformPercentage = () => {
  const raw = process.env.PERCENTAGE;
  if (raw === undefined || raw === null || raw === "") return 0;
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const toMoney = (value) => Math.round(value * 100) / 100;

export const decimalToNumber = (value) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseFloat(value) || 0;
  if (value.toString) return parseFloat(value.toString()) || 0;
  return 0;
};

/** Platform fee added on top of the coach's registered monthly price. */
export const getPlatformFee = (coachMonthlyPrice) => {
  const coachNet = decimalToNumber(coachMonthlyPrice);
  return toMoney((coachNet * getPlatformPercentage()) / 100);
};

/** What the athlete pays: coach price + platform percentage. */
export const getAthletePrice = (coachMonthlyPrice) => {
  const coachNet = decimalToNumber(coachMonthlyPrice);
  return toMoney(coachNet + getPlatformFee(coachNet));
};

export const getCoachNet = (coachMonthlyPrice) => toMoney(decimalToNumber(coachMonthlyPrice));

export const getSubscriptionAmounts = (coachMonthlyPrice) => {
  const coachNetAmount = getCoachNet(coachMonthlyPrice);
  const platformFee = getPlatformFee(coachNetAmount);
  const amount = toMoney(coachNetAmount + platformFee);
  return { amount, platformFee, coachNetAmount };
};

export const resolveSubscriptionAmounts = (subscription) => {
  const storedNet = decimalToNumber(subscription?.coachNetAmount);
  const storedFee = decimalToNumber(subscription?.platformFee);
  const storedGross = decimalToNumber(subscription?.amount);

  if (storedNet > 0) {
    const platformFee = storedFee > 0 ? storedFee : getPlatformFee(storedNet);
    const amount = storedGross > 0 ? storedGross : toMoney(storedNet + platformFee);
    return { amount, platformFee, coachNetAmount: storedNet };
  }

  return getSubscriptionAmounts(storedGross);
};

export const getWeeklyRate = (coachNetAmount) => {
  return toMoney(decimalToNumber(coachNetAmount) / WEEKS_PER_MONTH);
};

export const athletePriceMongoExpr = () => ({
  $multiply: [
    { $toDouble: { $ifNull: ["$monthlyPriceEgp", 0] } },
    1 + getPlatformPercentage() / 100,
  ],
});

export { WEEKS_PER_MONTH };
