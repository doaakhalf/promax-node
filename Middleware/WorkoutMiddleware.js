export function WorkoutMiddleware(req, res, next) {
  const body = req.body;

  // TODO: validate workout data
  if (!body) {
    return res.status(400).json({ message: "Workout data is required" });
  }

  next();
}