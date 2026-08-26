import { Router } from "express";
import auth from "../Middleware/auth.js";
import { checkRole } from "../Middleware/checkRole.js";
import {
  listCoachesWithSubscriptions,
  getCoachSubscriptionTrainees,
  getCoachAthleteCalendar,
  listProcessedSubscriptionPayments,
} from "../Controller/AdminSubscriptionController.js";

const AdminSubscriptionsRouter = Router();

AdminSubscriptionsRouter.get(
  "/subscriptions/payments",
  auth,
  checkRole("admin"),
  listProcessedSubscriptionPayments
);
AdminSubscriptionsRouter.get(
  "/subscriptions/coaches",
  auth,
  checkRole("admin"),
  listCoachesWithSubscriptions
);
AdminSubscriptionsRouter.get(
  "/subscriptions/coaches/:coachId/athletes/:athleteId/calendar",
  auth,
  checkRole("admin"),
  getCoachAthleteCalendar
);
AdminSubscriptionsRouter.get(
  "/subscriptions/coaches/:coachId",
  auth,
  checkRole("admin"),
  getCoachSubscriptionTrainees
);

export default AdminSubscriptionsRouter;
