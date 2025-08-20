const Barbero = require('../models/Barbero');
const Cita = require('../models/Cita'); 
const moment = require('moment-timezone'); 
const cloudinary = require('../config/cloudinaryConfig');


const getPublicIdFromCloudinaryUrl = (url) => {
    if (!url) return null;
    try {
        const urlParts = url.split('/');
        const uploadIndex = urlParts.indexOf('upload');
        if (uploadIndex > -1 && urlParts.length > uploadIndex + 1) {
            const pathAfterUpload = urlParts.slice(uploadIndex + 1).join('/');
            return pathAfterUpload.split('.')[0];
        }
    } catch (e) {
        console.error('Error al parsear URL de Cloudinary:', e);
    }
    return null;
};

exports.getBarberos = async (req, res, next) => {
    try {
        // Usa el método getAllBarbersWithUserDetails para obtener información completa
        const barberos = await Barbero.getAllBarbersWithUserDetails();
        
        // Si no hay barberos disponibles, regresa un mensaje apropiado
        if (!barberos || barberos.length === 0) {
            return res.status(404).json({ message: 'No hay barberos disponibles en este momento.' });
        }

        res.status(200).json(barberos);
    } catch (error) {
        console.error('Error al obtener barberos:', error);
        next(error);
    }
};

exports.getAgendaDelDiaBarbero = async (req, res, next) => { 
    try {
        const id_barbero = req.user.id_barbero; 

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

exports.getAgendaPorFechaBarbero = async (req, res, next) => { 
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

exports.getHistorialBarberoPorMes = async (req, res, next) => { 
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

exports.getHistorialBarberoPorAño = async (req, res, next) => { 
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

exports.updateBarbero = async (req, res, next) => {
    const { id } = req.params;
    const { nombre, apellido, especialidad, descripcion, clear_foto_perfil } = req.body; 

    try {
        const currentBarbero = await Barbero.getById(id); 
        if (!currentBarbero) {
            return res.status(404).json({ message: 'Barbero no encontrado.' });
        }

        let foto_perfil_url = currentBarbero.foto_perfil_url || ''; 
        let publicIdToDelete = getPublicIdFromCloudinaryUrl(currentBarbero.foto_perfil_url);

        // Si se pide borrar la foto de perfil
        if (clear_foto_perfil === 'true') { 
            if (publicIdToDelete) {
                try {
                    await cloudinary.uploader.destroy(publicIdToDelete);
                } catch (destroyError) {
                    console.warn('Advertencia: No se pudo eliminar la imagen antigua de Cloudinary:', destroyError.message);
                }
            }
            foto_perfil_url = ''; 
        } 
        // Si hay un archivo en la solicitud, es decir, se está subiendo una nueva imagen
        else if (req.file) { 
            // Si ya existe una foto, la eliminamos primero de Cloudinary
            if (publicIdToDelete) {
                try {
                    await cloudinary.uploader.destroy(publicIdToDelete);
                } catch (destroyError) {
                    console.warn('Advertencia: No se pudo eliminar la imagen antigua de Cloudinary:', destroyError.message);
                }
            }
            // Asignamos la nueva URL de la imagen a la variable
            // El paquete multer-storage-cloudinary ya sube la imagen y pone la URL en req.file.path
            foto_perfil_url = req.file.path; // <-- CAMBIO CLAVE: Usar req.file.path
        }

        const updated = await Barbero.updateBarbero(id, {
            nombre: currentBarbero.nombre, 
            apellido: currentBarbero.apellido, 
            especialidad,
            foto_perfil_url, // Se usa la URL que acabamos de obtener
            descripcion 
        });

        if (updated) {
            res.status(200).json({ message: 'Barbero actualizado exitosamente.', foto_perfil_url_actual: foto_perfil_url });
        } else {
            res.status(404).json({ message: 'Barbero no encontrado o no se realizaron cambios.' });
        }
    } catch (error) {
        console.error('Error al actualizar barbero:', error);
        next(error); 
    }
};