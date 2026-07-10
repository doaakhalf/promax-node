import { refreshTokenController ,deleteAccount, deletePending} from "../Controller/LoginController.js";
import { Router } from "express";
import auth from "../Middleware/auth.js";

const UserRouter = Router();

// Add this route
UserRouter.post("/refresh", refreshTokenController);

UserRouter.delete('/account', auth, deleteAccount);
// UserRouter.delete('/pendingaccount', deletePending);

export default UserRouter;