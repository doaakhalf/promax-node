import { createHash } from "node:crypto";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

const tooManyRequestsHandler = (_req, res) => {
  res.status(429).json({
    status: "error",
    message: "Too many requests. Please try again later.",
  });
};

// Mobile carriers put many users behind one public IP. Key logged-in traffic
// by token so one shared address cannot lock the whole app.
function apiRateLimitKey(req) {
  const header = req.headers.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    const token = header.slice("Bearer ".length).trim();
    if (token) {
      return createHash("sha256").update(token).digest("hex");
    }
  }
  return ipKeyGenerator(req.ip);
}

/** Soft global limit for all /api traffic. */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: apiRateLimitKey,
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
