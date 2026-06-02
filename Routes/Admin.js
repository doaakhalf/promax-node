import { Router } from "express";
import { checkRole } from "../Middleware/checkRole.js";
import auth from "../Middleware/auth.js";
import { activatePayment,getAllSubscriptionPayments } from "../Controller/PaymentController.js";

const AdminRouter = Router();



export default AdminRouter;


AdminRouter.put("/coaches/subscription/confirm/:paymentId", auth, checkRole("admin"), activatePayment);
AdminRouter.get("/coaches/subscription", auth, checkRole("admin"), getAllSubscriptionPayments);