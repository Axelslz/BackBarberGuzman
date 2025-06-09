// routes/aboutRoutes.js
const express = require('express');
const router = express.Router();
const aboutController = require('../controllers/aboutController');
// Asegúrate de que tus middlewares de autenticación y autorización estén importados correctamente
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware'); // Ajusta la ruta si es diferente

// Ruta pública para obtener la información "Sobre Mí" (cualquier usuario puede verla)
router.get('/', aboutController.getAboutInfo);

// Ruta protegida para actualizar la información "Sobre Mí" (solo administradores)
router.post('/', authenticateToken, authorizeRole('admin'), aboutController.updateAboutInfo);

module.exports = router;