const twilio = require('twilio');

exports.handleIncomingMessage = (req, res) => {
  const twiml = new twilio.twiml.MessagingResponse();
  const incomingMsg = req.body.Body.toLowerCase().trim();

  // Lógica de chatbot simple
  if (incomingMsg.includes('hola', ) || incomingMsg.includes('hello')) {
    twiml.message('¡Hola! Soy el bot de BarberGuzman. ¿Cómo puedo ayudarte?');
  } else if (incomingMsg.includes('cita')) {
    twiml.message('Para agendar una cita, visita nuestro sitio web: [tu-url-a-la-pagina-de-citas]');
  } else if (incomingMsg.includes('horario')) {
    twiml.message('Nuestro horario es de Lunes a Viernes de 10AM a 8PM. Sabados de 9AM a 6PM y Domingos de 9AM a 4PM.');
  } else {
    twiml.message('Lo siento, no entendí tu mensaje. Puedes preguntar por "hola", "cita" o "horario".');
  }

  res.writeHead(200, { 'Content-Type': 'text/xml' });
  res.end(twiml.toString());
};