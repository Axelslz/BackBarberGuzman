const express = require('express');
const router = express.Router();

const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');

const {
    getDisponibilidadBarbero,
    crearCita,
    getHistorialCitas,
    actualizarCita,
    cancelarCita, 
    blockTimeForBarber,
    unblockTimeForBarber,
    getAllCitas, 
    getCitasByUserId, 
    getCitasByBarberId 
} = require('../controllers/citasController');

router.get('/disponibilidad', getDisponibilidadBarbero);
router.post('/', authenticateToken, authorizeRole(['cliente', 'admin', 'super_admin']), crearCita);
router.get('/', authenticateToken, authorizeRole(['cliente', 'admin', 'super_admin', 'barber']), getHistorialCitas);
router.put('/:id', authenticateToken, authorizeRole(['admin', 'super_admin']), actualizarCita);
router.put('/:idCita/cancelar', authenticateToken, authorizeRole(['admin', 'super_admin', 'barber']), cancelarCita);
router.post('/block-time', authenticateToken, authorizeRole(['admin', 'super_admin', 'barber']), blockTimeForBarber);
router.delete('/unblock-time/:id', authenticateToken, authorizeRole(['admin', 'super_admin', 'barber']), unblockTimeForBarber);
router.get('/all', authenticateToken, authorizeRole(['admin', 'super_admin']), getAllCitas);
router.get('/user/:userId', authenticateToken, authorizeRole(['cliente', 'admin', 'super_admin']), getCitasByUserId); 
router.get('/barber/:barberId', authenticateToken, authorizeRole(['admin', 'super_admin', 'barber']), getCitasByBarberId); 
router.get('/historial',
    authenticateToken,
    authorizeRole(['cliente', 'admin', 'super_admin', 'barber']),
    getHistorialCitas
);

module.exports = router;