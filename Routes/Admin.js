import { Router } from "express";
import { checkRole } from "../Middleware/checkRole.js";
import auth from "../Middleware/auth.js";
import { activatePayment,getAllSubscriptionPayments } from "../Controller/PaymentController.js";
import {
  setAppVersion,
  getChatSettings,
  setChatSettings,
  getSubscriptionSettings,
  setSubscriptionSettings
} from "../Controller/AdminController.js";
import {
  adminGeneratePayouts,
  adminGetCoachUpcomingPayout,
  adminGetPayoutDetails,
  adminListPayouts,
  adminListUpcomingPayouts,
  adminMarkPayoutPaid,
} from "../Controller/PayoutController.js";
import { createUploader } from "../config/upload.js";
import { getAdminOverviewSummary, getWeightTrackers } from "../Controller/AdminDashboardController.js";
import { getLiveExerciseDbExercises } from "../Controller/AdminExerciseDbController.js";
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
  approveCoachProfileReview,
  getCoachProfileReview,
  listCoachProfileReviews,
  rejectCoachProfileReview,
} from "../Controller/CoachProfileReviewController.js";
import { adminListFeedback } from "../Controller/FeedbackController.js";
import { adminListRatings } from "../Controller/RatingController.js";
const AdminRouter = Router();
const payoutUpload = createUploader("payout-proofs");

export default AdminRouter;


AdminRouter.put("/coaches/subscription/confirm/:paymentId", auth, checkRole("admin"), activatePayment);
AdminRouter.get("/coaches/subscription", auth, checkRole("admin"), getAllSubscriptionPayments);
AdminRouter.get("/coaches", auth, checkRole("admin"), getCoaches);
AdminRouter.get("/coach-profile-reviews", auth, checkRole("admin"), listCoachProfileReviews);
AdminRouter.get("/coach-profile-reviews/:id", auth, checkRole("admin"), getCoachProfileReview);
AdminRouter.put("/coach-profile-reviews/:id/approve", auth, checkRole("admin"), approveCoachProfileReview);
AdminRouter.put("/coach-profile-reviews/:id/reject", auth, checkRole("admin"), rejectCoachProfileReview);


AdminRouter.get("/payouts/upcoming", auth, checkRole("admin"), adminListUpcomingPayouts);
AdminRouter.get("/payouts/upcoming/:coachId", auth, checkRole("admin"), adminGetCoachUpcomingPayout);
AdminRouter.get("/payouts", auth, checkRole("admin"), adminListPayouts);
AdminRouter.get("/payouts/:id", auth, checkRole("admin"), adminGetPayoutDetails);
AdminRouter.get("/overview/summary", auth, checkRole("admin"), getAdminOverviewSummary);
AdminRouter.get("/weight-trackers", auth, checkRole("admin"), getWeightTrackers);
AdminRouter.post("/payouts/generate", auth, checkRole("admin"), adminGeneratePayouts);
AdminRouter.patch(
  "/payouts/:id/mark-paid",
  auth,
  checkRole("admin"),
  payoutUpload.single("paymentProofImage"),
  adminMarkPayoutPaid
);

AdminRouter.put("/app/version", auth, checkRole("admin"), setAppVersion);

AdminRouter.get("/chat/settings", auth, checkRole("admin"), getChatSettings);
AdminRouter.put("/chat/settings", auth, checkRole("admin"), setChatSettings);

AdminRouter.get("/subscription/settings", auth, checkRole("admin"), getSubscriptionSettings);
AdminRouter.put("/subscription/settings", auth, checkRole("admin"), setSubscriptionSettings);

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

AdminRouter.get("/exercises/live", auth, checkRole("admin"), getLiveExerciseDbExercises);

AdminRouter.get("/feedback", auth, checkRole("admin"), adminListFeedback);
AdminRouter.get("/ratings", auth, checkRole("admin"), adminListRatings);

// Audit log routes (Admin only)
AdminRouter.get("/audit-logs", auth, checkRole("admin"), getAuditLogs);
AdminRouter.get("/audit-logs/stats", auth, checkRole("admin"), getAuditLogStats);
