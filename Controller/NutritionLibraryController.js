import NotificationService from "../services/NotificationService.js";
import {
  createFood,
  createMeal,
  deleteFood,
  deleteMeal,
  getAssignmentForSubscription,
  listFoods,
  listMeals,
  saveSubscriptionNutritionPlan,
  updateFood,
  updateMeal,
} from "../services/NutritionLibraryService.js";

const actor = (req) => ({ role: "coach", userId: req.userId });

const respond = (res, message, data, pagination, statusCode = 200) => {
  res.status(statusCode).json({
    status: "success",
    message,
    data,
    ...(pagination ? { pagination } : {}),
  });
};

export const coachListFoods = async (req, res, next) => {
  try {
    const result = await listFoods(actor(req), req.query);
    respond(res, "Food items retrieved", result.data, result.pagination);
  } catch (err) {
    next(err);
  }
};

export const coachCreateFood = async (req, res, next) => {
  try {
    const data = await createFood(actor(req), req.body);
    respond(res, "Food item created", data, null, 201);
  } catch (err) {
    next(err);
  }
};

export const coachUpdateFood = async (req, res, next) => {
  try {
    const data = await updateFood(actor(req), req.params.id, req.body);
    respond(res, "Food item updated", data);
  } catch (err) {
    next(err);
  }
};

export const coachDeleteFood = async (req, res, next) => {
  try {
    await deleteFood(actor(req), req.params.id);
    respond(res, "Food item deleted", null);
  } catch (err) {
    next(err);
  }
};

export const coachListMeals = async (req, res, next) => {
  try {
    const result = await listMeals(actor(req), req.query);
    respond(res, "Meals retrieved", result.data, result.pagination);
  } catch (err) {
    next(err);
  }
};

export const coachCreateMeal = async (req, res, next) => {
  try {
    const data = await createMeal(actor(req), req.body);
    respond(res, "Meal created", data, null, 201);
  } catch (err) {
    next(err);
  }
};

export const coachUpdateMeal = async (req, res, next) => {
  try {
    const data = await updateMeal(actor(req), req.params.id, req.body);
    respond(res, "Meal updated", data);
  } catch (err) {
    next(err);
  }
};

export const coachDeleteMeal = async (req, res, next) => {
  try {
    await deleteMeal(actor(req), req.params.id);
    respond(res, "Meal deleted", null);
  } catch (err) {
    next(err);
  }
};

export const coachSaveSubscriptionPlan = async (req, res, next) => {
  try {
    const merge = req.method === "PUT";
    const { assignment, athleteId, isUpdate } = await saveSubscriptionNutritionPlan(
      req.userId,
      req.params.subscriptionId,
      req.body,
      { merge }
    );
    const type = isUpdate ? "nutrition_plan_updated" : "nutrition_plan_assigned";
    try {
      await NotificationService.sendNotification({
        recipientId: athleteId,
        senderId: req.userId,
        type,
        title: isUpdate ? "🍎 تم تحديث خطة التغذية" : "🍎 تم إضافة خطة التغذية",
        message: isUpdate
          ? "قام المدرب بتحديث خطة التغذية الأسبوعية الخاصة بك"
          : "قام المدرب بإضافة خطة تغذية أسبوعية لك",
        data: {
          subscriptionId: req.params.subscriptionId,
          nutritionAssignmentId: assignment.id,
          type,
        },
      });
    } catch (notifyErr) {
      console.error("Nutrition plan notification failed:", notifyErr);
    }
    respond(
      res,
      isUpdate ? "Nutrition plan updated" : "Nutrition plan created",
      assignment,
      null,
      isUpdate ? 200 : 201
    );
  } catch (err) {
    next(err);
  }
};

export const getAssignedNutritionPlan = async (req, res, next) => {
  try {
    const data = await getAssignmentForSubscription(req.user, req.params.subscriptionId);
    respond(res, "Nutrition plan retrieved", data);
  } catch (err) {
    next(err);
  }
};
