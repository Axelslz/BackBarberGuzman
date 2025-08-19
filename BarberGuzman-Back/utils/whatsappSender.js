// utils/whatsappSender.js
const twilio = require('twilio');
require('dotenv').config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = new twilio(accountSid, authToken);

exports.sendWhatsappMessage = async (to, message) => {
  try {
    await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: `whatsapp:${to}`,
    });
    console.log(`Mensaje de WhatsApp enviado a ${to}`);
  } catch (error) {
    console.error(`Error al enviar mensaje a ${to}:`, error.message);
    throw error; // Re-lanza el error para que el scheduler lo maneje si falla
  }
};