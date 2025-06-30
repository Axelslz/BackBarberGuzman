const multer = require('multer');
const storage = multer.memoryStorage();

const uploadBarberPhoto = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(file.originalname.toLowerCase().split('.').pop());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, gif) para la foto de perfil.'));
    }
}).single('foto_perfil');

module.exports = uploadBarberPhoto;