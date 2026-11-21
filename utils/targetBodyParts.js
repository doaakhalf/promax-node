// Allowed exercise target body parts, taken from the distinct values stored
// on exercises (lowercased). "claves" is excluded; it is a typo of "calves".

export const TARGET_BODY_PARTS = Object.freeze([
  "abs",
  "arm",
  "back",
  "biceps",
  "calves",
  "cardio",
  "chest",
  "delts",
  "forearms",
  "glutes",
  "hamstrings",
  "lats",
  "legs",
  "lower back",
  "lower body",
  "lower legs",
  "obliques",
  "quadriceps",
  "shoulders",
  "triceps",
  "upper arms",
  "upper body",
  "upper legs",
  "waist",
]);

const TARGET_BODY_PART_SET = new Set(TARGET_BODY_PARTS);

export function isTargetBodyPart(value) {
  return TARGET_BODY_PART_SET.has(String(value ?? "").trim().toLowerCase());
}

/** Accepts "abs,chest", ["abs", "chest"], or ["abs,chest"]. */
export function parseTargetBodyPartsQuery(raw) {
  if (raw == null || raw === "") return [];
  const items = Array.isArray(raw) ? raw : [raw];
  return [
    ...new Set(
      items
        .flatMap((item) => String(item).split(","))
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
}
