const cron = require('node-cron');
const db = require('../config/db'); // Necesitas tu conexión a la DB
const Usuario = require('../models/Usuario'); // Necesitas el modelo de Usuario
const moment = require('moment-timezone'); // Para manejar fechas

// Función para procesar citas completadas
const processCompletedCitas = async () => {
    console.log('Iniciando procesamiento de citas completadas...');
    const now = moment.tz("America/Mexico_City");
    const today = now.format('YYYY-MM-DD');
    const currentTime = now.format('HH:mm:ss');

    try {
        // Encuentra citas que deberían haber terminado y estén 'confirmada' o 'completada'
        // y aún no se haya actualizado el contador.
        // Para simplificar, asumimos que si el estado es 'completada', el contador se incrementa.
        // Si el estado es 'confirmada' y la hora ya pasó, podemos cambiarla a 'completada' y luego sumar.
        // Para tu requisito, sumaremos si la cita está marcada como 'completada'.

        // Paso 1: Identificar citas que ya pasaron y tienen estado 'confirmada' para marcarlas como 'completada'
        // Esto es crucial para tu lógica "siempre y cuando no haya cambios".
        // Podrías tener un estado intermedio como 'finalizada' antes de 'completada' si es más complejo.
        const [citasPorFinalizar] = await db.query(
            `SELECT id, id_cliente FROM citas
             WHERE fecha_cita <= ? AND hora_fin <= ?
             AND estado = 'confirmada'`, // O 'pendiente', 'agendada', etc.
            [today, currentTime]
        );

        if (citasPorFinalizar.length > 0) {
            console.log(`Citas por finalizar encontradas: ${citasPorFinalizar.length}`);
            for (const cita of citasPorFinalizar) {
                await db.query('UPDATE citas SET estado = ? WHERE id = ?', ['completada', cita.id]);
                console.log(`Cita ${cita.id} marcada como 'completada'.`);
            }
        }

        // Paso 2: Contar citas completadas que aún no han sido contadas
        // Asumimos que hay una forma de marcar que ya se contó, o que el estado 'completada' es final.
        // Si quieres evitar doble conteo, podrías añadir una columna 'contador_actualizado' boolean en 'citas'.
        // Por ahora, si una cita está 'completada', la contamos y la marcamos.
        const [citasCompletadasParaContar] = await db.query(
            `SELECT c.id, c.id_cliente
             FROM citas c
             WHERE c.estado = 'completada' AND c.contador_actualizado = 0` // Necesita la columna 'contador_actualizado' en 'citas'
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

// Programa la tarea para que se ejecute cada hora (ej. a los 0 minutos de cada hora)
// Puedes ajustarlo, ej. '0 0 * * *' para que se ejecute a medianoche todos los días.
const startScheduler = () => {
    cron.schedule('0 * * * *', () => { // Ejecuta cada hora en el minuto 0
        processCompletedCitas();
    }, {
        scheduled: true,
        timezone: "America/Mexico_City" // Asegura la zona horaria correcta
    });
    console.log('Scheduler de citas completadas iniciado.');
};

module.exports = { startScheduler };