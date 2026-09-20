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
import { getAuditLogs, getAuditLogStats } from "../Controller/AuditLogController.js";
import {
  broadcastNotification,
  searchNotificationUsers,
  sendToUserNotification,
  sendToUsersBroadcast
} from "../Controller/NotificationController.js";
import { adminListGalleryImages } from "../Controller/GalleryController.js";
import { getCoaches } from "../Controller/CoachController.js";
import {
  adminCreatePromoCode,
  adminDeletePromoCode,
  adminListPromoCodes,
  adminUpdatePromoCode,
} from "../Controller/PromoCodeController.js";
const AdminRouter = Router();
const payoutUpload = createUploader("payout-proofs");

export default AdminRouter;


AdminRouter.put("/coaches/subscription/confirm/:paymentId", auth, checkRole("admin"), activatePayment);
AdminRouter.get("/coaches/subscription", auth, checkRole("admin"), getAllSubscriptionPayments);
AdminRouter.get("/coaches", auth, checkRole("admin"), getCoaches);


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

AdminRouter.post(
  "/notifications/broadcast",
  auth,
  checkRole("admin"),
  broadcastNotification
);

AdminRouter.get(
  "/notifications/users",
  auth,
  checkRole("admin"),
  searchNotificationUsers
);

AdminRouter.post(
  "/notifications/send-to-user",
  auth,
  checkRole("admin"),
  sendToUserNotification
);

AdminRouter.post(
  "/notifications/send-to-users",
  auth,
  checkRole("admin"),
  sendToUsersBroadcast
);

AdminRouter.get("/gallery", auth, checkRole("admin"), adminListGalleryImages);

AdminRouter.post("/promo-codes", auth, checkRole("admin"), adminCreatePromoCode);
AdminRouter.get("/promo-codes", auth, checkRole("admin"), adminListPromoCodes);
AdminRouter.patch("/promo-codes/:id", auth, checkRole("admin"), adminUpdatePromoCode);
AdminRouter.delete("/promo-codes/:id", auth, checkRole("admin"), adminDeletePromoCode);

// Audit log routes (Admin only)
AdminRouter.get("/audit-logs", auth, checkRole("admin"), getAuditLogs);
AdminRouter.get("/audit-logs/stats", auth, checkRole("admin"), getAuditLogStats);
