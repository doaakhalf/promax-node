import jwt from "jsonwebtoken";

function requireSecret(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

// Access token: 1 hour
const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || "1h";
// Refresh token: 90 days
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || "90d";

/**
 * Generate access token (short-lived)
 */
export function generateToken(payload) {
  return jwt.sign(
    { ...payload, type: "access" },
    requireSecret("JWT_SECRET"),
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
  );
}

/**
 * Generate refresh token (long-lived)
 */
export function generateRefreshToken(payload) {
  return jwt.sign(
    { userId: payload.userId, type: "refresh" },
    requireSecret("REFRESH_TOKEN_SECRET"),
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
  );
}

/**
 * Generate both access and refresh tokens
 */
export function generateTokenPair(payload) {
  const accessToken = generateToken(payload);
  const refreshToken = generateRefreshToken(payload);

  return {
    token: accessToken,
    refreshToken: refreshToken,
    expiresIn: 3600, // 1 hour in seconds
  };
}

/**
 * Verify access token
 */
export function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, requireSecret("JWT_SECRET"));
    if (decoded.type !== "access") {
      return null;
    }
    return decoded;
  } catch (err) {
    return null;
  }
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token) {
  try {
    const decoded = jwt.verify(token, requireSecret("REFRESH_TOKEN_SECRET"));
    if (decoded.type !== "refresh") {
      return null;
    }
    return decoded;
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      throw new Error("REFRESH_TOKEN_EXPIRED");
    }
    throw err;
  }
}
