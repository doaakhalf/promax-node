
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