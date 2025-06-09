// controllers/citaController.js
const Cita = require('../models/Cita');
const Servicio = require('../models/Servicio');
const Barbero = require('../models/Barbero');
const Usuario = require('../models/Usuario');
const moment = require('moment');
require('moment/locale/es'); // Para asegurar que format('dddd') devuelva en español

// Horarios de trabajo fijos por día de la semana
// ¡¡IMPORTANTE!! Asegúrate de que los días de la semana y los acentos sean EXACTOS
// como los devuelve moment.locale('es').format('dddd')
const WORK_HOURS = {
    'lunes': { start: '10:00', end: '20:00' }, // Cambiado a minúscula si moment.js devuelve así
    'martes': { start: '10:00', end: '20:00' },
    'miércoles': { start: '10:00', end: '20:00' }, // Asegurado con acento y minúscula
    'jueves': { start: '10:00', end: '20:00' },
    'viernes': { start: '10:00', end: '20:00' },
    'sábado': { start: '10:00', end: '17:00' }, // Asegurado con acento y minúscula
    'domingo': { start: '10:00', end: '13:00' },
};

// Función para generar intervalos de tiempo
// Ahora genera los slots en formato 'HH:mm' para facilitar la comparación
function generateTimeSlots(start, end, intervalMinutes = 60) { // <-- Mantenido en 60 minutos
    const slots = [];
    let currentTime = moment(start, 'HH:mm');
    const endTime = moment(end, 'HH:mm');

    while (currentTime.isBefore(endTime)) {
        slots.push(currentTime.format('HH:mm')); // Formato 24h para comparación
        currentTime.add(intervalMinutes, 'minutes');
    }
    return slots;
}

exports.getDisponibilidadBarbero = async (req, res, next) => {
    try {
        const { idBarbero, fecha } = req.query;

        if (!idBarbero || !fecha) {
            return res.status(400).json({ message: 'Se requiere el ID del barbero y la fecha.' });
        }

        const barbero = await Barbero.getById(idBarbero);
        if (!barbero) {
            return res.status(404).json({ message: 'Barbero no encontrado.' });
        }

        const dateMoment = moment(fecha);
        if (!dateMoment.isValid()) {
            return res.status(400).json({ message: 'Formato de fecha inválido. Use YYYY-MM-DD.' });
        }

        // Obtener el día de la semana en minúsculas y con acentos (lo que moment.js suele devolver)
        const dayKey = dateMoment.locale('es').format('dddd').toLowerCase(); // <-- CAMBIO CLAVE AQUÍ: toLowerCase()
        
        // *** ESTO ES MUY IMPORTANTE PARA DEPURAR ***
        // Loguea el valor exacto de dayKey y las claves de WORK_HOURS para comparación
        console.log("Día de la semana obtenido por moment (dayKey):", dayKey); 
        console.log("Días definidos en WORK_HOURS:", Object.keys(WORK_HOURS));
        // *****************************************

        if (!WORK_HOURS[dayKey]) {
            return res.status(400).json({ message: `Día de la semana "${dayKey}" no válido o sin horario definido para el barbero.` });
        }

        const { start, end } = WORK_HOURS[dayKey];
        const allPossibleSlots_24h = generateTimeSlots(start, end, 60); // <-- Slots cada 60 minutos

        const citasOcupadas = await Cita.getCitasByBarberoAndDate(idBarbero, fecha);

        const availability = allPossibleSlots_24h.map(slot24h => {
            const slotMoment = moment(slot24h, 'HH:mm'); // El momento del slot actual

            const isOccupied = citasOcupadas.some(cita => {
                const citaStart = moment(cita.hora_inicio, 'HH:mm:ss');
                const citaEnd = moment(cita.hora_fin, 'HH:mm:ss');
                
                // Comprobamos si el slot actual (AHORA de 60 minutos) se solapa con una cita existente
                const slotEndMoment = slotMoment.clone().add(60, 'minutes'); // <-- Asegurado a 60 minutos

                return (slotMoment.isBefore(citaEnd) && slotEndMoment.isAfter(citaStart));
            });

            return {
                hora_inicio_24h: slot24h,
                hora_inicio: slotMoment.format('h:mm A'), // Formato AM/PM para el frontend
                disponible: !isOccupied
            };
        });

        res.status(200).json({
            barbero: { id: barbero.id, nombre: barbero.nombre, apellido: barbero.apellido },
            fecha: fecha,
            disponibilidad: availability // Esto se envía al frontend
        });

    } catch (error) {
        console.error('Error al obtener disponibilidad:', error);
        next(error);
    }
};

exports.crearCita = async (req, res, next) => {
    try {
        const { id_barbero, fecha_cita, hora_inicio, id_servicio } = req.body;
        const id_cliente = req.user.id; // Viene del middleware de autenticación

        if (!id_barbero || !fecha_cita || !hora_inicio || !id_servicio || !id_cliente) {
            return res.status(400).json({ message: 'Faltan datos obligatorios para crear la cita.' });
        }

        const servicio = await Servicio.getById(id_servicio);
        if (!servicio) {
            return res.status(404).json({ message: 'Servicio no encontrado.' });
        }

        // *** CAMBIO TEMPORAL AQUÍ: Forzar duracion_minutos a 60 si es necesario ***
        // Por ahora, forzaremos la duración a 60 minutos para todas las citas.
        // Cuando tengas las duraciones reales de los servicios, deberías usar:
        // const duracion_minutos = servicio.duracion_minutos;
        const duracion_minutos = 60; // Temporalmente forzamos a 60 minutos
        // *******************************************************************

        const dayOfWeek = moment(fecha_cita).locale('es').format('dddd').toLowerCase(); // <-- toLowerCase()
        const dayKey = dayOfWeek; // dayKey ya es la cadena en minúsculas y con acentos

        if (!WORK_HOURS[dayKey]) {
            return res.status(400).json({ message: 'Día de la semana no válido o sin horario definido para el barbero.' });
        }

        const { start, end } = WORK_HOURS[dayKey];
        
        // Asegúrate de que hora_inicio que llega aquí sea 'HH:mm'
        // Si desde el frontend envías 'h:mm A' (ej. '10:00 AM'), necesitarás parsearlo:
        // const requestedStartTime = moment(hora_inicio, 'h:mm A'); 
        // Si viene de tu `hora_inicio_24h` de la respuesta de disponibilidad, será `HH:mm`:
        const requestedStartTime = moment(hora_inicio, 'HH:mm'); // Usamos HH:mm asumiendo que el frontend lo envía así

        const workingStartTime = moment(start, 'HH:mm');
        const workingEndTime = moment(end, 'HH:mm');

        // Validar que la hora de inicio solicitada esté dentro del horario de trabajo
        if (requestedStartTime.isBefore(workingStartTime) || requestedStartTime.isAfter(workingEndTime)) {
            return res.status(400).json({ message: 'La hora solicitada está fuera del horario de trabajo del barbero.' });
        }

        // Calcular la hora de fin de la nueva cita
        const newAppointmentEnd = requestedStartTime.clone().add(duracion_minutos, 'minutes');

        // Validar que la hora de fin de la nueva cita no exceda el horario de cierre
        if (newAppointmentEnd.isAfter(workingEndTime)) {
            return res.status(400).json({ message: 'La duración del servicio excede el horario de trabajo del barbero.' });
        }

        // Segundo, verificar si la hora está ocupada o si se solapa con otra cita
        const citasExistentes = await Cita.getCitasByBarberoAndDate(id_barbero, fecha_cita);
        
        const isOverlap = citasExistentes.some(cita => {
            const existingStart = moment(cita.hora_inicio, 'HH:mm:ss');
            const existingEnd = moment(cita.hora_fin, 'HH:mm:ss');

            // Verifica si la nueva cita se solapa con alguna existente
            return (requestedStartTime.isBefore(existingEnd) && newAppointmentEnd.isAfter(existingStart));
        });

        if (isOverlap) {
            return res.status(409).json({ message: 'La hora seleccionada ya está ocupada o se solapa con otra cita.' });
        }

        // Si todo es válido, procede a crear la cita
        const nuevaCita = await Cita.crear({
            id_cliente,
            id_barbero,
            id_servicio,
            fecha_cita,
            // Guardar hora_inicio y hora_fin en formato HH:mm:ss para la base de datos
            hora_inicio: requestedStartTime.format('HH:mm:ss'),
            hora_fin: newAppointmentEnd.format('HH:mm:ss'), 
            duracion_minutos // Este es el valor que se guardará en la BD si la columna existe
        });

        res.status(201).json({
            message: 'Cita agendada exitosamente',
            cita: nuevaCita
        });

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'La hora seleccionada ya está ocupada. Por favor, elige otro horario.' });
        }
        console.error('Error al crear cita:', error);
        next(error);
    }
};

// --- Funciones para Clientes (desde routes/citasRoutes.js) ---
exports.obtenerHistorialCliente = async (req, res, next) => {
    try {
        const id_cliente = req.user.id; // ID del cliente desde el token
        const citas = await Cita.getCitasByCliente(id_cliente);
        res.status(200).json(citas);
    } catch (error) {
        console.error('Error al obtener historial del cliente:', error);
        next(error);
    }
};


// --- Funciones para Administradores (desde routes/citasRoutes.js) ---

exports.obtenerCitas = async (req, res, next) => {
    try {
        const citas = await Cita.obtenerTodas();
        res.status(200).json(citas);
    } catch (error) {
        console.error('Error al obtener todas las citas:', error);
        next(error);
    }
};

exports.actualizarCita = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { nuevoEstado } = req.body; // Asumimos que se envía 'nuevoEstado' en el body

        // Opcional: Obtener la cita actual para verificar el estado anterior si es necesario
        // const citaActual = await Cita.obtenerCitaPorId(id); // Necesitarías este método

        // Actualiza el estado de la cita
        await Cita.actualizarEstado(id, nuevoEstado);

        // Si el nuevo estado es 'completada', incrementa el contador del cliente
        // También asegúrate de que no se haya contado ya, si tienes una columna 'contador_actualizado'
        if (nuevoEstado === 'completada') {
            // Necesitas obtener el id_cliente de la cita
            // Asegúrate de que 'db' esté importado o accesible aquí si no lo está globalmente.
            const db = require('../config/db'); 
            const [citaInfo] = await db.query('SELECT id_cliente, contador_actualizado FROM citas WHERE id = ?', [id]);

            if (citaInfo && citaInfo.length > 0) {
                const { id_cliente, contador_actualizado } = citaInfo[0];

                if (contador_actualizado === 0) { // Solo si no se ha actualizado el contador para esta cita
                    await Usuario.incrementarCitasCompletadas(id_cliente);
                    await db.query('UPDATE citas SET contador_actualizado = 1 WHERE id = ?', [id]); // Marcar como contado
                    console.log(`Contador de citas completadas incrementado para usuario ${id_cliente}`);
                }
            }
        }

        res.status(200).json({ mensaje: 'Estado de la cita actualizado exitosamente' });
    } catch (error) {
        console.error('Error al actualizar el estado de la cita:', error);
        next(error);
    }
};

exports.obtenerCitasPorDia = async (req, res, next) => {
    try {
        const { fecha } = req.params; // Formato YYYY-MM-DD
        const dateMoment = moment(fecha);
        if (!dateMoment.isValid()) {
            return res.status(400).json({ message: 'Formato de fecha inválido. Use YYYY-MM-DD.' });
        }

        const citas = await Cita.obtenerPorDia(fecha);
        res.status(200).json(citas);
    } catch (error) {
        console.error('Error al obtener citas por día:', error);
        next(error);
    }
};

exports.obtenerCitasPorMes = async (req, res, next) => {
    try {
        const { año, mes } = req.params; // Año (ej. 2025), Mes (ej. 6 para junio)

        if (isNaN(parseInt(año)) || isNaN(parseInt(mes)) || parseInt(mes) < 1 || parseInt(mes) > 12) {
            return res.status(400).json({ message: 'Año o mes inválidos.' });
        }

        const citas = await Cita.obtenerPorMes(año, mes);
        res.status(200).json(citas);
    } catch (error) {
        console.error('Error al obtener citas por mes:', error);
        next(error);
    }
};

exports.obtenerTotalDelDia = async (req, res, next) => {
    try {
        const { fecha } = req.params; // Formato YYYY-MM-DD
        const dateMoment = moment(fecha);
        if (!dateMoment.isValid()) {
            return res.status(400).json({ message: 'Formato de fecha inválido. Use YYYY-MM-DD.' });
        }

        const total = await Cita.obtenerTotalesPorDia(fecha);
        res.status(200).json({ fecha: fecha, total_citas: total });
    } catch (error) {
        console.error('Error al obtener total de citas por día:', error);
        next(error);
    }
};