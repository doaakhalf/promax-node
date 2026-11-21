import mongoose from "mongoose";
import FoodItem from "../Models/FoodItem.js";
import MealTemplate from "../Models/MealTemplate.js";
import NutritionPlan from "../Models/NutritionPlan.js";
import NutritionAssignment from "../Models/NutritionAssignment.js";
import Subscription from "../Models/Subscription.js";
import ApiError from "../utils/ApiError.js";
import {
  GOALS,
  MEAL_TYPES,
  emptyMacros,
  escapeRegex,
  idOf,
  macrosForQuantity,
  pageParams,
  paginationMeta,
  parseFoodBody,
  parseMealBody,
  serializeAssignment,
  serializeFood,
  serializeMeal,
  sumMacros,
} from "../utils/nutritionLibrary.js";

function assertObjectId(value, label) {
  if (!mongoose.isValidObjectId(value)) {
    throw new ApiError(400, `Invalid ${label}`);
  }
}

function sameId(left, right) {
  if (!left || !right) return false;
  return idOf(left) === idOf(right);
}

function assertCanEditFood(food, actor) {
  if (!food) throw new ApiError(404, "Food item not found");
  if (actor.role === "admin") {
    if (food.source !== "library") {
      throw new ApiError(403, "Admins can only edit library foods");
    }
    return;
  }
  if (food.source !== "coach" || !sameId(food.userId, actor.userId)) {
    throw new ApiError(403, "You can only edit your own food items");
  }
}

function assertCanEditMeal(meal, actor) {
  if (!meal) throw new ApiError(404, "Meal not found");
  if (actor.role === "admin") {
    if (meal.source !== "library") {
      throw new ApiError(403, "Admins can only edit library meals");
    }
    return;
  }
  if (meal.source !== "coach" || !sameId(meal.userId, actor.userId)) {
    throw new ApiError(403, "You can only edit your own meals");
  }
}

function foodListFilter(actor, query) {
  const and = [];
  if (actor.role === "admin") {
    const source = query.source || "library";
    if (source !== "all") and.push({ source });
    if (query.isActive === "true") and.push({ isActive: true });
    if (query.isActive === "false") and.push({ isActive: false });
  } else {
    and.push({
      $or: [
        { source: "library", isActive: true },
        { source: "coach", userId: actor.userId },
      ],
    });
  }
  if (query.mealType) {
    if (!MEAL_TYPES.includes(query.mealType)) {
      throw new ApiError(400, "Invalid mealType");
    }
    and.push({ mealType: query.mealType });
  }
  if (query.tags) {
    const tags = String(query.tags).split(",").map((tag) => tag.trim()).filter(Boolean);
    if (tags.length) and.push({ tags: { $in: tags } });
  }
  if (query.q) {
    const regex = new RegExp(escapeRegex(query.q), "i");
    and.push({ $or: [{ nameAr: regex }, { nameEn: regex }] });
  }
  return and.length ? { $and: and } : {};
}

function mealListFilter(actor, query) {
  const and = [];
  if (actor.role === "admin") {
    const source = query.source || "library";
    if (source !== "all") and.push({ source });
    if (query.isActive === "true") and.push({ isActive: true });
    if (query.isActive === "false") and.push({ isActive: false });
  } else {
    and.push({
      $or: [
        { source: "library", isActive: true },
        { source: "coach", userId: actor.userId },
      ],
    });
  }
  if (query.mealType) {
    if (!MEAL_TYPES.includes(query.mealType)) throw new ApiError(400, "Invalid mealType");
    and.push({ mealType: query.mealType });
  }
  if (query.goal) {
    if (!GOALS.includes(query.goal)) throw new ApiError(400, "Invalid goal");
    and.push({ goal: query.goal });
  }
  if (query.q) {
    const regex = new RegExp(escapeRegex(query.q), "i");
    and.push({ $or: [{ name: regex }, { description: regex }] });
  }
  return and.length ? { $and: and } : {};
}

async function resolveIngredients(rows, actor) {
  const ids = rows.map((row) => {
    assertObjectId(row.foodId, "foodId");
    return row.foodId;
  });
  const foods = await FoodItem.find({ _id: { $in: ids } });
  const byId = new Map(foods.map((food) => [food._id.toString(), food]));
  return rows.map((row) => {
    const food = byId.get(row.foodId.toString());
    if (!food) throw new ApiError(400, "Food item not found");
    if (actor.role === "admin") {
      if (food.source !== "library") {
        throw new ApiError(400, "Library meals can only use library foods");
      }
    } else if (food.source === "library") {
      if (!food.isActive) throw new ApiError(400, `Food item is inactive: ${food.nameAr}`);
    } else if (!sameId(food.userId, actor.userId)) {
      throw new ApiError(403, "You cannot use this food item");
    }
    return { foodId: food._id, quantityGrams: row.quantityGrams };
  });
}

function coachCanUseFood(food, coachId, { allowInactiveLibrary = false } = {}) {
  if (!food) return false;
  if (food.source === "library") return food.isActive || allowInactiveLibrary;
  return sameId(food.userId, coachId);
}

function coachCanUseMeal(meal, coachId) {
  if (!meal) return false;
  if (meal.source === "library") return meal.isActive;
  return sameId(meal.userId, coachId);
}

function foodIdsOnDays(days) {
  const ids = new Set();
  for (const day of days || []) {
    for (const meal of day.meals || []) {
      for (const item of meal.items || []) {
        const id = idOf(item.foodId);
        if (id) ids.add(id);
      }
    }
  }
  return ids;
}

function plainDay(day) {
  if (day && typeof day.toObject === "function") return day.toObject();
  return day;
}

function mergeDays(existingDays, incomingDays) {
  const byNumber = new Map(
    (existingDays || []).map((day) => {
      const plain = plainDay(day);
      return [Number(plain.dayNumber), plain];
    })
  );
  for (const day of incomingDays) {
    byNumber.set(day.dayNumber, day);
  }
  const days = [...byNumber.values()].sort((a, b) => a.dayNumber - b.dayNumber);
  return {
    days,
    totals: sumMacros(days.map((day) => day.totals || emptyMacros())),
  };
}

function readTargetCalories(value) {
  if (value == null || value === "") return null;
  const targetCalories = Number(value);
  if (!Number.isFinite(targetCalories) || targetCalories < 0) {
    throw new ApiError(400, "targetCalories must be a number greater than or equal to 0");
  }
  return Math.round(targetCalories * 10) / 10;
}

function assignmentMeta(body, { partial = false, current = null } = {}) {
  let name;
  if (!partial || body.name !== undefined) {
    name = String(body.name || "").trim();
    if (!name) throw new ApiError(400, "name is required");
  } else {
    name = current.name;
  }

  let goal;
  if (!partial || body.goal !== undefined) {
    if (!GOALS.includes(body.goal)) {
      throw new ApiError(400, "goal must be cutting, bulking, or maintenance");
    }
    goal = body.goal;
  } else {
    goal = current.goal;
  }

  let targetCalories;
  if (!partial || body.targetCalories !== undefined) {
    targetCalories = readTargetCalories(body.targetCalories);
  } else {
    targetCalories = current.targetCalories ?? null;
  }

  return { name, goal, targetCalories };
}

async function loadActiveCoachSubscription(coachId, subscriptionId) {
  assertObjectId(subscriptionId, "subscription id");
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription || subscription.deletedAt) {
    throw new ApiError(404, "Subscription not found");
  }
  if (!sameId(subscription.coachId, coachId)) {
    throw new ApiError(403, "You are not allowed to update this subscription");
  }
  if (subscription.status !== "active") {
    throw new ApiError(400, "Subscription is not active");
  }
  return subscription;
}

async function buildPlanDays(days, coachId, { existingFoodIds = new Set() } = {}) {
  if (!Array.isArray(days) || days.length < 1 || days.length > 7) {
    throw new ApiError(400, "Send between 1 and 7 days");
  }
  const seen = new Set();
  for (const day of days) {
    const dayNumber = Number(day?.dayNumber);
    if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 7) {
      throw new ApiError(400, "dayNumber must be from 1 to 7");
    }
    if (seen.has(dayNumber)) {
      throw new ApiError(400, `Day ${dayNumber} is duplicated`);
    }
    seen.add(dayNumber);
  }

  const templateIds = [];
  const directFoodIds = [];
  for (const day of days) {
    for (const meal of day.meals || []) {
      if (meal?.mealTemplateId) {
        assertObjectId(meal.mealTemplateId, "mealTemplateId");
        templateIds.push(meal.mealTemplateId);
      }
      for (const item of meal?.items || []) {
        if (item?.foodId) {
          assertObjectId(item.foodId, "foodId");
          directFoodIds.push(item.foodId);
        }
      }
    }
  }

  const templates = templateIds.length
    ? await MealTemplate.find({ _id: { $in: templateIds } }).populate("ingredients.foodId")
    : [];
  const templateMap = new Map(templates.map((meal) => [meal._id.toString(), meal]));

  const foods = directFoodIds.length
    ? await FoodItem.find({ _id: { $in: directFoodIds } })
    : [];
  const foodMap = new Map(foods.map((food) => [food._id.toString(), food]));

  const builtDays = days
    .map((day) => {
      const meals = (day.meals || []).map((meal) => {
        const hasExplicitItems = Array.isArray(meal.items) && meal.items.length > 0;
        let template = null;
        if (meal.mealTemplateId) {
          assertObjectId(meal.mealTemplateId, "mealTemplateId");
          template = templateMap.get(meal.mealTemplateId.toString());
          if (!template || !coachCanUseMeal(template, coachId)) {
            if (!hasExplicitItems) throw new ApiError(400, "Meal not found");
            template = null;
          }
        }

        const sourceItems = hasExplicitItems
          ? meal.items
          : (template?.ingredients || []).map((row) => ({
              foodId: idOf(row.foodId),
              quantityGrams: row.quantityGrams,
              fromTemplate: true,
            }));

        if (!sourceItems.length) {
          throw new ApiError(400, "Each meal needs at least one food");
        }

        const items = sourceItems.map((item) => {
          assertObjectId(item.foodId, "foodId");
          const quantity = Number(item.quantityGrams);
          if (!Number.isFinite(quantity) || quantity <= 0) {
            throw new ApiError(400, "quantityGrams must be greater than 0");
          }
          let food = foodMap.get(item.foodId.toString());
          if (!food && item.fromTemplate && template) {
            const row = template.ingredients.find((ingredient) => idOf(ingredient.foodId) === item.foodId.toString());
            food = row?.foodId && row.foodId.nameAr ? row.foodId : null;
          }
          const alreadyOnPlan = existingFoodIds.has(item.foodId.toString());
          if (!coachCanUseFood(food, coachId, {
            allowInactiveLibrary: Boolean(item.fromTemplate) || alreadyOnPlan,
          })) {
            throw new ApiError(400, "Food item is not available");
          }
          const macros = macrosForQuantity(food.nutritionPer100g, quantity);
          return {
            foodId: food._id,
            nameAr: food.nameAr,
            nameEn: food.nameEn || null,
            quantityGrams: Math.round(quantity * 10) / 10,
            ...macros,
          };
        });

        const name = String(meal.name || template?.name || "").trim();
        if (!name) throw new ApiError(400, "Meal name is required");
        const mealType = meal.mealType || template?.mealType;
        if (!MEAL_TYPES.includes(mealType)) throw new ApiError(400, "Invalid mealType");

        return {
          mealTemplateId: template?._id || null,
          name,
          description: String(meal.description ?? template?.description ?? "").trim(),
          mealType,
          coachNote: String(meal.coachNote ?? template?.coachNote ?? "").trim(),
          image: meal.image ?? template?.image ?? null,
          items,
          totals: sumMacros(items),
        };
      });

      return {
        dayNumber: Number(day.dayNumber),
        note: String(day.note || "").trim(),
        meals,
        totals: sumMacros(meals.map((meal) => meal.totals)),
      };
    })
    .sort((a, b) => a.dayNumber - b.dayNumber);

  return {
    days: builtDays,
    totals: sumMacros(builtDays.map((day) => day.totals)),
  };
}

export async function listFoods(actor, query) {
  const paging = pageParams(query);
  const filter = foodListFilter(actor, query);
  const [total, rows] = await Promise.all([
    FoodItem.countDocuments(filter),
    FoodItem.find(filter).sort({ source: 1, nameAr: 1 }).skip(paging.skip).limit(paging.limit),
  ]);
  return {
    data: rows.map(serializeFood),
    pagination: paginationMeta({ ...paging, total }),
  };
}

export async function createFood(actor, body) {
  const payload = parseFoodBody(body);
  const doc = {
    ...payload,
    source: actor.role === "admin" ? "library" : "coach",
  };
  if (actor.role !== "admin") doc.userId = actor.userId;
  const food = await FoodItem.create(doc);
  return serializeFood(food);
}

export async function updateFood(actor, id, body) {
  assertObjectId(id, "food id");
  const food = await FoodItem.findById(id);
  assertCanEditFood(food, actor);
  const payload = parseFoodBody(body, { partial: true });
  Object.assign(food, payload);
  await food.save();
  return serializeFood(food);
}

export async function deleteFood(actor, id) {
  assertObjectId(id, "food id");
  const food = await FoodItem.findById(id);
  assertCanEditFood(food, actor);
  if (food.source !== "coach") {
    throw new ApiError(400, "Library foods are deactivated instead of deleted");
  }
  const [usedInMeal, usedInPlan, usedInAssignment] = await Promise.all([
    MealTemplate.exists({ "ingredients.foodId": food._id }),
    NutritionPlan.exists({ "days.meals.items.foodId": food._id }),
    NutritionAssignment.exists({ "days.meals.items.foodId": food._id }),
  ]);
  if (usedInMeal || usedInPlan || usedInAssignment) {
    throw new ApiError(400, "Remove this food from meals and plans before deleting it");
  }
  await food.deleteOne();
}

export async function listMeals(actor, query) {
  const paging = pageParams(query);
  const filter = mealListFilter(actor, query);
  const [total, rows] = await Promise.all([
    MealTemplate.countDocuments(filter),
    MealTemplate.find(filter)
      .populate("ingredients.foodId")
      .sort({ source: 1, name: 1 })
      .skip(paging.skip)
      .limit(paging.limit),
  ]);
  return {
    data: rows.map(serializeMeal),
    pagination: paginationMeta({ ...paging, total }),
  };
}

export async function createMeal(actor, body) {
  const payload = parseMealBody(body);
  payload.ingredients = await resolveIngredients(payload.ingredients, actor);
  const doc = {
    ...payload,
    source: actor.role === "admin" ? "library" : "coach",
  };
  if (actor.role !== "admin") doc.userId = actor.userId;
  const meal = await MealTemplate.create(doc);
  await meal.populate("ingredients.foodId");
  return serializeMeal(meal);
}

export async function updateMeal(actor, id, body) {
  assertObjectId(id, "meal id");
  const meal = await MealTemplate.findById(id);
  assertCanEditMeal(meal, actor);
  const payload = parseMealBody(body, { partial: true });
  if (payload.ingredients) {
    payload.ingredients = await resolveIngredients(payload.ingredients, actor);
  }
  Object.assign(meal, payload);
  await meal.save();
  await meal.populate("ingredients.foodId");
  return serializeMeal(meal);
}

export async function deleteMeal(actor, id) {
  assertObjectId(id, "meal id");
  const meal = await MealTemplate.findById(id);
  assertCanEditMeal(meal, actor);
  if (meal.source !== "coach") {
    throw new ApiError(400, "Library meals are deactivated instead of deleted");
  }
  const [usedInPlan, usedInAssignment] = await Promise.all([
    NutritionPlan.exists({ "days.meals.mealTemplateId": meal._id }),
    NutritionAssignment.exists({ "days.meals.mealTemplateId": meal._id }),
  ]);
  if (usedInPlan || usedInAssignment) {
    throw new ApiError(400, "Remove this meal from nutrition plans before deleting it");
  }
  await meal.deleteOne();
}

export async function saveSubscriptionNutritionPlan(coachId, subscriptionId, body, { merge = false } = {}) {
  const subscription = await loadActiveCoachSubscription(coachId, subscriptionId);
  const existing = subscription.nutritionAssignmentId
    ? await NutritionAssignment.findById(subscription.nutritionAssignmentId)
    : null;
  if (merge && !existing) {
    throw new ApiError(404, "Nutrition plan not found");
  }

  const meta = assignmentMeta(body, { partial: merge, current: existing });
  const built = await buildPlanDays(body.days, coachId, {
    existingFoodIds: existing ? foodIdsOnDays(existing.days) : new Set(),
  });
  const savedDays = merge ? mergeDays(existing.days, built.days) : built;
  const assignment = await NutritionAssignment.findOneAndUpdate(
    { subscriptionId: subscription._id },
    {
      $set: {
        subscriptionId: subscription._id,
        coachId: subscription.coachId,
        athleteId: subscription.athleteId,
        sourcePlanId: null,
        name: meta.name,
        goal: meta.goal,
        targetCalories: meta.targetCalories,
        days: savedDays.days,
        totals: savedDays.totals,
        assignedAt: existing?.assignedAt || new Date(),
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );

  if (!sameId(subscription.nutritionAssignmentId, assignment._id)) {
    await Subscription.updateOne(
      { _id: subscription._id },
      { $set: { nutritionAssignmentId: assignment._id } }
    );
  }

  return {
    assignment: serializeAssignment(assignment),
    athleteId: subscription.athleteId,
    isUpdate: Boolean(existing),
  };
}

export async function getAssignmentForSubscription(user, subscriptionId) {
  assertObjectId(subscriptionId, "subscription id");
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription || subscription.deletedAt) {
    throw new ApiError(404, "Subscription not found");
  }
  const role = user?.role_id?.name;
  const isCoach = role === "coach" && sameId(subscription.coachId, user._id || user.id);
  const isAthlete = role === "athlete" && sameId(subscription.athleteId, user._id || user.id);
  if (!isCoach && !isAthlete) {
    throw new ApiError(403, "You are not allowed to view this nutrition plan");
  }
  if (!subscription.nutritionAssignmentId) return null;
  const assignment = await NutritionAssignment.findById(subscription.nutritionAssignmentId);
  return serializeAssignment(assignment);
}

export async function getAssignmentById(id) {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  const assignment = await NutritionAssignment.findById(id);
  return serializeAssignment(assignment);
}
