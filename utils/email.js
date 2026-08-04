import { BrevoClient } from "@getbrevo/brevo";

import dotenv from "dotenv";
dotenv.config();
 const client = new BrevoClient({
        apiKey: process.env.BREVO_API_KEY,
    });


export const sendCoachActivationEmail = async (to) => {
      const androidStoreUrl="https://play.google.com/store/apps/details?id=com.mrazzak.trainify";
      const iosStoreUrl="https://apps.apple.com/eg/app/trainify/id6786225762";
     const HtmlEmail = `
  <!DOCTYPE html>
  <html>
  
  <head>
    <style>
      body { 
        font-family: Arial, sans-serif; 
        line-height: 1.6; 
        color: #333; 
      }
  
      .container { 
        max-width: 600px; 
        margin: 0 auto; 
        padding: 20px; 
      }
  
      .header { 
        background: linear-gradient(135deg, #E8652D 0%, #F58A4B 100%);
        color: white; 
        padding: 35px; 
        text-align: center; 
        border-radius: 10px 10px 0 0; 
      }
  
      .content { 
        background: #f9f9f9; 
        padding: 30px; 
        border-radius: 0 0 10px 10px; 
      }
  
      .button { 
        display: inline-block; 
        padding: 14px 35px; 
        background: #E8652D; 
        color: white; 
        text-decoration: none; 
        border-radius: 8px; 
        margin: 20px 0; 
        font-weight: bold;
      }
  
      .highlight {
        background: #fff3ed;
        border-left: 4px solid #E8652D;
        padding: 15px;
        margin: 20px 0;
      }
  
      .footer { 
        text-align: center; 
        margin-top: 20px; 
        color: #666; 
        font-size: 12px; 
      }
    </style>
  </head>
  
  <body>
  
  <div class="container">
  
    <div class="header">
      <h1>🎉 Welcome to Trainify!</h1>
      <h2>Your Account is Activated Successfully</h2>
    </div>
  
    <div class="content">
  
      <p>Hello,</p>
  
      <p>
        Great news! Your Trainify account has been successfully activated. ✅
      </p>
  
      <p>
        You are now ready to start your fitness journey and take the next step toward achieving your goals. 💪🔥
      </p>
  
      <div class="highlight">
        🚀 <strong>Your training journey starts now!</strong>
        <br>
        Download the Trainify app, login to your account, and start exploring your personalized training experience.
      </div>
  
      <p style="text-align:center;">
        <a href="${androidStoreUrl}" 
          class="button"
          style="
            background:#E8652D;
            color:#ffffff;
            padding:14px 35px;
            text-decoration:none;
            border-radius:8px;">
            📱 Download Android App
        </a>
      </p>
  
      <p style="text-align:center;">
        <a href="${iosStoreUrl}" 
          class="button"
          style="
            background:#E8652D;
            color:#ffffff;
            padding:14px 35px;
            text-decoration:none;
            border-radius:8px;">
            🍎 Download iOS App
        </a>
      </p>
  
      <p>
        Once you install the app, simply login using your registered email and start your new training experience.
      </p>
  
      <p>
        Let's build a stronger, healthier you! 🏋️‍♂️🔥
      </p>
  
      <p>
        Best regards,<br>
        <strong>Trainify Team</strong>
      </p>
  
    </div>
  
    <div class="footer">
      <p>© ${new Date().getFullYear()} Trainify. All rights reserved.</p>
      <p>This is an automated email, please do not reply.</p>
    </div>
  
  </div>
  
  </body>
  </html>
  `;
  try {
    const email = {
      sender: {
        name: "Trainify App",
        email: process.env.EMAIL_USER,
      },
      to: [{ email: to }],
      subject: "Coach Activated",
      htmlContent: HtmlEmail,
    };

    const result = await client.transactionalEmails.sendTransacEmail(email);

    return result;
  } catch (error) {
    console.error(error);
    throw error;
  }
};











