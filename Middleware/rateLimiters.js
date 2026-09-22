import rateLimit from "express-rate-limit";

const tooManyRequestsHandler = (_req, res) => {
  res.status(429).json({
    status: "error",
    message: "Too many requests. Please try again later.",
  });
};

/** Soft global limit for all /api traffic. */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooManyRequestsHandler,
});

/** Stricter limit for login / register / Google auth / password reset. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooManyRequestsHandler,
});
