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

export const getPlatformFee = (grossAmount) => {
  const gross = decimalToNumber(grossAmount);
  return toMoney(gross * getPlatformPercentage() / 100);
};

export const getCoachNet = (grossAmount) => {
  const gross = decimalToNumber(grossAmount);
  return toMoney(gross - getPlatformFee(gross));
};

export const getWeeklyRate = (grossAmount) => {
  const coachNet = getCoachNet(grossAmount);
  return toMoney(coachNet / WEEKS_PER_MONTH);
};

export { WEEKS_PER_MONTH };
