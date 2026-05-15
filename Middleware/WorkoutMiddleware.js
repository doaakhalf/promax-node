export function WorkoutMiddleware(req, res, next) {
  const data = req.body;

  // TODO: validate workout data
  if (req.user.role?.name !== "coach" && req.user.role?.name !== "admin" && req.user.status !== "active") {
    return res.status(403).json({ message: "Only coaches, admins and managers can create workouts" });
  }
  if (!data.name || !data.description || !data.sets) {
    return res.status(400).json({ message: "Workout data is required" });
  }

  next();
}