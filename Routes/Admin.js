import { Router } from "express";
import { checkRole } from "../Middleware/checkRole.js";
import auth from "../Middleware/auth.js";
import { activatePayment,getAllSubscriptionPayments } from "../Controller/PaymentController.js";
import { setAppVersion } from "../Controller/AdminController.js";
import {
  adminGeneratePayouts,
  adminGetCoachUpcomingPayout,
  adminGetPayoutDetails,
  adminListPayouts,
  adminListUpcomingPayouts,
  adminMarkPayoutPaid,
} from "../Controller/PayoutController.js";
import { createUploader } from "../config/upload.js";
import { getAdminOverviewSummary } from "../Controller/AdminDashboardController.js";

const AdminRouter = Router();
const payoutUpload = createUploader("payout-proofs");

export default AdminRouter;


AdminRouter.put("/coaches/subscription/confirm/:paymentId", auth, checkRole("admin"), activatePayment);
AdminRouter.get("/coaches/subscription", auth, checkRole("admin"), getAllSubscriptionPayments);

AdminRouter.get("/payouts/upcoming", auth, checkRole("admin"), adminListUpcomingPayouts);
AdminRouter.get("/payouts/upcoming/:coachId", auth, checkRole("admin"), adminGetCoachUpcomingPayout);
AdminRouter.get("/payouts", auth, checkRole("admin"), adminListPayouts);
AdminRouter.get("/payouts/:id", auth, checkRole("admin"), adminGetPayoutDetails);
AdminRouter.get("/overview/summary", auth, checkRole("admin"), getAdminOverviewSummary);
AdminRouter.post("/payouts/generate", auth, checkRole("admin"), adminGeneratePayouts);
AdminRouter.patch(
  "/payouts/:id/mark-paid",
  auth,
  checkRole("admin"),
  payoutUpload.single("paymentProofImage"),
  adminMarkPayoutPaid
);

AdminRouter.put("/app/version", auth, checkRole("admin"), setAppVersion);
