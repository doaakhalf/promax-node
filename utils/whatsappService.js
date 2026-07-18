import twilio from 'twilio';

const accountSid = process.env.TWILIOACCOUNTSID;
const authToken = process.env.TWILIOAUTHTOKEN;
// Twilio sandbox default number: 'whatsapp:+14155238886'. Use your own
// approved WhatsApp sender number in production.
const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;

const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

/**
 * Normalizes a phone number into Twilio's WhatsApp address format,
 * e.g. "+201234567890" -> "whatsapp:+201234567890"
 */
const toWhatsAppAddress = (phoneNumber) => {
  if (!phoneNumber) {
    throw new Error('Phone number is required');
  }
  const trimmed = phoneNumber.trim();
  return trimmed.startsWith('whatsapp:') ? trimmed : `whatsapp:${trimmed}`;
};

/**
 * Sends a plain-text WhatsApp message via Twilio.
 * @param {string} phoneNumber - Recipient's phone number in E.164 format (e.g. "+201234567890")
 * @param {string} message - Text content of the message
 */

export const sendWhatsAppMessage = async (phoneNumber, message) => {
  if (!client) {
    throw new Error('Twilio is not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.');
  }
  if (!fromNumber) {
    throw new Error('TWILIO_WHATSAPP_NUMBER is not configured.');
  }

  try {
    const response = await client.messages.create({
      from: toWhatsAppAddress(fromNumber),
      to: toWhatsAppAddress(phoneNumber),
      body: message
    });

    console.log(`WhatsApp message sent to ${phoneNumber}`, response.sid);
    return { success: true, sid: response.sid };
  } catch (error) {
    console.error('WhatsApp sending failed:', error);
    throw new Error('Failed to send WhatsApp message');
  }
};

/**
 * Sends a password reset link via WhatsApp.
 * @param {string} phoneNumber - Recipient's phone number in E.164 format
 * @param {string} resetToken - Raw (unhashed) reset token
 */
export const sendPasswordResetWhatsApp = async (phoneNumber, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

  const message =
    `*Trainify - Password Reset Request*\n\n` +
    `We received a request to reset your password.\n\n` +
    `Reset your password here:\n${resetUrl}\n\n` +
    `This link will expire in 1 hour.\n` +
    `If you didn't request this, please ignore this message.`;

  return sendWhatsAppMessage(phoneNumber, message);
};

export const sendWelcomeMessage = async (phoneNumber, otp) => {
  if (!client) {
    throw new Error('Twilio is not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.');
  }
  if (!otp) {
    throw new Error('OTP is required');
  }

  try {
    const message = await client.messages.create({
      from: toWhatsAppAddress(fromNumber),
      contentSid: 'HX229f5a04fd0510ce1b071852155d3e75',
      contentVariables: JSON.stringify({ 1: otp }),
      to: toWhatsAppAddress(phoneNumber)
    });

    console.log(message.sid);
    return { success: true, sid: message.sid };
  } catch (error) {
    console.error('WhatsApp welcome message failed:', error);
    throw new Error('Failed to send WhatsApp welcome message');
  }
};

export default { sendWhatsAppMessage, sendPasswordResetWhatsApp, sendWelcomeMessage };
