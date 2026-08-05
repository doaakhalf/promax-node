import crypto from 'crypto';
import bcrypt from 'bcrypt';
import User from '../Models/User.js';
import { sendForgetPasswordEmail } from '../utils/email.js';

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const RESET_TOKEN_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

const hashValue = (value) => crypto.createHash('sha256').update(value).digest('hex');

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        status: 'error',
        message: 'email is required'
      });
    }

    const user = await User.findOne({ email: email.trim() });
   
    if (!user) {
      return res.status(200).json({
        status: 'success',
        message: 'If an account exists with this email, an OTP has been sent via this mail.'
      });
    }

    const otp = crypto.randomInt(100000, 1000000).toString();

    user.resetPasswordToken = hashValue(otp);
    user.resetPasswordExpires = Date.now() + OTP_EXPIRY_MS;
    await user.save();

    try {
      await sendForgetPasswordEmail(
        user.email,
        user.firstName + " " + user.lastName,
        otp
      );
      return res.status(200).json({
        status: 'success',
        message: 'otp send successfully.'
      });

    } catch (emailError) {
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      await user.save();
      console.error('Failed to send OTP:', emailError);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to send OTP. Please try again later.'
      });
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'An error occurred. Please try again.'
    });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        status: 'error',
        message: 'email and OTP are required'
      });
    }

    const user = await User.findOne({
      email: email.trim(),
      resetPasswordToken: hashValue(otp),
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid or expired OTP'
      });
    }

    // Issue a short-lived reset token so the OTP itself can't be replayed
    // against the /reset endpoint.
    const resetToken = crypto.randomBytes(32).toString('hex');

    user.resetPasswordToken = hashValue(resetToken);
    user.resetPasswordExpires = Date.now() + RESET_TOKEN_EXPIRY_MS;
    await user.save();

    return res.status(200).json({
      status: 'success',
      message: 'OTP verified',
      data: { resetToken }
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'An error occurred. Please try again.'
    });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword ,confirmNewPassword} = req.body;

    if (!token || !newPassword || !confirmNewPassword) {
      return res.status(400).json({
        status: 'error',
        message: 'Token, new password, and confirm password are required'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        status: 'error',
        message: 'Password must be at least 8 characters long'
      });
    }

    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({
        status: 'error',
        message: 'Passwords do not match'
      });
    }

    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid or expired reset token'
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    return res.status(200).json({
      status: 'success',
      message: 'Password has been reset successfully. You can now login with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'An error occurred. Please try again.'
    });
  }
};

export const verifyResetToken = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        status: 'error',
        message: 'Token is required'
      });
    }

    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid or expired token'
      });
    }

    return res.status(200).json({
      status: 'success',
      message: 'Token is valid',
      data: {
        email: user.email
      }
    });
  } catch (error) {
    console.error('Verify token error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'An error occurred'
    });
  }
};
