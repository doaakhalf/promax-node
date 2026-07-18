import express from 'express';
import { forgotPassword, verifyOtp, resetPassword, verifyResetToken } from '../Controller/PasswordResetController.js';

const PasswordResetRouter = express.Router();

PasswordResetRouter.post('/forgot', forgotPassword);
PasswordResetRouter.post('/verify-otp', verifyOtp);
PasswordResetRouter.post('/reset', resetPassword);
PasswordResetRouter.get('/verify/:token', verifyResetToken);

export default PasswordResetRouter;
