/**
 * Allowed browser origins for CORS / Socket.IO.
 * Native mobile apps typically send no Origin — those are allowed separately.
 *
 * CORS_ORIGINS — comma-separated list (defaults to trainifypro.com).
 * BASE_URL — also allowed so the admin dashboard on the same host keeps working.
 */
const DEFAULT_SITE_ORIGINS = [
  "https://trainifypro.com",
  "https://www.trainifypro.com",
];

function normalizeOrigin(value) {
  if (!value || typeof value !== "string") return null;
  return value.trim().replace(/\/$/, "");
}

export function getAllowedCorsOrigins() {
  const fromEnv = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);

  const origins = new Set(fromEnv.length ? fromEnv : DEFAULT_SITE_ORIGINS);

  const baseUrl = normalizeOrigin(process.env.BASE_URL);
  if (baseUrl) origins.add(baseUrl);

  // Local admin / web during development
  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost:4200");
    origins.add("http://127.0.0.1:4200");
    origins.add("http://localhost:3000");
    origins.add("http://127.0.0.1:3000");
  }

  return [...origins];
}

export function isAllowedCorsOrigin(origin) {
  if (!origin) return false;
  return getAllowedCorsOrigins().includes(normalizeOrigin(origin));
}
