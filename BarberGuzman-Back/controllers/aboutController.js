const About = require('../models/About');
const multer = require('multer');
const cloudinary = require('../config/cloudinaryConfig'); 

const storage = multer.memoryStorage();

exports.upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, 
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(file.originalname.toLowerCase().split('.').pop());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, gif)'));
    }
}).fields([{ name: 'imagen1', maxCount: 1 }, { name: 'imagen2', maxCount: 1 }]);


exports.getAboutInfo = async (req, res, next) => {
    try {
        const info = await About.getAboutInfo(); 
        if (!info) {
            return res.status(200).json({
                titulo: 'Barbería',
                parrafo1: '¡Bienvenido a nuestra barbería!',
                parrafo2: '',
                imagen_url1: '',
                imagen_url2: ''
            });
        }
        res.status(200).json(info);
    } catch (error) {
        console.error('Error al obtener información "Sobre Mí":', error);
        next(error); 
    }
};


exports.updateAboutInfo = async (req, res, next) => {
    try {
        const { titulo, parrafo1, parrafo2 } = req.body;
        const imagen1_eliminar = req.body.imagen1_eliminar === 'true';
        const imagen2_eliminar = req.body.imagen2_eliminar === 'true';
        const imagen_url1_existente = req.body.imagen_url1_existente || '';
        const imagen_url2_existente = req.body.imagen_url2_existente || '';

        const currentInfo = await About.getAboutInfo(); 

        const handleImageOperation = async (file, currentDbUrl, existingFrontendUrl, shouldDelete) => {
            let finalImageUrl = currentDbUrl; 
            let publicIdToDelete = null;
            // Define la carpeta de Cloudinary aquí
            const folder = 'barberia'; 

            if (currentDbUrl) {
                try {
                    const urlParts = currentDbUrl.split('/');
                    const uploadIndex = urlParts.indexOf('upload');
                    if (uploadIndex > -1 && urlParts.length > uploadIndex + 1) {
                        const pathAfterUpload = urlParts.slice(uploadIndex + 1).join('/');
                        publicIdToDelete = pathAfterUpload.split('.')[0];
                    }
                } catch (parseError) {
                    // No loguear advertencias en consola, solo si es estrictamente necesario para el flujo
                    publicIdToDelete = null; 
                }
            }
            
            if (shouldDelete) {
                if (publicIdToDelete) {
                    try {
                        await cloudinary.uploader.destroy(publicIdToDelete);
                    } catch (destroyError) {
                        // Considera loguear errores graves si la eliminación es crítica, pero evita spam
                    }
                }
                finalImageUrl = ''; 
            } else if (file) {
                if (!file || !file.buffer) {
                    // Considera lanzar un error o retornar la URL actual si el archivo no es válido
                    return currentDbUrl; 
                }
                
                try {
                    const result = await cloudinary.uploader.upload(`data:${file.mimetype};base64,${file.buffer.toString('base64')}`, {
                        folder: folder, // <-- ¡Aquí se aplica la carpeta 'barberia'!
                    });
                    finalImageUrl = result.secure_url;

                    if (publicIdToDelete && publicIdToDelete !== result.public_id) { 
                        try {
                            await cloudinary.uploader.destroy(publicIdToDelete);
                        } catch (destroyError) {
                            // Considera loguear errores graves si la eliminación es crítica, pero evita spam
                        }
                    }
                } catch (uploadError) {
                    console.error('Error al subir la imagen a Cloudinary:', uploadError); // Mantener este log de error crítico
                    finalImageUrl = currentDbUrl; 
                }
            } else {
                finalImageUrl = existingFrontendUrl || currentDbUrl || ''; 
            }
            return finalImageUrl;
        };

        const imagen_url1 = await handleImageOperation(
            req.files && req.files['imagen1'] ? req.files['imagen1'][0] : null,
            currentInfo ? currentInfo.imagen_url1 : '', 
            imagen_url1_existente,
            imagen1_eliminar
        );

        const imagen_url2 = await handleImageOperation(
            req.files && req.files['imagen2'] ? req.files['imagen2'][0] : null,
            currentInfo ? currentInfo.imagen_url2 : '',
            imagen_url2_existente,
            imagen2_eliminar
        );
        
        const success = await About.updateAboutInfo({
            titulo,
            parrafo1,
            parrafo2,
            imagen_url1, 
            imagen_url2
        });

        if (!success) { 
            return res.status(500).json({ message: 'No se pudo actualizar la información "Sobre Mí".' });
        }

        const updatedAboutInfo = await About.getAboutInfo();
        res.status(200).json(updatedAboutInfo); 

    } catch (error) {
        console.error('Error general al actualizar información "Sobre Mí":', error); // Mantener este log de error general
        next(error); 
    }
};