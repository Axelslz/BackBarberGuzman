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
}).any(); 

exports.getAboutInfo = async (req, res, next) => {
    try {
        const info = await About.getAboutInfo();
        if (!info) {
        
            return res.status(200).json({
                titulo: 'Barbería',
                parrafo1: '¡Bienvenido a nuestra barbería!',
                parrafo2: '',
                imagen_url1: '',
                imagen_url2: '',
                imagen_url3: '', 
                imagen_url4: ''  
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
        const deletedImageUrls = req.body.deletedImageUrls ? JSON.parse(req.body.deletedImageUrls) : [];
        const currentInfo = await About.getAboutInfo(); 
        const finalImageUrls = ['', '', '', ''];

        // 1. Manejar eliminaciones de imágenes de Cloudinary
        for (const urlToDelete of deletedImageUrls) {
            if (urlToDelete) {
                try {
                    const urlParts = urlToDelete.split('/');
                    const uploadIndex = urlParts.indexOf('upload');
                    if (uploadIndex > -1 && urlParts.length > uploadIndex + 1) {
                        const publicIdWithExtension = urlParts.slice(uploadIndex + 1).join('/');
                        const publicId = publicIdWithExtension.split('.')[0]; 

                        if (publicId) {
                            await cloudinary.uploader.destroy(publicId);
                            console.log(`Imagen eliminada de Cloudinary: ${publicId}`);
                        }
                    }
                } catch (destroyError) {
                    console.error('Error al eliminar imagen de Cloudinary:', destroyError);
                }
            }
        }

        // 2. Procesar y organizar las imágenes para actualizar la base de datos
   
        for (let i = 0; i < 4; i++) {
            const newFile = req.files ? req.files.find(f => f.fieldname === `newImage_${i}`) : null;
            const existingUrl = req.body[`existingImageUrl_${i}`]; 
            const currentDbUrl = currentInfo ? currentInfo[`imagen_url${i + 1}`] : '';

            if (newFile) {
                try {
                    const result = await cloudinary.uploader.upload(`data:${newFile.mimetype};base64,${newFile.buffer.toString('base64')}`, {
                        folder: 'barberia', 
                    });
                    finalImageUrls[i] = result.secure_url;

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
                    finalImageUrls[i] = currentDbUrl;
                }
            } else if (existingUrl && !deletedImageUrls.includes(existingUrl)) {
                finalImageUrls[i] = existingUrl;
            } else {
                finalImageUrls[i] = '';
            }
        }

        const dataToUpdate = {
            titulo,
            parrafo1,
            parrafo2,
            imagen_url1: finalImageUrls[0],
            imagen_url2: finalImageUrls[1],
            imagen_url3: finalImageUrls[2],
            imagen_url4: finalImageUrls[3], 
        };

        const success = await About.updateAboutInfo(dataToUpdate);

        if (!success) {
            return res.status(500).json({ message: 'No se pudo actualizar la información "Sobre Mí".' });
        }

    
        const updatedAboutInfo = await About.getAboutInfo();
        res.status(200).json(updatedAboutInfo);

    } catch (error) {
        console.error('Error general al actualizar información "Sobre Mí":', error);
        next(error); 
    }
};