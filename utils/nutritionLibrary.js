import ApiError from "./ApiError.js";

export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"];
export const GOALS = ["cutting", "bulking", "maintenance"];

export function round1(value) {
  return Math.round((Number(value) + Number.EPSILON) * 10) / 10;
}

export function emptyMacros() {
  return { calories: 0, protein: 0, carbs: 0, fat: 0 };
}

export function macrosForQuantity(per100g, quantityGrams) {
  const factor = quantityGrams / 100;
  return {
    calories: round1((per100g?.calories || 0) * factor),
    protein: round1((per100g?.protein || 0) * factor),
    carbs: round1((per100g?.carbs || 0) * factor),
    fat: round1((per100g?.fat || 0) * factor),
  };
}

export function sumMacros(rows) {
  return rows.reduce((total, row) => ({
    calories: round1(total.calories + (row.calories || 0)),
    protein: round1(total.protein + (row.protein || 0)),
    carbs: round1(total.carbs + (row.carbs || 0)),
    fat: round1(total.fat + (row.fat || 0)),
  }), emptyMacros());
}

function nonNegativeNumber(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new ApiError(400, `${field} must be a number greater than or equal to 0`);
  }
  return round1(number);
}

function positiveGrams(value, field) {
  const number = nonNegativeNumber(value, field);
  if (number <= 0) {
    throw new ApiError(400, `${field} must be greater than 0`);
  }
  return number;
}

function optionalText(value, field, max) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > max) {
    throw new ApiError(400, `${field} is too long`);
  }
  return text;
}

function requiredText(value, field, max) {
  const text = optionalText(value, field, max);
  if (!text) throw new ApiError(400, `${field} is required`);
  return text;
}

export function parseFoodBody(body = {}, { partial = false } = {}) {
  const out = {};
  if (!partial || body.nameAr !== undefined) {
    out.nameAr = requiredText(body.nameAr, "nameAr", 200);
  }
  if (body.nameEn !== undefined) {
    out.nameEn = optionalText(body.nameEn, "nameEn", 200);
  } else if (!partial) {
    out.nameEn = null;
  }
  if (!partial || body.mealType !== undefined) {
    if (!MEAL_TYPES.includes(body.mealType)) {
      throw new ApiError(400, "mealType must be breakfast, lunch, dinner, or snack");
    }
    out.mealType = body.mealType;
  }
  if (!partial || body.nutritionPer100g !== undefined) {
    const nutrition = body.nutritionPer100g || {};
    out.nutritionPer100g = {
      calories: nonNegativeNumber(nutrition.calories, "calories"),
      protein: nonNegativeNumber(nutrition.protein, "protein"),
      carbs: nonNegativeNumber(nutrition.carbs, "carbs"),
      fat: nonNegativeNumber(nutrition.fat, "fat"),
    };
  }
  if (!partial || body.defaultServingGrams !== undefined) {
    out.defaultServingGrams = positiveGrams(body.defaultServingGrams, "defaultServingGrams");
  }
  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags)) throw new ApiError(400, "tags must be an array");
    out.tags = body.tags
      .map((tag) => String(tag).trim())
      .filter(Boolean)
      .slice(0, 20);
  } else if (!partial) {
    out.tags = [];
  }
  if (body.image !== undefined) {
    out.image = optionalText(body.image, "image", 2000);
  }
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== "boolean") {
      throw new ApiError(400, "isActive must be a boolean");
    }
    out.isActive = body.isActive;
  } else if (!partial) {
    out.isActive = true;
  }
  return out;
}

export function parseMealBody(body = {}, { partial = false } = {}) {
  const out = {};
  if (!partial || body.name !== undefined) {
    out.name = requiredText(body.name, "name", 200);
  }
  if (body.description !== undefined) {
    out.description = optionalText(body.description, "description", 2000) || "";
  } else if (!partial) {
    out.description = "";
  }
  if (body.image !== undefined) {
    out.image = optionalText(body.image, "image", 2000);
  }
  if (body.imageSource !== undefined) {
    out.imageSource = optionalText(body.imageSource, "imageSource", 200);
  }
  if (!partial || body.mealType !== undefined) {
    if (!MEAL_TYPES.includes(body.mealType)) {
      throw new ApiError(400, "mealType must be breakfast, lunch, dinner, or snack");
    }
    out.mealType = body.mealType;
  }
  if (!partial || body.goal !== undefined) {
    if (!GOALS.includes(body.goal)) {
      throw new ApiError(400, "goal must be cutting, bulking, or maintenance");
    }
    out.goal = body.goal;
  }
  if (body.coachNote !== undefined) {
    out.coachNote = optionalText(body.coachNote, "coachNote", 2000) || "";
  } else if (!partial) {
    out.coachNote = "";
  }
  if (!partial || body.ingredients !== undefined) {
    if (!Array.isArray(body.ingredients) || body.ingredients.length === 0) {
      throw new ApiError(400, "ingredients must include at least one food");
    }
    out.ingredients = body.ingredients.map((row) => ({
      foodId: row?.foodId,
      quantityGrams: positiveGrams(row?.quantityGrams, "quantityGrams"),
    }));
  }
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== "boolean") {
      throw new ApiError(400, "isActive must be a boolean");
    }
    out.isActive = body.isActive;
  } else if (!partial) {
    out.isActive = true;
  }
  return out;
}

export function idOf(value) {
  if (!value) return null;
  if (typeof value === "object" && value._id) return value._id.toString();
  return value.toString();
}

export function serializeFood(doc) {
  if (!doc) return null;
  const food = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return {
    id: idOf(food._id || food.id),
    seedId: food.seedId || null,
    source: food.source,
    userId: food.userId ? idOf(food.userId) : null,
    nameAr: food.nameAr,
    nameEn: food.nameEn || null,
    mealType: food.mealType,
    nutritionPer100g: food.nutritionPer100g,
    defaultServingGrams: food.defaultServingGrams,
    tags: food.tags || [],
    isActive: food.isActive,
    image: food.image || null,
  };
}

export function serializeMeal(doc) {
  if (!doc) return null;
  const meal = typeof doc.toObject === "function" ? doc.toObject() : doc;
  const ingredients = (meal.ingredients || []).map((row) => {
    const populated = row.foodId && typeof row.foodId === "object" && row.foodId.nameAr;
    const food = populated ? row.foodId : null;
    const macros = food
      ? macrosForQuantity(food.nutritionPer100g, row.quantityGrams)
      : emptyMacros();
    return {
      foodId: idOf(populated ? food._id : row.foodId),
      quantityGrams: row.quantityGrams,
      food: food ? serializeFood(food) : null,
      ...macros,
    };
  });
  return {
    id: idOf(meal._id || meal.id),
    seedId: meal.seedId || null,
    source: meal.source,
    userId: meal.userId ? idOf(meal.userId) : null,
    name: meal.name,
    description: meal.description || "",
    image: meal.image || null,
    imageSource: meal.imageSource || null,
    mealType: meal.mealType,
    goal: meal.goal,
    ingredients,
    coachNote: meal.coachNote || "",
    isActive: meal.isActive,
    totals: sumMacros(ingredients),
  };
}

export function serializePlan(doc) {
  if (!doc) return null;
  const plan = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return {
    id: idOf(plan._id || plan.id),
    coachId: plan.coachId ? idOf(plan.coachId) : null,
    name: plan.name,
    goal: plan.goal,
    targetCalories: plan.targetCalories ?? null,
    isTemplate: Boolean(plan.isTemplate),
    status: plan.status,
    days: plan.days || [],
    totals: plan.totals || emptyMacros(),
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  };
}

export function serializeAssignment(doc) {
  if (!doc) return null;
  const assignment = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return {
    id: idOf(assignment._id || assignment.id),
    subscriptionId: idOf(assignment.subscriptionId),
    coachId: idOf(assignment.coachId),
    athleteId: idOf(assignment.athleteId),
    sourcePlanId: assignment.sourcePlanId ? idOf(assignment.sourcePlanId) : null,
    name: assignment.name,
    goal: assignment.goal,
    targetCalories: assignment.targetCalories ?? null,
    days: assignment.days || [],
    totals: assignment.totals || emptyMacros(),
    assignedAt: assignment.assignedAt,
  };
}

export function pageParams(query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(query.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

export function paginationMeta({ page, limit, total }) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
