// Single source of truth for coach specializations.
//
// The database only ever stores the stable English `value` code
// (e.g. "weight_gain_loss") on Coach.specializations. Arabic/English display
// labels live here and are resolved at the API boundary, so renaming a
// label never touches stored data and codes are safe to filter by.
//
// Do NOT rename a `value` after release: existing coaches already store
// it and the Coach schema enum would reject their documents on save.

export const MAX_COACH_SPECIALIZATIONS = 3;

export const COACH_SPECIALIZATIONS = Object.freeze([
  { value: "weight_gain_loss", labelAr: "زيادة وإنقاص الوزن", labelEn: "Weight Gain & Loss" },
  { value: "muscle_building", labelAr: "بناء العضلات", labelEn: "Muscle Building" },
  { value: "bodybuilding", labelAr: "كمال الأجسام", labelEn: "Bodybuilding" },
  { value: "strength_training", labelAr: "تدريب القوة", labelEn: "Strength Training" },
  { value: "fitness", labelAr: "لياقة بدنية", labelEn: "Fitness" },
  { value: "crossfit", labelAr: "كروس فيت", labelEn: "CrossFit" },
  { value: "cardio_endurance", labelAr: "كارديو وتحمّل", labelEn: "Cardio & Endurance" },
  { value: "sports_nutrition", labelAr: "التغذية الرياضية", labelEn: "Sports Nutrition" },
  { value: "flexibility_mobility", labelAr: "المرونة والحركة", labelEn: "Flexibility & Mobility" },
  { value: "pilates", labelAr: "بيلاتس", labelEn: "Pilates" },
  { value: "home_workout", labelAr: "تدريب منزلي", labelEn: "Home Workout" },
]);

export const COACH_SPECIALIZATION_VALUES = Object.freeze(
  COACH_SPECIALIZATIONS.map((item) => item.value)
);

const SPECIALIZATION_BY_VALUE = new Map(
  COACH_SPECIALIZATIONS.map((item) => [item.value, item])
);

/** Options list for the frontend multi-select (Arabic-first). */
export function listCoachSpecializationOptions() {
  return COACH_SPECIALIZATIONS.map((item) => ({
    value: item.value,
    label: item.labelAr,
    labelAr: item.labelAr,
    labelEn: item.labelEn,
  }));
}

/**
 * Stored codes -> API shape the frontend displays/sends back:
 * [{ value: "weight_gain_loss", label: "زيادة وإنقاص الوزن", labelAr, labelEn }]
 * Unknown codes (should not happen thanks to the enum) fall back to the
 * raw code as the label instead of breaking the response.
 */
export function formatCoachSpecializations(codes) {
  if (!Array.isArray(codes)) return [];
  return codes
    .filter((code) => typeof code === "string" && code.trim() !== "")
    .map((code) => {
      const item = SPECIALIZATION_BY_VALUE.get(code.trim().toLowerCase());
      if (!item) return { value: code, label: code, labelAr: code, labelEn: code };
      return {
        value: item.value,
        label: item.labelAr,
        labelAr: item.labelAr,
        labelEn: item.labelEn,
      };
    });
}

function extractRawItems(raw) {
  if (raw === undefined || raw === null) return { provided: false, items: [] };
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed === "") return { provided: true, items: [] };
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed)
          ? { provided: true, items: parsed }
          : { provided: true, items: null };
      } catch {
        return { provided: true, items: null };
      }
    }
    // Comma-separated fallback ("weight_gain_loss,fitness").
    return { provided: true, items: trimmed.split(",") };
  }
  if (Array.isArray(raw)) {
    // multipart forms may deliver a JSON string as the only element.
    if (raw.length === 1 && typeof raw[0] === "string" && raw[0].trim().startsWith("[")) {
      return extractRawItems(raw[0]);
    }
    return { provided: true, items: raw };
  }
  return { provided: true, items: null };
}

/**
 * Normalize whatever the client sent (array of codes, JSON string,
 * comma-separated string, or [{ value }] items) into clean stored codes.
 *
 * Returns { provided, specializations, error }:
 * - provided=false  -> field absent, caller should keep the current value
 * - provided=true + specializations=[] -> client explicitly cleared all
 * - error           -> human-readable message for a 422 response
 */
export function parseCoachSpecializations(raw) {
  const { provided, items } = extractRawItems(raw);
  if (!provided) return { provided: false, specializations: undefined, error: null };
  if (items === null) {
    return {
      provided: true,
      specializations: undefined,
      error: "يجب إرسال التخصصات كمصفوفة من أكواد التخصصات المتاحة",
    };
  }

  const codes = [];
  for (const item of items) {
    const rawCode =
      typeof item === "string"
        ? item
        : item && typeof item === "object"
          ? item.value ?? item.code
          : null;
    if (typeof rawCode !== "string" || rawCode.trim() === "") {
      return {
        provided: true,
        specializations: undefined,
        error: "يجب أن يكون كل تخصص من أكواد التخصصات المتاحة",
      };
    }
    const code = rawCode.trim().toLowerCase();
    if (!SPECIALIZATION_BY_VALUE.has(code)) {
      return {
        provided: true,
        specializations: undefined,
        error: `تخصص غير صحيح: "${rawCode}". يرجى الاختيار من قائمة التخصصات المتاحة`,
      };
    }
    if (!codes.includes(code)) codes.push(code);
  }

  if (codes.length > MAX_COACH_SPECIALIZATIONS) {
    return {
      provided: true,
      specializations: undefined,
      error: `يمكن اختيار ${MAX_COACH_SPECIALIZATIONS} تخصصات كحد أقصى`,
    };
  }

  return { provided: true, specializations: codes, error: null };
}
