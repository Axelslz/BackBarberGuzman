const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === 'true', 
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
});

exports.sendEmail = async (to, subject, htmlContent) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_FROM,
            to: to,
            subject: subject,
            html: htmlContent,
        };

        await transporter.sendMail(mailOptions);
        console.log(`Correo enviado a ${to} con el asunto: ${subject}`);
    } catch (error) {
        console.error('Error al enviar correo electrónico:', error);
        throw new Error('Error al enviar el correo de restablecimiento de contraseña.');
    }
};