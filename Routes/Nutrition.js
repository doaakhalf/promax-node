import { Router } from "express";
import { checkRole } from "../Middleware/checkRole.js";
import {
  coachCreateFood,
  coachCreateMeal,
  coachDeleteFood,
  coachDeleteMeal,
  coachListFoods,
  coachListMeals,
  coachSaveSubscriptionPlan,
  coachUpdateFood,
  coachUpdateMeal,
  getAssignedNutritionPlan,
  getFoodItem,
  getMealTemplate,
} from "../Controller/NutritionLibraryController.js";

const NutritionRouter = Router();

NutritionRouter.get("/food-items", checkRole("coach"), coachListFoods);
NutritionRouter.get("/food-items/:id", checkRole("coach", "athlete", "admin"), getFoodItem);
NutritionRouter.post("/food-items", checkRole("coach"), coachCreateFood);
NutritionRouter.put("/food-items/:id", checkRole("coach"), coachUpdateFood);
NutritionRouter.delete("/food-items/:id", checkRole("coach"), coachDeleteFood);

NutritionRouter.get("/meal-templates", checkRole("coach"), coachListMeals);
NutritionRouter.get("/meal-templates/:id", checkRole("coach", "athlete", "admin"), getMealTemplate);
NutritionRouter.post("/meal-templates", checkRole("coach"), coachCreateMeal);
NutritionRouter.put("/meal-templates/:id", checkRole("coach"), coachUpdateMeal);
NutritionRouter.delete("/meal-templates/:id", checkRole("coach"), coachDeleteMeal);

NutritionRouter.get(
  "/subscriptions/:subscriptionId/nutrition-plan",
  checkRole("coach", "athlete"),
  getAssignedNutritionPlan
);
NutritionRouter.post(
  "/subscriptions/:subscriptionId/nutrition-plan",
  checkRole("coach"),
  coachSaveSubscriptionPlan
);
NutritionRouter.put(
  "/subscriptions/:subscriptionId/nutrition-plan",
  checkRole("coach"),
  coachSaveSubscriptionPlan
);

export default NutritionRouter;
