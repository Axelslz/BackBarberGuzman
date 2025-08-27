const Cita = require('../models/Cita');
const Servicio = require('../models/Servicio');
const Barbero = require('../models/Barbero');
const Usuario = require('../models/Usuario');
const moment = require('moment');
require('moment/locale/es');
const { parseISO, isSameDay, isWithinInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfToday } = require('date-fns');
const { es } = require('date-fns/locale');
const { Op } = require('sequelize');

const WORK_HOURS = {
    'lunes': { start: '10:00', end: '20:00' },
    'martes': { start: '10:00', end: '20:00' },
    'miércoles': { start: '10:00', end: '20:00' },
    'jueves': { start: '10:00', end: '20:00' },
    'viernes': { start: '10:00', end: '20:00' },
    'sábado': { start: '09:00', end: '18:00' },
    'domingo': { start: '09:00', end: '15:00' },
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
        const dayKey = dateMoment.locale('es').format('dddd').toLowerCase();

        if (!WORK_HOURS[dayKey]) {
            return res.status(200).json({ disponibilidad: [], message: `El barbero no trabaja los ${dayKey}.` });
        }
        
        const todosLosServicios = await Servicio.getAll();
        if (todosLosServicios.length === 0) {
            return res.status(200).json({ disponibilidad: [], message: 'No hay servicios configurados.' });
        }
        const intervaloMinimo = Math.min(...todosLosServicios.map(s => s.duracion_minutos));

        const { start, end } = WORK_HOURS[dayKey];
        const inicioJornada = moment(`${fecha} ${start}`);
        const finJornada = moment(`${fecha} ${end}`);

        const citasOcupadas = await Cita.getCitasByBarberoAndDate(idBarbero, fecha);
        const horariosBloqueados = await Barbero.getUnavailableTimesByBarberoAndDate(idBarbero, fecha);
        let todosLosBloqueos = [];

        citasOcupadas.forEach(cita => {
            todosLosBloqueos.push({
                start: moment(`${fecha} ${cita.hora_inicio}`),
                end: moment(`${fecha} ${cita.hora_fin}`),
                type: 'cita',
                details: { cita_id: cita.id, cliente_nombre: `${cita.cliente_name} ${cita.cliente_lastname}` }
            });
        });

        horariosBloqueados.forEach(bloqueo => {
            if (bloqueo.hora_inicio === null && bloqueo.hora_fin === null) {
                todosLosBloqueos.push({ start: inicioJornada.clone(), end: finJornada.clone(), type: 'bloqueo' });
            } else {
                todosLosBloqueos.push({
                    start: moment(`${fecha} ${bloqueo.hora_inicio}`),
                    end: moment(`${fecha} ${bloqueo.hora_fin}`),
                    type: 'bloqueo'
                });
            }
        });
        
        todosLosBloqueos.sort((a, b) => a.start.valueOf() - b.start.valueOf());

        let agendaCompleta = [];

        todosLosBloqueos.forEach(bloqueo => {
            agendaCompleta.push({
                hora_inicio_24h: bloqueo.start.format('HH:mm'),
                hora_inicio: bloqueo.start.format('h:mm A'),
                disponible: false,
                cita_id: bloqueo.type === 'cita' ? bloqueo.details.cita_id : null,
                cliente_nombre: bloqueo.type === 'cita' ? bloqueo.details.cliente_nombre : null
            });
        });

        let tiempoActual = inicioJornada.clone();

        todosLosBloqueos.forEach(bloqueo => {
            while (tiempoActual.isBefore(bloqueo.start)) {
                agendaCompleta.push({
                    hora_inicio_24h: tiempoActual.format('HH:mm'),
                    hora_inicio: tiempoActual.format('h:mm A'),
                    disponible: true,
                    cita_id: null,
                    cliente_nombre: null
                });
                tiempoActual.add(intervaloMinimo, 'minutes');
            }
 
            if (tiempoActual.isBefore(bloqueo.end)) {
                tiempoActual = bloqueo.end.clone();
            }
        });

        while (tiempoActual.isBefore(finJornada)) {
            agendaCompleta.push({
                hora_inicio_24h: tiempoActual.format('HH:mm'),
                hora_inicio: tiempoActual.format('h:mm A'),
                disponible: true,
                cita_id: null,
                cliente_nombre: null
            });
            tiempoActual.add(intervaloMinimo, 'minutes');
        }

        agendaCompleta.sort((a, b) => moment(a.hora_inicio_24h, 'HH:mm').valueOf() - moment(b.hora_inicio_24h, 'HH:mm').valueOf());

        res.status(200).json({
            barbero: { id: barbero.id, nombre: barbero.nombre, apellido: barbero.apellido },
            fecha: fecha,
            disponibilidad: agendaCompleta,
            horariosNoDisponibles: horariosBloqueados 
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

        if (!['barber', 'admin', 'super_admin'].includes(role)) {
            return res.status(403).json({ message: 'No tienes permiso para gestionar horarios de barbero.' });
        }

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

exports.cancelarCita = async (req, res, next) => {
    try {
        const { idCita } = req.params;
        const { role, id: userId, id_barbero: userBarberoId } = req.user;

        const cita = await Cita.getById(idCita);
        if (!cita) {
            return res.status(404).json({ message: 'Cita no encontrada.' });
        }

        const barberoDeCita = await Barbero.getById(cita.id_barbero);

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
        const { id_barbero, fecha_cita, hora_inicio, id_servicio, id_cliente, nombre_cliente } = req.body;

        if (!id_barbero || !fecha_cita || !hora_inicio || !id_servicio || !id_cliente) {
            return res.status(400).json({ message: 'Faltan datos obligatorios para crear la cita.' });
        }

        const servicio = await Servicio.getById(id_servicio);
        if (!servicio) {
            return res.status(404).json({ message: 'Servicio no encontrado.' });
        }

        const duracion_minutos = servicio.duracion_minutos || 60;
        const dayKey = moment(fecha_cita).locale('es').format('dddd').toLowerCase();

        if (!WORK_HOURS[dayKey]) {
            return res.status(400).json({ message: 'Día de la semana no válido o sin horario definido.' });
        }

        const { start, end } = WORK_HOURS[dayKey];
        const requestedStartTime = moment(`${fecha_cita} ${hora_inicio}`);
        const workingStartTime = moment(`${fecha_cita} ${start}`);
        const workingEndTime = moment(`${fecha_cita} ${end}`);

        if (requestedStartTime.isBefore(workingStartTime) || requestedStartTime.isAfter(workingEndTime)) {
            return res.status(400).json({ message: 'La hora solicitada está fuera del horario de trabajo del barbero.' });
        }

        const newAppointmentEnd = requestedStartTime.clone().add(duracion_minutos, 'minutes');

        if (newAppointmentEnd.isAfter(workingEndTime)) {
            const lastHourStart = workingEndTime.clone().subtract(60, 'minutes');
            if (requestedStartTime.isBefore(lastHourStart)) {
                return res.status(400).json({ message: 'La duración del servicio excede el horario de trabajo del barbero.' });
            }
        }
    
        const citasExistentes = await Cita.getCitasByBarberoAndDate(id_barbero, fecha_cita);
        const horariosNoDisponibles = await Barbero.getUnavailableTimesByBarberoAndDate(id_barbero, fecha_cita);

        const isOverlapCita = citasExistentes.some(cita => {
            const existingStart = moment(`${fecha_cita} ${cita.hora_inicio}`);
            const existingEnd = moment(`${fecha_cita} ${cita.hora_fin}`);
            return requestedStartTime.isBefore(existingEnd) && newAppointmentEnd.isAfter(existingStart);
        });

        if (isOverlapCita) {
            return res.status(409).json({ message: 'La hora seleccionada ya está ocupada por otra cita.' });
        }

        const isOverlapBlocked = horariosNoDisponibles.some(block => {
            if (block.hora_inicio === null && block.hora_fin === null) return true;
            const blockStart = moment(`${fecha_cita} ${block.hora_inicio}`);
            const blockEnd = moment(`${fecha_cita} ${block.hora_fin}`);
            return requestedStartTime.isBefore(blockEnd) && newAppointmentEnd.isAfter(blockStart);
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
            hora_fin,
            duracion_minutos,
            nombre_cliente
        });

        res.status(201).json({
            message: 'Cita agendada exitosamente',
            cita: nuevaCita
        });

    } catch (error) {
        console.error('Error al crear cita:', error);
        next(error);
    }
};
exports.getHistorialCitas = async (req, res, next) => {
    try {
        const { role, id: userId, id_barbero: userBarberoId } = req.user;
        const { periodo } = req.query; 

        let fechaInicio;

        switch (periodo) {
            case 'dia':
                fechaInicio = startOfToday();
                break;
            case 'semana':
                fechaInicio = startOfWeek(new Date(), { weekStartsOn: 1 });
                break;
            case 'mes':
                fechaInicio = startOfMonth(new Date());
                break;
            case 'todo':
                fechaInicio = null; 
                break;
            default:
                fechaInicio = startOfToday(); 
        }
        const whereClause = {};

        if (fechaInicio) {
            whereClause.fecha_cita = {
                [Op.gte]: fechaInicio
            };
        }

        if (role === 'super_admin') {
           
        } else if (role === 'admin' || role === 'barber') {
            whereClause.id_barbero = userBarberoId;
        } else if (role === 'cliente') {
            whereClause.id_cliente = userId;
        } else {
            return res.status(200).json([]);
        }

        const historialCitas = await Cita.findAll({
            where: whereClause,
            include: [
                {
                    model: Usuario,
                    as: 'cliente', 
                    attributes: ['nombre', 'apellido'] 
                },
                {
                    model: Barbero,
                    as: 'barbero', 
                    attributes: ['nombre', 'apellido']
                }
            ],
            order: [['fecha_cita', 'DESC'], ['hora_inicio', 'DESC']] 
        });

        res.status(200).json(historialCitas);

    } catch (error) {
        console.error('Error al obtener historial de citas:', error);
        next(error);
    }
};


exports.actualizarCita = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { nuevoEstado } = req.body;

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

        const citas = await Cita.getAppointmentsByUserId(userId); 
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

        const citas = await Cita.getAppointmentsByBarberId(barberId); 
        res.status(200).json(citas);
    } catch (error) {
        console.error('Error al obtener citas por ID de barbero:', error);
        next(error);
    }
};