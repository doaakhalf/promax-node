import { Router } from "express";
import auth from "../Middleware/auth.js";
import { checkRole } from "../Middleware/checkRole.js";
import {
  listCoachesWithSubscriptions,
  getCoachSubscriptionTrainees,
  getCoachAthleteCalendar,
  listProcessedSubscriptionPayments,
  freezeSubscription,
  unfreezeSubscription,
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
AdminSubscriptionsRouter.post(
  "/subscriptions/:subscriptionId/freeze",
  auth,
  checkRole("admin"),
  freezeSubscription
);
AdminSubscriptionsRouter.post(
  "/subscriptions/:subscriptionId/unfreeze",
  auth,
  checkRole("admin"),
  unfreezeSubscription
);

export default AdminSubscriptionsRouter;
