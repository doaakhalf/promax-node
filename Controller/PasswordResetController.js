import crypto from 'crypto';
import bcrypt from 'bcrypt';
import User from '../Models/User.js';
import { sendWhatsAppMessage ,sendWelcomeMessage} from '../utils/whatsappService.js';

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const RESET_TOKEN_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

const hashValue = (value) => crypto.createHash('sha256').update(value).digest('hex');

export const forgotPassword = async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        status: 'error',
        message: 'Phone number is required'
      });
    }

    const user = await User.findOne({ phoneNumber: phoneNumber.trim() });

    if (!user) {
      return res.status(200).json({
        status: 'success',
        message: 'If an account exists with this phone number, an OTP has been sent via WhatsApp.'
      });
    }

    const otp = crypto.randomInt(100000, 1000000).toString();

    user.resetPasswordToken = hashValue(otp);
    user.resetPasswordExpires = Date.now() + OTP_EXPIRY_MS;
    await user.save();

    try {
      // await sendWhatsAppMessage(
      //   user.phoneNumber,
      //   `*Trainify - Password Reset*\n\nYour OTP code is: *${otp}*\n\nIt expires in 10 minutes. If you didn't request this, please ignore this message.`
      // );
await sendWelcomeMessage(user.phoneNumber, otp);
      return res.status(200).json({
        status: 'success',
        message: 'An OTP has been sent to your WhatsApp.'
      });
    } catch (whatsappError) {
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      await user.save();
      console.error('Failed to send OTP:', whatsappError);
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
    const { phoneNumber, otp } = req.body;

    if (!phoneNumber || !otp) {
      return res.status(400).json({
        status: 'error',
        message: 'Phone number and OTP are required'
      });
    }

    const user = await User.findOne({
      phoneNumber: phoneNumber.trim(),
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
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        status: 'error',
        message: 'Token and new password are required'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        status: 'error',
        message: 'Password must be at least 8 characters long'
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
