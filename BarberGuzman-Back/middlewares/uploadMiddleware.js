const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinaryConfig'); // Asegúrate de que este archivo existe y exporta la instancia de cloudinary

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: (req, file) => {
        // Obtenemos el ID del usuario del token de autenticación
        const userId = req.user.id;
        
        // Determina la carpeta de destino en Cloudinary según el tipo de subida
        let folderName = 'user-profiles';
        if (file.fieldname === 'foto_perfil') {
            folderName = 'barber-profiles'; // O la carpeta que uses para barberos
        }
        
        // Define el ID público único
        const publicId = `${folderName}-${userId}-${Date.now()}`;

        return {
            folder: folderName,
            public_id: publicId,
            format: 'jpg', // Puedes especificar el formato que desees
            transformation: [
                { width: 300, height: 300, crop: "fill", gravity: "face" } // Transformación para la imagen de perfil
            ]
        };
    },
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(file.originalname.toLowerCase().split('.').pop());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, gif) para la foto de perfil.'));
    }
});

// Define los diferentes middlewares de subida
const uploadUserProfileImage = upload.single('profileImage');
const uploadBarberPhoto = upload.single('foto_perfil');

module.exports = {
  uploadUserProfileImage,
  uploadBarberPhoto
};
