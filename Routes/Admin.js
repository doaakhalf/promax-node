import { Router } from "express";
import { checkRole } from "../Middleware/checkRole.js";
import auth from "../Middleware/auth.js";
import { activatePayment,getAllSubscriptionPayments } from "../Controller/PaymentController.js";
import { setAppVersion } from "../Controller/AdminController.js";
import {
  adminGeneratePayouts,
  adminGetCoachUpcomingPayout,
  adminListPayouts,
  adminListUpcomingPayouts,
  adminMarkPayoutPaid,
} from "../Controller/PayoutController.js";

const AdminRouter = Router();



export default AdminRouter;


AdminRouter.put("/coaches/subscription/confirm/:paymentId", auth, checkRole("admin"), activatePayment);
AdminRouter.get("/coaches/subscription", auth, checkRole("admin"), getAllSubscriptionPayments);

AdminRouter.get("/payouts/upcoming", auth, checkRole("admin"), adminListUpcomingPayouts);
AdminRouter.get("/payouts/upcoming/:coachId", auth, checkRole("admin"), adminGetCoachUpcomingPayout);
AdminRouter.get("/payouts", auth, checkRole("admin"), adminListPayouts);
AdminRouter.post("/payouts/generate", auth, checkRole("admin"), adminGeneratePayouts);
AdminRouter.patch("/payouts/:id/mark-paid", auth, checkRole("admin"), adminMarkPayoutPaid);

AdminRouter.put("/app/version", auth, checkRole("admin"), setAppVersion);
