const Barbero = require('../models/Barbero');
const Cita = require('../models/Cita'); // Importamos el modelo Cita (¡asegúrate de que exista!)
const moment = require('moment-timezone'); // Para manejar fechas (¡asegúrate de que esté instalado: npm install moment-timezone!)


// Función existente para obtener todos los barberos (público)
exports.getBarberos = async (req, res, next) => {
    try {
        const barberos = await Barbero.getAll();
        res.status(200).json(barberos);
    } catch (error) {
        console.error('Error al obtener barberos:', error);
        next(error);
    }
};

// NUEVAS FUNCIONES PARA EL BARBERO ADMIN (CÓPIALAS DESDE AQUÍ HACIA ABAJO)

// Obtener la agenda del día para el barbero autenticado
exports.getAgendaDelDiaBarbero = async (req, res, next) => {
    try {
        const id_barbero = req.user.id_barbero; // Obtenemos el id_barbero del token

        if (!id_barbero) {
            return res.status(403).json({ message: 'Usuario no asociado a un barbero o token inválido.' });
        }

        // Obtener la fecha actual en la zona horaria correcta
        const today = moment.tz("America/Mexico_City").format('YYYY-MM-DD');

        const citasDelDia = await Cita.getCitasByBarberoAndDate(id_barbero, today);
        res.status(200).json(citasDelDia);
    } catch (error) {
        console.error('Error al obtener agenda del día para el barbero:', error);
        next(error);
    }
};

// Obtener la agenda de una fecha específica para el barbero autenticado
exports.getAgendaPorFechaBarbero = async (req, res, next) => {
    try {
        const id_barbero = req.user.id_barbero;
        const { fecha } = req.params; // La fecha viene en los parámetros de la URL

        if (!id_barbero) {
            return res.status(403).json({ message: 'Usuario no asociado a un barbero o token inválido.' });
        }

        // Validar el formato de la fecha si es necesario
        if (!moment(fecha, 'YYYY-MM-DD', true).isValid()) {
            return res.status(400).json({ message: 'Formato de fecha inválido. Use YYYY-MM-DD.' });
        }

        const citasDeFecha = await Cita.getCitasByBarberoAndDate(id_barbero, fecha);
        res.status(200).json(citasDeFecha);
    } catch (error) {
        console.error('Error al obtener agenda por fecha para el barbero:', error);
        next(error);
    }
};


// Obtener el historial de citas por mes/año para el barbero autenticado
exports.getHistorialBarberoPorMes = async (req, res, next) => {
    try {
        const id_barbero = req.user.id_barbero;
        const { year, month } = req.params;

        if (!id_barbero) {
            return res.status(403).json({ message: 'Usuario no asociado a un barbero o token inválido.' });
        }

        // Validar año y mes
        if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
            return res.status(400).json({ message: 'Año o mes inválido.' });
        }

        // Calcular el rango de fechas para el mes
        const startDate = moment.tz(`${year}-${month}-01`, "America/Mexico_City").startOf('month').format('YYYY-MM-DD');
        const endDate = moment.tz(`${year}-${month}-01`, "America/Mexico_City").endOf('month').format('YYYY-MM-DD');

        const historial = await Cita.getHistorialCitasByBarbero(id_barbero, startDate, endDate);
        res.status(200).json(historial);
    } catch (error) {
        console.error('Error al obtener historial por mes para el barbero:', error);
        next(error);
    }
};

// Obtener el historial de citas por año para el barbero autenticado
exports.getHistorialBarberoPorAño = async (req, res, next) => {
    try {
        const id_barbero = req.user.id_barbero;
        const { year } = req.params;

        if (!id_barbero) {
            return res.status(403).json({ message: 'Usuario no asociado a un barbero o token inválido.' });
        }

        // Validar año
        if (isNaN(year)) {
            return res.status(400).json({ message: 'Año inválido.' });
        }

        // Calcular el rango de fechas para el año
        const startDate = moment.tz(`${year}-01-01`, "America/Mexico_City").startOf('year').format('YYYY-MM-DD');
        const endDate = moment.tz(`${year}-01-01`, "America/Mexico_City").endOf('year').format('YYYY-MM-DD');

        const historial = await Cita.getHistorialCitasByBarbero(id_barbero, startDate, endDate);
        res.status(200).json(historial);
    } catch (error) {
        console.error('Error al obtener historial por año para el barbero:', error);
        next(error);
    }
};