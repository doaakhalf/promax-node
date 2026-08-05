import { BrevoClient } from "@getbrevo/brevo";

import dotenv from "dotenv";
dotenv.config();
const client = new BrevoClient({
    apiKey: process.env.BREVO_API_KEY,
});


export const sendCoachActivationEmail = async (to, coachName) => {
    const androidStoreUrl = "https://play.google.com/store/apps/details?id=com.mrazzak.trainify";
    const iosStoreUrl = "https://apps.apple.com/eg/app/trainify/id6786225762";
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
      <h1> اهلا بك ${coachName} في Trainify! 🎉 </h1>
   
    </div>
  
    <div class="content">

      <p>
       تمت الموافقة على حسابك، وأصبح بإمكانك الآن تسجيل الدخول إلى Trainify والبدء في استخدام المنصة.

      </p>
  
      <p>
       كمّل ملفك الشخصي، واستكشف لوحة التحكم، وخلي حسابك جاهز علشان يظهر بأفضل شكل للمتدربين. 💪🔥
      </p>
  
      <div class="highlight">
        🚀 <strong>يلا نبدأ </strong>
        <br>
     
      </div>
  
   <div style="text-align:center; margin-top:30px;">

  <a href="${androidStoreUrl}" target="_blank">
    <img
      src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg"
      alt="Get it on Google Play"
      width="180"
      style="margin:10px;border:0;">
  </a>

  <a href="${iosStoreUrl}" target="_blank">
    <img
      src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg"
      alt="Download on the App Store"
      width="180"
      style="margin:10px;border:0;">
  </a>

</div>
  
    
  
      <p>
        أطيب التحيات,<br>
        <strong>فريق Trainify</strong>
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
                name: "Trainify",
                email: process.env.EMAIL_USER,
            },
            to: [{ email: to }],
            subject: "🎉 تم تفعيل حسابك",
            htmlContent: HtmlEmail,
        };

        const result = await client.transactionalEmails.sendTransacEmail(email);

        return result;
    } catch (error) {
        console.error(error);
        throw error;
    }
};






export const sendForgetPasswordEmail = async (to, name, otp) => {
    const androidStoreUrl = "https://play.google.com/store/apps/details?id=com.mrazzak.trainify";
    const iosStoreUrl = "https://apps.apple.com/eg/app/trainify/id6786225762";
    const HtmlEmail = `
<!DOCTYPE html>
<html>

<head>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f4f4f4;
    }

    .container {
      max-width: 600px;
      margin: 30px auto;
      padding: 0;
    }

    .header {
      background: linear-gradient(135deg, #E8652D 0%, #F58A4B 100%);
      color: white;
      padding: 35px;
      text-align: center;
      border-radius: 10px 10px 0 0;
    }

    .content {
      background: #ffffff;
      padding: 35px;
      border-radius: 0 0 10px 10px;
    }

    .otp-box {
      background: #fff3ed;
      border: 2px dashed #E8652D;
      border-radius: 10px;
      padding: 20px;
      text-align: center;
      margin: 30px 0;
    }

    .otp-code {
      font-size: 36px;
      font-weight: bold;
      color: #E8652D;
      letter-spacing: 8px;
      margin-top: 10px;
    }

    .warning {
      background: #FFF8E6;
      border-left: 4px solid #FFC107;
      padding: 15px;
      margin-top: 25px;
      border-radius: 5px;
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
    <h1>🔐 Reset Your Password</h1>
  </div>

  <div class="content">

    <p>مرحبًا ${name}،</p>

    <p>
      تلقينا طلبًا لإعادة تعيين كلمة المرور الخاصة بحسابك في <strong>Trainify</strong>.
    </p>

    <p>
      استخدم رمز التحقق (OTP) التالي لإكمال عملية إعادة تعيين كلمة المرور:
    </p>

    <div class="otp-box">
      <div style="font-size:18px;">رمز التحقق</div>
      <div class="otp-code">${otp}</div>
    </div>

    <div class="warning">
      <strong>⚠️ ملاحظات مهمة:</strong>
      <ul>
        <li>رمز التحقق صالح لمدة <strong>10 دقائق</strong>.</li>
        <li>لا تشارك هذا الرمز مع أي شخص.</li>
        <li>إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذه الرسالة بأمان.</li>
      </ul>
    </div>

    <p>
      شكرًا لاستخدامك Trainify 💪
    </p>

    <p>
      مع أطيب التحيات،<br>
      <strong>فريق Trainify</strong>
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
                name: "Trainify",
                email: process.env.EMAIL_USER,
            },
            to: [{ email: to }],
            subject: "إعادة تعيين كلمة المرور",
            htmlContent: HtmlEmail,
        };

        const result = await client.transactionalEmails.sendTransacEmail(email);

        return result;
    } catch (error) {
        console.error(error);
        throw error;
    }
};






