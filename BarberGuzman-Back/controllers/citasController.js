// controllers/citaController.js
const Cita = require('../models/Cita');
const Servicio = require('../models/Servicio');
const Barbero = require('../models/Barbero');
const moment = require('moment');
require('moment/locale/es'); // Para asegurar que format('dddd') devuelva en español
const moment_timezone = require('moment-timezone'); // Usaremos este para cálculos de hora_fin

// Horarios de trabajo fijos por día de la semana
const WORK_HOURS = {
    Lunes: { start: '10:00', end: '20:00' },
    Martes: { start: '10:00', end: '20:00' },
    Miercoles: { start: '10:00', end: '20:00' },
    Jueves: { start: '10:00', end: '20:00' },
    Viernes: { start: '10:00', end: '20:00' },
    Sabado: { start: '10:00', end: '17:00' },
    Domingo: { start: '10:00', end: '13:00' },
};

// Función para generar intervalos de tiempo
function generateTimeSlots(start, end, intervalMinutes = 30) {
    const slots = [];
    let currentTime = moment(start, 'HH:mm');
    const endTime = moment(end, 'HH:mm');

    // Asegurarse de incluir el último slot si es un múltiplo del intervalo y no excede la hora de fin
    while (currentTime.isBefore(endTime)) {
        slots.push(currentTime.format('HH:mm'));
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

        const dayOfWeek = dateMoment.locale('es').format('dddd'); // 'lunes', 'martes', etc.
        const dayMap = {
            'lunes': 'Lunes', 'martes': 'Martes', 'miércoles': 'Miercoles', 'jueves': 'Jueves',
            'viernes': 'Viernes', 'sábado': 'Sabado', 'domingo': 'Domingo'
        };
        const dayKey = dayMap[dayOfWeek.toLowerCase()];

        if (!dayKey || !WORK_HOURS[dayKey]) {
            return res.status(400).json({ message: 'Día de la semana no válido o sin horario definido para el barbero.' });
        }

        const { start, end } = WORK_HOURS[dayKey];
        const allPossibleSlots = generateTimeSlots(start, end, 30);

        const citasOcupadas = await Cita.getCitasByBarberoAndDate(idBarbero, fecha);

        const availability = allPossibleSlots.map(slot => {
            const isOccupied = citasOcupadas.some(cita => {
                const slotMoment = moment(slot, 'HH:mm');
                const citaStart = moment(cita.hora_inicio, 'HH:mm:ss');
                const citaEnd = moment(cita.hora_fin, 'HH:mm:ss');
                
                return slotMoment.isSameOrAfter(citaStart) && slotMoment.isBefore(citaEnd);
            });
            return {
                time: slot,
                available: !isOccupied
            };
        });

        res.status(200).json({
            barbero: { id: barbero.id, nombre: barbero.nombre, apellido: barbero.apellido },
            fecha: fecha,
            disponibilidad: availability
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

        const duracion_minutos = servicio.duracion_minutos;

        const dayOfWeek = moment(fecha_cita).locale('es').format('dddd');
        const dayMap = {
            'lunes': 'Lunes', 'martes': 'Martes', 'miércoles': 'Miercoles', 'jueves': 'Jueves',
            'viernes': 'Viernes', 'sábado': 'Sabado', 'domingo': 'Domingo'
        };
        const dayKey = dayMap[dayOfWeek.toLowerCase()];

        if (!dayKey || !WORK_HOURS[dayKey]) {
            return res.status(400).json({ message: 'Día de la semana no válido o sin horario definido para el barbero.' });
        }

        const { start, end } = WORK_HOURS[dayKey];
        const requestedStartTime = moment(hora_inicio, 'HH:mm');
        const workingStartTime = moment(start, 'HH:mm');
        const workingEndTime = moment(end, 'HH:mm');

        // Validar que la hora de inicio solicitada esté dentro del horario de trabajo
        if (requestedStartTime.isBefore(workingStartTime) || requestedStartTime.isAfter(workingEndTime)) {
            return res.status(400).json({ message: 'La hora solicitada está fuera del horario de trabajo del barbero.' });
        }

        // Calcular la hora de fin de la nueva cita
        const newAppointmentEnd = moment(hora_inicio, 'HH:mm').add(duracion_minutos, 'minutes');

        // Validar que la hora de fin de la nueva cita no exceda el horario de cierre
        if (newAppointmentEnd.isAfter(workingEndTime)) {
            return res.status(400).json({ message: 'La duración del servicio excede el horario de trabajo del barbero.' });
        }

        // Segundo, verificar si la hora está ocupada o si se solapa con otra cita
        const citasExistentes = await Cita.getCitasByBarberoAndDate(id_barbero, fecha_cita);
        
        const isOverlap = citasExistentes.some(cita => {
            const existingStart = moment(cita.hora_inicio, 'HH:mm:ss');
            const existingEnd = moment(cita.hora_fin, 'HH:mm:ss');

            return (requestedStartTime.isBefore(existingEnd) && newAppointmentEnd.isAfter(existingStart));
        });

        if (isOverlap) {
            return res.status(409).json({ message: 'La hora seleccionada ya está ocupada o se solapa con otra cita.' });
        }

        const nuevaCita = await Cita.crear({
            id_cliente,
            id_barbero,
            id_servicio,
            fecha_cita,
            hora_inicio,
            duracion_minutos
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
        const { nuevoEstado } = req.body; // Solo permitiremos actualizar el estado por ahora

        if (!nuevoEstado) {
            return res.status(400).json({ message: 'Se requiere un nuevo estado para la cita.' });
        }
        // Puedes agregar validación para los estados permitidos
        const estadosValidos = ['pendiente', 'confirmada', 'cancelada', 'completada'];
        if (!estadosValidos.includes(nuevoEstado)) {
            return res.status(400).json({ message: 'Estado de cita inválido.' });
        }

        const actualizado = await Cita.actualizarEstado(id, nuevoEstado);
        if (!actualizado) {
            return res.status(404).json({ message: 'Cita no encontrada o no se pudo actualizar.' });
        }
        res.status(200).json({ message: 'Cita actualizada exitosamente.' });
    } catch (error) {
        console.error('Error al actualizar cita:', error);
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