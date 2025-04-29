const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middlewares/authMiddleware');
const { permitirRoles } = require('../middlewares/roleMiddleware');
const { obtenerCitas, crearCita } = require('../controllers/citasController');

// Solo admins pueden crear citas
router.post('/', verificarToken, permitirRoles('admin'), crearCita);

// Clientes y Admins pueden ver citas
router.get('/', verificarToken, permitirRoles('cliente', 'admin'), obtenerCitas);

module.exports = router;

