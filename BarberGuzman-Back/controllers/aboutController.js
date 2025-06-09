// controllers/aboutController.js
const About = require('../models/About');
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // Para manejar la eliminación de archivos

// Configuración de Multer para la subida de imágenes
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../uploads/about');
        // Asegúrate de que el directorio exista
        fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        // Genera un nombre de archivo único para evitar colisiones
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Límite de 5MB por imagen
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, gif)'));
    }
}).fields([{ name: 'imagen1', maxCount: 1 }, { name: 'imagen2', maxCount: 1 }]); // Permite subir hasta 2 imágenes con nombres específicos


exports.getAboutInfo = async (req, res, next) => {
    try {
        const info = await About.getAboutInfo();
        if (!info) {
            // Si no hay información, puedes devolver un objeto vacío o valores por defecto
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
    upload(req, res, async (err) => {
        if (err) {
            console.error('Error al subir archivos:', err);
            return res.status(400).json({ message: err.message });
        }

        try {
            const { titulo, parrafo1, parrafo2 } = req.body;
            let { imagen_url1_existente, imagen_url2_existente } = req.body; // URLs que ya existen en la BD

            // Obtener la información actual para manejar la eliminación de imágenes antiguas
            const currentInfo = await About.getAboutInfo();

            // Determinar las URLs de las imágenes
            let imagen_url1 = imagen_url1_existente || (req.files['imagen1'] ? `uploads/about/${req.files['imagen1'][0].filename}` : '');
            let imagen_url2 = imagen_url2_existente || (req.files['imagen2'] ? `uploads/about/${req.files['imagen2'][0].filename}` : '');

            // Si se subió una nueva imagen_url1 y ya existía una, eliminar la antigua
            if (req.files['imagen1'] && currentInfo && currentInfo.imagen_url1 && currentInfo.imagen_url1 !== imagen_url1_existente) {
                const oldPath = path.join(__dirname, '..', currentInfo.imagen_url1);
                if (fs.existsSync(oldPath)) {
                    fs.unlink(oldPath, (err) => {
                        if (err) console.error('Error al eliminar imagen antigua:', oldPath, err);
                    });
                }
            }
            // Si se subió una nueva imagen_url2 y ya existía una, eliminar la antigua
            if (req.files['imagen2'] && currentInfo && currentInfo.imagen_url2 && currentInfo.imagen_url2 !== imagen_url2_existente) {
                const oldPath = path.join(__dirname, '..', currentInfo.imagen_url2);
                if (fs.existsSync(oldPath)) {
                    fs.unlink(oldPath, (err) => {
                        if (err) console.error('Error al eliminar imagen antigua:', oldPath, err);
                    });
                }
            }

            // Si se envía una URL vacía para una imagen, significa que se quiere eliminar
            if (imagen_url1_existente === '') {
                 if (currentInfo && currentInfo.imagen_url1) {
                    const oldPath = path.join(__dirname, '..', currentInfo.imagen_url1);
                    if (fs.existsSync(oldPath)) {
                        fs.unlink(oldPath, (err) => {
                            if (err) console.error('Error al eliminar imagen:', oldPath, err);
                        });
                    }
                 }
                 imagen_url1 = ''; // Asegurar que la URL en BD sea vacía
            }

            if (imagen_url2_existente === '') {
                if (currentInfo && currentInfo.imagen_url2) {
                    const oldPath = path.join(__dirname, '..', currentInfo.imagen_url2);
                    if (fs.existsSync(oldPath)) {
                        fs.unlink(oldPath, (err) => {
                            if (err) console.error('Error al eliminar imagen:', oldPath, err);
                        });
                    }
                }
                imagen_url2 = ''; // Asegurar que la URL en BD sea vacía
            }

            const updated = await About.updateAboutInfo({ titulo, parrafo1, parrafo2, imagen_url1, imagen_url2 });

            if (!updated) {
                return res.status(500).json({ message: 'No se pudo actualizar la información "Sobre Mí".' });
            }

            res.status(200).json({ message: 'Información "Sobre Mí" actualizada exitosamente.' });

        } catch (error) {
            console.error('Error al actualizar información "Sobre Mí":', error);
            next(error);
        }
    });
};