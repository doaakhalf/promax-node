import crypto from "crypto";

/**
 * Requires X-Api-Key (or x-api-key) matching CLIENT_API_KEY.
 * Blocks casual Postman/curl use while the mobile app and website send the key.
 *
 * If CLIENT_API_KEY is unset, requests are rejected in production and
 * allowed in non-production (so local dev without the key still works).
 */
export default function requireClientApiKey(req, res, next) {
  const expected = process.env.CLIENT_API_KEY;

  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      return res.status(503).json({
        status: "error",
        message: "Server misconfigured: CLIENT_API_KEY is missing",
      });
    }
    return next();
  }

  const provided =
    req.headers["x-api-key"] ||
    req.headers["x-client-api-key"] ||
    "";

  const expectedBuf = Buffer.from(String(expected));
  const providedBuf = Buffer.from(String(provided));

  const valid =
    expectedBuf.length === providedBuf.length &&
    crypto.timingSafeEqual(expectedBuf, providedBuf);

  if (!valid) {
    return res.status(403).json({
      status: "error",
      message: "Invalid or missing API key",
    });
  }

  return next();
}
