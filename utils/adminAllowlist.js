const DEFAULT_ALLOWED_ADMIN_EMAILS = ["mohamed.razzak111@gmail.com"];

/**
 * Emails allowed to use admin-only APIs / dashboard.
 * Override with ADMIN_ALLOWED_EMAILS (comma-separated) in env.
 */
export function getAllowedAdminEmails() {
  const fromEnv = (process.env.ADMIN_ALLOWED_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return fromEnv.length ? fromEnv : DEFAULT_ALLOWED_ADMIN_EMAILS;
}

export function isAllowedAdminEmail(email) {
  if (!email || typeof email !== "string") return false;
  return getAllowedAdminEmails().includes(email.trim().toLowerCase());
}
