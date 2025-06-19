// controllers/aboutController.js
const About = require('../models/About');
const multer = require('multer');
const cloudinary = require('../config/cloudinaryConfig');

const storage = multer.memoryStorage(); // Almacenar en memoria para Cloudinary

// Configuración de Multer: Acepta cualquier archivo en cualquier campo.
// Los archivos estarán en req.files (un array de objetos de archivo).
exports.upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Límite de 5MB por archivo
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(file.originalname.toLowerCase().split('.').pop());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, gif)'));
    }
}).any(); // CAMBIO CLAVE: Acepta cualquier campo de archivo. Esto resuelve el "Unexpected field".

// Función para obtener información "Sobre Mí"
exports.getAboutInfo = async (req, res, next) => {
    try {
        const info = await About.getAboutInfo();
        if (!info) {
            // Devuelve valores por defecto si no hay información en la BD
            return res.status(200).json({
                titulo: 'Barbería',
                parrafo1: '¡Bienvenido a nuestra barbería!',
                parrafo2: '',
                imagen_url1: '',
                imagen_url2: '',
                imagen_url3: '', // Añade si tu modelo About los soporta
                imagen_url4: ''  // Añade si tu modelo About los soporta
            });
        }
        res.status(200).json(info);
    } catch (error) {
        console.error('Error al obtener información "Sobre Mí":', error);
        next(error); // Pasa el error al middleware de errores
    }
};

// Función para actualizar información "Sobre Mí"
exports.updateAboutInfo = async (req, res, next) => {
    try {
        const { titulo, parrafo1, parrafo2 } = req.body;

        // deletedImageUrls viene como un JSON string del frontend, parsearlo
        const deletedImageUrls = req.body.deletedImageUrls ? JSON.parse(req.body.deletedImageUrls) : [];

        // Obtener la información actual de la base de datos para comparar y eliminar viejas imágenes
        const currentInfo = await About.getAboutInfo(); // Esto asume que trae imagen_url1, imagen_url2, etc.

        // Array para almacenar las URLs finales de las 4 imágenes
        const finalImageUrls = ['', '', '', '']; // Inicializar con cadenas vacías

        // 1. Manejar eliminaciones de imágenes de Cloudinary
        for (const urlToDelete of deletedImageUrls) {
            if (urlToDelete) {
                try {
                    // Extraer public_id de la URL de Cloudinary
                    const urlParts = urlToDelete.split('/');
                    const uploadIndex = urlParts.indexOf('upload');
                    if (uploadIndex > -1 && urlParts.length > uploadIndex + 1) {
                        // Concatenar las partes de la URL después de 'upload/' y antes de la extensión
                        const publicIdWithExtension = urlParts.slice(uploadIndex + 1).join('/');
                        const publicId = publicIdWithExtension.split('.')[0]; // Eliminar la extensión del archivo

                        if (publicId) {
                            await cloudinary.uploader.destroy(publicId);
                            console.log(`Imagen eliminada de Cloudinary: ${publicId}`);
                        }
                    }
                } catch (destroyError) {
                    console.error('Error al eliminar imagen de Cloudinary:', destroyError);
                    // Continuar aunque falle una eliminación, para no bloquear la actualización
                }
            }
        }

        // 2. Procesar y organizar las imágenes para actualizar la base de datos
        // Recorre hasta 4 posiciones de imagen (0 a 3)
        for (let i = 0; i < 4; i++) {
            const newFile = req.files ? req.files.find(f => f.fieldname === `newImage_${i}`) : null;
            const existingUrl = req.body[`existingImageUrl_${i}`]; // URL de la imagen que el frontend quiere mantener en esta posición

            // Obtener la URL actual de la base de datos para esta posición
            const currentDbUrl = currentInfo ? currentInfo[`imagen_url${i + 1}`] : '';

            if (newFile) {
                // Hay un nuevo archivo para subir en esta posición
                try {
                    const result = await cloudinary.uploader.upload(`data:${newFile.mimetype};base64,${newFile.buffer.toString('base64')}`, {
                        folder: 'barberia', // Carpeta en Cloudinary
                    });
                    finalImageUrls[i] = result.secure_url;

                    // Si había una imagen anterior en la BD en esta posición Y no es la misma que la nueva, eliminarla
                    if (currentDbUrl && currentDbUrl !== result.secure_url) {
                        try {
                            const urlParts = currentDbUrl.split('/');
                            const publicIdWithExtension = urlParts.slice(urlParts.indexOf('upload') + 1).join('/');
                            const publicId = publicIdWithExtension.split('.')[0];
                            if (publicId) {
                                await cloudinary.uploader.destroy(publicId);
                                console.log(`Imagen antigua reemplazada eliminada de Cloudinary: ${publicId}`);
                            }
                        } catch (destroyError) {
                            console.error('Error al eliminar imagen antigua reemplazada:', destroyError);
                        }
                    }
                } catch (uploadError) {
                    console.error(`Error al subir newImage_${i} a Cloudinary:`, uploadError);
                    // En caso de error de subida, intenta mantener la URL que ya estaba en la BD o vacía
                    finalImageUrls[i] = currentDbUrl;
                }
            } else if (existingUrl && !deletedImageUrls.includes(existingUrl)) {
                // No hay nuevo archivo, pero el frontend indica que quiere mantener una URL existente
                // Y esa URL no está marcada para ser eliminada
                finalImageUrls[i] = existingUrl;
            } else {
                // No hay nuevo archivo y la imagen existente fue eliminada o no existía
                finalImageUrls[i] = '';
            }
        }

        // Prepara los datos para la actualización de la base de datos
        const dataToUpdate = {
            titulo,
            parrafo1,
            parrafo2,
            imagen_url1: finalImageUrls[0],
            imagen_url2: finalImageUrls[1],
            imagen_url3: finalImageUrls[2], // Asegúrate de que tu modelo About.js y tu DB soporten estos campos
            imagen_url4: finalImageUrls[3]  // Asegúrate de que tu modelo About.js y tu DB soporten estos campos
        };

        const success = await About.updateAboutInfo(dataToUpdate);

        if (!success) {
            return res.status(500).json({ message: 'No se pudo actualizar la información "Sobre Mí".' });
        }

        // Recupera la información actualizada para enviarla como respuesta
        const updatedAboutInfo = await About.getAboutInfo();
        res.status(200).json(updatedAboutInfo);

    } catch (error) {
        console.error('Error general al actualizar información "Sobre Mí":', error);
        next(error); // Pasa el error al middleware de errores
    }
};