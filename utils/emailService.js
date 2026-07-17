import nodemailer from 'nodemailer';
 import { Resend } from 'resend';

// nodemailer's built-in DNS resolution resolves both A and AAAA records and
// picks a *random* address from the combined list, ignoring the `family`
// option. On hosts without real IPv6 egress (e.g. Railway) this randomly
// causes ENETUNREACH when it picks an AAAA address. Resolving the IPv4
// address ourselves and passing it as a literal IP avoids that logic
// entirely (nodemailer skips DNS resolution when `host` is already an IP).



const createTransporter = async () => {
  const host = process.env.EMAIL_HOST || "smtp.gmail.com";
  
  return nodemailer.createTransport({
     host,
    port: 465,
    secure: true,

    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    },

    tls: {
        servername: "smtp.gmail.com"
    }
  });
};

export const sendPasswordResetEmail = async (email, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  
  const mailOptions = {
    from: `"Trainify Support" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Password Reset Request - Trainify',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #E8652D 0%, #E8652D 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 30px; background: #E8652D; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Password Reset Request</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>We received a request to reset your password for your Trainify account.</p>
            <p>Click the button below to reset your password:</p>
            <p style="text-align: center;">
              <a href="${resetUrl}" class="button" style="display: inline-block; padding: 12px 30px; background: #E8652D; color: #ffffff; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold;">Reset Password</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #E8652D;">${resetUrl}</p>
            <div class="warning">
              <strong>⚠️ Important:</strong>
              <ul>
                <li>This link will expire in <strong>1 hour</strong></li>
                <li>If you didn't request this, please ignore this email</li>
                <li>Your password won't change until you create a new one</li>
              </ul>
            </div>
            <p>If you have any questions, please contact our support team.</p>
            <p>Best regards,<br><strong>Trainify Team</strong></p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Trainify. All rights reserved.</p>
            <p>This is an automated email, please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
  
const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  mailOptions
});
  } catch (error) {
    console.error('Email sending failed:', error);
    throw new Error('Failed to send password reset email');
  }
};

export default { sendPasswordResetEmail };
