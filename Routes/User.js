import { refreshTokenController ,deleteAccount} from "../Controller/LoginController.js";
import { Router } from "express";
import auth from "../Middleware/auth.js";

const UserRouter = Router();

// Add this route
UserRouter.post("/refresh", refreshTokenController);

UserRouter.delete('/account', auth, deleteAccount);

export default UserRouter;