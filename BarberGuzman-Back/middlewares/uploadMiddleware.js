// middlewares/uploadMiddleware.js
const multer = require('multer');

// Usar memoryStorage para que Cloudinary pueda leer directamente desde el buffer
const storage = multer.memoryStorage();

// Configuración para la subida de la foto de perfil del barbero
const uploadBarberPhoto = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Límite de 5MB
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(file.originalname.toLowerCase().split('.').pop());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, gif) para la foto de perfil.'));
    }
}).single('foto_perfil'); // Este middleware maneja un solo archivo con el campo 'foto_perfil'

module.exports = uploadBarberPhoto;