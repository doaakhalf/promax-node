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
  serializePlan,
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

async function buildPlanDays(days, coachId) {
  if (!Array.isArray(days) || days.length !== 7) {
    throw new ApiError(400, "A nutrition plan needs 7 days");
  }
  const dayNumbers = new Set(days.map((day) => Number(day?.dayNumber)));
  for (let dayNumber = 1; dayNumber <= 7; dayNumber += 1) {
    if (!dayNumbers.has(dayNumber)) {
      throw new ApiError(400, `Day ${dayNumber} is missing`);
    }
  }

  const templateIds = [];
  const directFoodIds = [];
  for (const day of days) {
    for (const meal of day.meals || []) {
      if (meal?.mealTemplateId) templateIds.push(meal.mealTemplateId);
      for (const item of meal?.items || []) {
        if (item?.foodId) directFoodIds.push(item.foodId);
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
        let template = null;
        if (meal.mealTemplateId) {
          assertObjectId(meal.mealTemplateId, "mealTemplateId");
          template = templateMap.get(meal.mealTemplateId.toString());
          if (!template || !coachCanUseMeal(template, coachId)) {
            throw new ApiError(400, "Meal not found");
          }
        }

        const sourceItems = Array.isArray(meal.items) && meal.items.length
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
          if (!coachCanUseFood(food, coachId, { allowInactiveLibrary: Boolean(item.fromTemplate) })) {
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

function planPayload(body, coachId) {
  const name = String(body.name || "").trim();
  if (!name) throw new ApiError(400, "name is required");
  if (!GOALS.includes(body.goal)) {
    throw new ApiError(400, "goal must be cutting, bulking, or maintenance");
  }
  let targetCalories = null;
  if (body.targetCalories != null && body.targetCalories !== "") {
    targetCalories = Number(body.targetCalories);
    if (!Number.isFinite(targetCalories) || targetCalories < 0) {
      throw new ApiError(400, "targetCalories must be a number greater than or equal to 0");
    }
    targetCalories = Math.round(targetCalories * 10) / 10;
  }
  return buildPlanDays(body.days, coachId).then((built) => ({
    coachId,
    name,
    goal: body.goal,
    targetCalories,
    isTemplate: Boolean(body.isTemplate),
    ...built,
  }));
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
  const [usedInMeal, usedInPlan] = await Promise.all([
    MealTemplate.exists({ "ingredients.foodId": food._id }),
    NutritionPlan.exists({ "days.meals.items.foodId": food._id }),
  ]);
  if (usedInMeal || usedInPlan) {
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
  const used = await NutritionPlan.exists({ "days.meals.mealTemplateId": meal._id });
  if (used) {
    throw new ApiError(400, "Remove this meal from nutrition plans before deleting it");
  }
  await meal.deleteOne();
}

export async function listPlans(coachId, query) {
  const paging = pageParams(query);
  const filter = { coachId };
  if (query.isTemplate === "true") filter.isTemplate = true;
  if (query.isTemplate === "false") filter.isTemplate = false;
  const [total, rows] = await Promise.all([
    NutritionPlan.countDocuments(filter),
    NutritionPlan.find(filter).sort({ updatedAt: -1 }).skip(paging.skip).limit(paging.limit),
  ]);
  return {
    data: rows.map(serializePlan),
    pagination: paginationMeta({ ...paging, total }),
  };
}

export async function getPlan(coachId, id) {
  assertObjectId(id, "plan id");
  const plan = await NutritionPlan.findOne({ _id: id, coachId });
  if (!plan) throw new ApiError(404, "Nutrition plan not found");
  return serializePlan(plan);
}

export async function createPlan(coachId, body) {
  const payload = await planPayload(body, coachId);
  const plan = await NutritionPlan.create({ ...payload, status: "draft" });
  return serializePlan(plan);
}

export async function updatePlan(coachId, id, body) {
  assertObjectId(id, "plan id");
  const plan = await NutritionPlan.findOne({ _id: id, coachId });
  if (!plan) throw new ApiError(404, "Nutrition plan not found");
  const payload = await planPayload(body, coachId);
  plan.name = payload.name;
  plan.goal = payload.goal;
  plan.targetCalories = payload.targetCalories;
  plan.isTemplate = payload.isTemplate;
  plan.days = payload.days;
  plan.totals = payload.totals;
  await plan.save();
  return serializePlan(plan);
}

export async function duplicatePlan(coachId, id, body = {}) {
  assertObjectId(id, "plan id");
  const plan = await NutritionPlan.findOne({ _id: id, coachId });
  if (!plan) throw new ApiError(404, "Nutrition plan not found");
  const name = String(body.name || `${plan.name} copy`).trim();
  if (!name) throw new ApiError(400, "name is required");
  const plain = plan.toObject();
  const copy = await NutritionPlan.create({
    coachId,
    name,
    goal: plain.goal,
    targetCalories: plain.targetCalories,
    isTemplate: false,
    status: "draft",
    days: plain.days,
    totals: plain.totals,
  });
  return serializePlan(copy);
}

export async function deletePlan(coachId, id) {
  assertObjectId(id, "plan id");
  const plan = await NutritionPlan.findOne({ _id: id, coachId });
  if (!plan) throw new ApiError(404, "Nutrition plan not found");
  await plan.deleteOne();
}

export async function assignPlan(coachId, subscriptionId, planId) {
  assertObjectId(subscriptionId, "subscription id");
  assertObjectId(planId, "plan id");
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
  const plan = await NutritionPlan.findOne({ _id: planId, coachId });
  if (!plan) throw new ApiError(404, "Nutrition plan not found");

  const hadAssignment = Boolean(subscription.nutritionAssignmentId);
  const plain = plan.toObject();
  const assignment = await NutritionAssignment.findOneAndUpdate(
    { subscriptionId: subscription._id },
    {
      $set: {
        subscriptionId: subscription._id,
        coachId: subscription.coachId,
        athleteId: subscription.athleteId,
        sourcePlanId: plan._id,
        name: plain.name,
        goal: plain.goal,
        targetCalories: plain.targetCalories,
        days: plain.days,
        totals: plain.totals || emptyMacros(),
        assignedAt: new Date(),
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );

  await Subscription.updateOne(
    { _id: subscription._id },
    { $set: { nutritionAssignmentId: assignment._id } }
  );

  if (!plan.isTemplate && plan.status !== "assigned") {
    plan.status = "assigned";
    await plan.save();
  }

  return {
    assignment: serializeAssignment(assignment),
    athleteId: subscription.athleteId,
    isUpdate: hadAssignment,
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
