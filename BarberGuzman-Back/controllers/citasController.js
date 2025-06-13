const Cita = require('../models/Cita');
const Servicio = require('../models/Servicio');
const Barbero = require('../models/Barbero');
const Usuario = require('../models/Usuario');
const moment = require('moment');
require('moment/locale/es');

const WORK_HOURS = {
    'lunes': { start: '10:00', end: '20:00' },
    'martes': { start: '10:00', end: '20:00' },
    'miércoles': { start: '10:00', end: '20:00' },
    'jueves': { start: '10:00', end: '20:00' },
    'viernes': { start: '10:00', end: '20:00' },
    'sábado': { start: '10:00', end: '17:00' },
    'domingo': { start: '10:00', end: '13:00' },
};

// Función para generar intervalos de tiempo
function generateTimeSlots(start, end, intervalMinutes = 60) {
    const slots = [];
    let currentTime = moment(start, 'HH:mm');
    const endTime = moment(end, 'HH:mm');

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

        const dayKey = dateMoment.locale('es').format('dddd').toLowerCase();

        if (!WORK_HOURS[dayKey]) {
            return res.status(400).json({ message: `Día de la semana "${dayKey}" no válido o sin horario definido para el barbero.` });
        }

        const { start, end } = WORK_HOURS[dayKey];
        const allPossibleSlots_24h = generateTimeSlots(start, end, 60);

        const citasOcupadas = await Cita.getCitasByBarberoAndDate(idBarbero, fecha);

        const availability = allPossibleSlots_24h.map(slot24h => {
            const slotMoment = moment(slot24h, 'HH:mm');

            const isOccupied = citasOcupadas.some(cita => {
                const citaStart = moment(cita.hora_inicio, 'HH:mm:ss');
                const citaEnd = moment(cita.hora_fin, 'HH:mm:ss');

                const slotEndMoment = slotMoment.clone().add(60, 'minutes');

                return (slotMoment.isBefore(citaEnd) && slotEndMoment.isAfter(citaStart));
            });

            return {
                hora_inicio_24h: slot24h,
                hora_inicio: slotMoment.format('h:mm A'),
                disponible: !isOccupied
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
        const id_cliente = req.user.id;

        if (!id_barbero || !fecha_cita || !hora_inicio || !id_servicio || !id_cliente) {
            return res.status(400).json({ message: 'Faltan datos obligatorios para crear la cita.' });
        }

        const servicio = await Servicio.getById(id_servicio);
        if (!servicio) {
            return res.status(404).json({ message: 'Servicio no encontrado.' });
        }

        const duracion_minutos = servicio.duracion_minutos || 60;

        const dayOfWeek = moment(fecha_cita).locale('es').format('dddd').toLowerCase();
        const dayKey = dayOfWeek;

        if (!WORK_HOURS[dayKey]) {
            return res.status(400).json({ message: 'Día de la semana no válido o sin horario definido para el barbero.' });
        }

        const { start, end } = WORK_HOURS[dayKey];

        const requestedStartTime = moment(hora_inicio, 'HH:mm');

        const workingStartTime = moment(start, 'HH:mm');
        const workingEndTime = moment(end, 'HH:mm');

        if (requestedStartTime.isBefore(workingStartTime) || requestedStartTime.isAfter(workingEndTime)) {
            return res.status(400).json({ message: 'La hora solicitada está fuera del horario de trabajo del barbero.' });
        }

        const newAppointmentEnd = requestedStartTime.clone().add(duracion_minutos, 'minutes');

        if (newAppointmentEnd.isAfter(workingEndTime)) {
            return res.status(400).json({ message: 'La duración del servicio excede el horario de trabajo del barbero.' });
        }

        const citasExistentes = await Cita.getCitasByBarberoAndDate(id_barbero, fecha_cita);

        const isOverlap = citasExistentes.some(cita => {
            const existingStart = moment(cita.hora_inicio, 'HH:mm:ss');
            // Asegúrate de que `cita.hora_fin` siempre esté presente en las citas recuperadas
            // La columna `hora_fin` ya existe en la tabla y es `NOT NULL`, por lo que debería estar ahí.
            const existingEnd = moment(cita.hora_fin, 'HH:mm:ss'); 

            return (requestedStartTime.isBefore(existingEnd) && newAppointmentEnd.isAfter(existingStart));
        });

        if (isOverlap) {
            return res.status(409).json({ message: 'La hora seleccionada ya está ocupada o se solapa con otra cita.' });
        }

        // --- CALCULAR HORA_FIN AQUÍ ---
        const hora_fin = newAppointmentEnd.format('HH:mm:ss');

        const nuevaCita = await Cita.crear({
            id_cliente,
            id_barbero,
            id_servicio,
            fecha_cita,
            hora_inicio: requestedStartTime.format('HH:mm:ss'),
            hora_fin: hora_fin, // <<<--- PASAR HORA_FIN
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

exports.getHistorialCitas = async (req, res, next) => {
    try {
        console.log('DEBUG: req.user en getHistorialCitas:', req.user);
        const { role, id: userId, id_barbero: userBarberoId } = req.user;
        console.log(`[getHistorialCitas] Usuario autenticado: ID=${userId}, Rol=${role}, ID Barbero=${userBarberoId}`);

        const { startDate, endDate, barberoId, clienteId, allBarbers } = req.query; // allBarbers es un string 'true'
        console.log(`[getHistorialCitas] Query Params: startDate=${startDate || 'N/A'}, endDate=${endDate || 'N/A'}, barberoId=${barberoId || 'N/A'}, clienteId=${clienteId || 'N/A'}, allBarbers=${allBarbers || 'false'}`);

        let citas = [];

        if (role === 'super_admin') {
            console.log('[getHistorialCitas] Rol: super_admin detectado.');
            // El super_admin puede solicitar todas las citas sin filtrar (allBarbers=true)
            // O puede solicitar citas de un barbero específico (barberoId)
            // O puede solicitar citas de un cliente específico (clienteId)
            // Si allBarbers es 'true', ignoramos los otros filtros de ID en el backend.
            if (allBarbers === 'true') {
                console.log('[getHistorialCitas] super_admin: Obteniendo TODAS las citas (allBarbers=true).');
                // Si el frontend envía fechas para optimizar, las usamos, sino no.
                citas = await Cita.getAllAppointments(startDate, endDate); // Podríamos pasar fechas para optimización
            } else if (barberoId) {
                console.log(`[getHistorialCitas] super_admin filtrando por barberoId: ${barberoId}`);
                citas = await Cita.getAppointmentsByBarberId(barberoId, startDate, endDate);
            } else if (clienteId) {
                console.log(`[getHistorialCitas] super_admin filtrando por clienteId: ${clienteId}`);
                citas = await Cita.getAppointmentsByUserId(clienteId, startDate, endDate);
            } else {
                // Si el super_admin no especifica allBarbers=true ni barberoId/clienteId,
                // por defecto le devolvemos TODAS las citas.
                console.log('[getHistorialCitas] super_admin: Obteniendo TODAS las citas (sin filtros específicos).');
                citas = await Cita.getAllAppointments(startDate, endDate);
            }
        } else if (role === 'admin') {
            console.log('[getHistorialCitas] Rol: admin (barbero) detectado.');
            if (!userBarberoId) {
                console.warn('[getHistorialCitas] Usuario admin no tiene ID de barbero asociado. Esto es un error de configuración.');
                return res.status(403).json({ message: 'Usuario admin no asociado a un barbero. No puede ver historial.' });
            }
            console.log(`[getHistorialCitas] Admin (barbero) obteniendo citas para su propio ID: ${userBarberoId}`);
            citas = await Cita.getAppointmentsByBarberId(userBarberoId, startDate, endDate);
        } else if (role === 'cliente') {
            console.log('[getHistorialCitas] Rol: cliente detectado.');
            console.log(`[getHistorialCitas] Cliente obteniendo citas para su propio ID: ${userId}`);
            citas = await Cita.getAppointmentsByUserId(userId, startDate, endDate);
        } else {
            console.warn(`[getHistorialCitas] Rol de usuario no válido o desconocido: ${role}`);
            return res.status(403).json({ message: 'Rol de usuario no válido para acceder al historial.' });
        }

        console.log(`[getHistorialCitas] Respondiendo con ${citas.length} citas.`);
        res.status(200).json(citas);
    } catch (error) {
        console.error('Error al obtener historial de citas:', error);
        next(error);
    }
};

exports.actualizarCita = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { nuevoEstado } = req.body;

        const estadosValidos = ['pendiente', 'confirmada', 'completada', 'cancelada'];
        if (!estadosValidos.includes(nuevoEstado)) {
            return res.status(400).json({ message: 'Estado de cita inválido.' });
        }

        const citaExistente = await Cita.getById(id);
        if (!citaExistente) {
            return res.status(404).json({ message: 'Cita no encontrada.' });
        }

        const { role, id: userId, id_barbero: userBarberoId } = req.user;

        if (role === 'admin' && citaExistente.id_barbero.toString() !== userBarberoId.toString()) {
            return res.status(403).json({ message: 'No tienes permiso para actualizar esta cita (solo puedes actualizar las tuyas).' });
        }
        if (role === 'cliente' && citaExistente.id_cliente.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'No tienes permiso para actualizar esta cita (solo puedes actualizar las tuyas).' });
        }
        if (role === 'cliente' && nuevoEstado !== 'cancelada') {
            return res.status(403).json({ message: 'Como cliente, solo puedes cancelar tus propias citas.' });
        }

        await Cita.actualizarEstado(id, nuevoEstado);

        if (nuevoEstado === 'completada') {
            const [citaInfo] = await Cita.getCitaByIdWithCountStatus(id);
            if (citaInfo && citaInfo.length > 0 && citaInfo[0].contador_actualizado === 0) {
                await Usuario.incrementarCitasCompletadas(citaInfo[0].id_cliente);
                await Cita.marcarContadorActualizado(id);
                console.log(`Contador de citas completadas incrementado para usuario ${citaInfo[0].id_cliente}`);
            } else {
                console.log(`Contador de citas para cita ID ${id} ya fue actualizado o no encontrada.`);
            }
        }

        res.status(200).json({ mensaje: 'Estado de la cita actualizado exitosamente' });
    } catch (error) {
        console.error('Error al actualizar el estado de la cita:', error);
        next(error);
    }
};

// Controlador para obtener todos los barberos con detalles de usuario
exports.getAllBarbers = async (req, res, next) => {
    try {
        const barberos = await Barbero.getAllBarbersWithUserDetails();
        res.status(200).json(barberos);
    } catch (error) {
        console.error('Error al obtener todos los barberos:', error);
        next(error);
    }
};