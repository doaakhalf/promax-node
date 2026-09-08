/**
 * Format a user's display name.
 * @param {{ firstName?: string, lastName?: string } | null | undefined} user
 * @param {{ full?: boolean }} [options] - full legal name when true; otherwise firstName + last initial
 */
export function displayName(user, { full = false } = {}) {
  if (!user) return "";
  const first = user.firstName || "";
  if (full) return `${first} ${user.lastName || ""}`.trim();
  const initial = user.lastName ? user.lastName.charAt(0).toUpperCase() : "";
  return `${first} ${initial}`.trim();
}
