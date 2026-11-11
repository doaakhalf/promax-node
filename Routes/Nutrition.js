import { Router } from "express";
import { checkRole } from "../Middleware/checkRole.js";
import {
  coachAssignPlan,
  coachCreateFood,
  coachCreateMeal,
  coachCreatePlan,
  coachDeleteFood,
  coachDeleteMeal,
  coachDeletePlan,
  coachDuplicatePlan,
  coachGetPlan,
  coachListFoods,
  coachListMeals,
  coachListPlans,
  coachUpdateFood,
  coachUpdateMeal,
  coachUpdatePlan,
  getAssignedNutritionPlan,
} from "../Controller/NutritionLibraryController.js";

const NutritionRouter = Router();

NutritionRouter.get("/food-items", checkRole("coach"), coachListFoods);
NutritionRouter.post("/food-items", checkRole("coach"), coachCreateFood);
NutritionRouter.put("/food-items/:id", checkRole("coach"), coachUpdateFood);
NutritionRouter.delete("/food-items/:id", checkRole("coach"), coachDeleteFood);

NutritionRouter.get("/meal-templates", checkRole("coach"), coachListMeals);
NutritionRouter.post("/meal-templates", checkRole("coach"), coachCreateMeal);
NutritionRouter.put("/meal-templates/:id", checkRole("coach"), coachUpdateMeal);
NutritionRouter.delete("/meal-templates/:id", checkRole("coach"), coachDeleteMeal);

NutritionRouter.get("/nutrition-plans", checkRole("coach"), coachListPlans);
NutritionRouter.post("/nutrition-plans", checkRole("coach"), coachCreatePlan);
NutritionRouter.get("/nutrition-plans/:id", checkRole("coach"), coachGetPlan);
NutritionRouter.put("/nutrition-plans/:id", checkRole("coach"), coachUpdatePlan);
NutritionRouter.post("/nutrition-plans/:id/duplicate", checkRole("coach"), coachDuplicatePlan);
NutritionRouter.delete("/nutrition-plans/:id", checkRole("coach"), coachDeletePlan);

NutritionRouter.get(
  "/subscriptions/:subscriptionId/nutrition-plan",
  checkRole("coach", "athlete"),
  getAssignedNutritionPlan
);
NutritionRouter.post(
  "/subscriptions/:subscriptionId/nutrition-plan",
  checkRole("coach"),
  coachAssignPlan
);

export default NutritionRouter;
