
// Helper function to reset time to midnight (work with dates only)
export const resetTime = (date) => {
  const newDate = new Date(date);
  newDate.setUTCHours(0, 0, 0, 0);
  return newDate;
};

// Helper function to compare dates only (returns -1, 0, or 1)
export const compareDates = (date1, date2) => {
  const d1 = resetTime(date1);
  const d2 = resetTime(date2);
  return d1.getTime() - d2.getTime();
};

// Inclusive full calendar month: same day next month, then -1 day
export const getMonthlySubscriptionEndDate = (startDate) => {
  const start = resetTime(startDate);
  const end = resetTime(new Date(start));
  end.setMonth(end.getMonth() + 1);
  if (end.getDate() !== start.getDate()) {
    end.setDate(0); // overflow: last day of the short month
  }
  end.setDate(end.getDate() - 1);
  return resetTime(end);
};