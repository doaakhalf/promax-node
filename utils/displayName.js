/**
 * Format a user's display name.
 * @param {{ firstName?: string, lastName?: string } | null | undefined} user
 * @param {{ full?: boolean }} [options] - full legal name when true; otherwise firstName + last initial
 */
export function displayName(user, { full = false } = {}) {
  if (!user) return "";
  const first = (user.firstName || "").trim();
  const last = (user.lastName || "").trim();
  if (full) return `${first} ${last}`.trim();
  // Use Array.from so Arabic / multi-code-unit chars still get the first letter
  const initial = last ? Array.from(last)[0].toUpperCase() : "" + " .";
  return `${first} ${initial}`.trim();
}
