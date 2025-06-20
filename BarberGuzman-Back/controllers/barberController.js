const Barbero = require('../models/Barbero');
const Cita = require('../models/Cita'); 
const moment = require('moment-timezone'); 
const cloudinary = require('../config/CloudinaryConfig'); 


const getPublicIdFromCloudinaryUrl = (url) => {
    if (!url) return null;
    try {
        const urlParts = url.split('/');
        const uploadIndex = urlParts.indexOf('upload');
        if (uploadIndex > -1 && urlParts.length > uploadIndex + 1) {
            // El public_id es la parte después de '/upload/' y antes de la extensión
            const pathAfterUpload = urlParts.slice(uploadIndex + 1).join('/');
            return pathAfterUpload.split('.')[0];
        }
    } catch (e) {
        console.error('Error al parsear URL de Cloudinary:', e);
    }
    return null;
};


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

// NUEVAS FUNCIONES PARA EL BARBERO ADMIN (¡asegúrate de que estén exportadas como 'exports.nombreFuncion'!)

// Obtener la agenda del día para el barbero autenticado
exports.getAgendaDelDiaBarbero = async (req, res, next) => { // <-- ¡AQUÍ DEBE ESTAR EL exports.!
    try {
        const id_barbero = req.user.id_barbero; // Obtenemos el id_barbero del token

        if (!id_barbero) {
            return res.status(403).json({ message: 'Usuario no asociado a un barbero o token inválido.' });
        }

        const today = moment.tz("America/Mexico_City").format('YYYY-MM-DD');

        const citasDelDia = await Cita.getCitasByBarberoAndDate(id_barbero, today);
        res.status(200).json(citasDelDia);
    } catch (error) {
        console.error('Error al obtener agenda del día para el barbero:', error);
        next(error);
    }
};

// Obtener la agenda de una fecha específica para el barbero autenticado
exports.getAgendaPorFechaBarbero = async (req, res, next) => { // <-- ¡AQUÍ DEBE ESTAR EL exports.!
    try {
        const id_barbero = req.user.id_barbero;
        const { fecha } = req.params;

        if (!id_barbero) {
            return res.status(403).json({ message: 'Usuario no asociado a un barbero o token inválido.' });
        }

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
exports.getHistorialBarberoPorMes = async (req, res, next) => { // <-- ¡AQUÍ DEBE ESTAR EL exports.!
    try {
        const id_barbero = req.user.id_barbero;
        const { year, month } = req.params;

        if (!id_barbero) {
            return res.status(403).json({ message: 'Usuario no asociado a un barbero o token inválido.' });
        }

        if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
            return res.status(400).json({ message: 'Año o mes inválido.' });
        }

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
exports.getHistorialBarberoPorAño = async (req, res, next) => { // <-- ¡AQUÍ DEBE ESTAR EL exports.!
    try {
        const id_barbero = req.user.id_barbero;
        const { year } = req.params;

        if (!id_barbero) {
            return res.status(403).json({ message: 'Usuario no asociado a un barbero o token inválido.' });
        }

        if (isNaN(year)) {
            return res.status(400).json({ message: 'Año inválido.' });
        }

        const startDate = moment.tz(`${year}-01-01`, "America/Mexico_City").startOf('year').format('YYYY-MM-DD');
        const endDate = moment.tz(`${year}-01-01`, "America/Mexico_City").endOf('year').format('YYYY-MM-DD');

        const historial = await Cita.getHistorialCitasByBarbero(id_barbero, startDate, endDate);
        res.status(200).json(historial);
    } catch (error) {
        console.error('Error al obtener historial por año para el barbero:', error);
        next(error);
    }
};

exports.getBarberoById = async (req, res, next) => {
    const { id } = req.params;
    try {
        const barbero = await Barbero.getById(id);
        if (!barbero) {
            return res.status(404).json({ message: 'Barbero no encontrado.' });
        }
        res.json(barbero);
    } catch (error) {
        console.error(`Error al obtener barbero con ID ${id}:`, error);
        next(error);
    }
};

// *** Asegúrate de que esta función también esté en tu archivo y correctamente exportada ***
exports.updateBarbero = async (req, res, next) => {
    const { id } = req.params;
    const { nombre, apellido, especialidad, descripcion, clear_foto_perfil } = req.body; // Incluimos clear_foto_perfil del body

    try {
        const currentBarbero = await Barbero.getById(id); // Obtener la información actual del barbero para la URL de la foto
        if (!currentBarbero) {
            return res.status(404).json({ message: 'Barbero no encontrado.' });
        }

        let foto_perfil_url = currentBarbero.foto_perfil_url || ''; // URL actual del barbero
        let publicIdToDelete = getPublicIdFromCloudinaryUrl(currentBarbero.foto_perfil_url);

        // Lógica para manejar la foto de perfil
        if (clear_foto_perfil === 'true') { // Si se marcó para eliminar
            if (publicIdToDelete) {
                try {
                    await cloudinary.uploader.destroy(publicIdToDelete);
                } catch (destroyError) {
                    console.warn('Advertencia: No se pudo eliminar la imagen antigua de Cloudinary:', destroyError.message);
                }
            }
            foto_perfil_url = ''; // Establecer URL a vacía
        } else if (req.file) { // Si se sube un nuevo archivo
            // Eliminar la imagen antigua si existe y no es la que se acaba de subir (esto es redundante con Cloudinary, pero útil si cambias la lógica)
            if (publicIdToDelete) {
                try {
                    await cloudinary.uploader.destroy(publicIdToDelete);
                } catch (destroyError) {
                    console.warn('Advertencia: No se pudo eliminar la imagen antigua de Cloudinary:', destroyError.message);
                }
            }

            // Subir la nueva imagen a Cloudinary desde el buffer
            const result = await cloudinary.uploader.upload(`data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`, {
                folder: 'barber_profiles', // Carpeta en Cloudinary, la misma que usabas
                public_id: `barber-${id}-${Date.now()}` // Puedes generar un public_id más robusto si quieres
            });
            foto_perfil_url = result.secure_url;
        }
        // Si no hay req.file y no se pidió clear_foto_perfil, la foto_perfil_url mantiene su valor original.

        const updated = await Barbero.updateBarbero(id, {
            // Nombre y Apellido se mantendrán como readonly en el frontend,
            // pero el backend debería poder manejarlos si se envían (o ignorarlos si no se espera cambio)
            // Aquí los incluimos para que la función de la DB los use si están presentes
            nombre: currentBarbero.nombre, // Mantener nombre
            apellido: currentBarbero.apellido, // Mantener apellido
            especialidad,
            foto_perfil_url,
            descripcion // Incluir la descripción
        });

        if (updated) {
            res.status(200).json({ message: 'Barbero actualizado exitosamente.', foto_perfil_url_actual: foto_perfil_url });
        } else {
            res.status(404).json({ message: 'Barbero no encontrado o no se realizaron cambios.' });
        }
    } catch (error) {
        console.error('Error al actualizar barbero:', error);
        // Puedes añadir más detalles de error aquí si es un error de Cloudinary, etc.
        // if (error.http_code) { ... }
        next(error); // Pasa el error al siguiente middleware de manejo de errores
    }
};