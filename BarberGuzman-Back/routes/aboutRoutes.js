const express = require('express');
const router = express.Router();
const aboutController = require('../controllers/aboutController');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');

// Importa el middleware 'upload' desde el controlador
// Asegúrate de que este import sea correcto y apunte a la exportación de Multer
const { upload } = require('../controllers/aboutController'); 


router.get('/', aboutController.getAboutInfo);

// ¡Asegúrate de que 'upload' esté justo antes de 'aboutController.updateAboutInfo'!
// Multer debe procesar los archivos antes de que el controlador intente acceder a req.files
router.post('/', authenticateToken, authorizeRole('admin'), upload, aboutController.updateAboutInfo); 

module.exports = router;