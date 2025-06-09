const express = require('express');
const router = express.Router();
const barberController = require('../controllers/barberController');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware'); // Importamos los middlewares

// Ruta pública para obtener todos los barberos (ej. para un cliente que va a agendar)
router.get('/', barberController.getBarberos);

router.get('/:id', barberController.getBarberoById);
// --- Rutas protegidas para el Barbero Admin (usuarios con rol 'admin' y id_barbero) ---
// Usamos 'admin' como el rol que tú asignarás manualmente.
// Si decidiste crear un rol 'barberoAdmin' específico, cámbialo aquí.

// Obtener la agenda del día del barbero autenticado
router.get('/me/agenda/hoy', authenticateToken, authorizeRole(['admin']), barberController.getAgendaDelDiaBarbero);

// Obtener la agenda de una fecha específica para el barbero autenticado
router.get('/me/agenda/:fecha', authenticateToken, authorizeRole(['admin']), barberController.getAgendaPorFechaBarbero);

// Obtener el historial de citas por mes para el barbero autenticado
router.get('/me/historial/:year/:month', authenticateToken, authorizeRole(['admin']), barberController.getHistorialBarberoPorMes);

// Obtener el historial de citas por año para el barbero autenticado
router.get('/me/historial/:year', authenticateToken, authorizeRole(['admin']), barberController.getHistorialBarberoPorAño);

module.exports = router;