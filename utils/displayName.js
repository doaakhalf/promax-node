/**
 * If firstName contains multiple words (e.g. "aya ahmed"), keep the first
 * token as firstName and merge the rest into lastName.
 * @param {string|null|undefined} firstName
 * @param {string|null|undefined} lastName
 * @returns {{ firstName: string|null, lastName: string|null }}
 */
export function normalizePersonName(firstName, lastName) {
  const first = typeof firstName === "string" ? firstName.trim() : "";
  const last = typeof lastName === "string" ? lastName.trim() : "";

  if (!first) {
    return { firstName: null, lastName: last || null };
  }

  const parts = first.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { firstName: parts[0], lastName: last || null };
  }

  const spilled = parts.slice(1).join(" ");
  return {
    firstName: parts[0],
    lastName: last ? `${spilled} ${last}` : spilled,
  };
}

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
  const initial = last ? Array.from(last)[0].toUpperCase() + ".": "";
  return `${first} ${initial}`.trim();
}
