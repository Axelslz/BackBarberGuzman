const cron = require('node-cron');
const db = require('../config/db');
const Usuario = require('../models/Usuario');
const moment = require('moment-timezone');
const { sendWhatsappMessage } = require('./whatsappSender'); 

const processCompletedCitas = async () => {
    let client;
    try {
        console.log('Iniciando procesamiento de citas completadas...');
        client = await db.client.connect(); // Obtén un cliente de la pool
        await client.query('BEGIN'); // Inicia la transacción

        const now = moment.tz("America/Mexico_City");
        const today = now.format('YYYY-MM-DD');
        const currentTime = now.format('HH:mm:ss');
        
        // 1. Selecciona las citas que deben ser completadas
        const citasToCompleteResult = await client.query(
            `SELECT id, id_cliente FROM citas 
             WHERE fecha_cita <= $1 AND hora_fin <= $2
             AND estado = 'confirmada'
             AND contador_actualizado = FALSE`,
            [today, currentTime]
        );
        
        const citasToComplete = citasToCompleteResult.rows;

        if (citasToComplete.length > 0) {
            console.log(`Se encontraron ${citasToComplete.length} citas para completar.`);

            // 2. Actualiza el estado de las citas a 'completada' y contador_actualizado a TRUE
            const citaIds = citasToComplete.map(cita => cita.id);
            await client.query(
                `UPDATE citas SET estado = 'completada', contador_actualizado = TRUE WHERE id = ANY($1::int[])`,
                [citaIds]
            );

            // 3. Incrementa el contador de citas completadas para cada cliente
            for (const cita of citasToComplete) {
                await Usuario.incrementarCitasCompletadas(cita.id_cliente);
                console.log(`Contador de citas actualizado para el cliente ID: ${cita.id_cliente}`);
            }
        } else {
            console.log('No hay citas que necesiten ser completadas en este momento.');
        }

        await client.query('COMMIT'); // Confirma la transacción
        console.log('Procesamiento de citas completadas finalizado exitosamente.');

    } catch (error) {
        if (client) {
            await client.query('ROLLBACK'); // Si algo falla, revierte todos los cambios
        }
        console.error('Error al procesar citas completadas:', error);
    } finally {
        if (client) {
            client.release(); // Libera el cliente de la pool
        }
    }
};

const sendAppointmentReminders = async () => {
    let client;
    try {
        console.log('Iniciando envío de recordatorios de citas...');
        client = await db.client.connect();
        const now = moment.tz("America/Mexico_City");
        const tomorrow = now.clone().add(1, 'day').startOf('day');
        
        // Consulta corregida para pg, usando $1 y $2 para los parámetros
        const citasDeMananaResult = await client.query(
            `SELECT id_cliente, fecha_cita, hora_inicio, id_servicio
             FROM citas
             WHERE fecha_cita = $1 AND estado = 'confirmada'`,
            [tomorrow.format('YYYY-MM-DD')]
        );
        
        const citasDeManana = citasDeMananaResult.rows;

        if (citasDeManana.length > 0) {
            console.log(`Citas de mañana encontradas: ${citasDeManana.length}`);
            for (const cita of citasDeManana) {
                // Obtenemos los datos del usuario y el servicio
                const usuarioResult = await client.query('SELECT name, telefono FROM usuarios WHERE id = $1', [cita.id_cliente]);
                const servicioResult = await client.query('SELECT nombre FROM servicios WHERE id = $1', [cita.id_servicio]);

                const usuario = usuarioResult.rows[0];
                const servicio = servicioResult.rows[0];

                if (usuario && usuario.telefono) {
                    const horaCita = moment(cita.hora_inicio, 'HH:mm:ss').format('hh:mm A');
                    const mensaje = `💈 ¡Hola ${usuario.name}! Este es un recordatorio de tu cita para ${servicio.nombre} en BarberGuzman programada para mañana a las ${horaCita}. ¡Te esperamos! ✨`;
                    await sendWhatsappMessage(usuario.telefono, mensaje);
                    console.log(`Recordatorio enviado a ${usuario.name} (${usuario.telefono}) para la cita del ${cita.fecha_cita}`);
                }
            }
        } else {
            console.log('No hay citas para mañana para enviar recordatorios.');
        }

    } catch (error) {
        console.error('Error al enviar recordatorios de citas:', error);
    } finally {
        if (client) {
            client.release();
        }
    }
};

const startScheduler = () => {
    // Tarea: procesar citas completadas cada hora
    // Se ejecuta al minuto 0 de cada hora (ej. 01:00, 02:00, etc.)
    cron.schedule('0 * * * *', () => {
        processCompletedCitas();
    }, {
        scheduled: true,
        timezone: "America/Mexico_City"
    });

    // Tarea: enviar recordatorios de citas para el día siguiente
    // Se ejecuta todos los días a las 8:00 AM
    cron.schedule('0 8 * * *', () => {
        sendAppointmentReminders();
    }, {
        scheduled: true,
        timezone: "America/Mexico_City"
    });

    console.log('Scheduler de citas iniciado. Las tareas se ejecutarán en la zona horaria de México.');
};

module.exports = { startScheduler };
