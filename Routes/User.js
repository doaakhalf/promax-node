import { refreshTokenController } from "../Controller/LoginController.js";
import { Router } from "express";

const UserRouter = Router();

// Add this route
UserRouter.post("/refresh", refreshTokenController);

export default UserRouter;