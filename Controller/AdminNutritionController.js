import {
  createFood,
  createMeal,
  listFoods,
  listMeals,
  updateFood,
  updateMeal,
} from "../services/NutritionLibraryService.js";

const actor = (req) => ({ role: "admin", userId: req.userId });

const respond = (res, message, data, pagination) => {
  res.status(200).json({
    status: "success",
    message,
    data,
    ...(pagination ? { pagination } : {}),
  });
};

export const adminListFoods = async (req, res, next) => {
  try {
    const result = await listFoods(actor(req), req.query);
    respond(res, "Food items retrieved", result.data, result.pagination);
  } catch (err) {
    next(err);
  }
};

export const adminCreateFood = async (req, res, next) => {
  try {
    const data = await createFood(actor(req), req.body);
    res.status(201).json({ status: "success", message: "Food item created", data });
  } catch (err) {
    next(err);
  }
};

export const adminUpdateFood = async (req, res, next) => {
  try {
    const data = await updateFood(actor(req), req.params.id, req.body);
    respond(res, "Food item updated", data);
  } catch (err) {
    next(err);
  }
};

export const adminListMeals = async (req, res, next) => {
  try {
    const result = await listMeals(actor(req), req.query);
    respond(res, "Meals retrieved", result.data, result.pagination);
  } catch (err) {
    next(err);
  }
};

export const adminCreateMeal = async (req, res, next) => {
  try {
    const data = await createMeal(actor(req), req.body);
    res.status(201).json({ status: "success", message: "Meal created", data });
  } catch (err) {
    next(err);
  }
};

export const adminUpdateMeal = async (req, res, next) => {
  try {
    const data = await updateMeal(actor(req), req.params.id, req.body);
    respond(res, "Meal updated", data);
  } catch (err) {
    next(err);
  }
};
