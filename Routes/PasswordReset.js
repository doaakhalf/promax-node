import express from 'express';
import { forgotPassword, resetPassword, verifyResetToken } from '../Controller/PasswordResetController.js';

const PasswordResetRouter = express.Router();

PasswordResetRouter.post('/forgot', forgotPassword);
PasswordResetRouter.post('/reset', resetPassword);
PasswordResetRouter.get('/verify/:token', verifyResetToken);

export default PasswordResetRouter;
