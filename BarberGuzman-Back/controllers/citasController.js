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
            return res.status(400).json({ message: 'Formato de fecha inválido. Use AAAA-MM-DD.' });
        }

        const dayKey = dateMoment.locale('es').format('dddd').toLowerCase();

        if (!WORK_HOURS[dayKey]) {
            return res.status(200).json({
                barbero: { id: barbero.id, nombre: barbero.nombre, apellido: barbero.apellido },
                fecha: fecha,
                disponibilidad: [],
                horariosNoDisponibles: [],
                message: `El barbero no tiene horario definido para el día "${dayKey}".`
            });
        }

        const { start, end } = WORK_HOURS[dayKey];
        let allPossibleSlots_24h = generateTimeSlots(start, end, 60);

        const citasOcupadas = await Cita.getCitasByBarberoAndDate(idBarbero, fecha);
        const horariosNoDisponibles = await Barbero.getUnavailableTimesByBarberoAndDate(idBarbero, fecha);

        const availability = allPossibleSlots_24h.map(slot24h => {
            const slotMoment = moment(slot24h, 'HH:mm');
            const slotEndMoment = slotMoment.clone().add(60, 'minutes');

            let isOccupiedByCita = false;
            let citaDetails = null;

            citasOcupadas.forEach(cita => {
                const citaStart = moment(cita.hora_inicio, 'HH:mm:ss');
                const citaEnd = moment(cita.hora_fin, 'HH:mm:ss');
                if (slotMoment.isBefore(citaEnd) && slotEndMoment.isAfter(citaStart)) {
                    isOccupiedByCita = true;
                    citaDetails = {
                        cita_id: cita.id,
                        cliente_nombre: `${cita.cliente_name} ${cita.cliente_lastname}`
                    };
                }
            });

            const isBlockedByBarber = horariosNoDisponibles.some(block => {
                if (block.hora_inicio === null && block.hora_fin === null) {
                    return true;
                }
                const blockStart = moment(block.hora_inicio, 'HH:mm:ss');
                const blockEnd = moment(block.hora_fin, 'HH:mm:ss');
                return (slotMoment.isBefore(blockEnd) && slotEndMoment.isAfter(blockStart));
            });

            return {
                hora_inicio_24h: slot24h,
                hora_inicio: slotMoment.format('h:mm A'),
                disponible: !(isOccupiedByCita || isBlockedByBarber),
                cita_id: citaDetails ? citaDetails.cita_id : null,
                cliente_nombre: citaDetails ? citaDetails.cliente_nombre : null
            };
        });

        res.status(200).json({
            barbero: { id: barbero.id, nombre: barbero.nombre, apellido: barbero.apellido },
            fecha: fecha,
            disponibilidad: availability,
            horariosNoDisponibles: horariosNoDisponibles
        });

    } catch (error) {
        console.error('Error al obtener disponibilidad:', error);
        next(error);
    }
};


exports.blockTimeForBarber = async (req, res, next) => {
    try {

        console.log('Contenido de req.body:', req.body); 
        console.log('Contenido de req.user:', req.user);
        
        const { role, id_barbero: userBarberoId } = req.user; 
        const { fecha, hora_inicio, hora_fin, motivo } = req.body; 

        if (!['barber', 'admin', 'super_admin'].includes(role)) {
            return res.status(403).json({ message: 'No tienes permiso para gestionar horarios de barbero.' });
        }

        if (!userBarberoId) {
            return res.status(403).json({ message: 'No se pudo identificar tu perfil de barbero asociado.' });
        }

        const id_barbero_a_bloquear = userBarberoId; 

        if (!fecha) { 
            return res.status(400).json({ message: 'Se requiere la fecha para bloquear horario.' });
        }

        const dateMoment = moment(fecha);
        if (!dateMoment.isValid()) {
            return res.status(400).json({ message: 'Formato de fecha inválido. Use AAAA-MM-DD.' });
        }

        if ((hora_inicio && !moment(hora_inicio, 'HH:mm').isValid()) || (hora_fin && !moment(hora_fin, 'HH:mm').isValid())) {
            return res.status(400).json({ message: 'Formato de hora inválido. Use HH:mm.' });
        }
        if (hora_inicio && hora_fin && moment(hora_inicio, 'HH:mm').isSameOrAfter(moment(hora_fin, 'HH:mm'))) {
            return res.status(400).json({ message: 'La hora de inicio debe ser anterior a la hora de fin.' });
        }

        const existingAppointments = await Cita.getCitasByBarberoAndDate(id_barbero_a_bloquear, fecha);

        const newBlockStart = hora_inicio ? moment(fecha + ' ' + hora_inicio) : moment(fecha + ' 00:00');
        const newBlockEnd = hora_fin ? moment(fecha + ' ' + hora_fin) : moment(fecha + ' 23:59');

        const hasOverlappingAppointments = existingAppointments.some(cita => {
            const citaStart = moment(fecha + ' ' + cita.hora_inicio);
            const citaEnd = moment(fecha + ' ' + cita.hora_fin);
            return (newBlockStart.isBefore(citaEnd) && newBlockEnd.isAfter(citaStart));
        });

        if (hasOverlappingAppointments) {
            return res.status(409).json({ message: 'No se puede bloquear este horario, existen citas pendientes o confirmadas en este rango.' });
        }

        const newUnavailableTime = await Barbero.addUnavailableTime({
            id_barbero: id_barbero_a_bloquear,  
            fecha,
            hora_inicio,
            hora_fin,
            motivo
        });
        res.status(201).json({ message: 'Horario bloqueado exitosamente.', unavailableTime: newUnavailableTime });

    } catch (error) {
        console.error('Error al bloquear horario:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Este horario ya está bloqueado para esta fecha.' });
        }
        next(error);
    }
};

exports.unblockTimeForBarber = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { role, id_barbero: userBarberoId } = req.user;

        const unavailableTimeEntry = await Barbero.getUnavailableTimeById(id);
        if (!unavailableTimeEntry) {
            return res.status(404).json({ message: 'Bloqueo de horario no encontrado.' });
        }

        // Verificar permisos
        if (!['barber', 'admin', 'super_admin'].includes(role)) {
            return res.status(403).json({ message: 'No tienes permiso para gestionar horarios de barbero.' });
        }

        // Un barbero solo puede liberar su propio horario
        if (role === 'barber' && userBarberoId.toString() !== unavailableTimeEntry.id_barbero.toString()) {
            return res.status(403).json({ message: 'No tienes permiso para liberar el horario de otro barbero.' });
        }
        // Admin y Super_admin pueden liberar cualquier horario, no necesitan esta restricción
        // if (role === 'admin' && userBarberoId.toString() !== unavailableTimeEntry.id_barbero.toString()) {
        //     return res.status(403).json({ message: 'No tienes permiso para liberar el horario de otro barbero.' });
        // }

        const deleted = await Barbero.deleteUnavailableTime(id);
        if (deleted) {
            res.status(200).json({ message: 'Horario liberado exitosamente.' });
        } else {
            res.status(404).json({ message: 'Bloqueo de horario no encontrado o ya eliminado.' });
        }

    } catch (error) {
        console.error('Error al liberar horario:', error);
        next(error);
    }
};

// Nueva función en el controlador para cancelar una cita
exports.cancelarCita = async (req, res, next) => {
    try {
        const { idCita } = req.params;
        const { role, id: userId, id_barbero: userBarberoId } = req.user;

        const cita = await Cita.getById(idCita);
        if (!cita) {
            return res.status(404).json({ message: 'Cita no encontrada.' });
        }

        // Obtener el barbero asociado a la cita para validar permisos
        const barberoDeCita = await Barbero.getById(cita.id_barbero);

        // Permisos: Solo el admin, super_admin o el propio barbero de la cita pueden cancelarla
        if (!['admin', 'super_admin'].includes(role)) {
            if (role === 'barber' && userBarberoId.toString() !== barberoDeCita.id.toString()) {
                return res.status(403).json({ message: 'No tienes permiso para cancelar citas de otros barberos.' });
            } else if (role === 'cliente') {
                return res.status(403).json({ message: 'Los clientes no pueden cancelar citas directamente desde esta interfaz.' });
            }
        }


        const cancelada = await Cita.cancelarCita(idCita);

        if (cancelada) {
            res.status(200).json({ message: 'Cita cancelada exitosamente.' });
        } else {
            res.status(404).json({ message: 'No se pudo cancelar la cita. Es posible que ya esté cancelada o no exista.' });
        }

    } catch (error) {
        console.error('Error al cancelar cita:', error);
        next(error);
    }
};


exports.crearCita = async (req, res, next) => {
    try {

        console.log('Contenido de req.body en crearCita:', req.body); // Agrega esta línea
        console.log('Contenido de req.user en crearCita:', req.user);
        
        const { id_barbero, fecha_cita, hora_inicio, id_servicio, id_cliente } = req.body;

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
        const horariosNoDisponibles = await Barbero.getUnavailableTimesByBarberoAndDate(id_barbero, fecha_cita);


        const isOverlapCita = citasExistentes.some(cita => {
            const existingStart = moment(cita.hora_inicio, 'HH:mm:ss');
            const existingEnd = moment(cita.hora_fin, 'HH:mm:ss');

            return (requestedStartTime.isBefore(existingEnd) && newAppointmentEnd.isAfter(existingStart));
        });

        if (isOverlapCita) {
            return res.status(409).json({ message: 'La hora seleccionada ya está ocupada por otra cita.' });
        }

        const isOverlapBlocked = horariosNoDisponibles.some(block => {
            if (block.hora_inicio === null && block.hora_fin === null) {
                return true;
            }
            const blockStart = moment(block.hora_inicio, 'HH:mm:ss');
            const blockEnd = moment(block.hora_fin, 'HH:mm:ss');
            return (requestedStartTime.isBefore(blockEnd) && newAppointmentEnd.isAfter(blockStart));
        });

        if (isOverlapBlocked) {
            return res.status(409).json({ message: 'La hora seleccionada está bloqueada por el barbero.' });
        }
    
        const hora_fin = newAppointmentEnd.format('HH:mm:ss');

        const nuevaCita = await Cita.crear({
            id_cliente,
            id_barbero,
            id_servicio,
            fecha_cita,
            hora_inicio: requestedStartTime.format('HH:mm:ss'),
            hora_fin: hora_fin,
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
        const { role, id: userId, id_barbero: userBarberId } = req.user;
        let citas;

        if (role === 'cliente') {
            citas = await Cita.getAppointmentsByUserId(userId); // Cambiado a getAppointmentsByUserId
        } else if (role === 'barber') {
            citas = await Cita.getAppointmentsByBarberId(userBarberId); // Cambiado a getAppointmentsByBarberId
        } else if (role === 'admin' || role === 'super_admin') {
            citas = await Cita.getAll();
        } else {
            return res.status(403).json({ message: 'No tienes permiso para ver el historial de citas.' });
        }

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

        // **IMPORTANTE:** Validación para asegurar que nuevoEstado no sea nulo o indefinido
        if (!nuevoEstado) {
            return res.status(400).json({ message: 'El nuevo estado de la cita no puede ser nulo o vacío.' });
        }

        const updated = await Cita.update(id, { estado: nuevoEstado });
        if (updated) {
            res.status(200).json({ message: 'Cita actualizada exitosamente.' });
        } else {
            res.status(404).json({ message: 'Cita no encontrada o no se pudo actualizar.' });
        }
    } catch (error) {
        console.error('Error al actualizar cita:', error);
        next(error);
    }
};

exports.getAllCitas = async (req, res, next) => {
    try {
        const citas = await Cita.getAll();
        res.status(200).json(citas);
    } catch (error) {
        console.error('Error al obtener todas las citas:', error);
        next(error);
    }
};

exports.getCitasByUserId = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { role, id: authenticatedUserId } = req.user;

        if (role === 'cliente' && authenticatedUserId.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'No tienes permiso para ver las citas de otros usuarios.' });
        }

        const citas = await Cita.getAppointmentsByUserId(userId); // Se cambió a la función correcta
        res.status(200).json(citas);
    } catch (error) {
        console.error('Error al obtener citas por ID de usuario:', error);
        next(error);
    }
};

exports.getCitasByBarberId = async (req, res, next) => {
    try {
        const { barberId } = req.params;
        const { role, id_barbero: authenticatedBarberId } = req.user;

        if (role === 'barber' && authenticatedBarberId.toString() !== barberId.toString()) {
            return res.status(403).json({ message: 'No tienes permiso para ver las citas de otros barberos.' });
        }

        const citas = await Cita.getAppointmentsByBarberId(barberId); // Se cambió a la función correcta
        res.status(200).json(citas);
    } catch (error) {
        console.error('Error al obtener citas por ID de barbero:', error);
        next(error);
    }
};