const express = require('express');
const router = express.Router();
const barberController = require('../controllers/barberController');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware'); 
const { permitirRoles } = require('../middlewares/roleMiddleware'); 
const upload = require('../middlewares/uploadMiddleware');

router.get('/', barberController.getBarberos);

router.put(
    '/:id',
    authenticateToken,
    permitirRoles('admin', 'super_admin'),
    upload, 
    barberController.updateBarbero
);

router.get('/:id', barberController.getBarberoById);

router.get('/me/agenda/hoy', authenticateToken, authorizeRole(['admin']), barberController.getAgendaDelDiaBarbero);

router.get('/me/agenda/:fecha', authenticateToken, authorizeRole(['admin']), barberController.getAgendaPorFechaBarbero);

router.get('/me/historial/:year/:month', authenticateToken, authorizeRole(['admin']), barberController.getHistorialBarberoPorMes);

router.get('/me/historial/:year', authenticateToken, authorizeRole(['admin']), barberController.getHistorialBarberoPorAño);

module.exports = router;