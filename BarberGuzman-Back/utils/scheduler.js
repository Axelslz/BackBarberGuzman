const cron = require('node-cron');
const db = require('../config/db');
const Usuario = require('../models/Usuario');
const moment = require('moment-timezone');
const { sendWhatsappMessage } = require('./whatsappSender'); 

const processCompletedCitas = async () => {
    console.log('Iniciando procesamiento de citas completadas...');
    const now = moment.tz("America/Mexico_City");
    const today = now.format('YYYY-MM-DD');
    const currentTime = now.format('HH:mm:ss');

    try {
        const [citasPorFinalizar] = await db.query(
            `SELECT id, id_cliente FROM citas
             WHERE fecha_cita <= ? AND hora_fin <= ?
             AND estado = 'confirmada'`,
            [today, currentTime]
        );

        if (citasPorFinalizar.length > 0) {
            console.log(`Citas por finalizar encontradas: ${citasPorFinalizar.length}`);
            for (const cita of citasPorFinalizar) {
                await db.query('UPDATE citas SET estado = ? WHERE id = ?', ['completada', cita.id]);
                console.log(`Cita ${cita.id} marcada como 'completada'.`);
            }
        }

        const [citasCompletadasParaContar] = await db.query(
            `SELECT c.id, c.id_cliente
             FROM citas c
             WHERE c.estado = 'completada' AND c.contador_actualizado = 0`
        );

        if (citasCompletadasParaContar.length > 0) {
            console.log(`Citas completadas para contar: ${citasCompletadasParaContar.length}`);
            for (const cita of citasCompletadasParaContar) {
                await Usuario.incrementarCitasCompletadas(cita.id_cliente);
                await db.query('UPDATE citas SET contador_actualizado = 1 WHERE id = ?', [cita.id]);
                console.log(`Contador de usuario ${cita.id_cliente} incrementado por cita ${cita.id}.`);
            }
        } else {
            console.log('No hay citas completadas para actualizar el contador.');
        }

    } catch (error) {
        console.error('Error al procesar citas completadas:', error);
    }
    console.log('Procesamiento de citas completadas finalizado.');
};

const sendAppointmentReminders = async () => {
    console.log('Iniciando envío de recordatorios de citas...');
    const now = moment.tz("America/Mexico_City");
    const tomorrow = now.clone().add(1, 'day').startOf('day'); 
    const endOfTomorrow = tomorrow.clone().endOf('day');

    try {
        
        const [citasDeManana] = await db.query(
            `SELECT id_cliente, fecha_cita
             FROM citas
             WHERE fecha_cita >= ? AND fecha_cita <= ? AND estado = 'confirmada'`,
            [tomorrow.format('YYYY-MM-DD'), endOfTomorrow.format('YYYY-MM-DD')]
        );

        if (citasDeManana.length > 0) {
            console.log(`Citas de mañana encontradas: ${citasDeManana.length}`);
            for (const cita of citasDeManana) {
                
                const [usuarioResult] = await db.query('SELECT name, telefono FROM usuarios WHERE id = ?', [cita.id_cliente]);
                const usuario = usuarioResult[0];

                if (usuario && usuario.telefono) {
                    const horaCita = moment(cita.fecha_cita).tz("America/Mexico_City").format('hh:mm A');
                    const mensaje = `💈 ¡Hola ${usuario.name}! Este es un recordatorio de tu corte de cabello en BarberGuzman programado para mañana a las ${horaCita}. ¡Te esperamos! ✨`;
                    await sendWhatsappMessage(usuario.telefono, mensaje);
                }
            }
        } else {
            console.log('No hay citas para mañana para enviar recordatorios.');
        }
    } catch (error) {
        console.error('Error al enviar recordatorios de citas:', error);
    }
    console.log('Envío de recordatorios finalizado.');
};

const startScheduler = () => {
    
    cron.schedule('0 8 * * *', () => {
        sendAppointmentReminders();
    }, {
        scheduled: true,
        timezone: "America/Mexico_City"
    });

    cron.schedule('0 * * * *', () => {
        processCompletedCitas();
    }, {
        scheduled: true,
        timezone: "America/Mexico_City"
    });

    console.log('Scheduler de citas iniciado.');
};

module.exports = { startScheduler };