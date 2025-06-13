const express = require('express');
const router = express.Router();
const barberController = require('../controllers/barberController');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware'); // Importamos los middlewares
const { permitirRoles } = require('../middlewares/roleMiddleware'); // <--- ¡AÑADE ESTA LÍNEA!
const upload = require('../middlewares/uploadMiddleware');

// Ruta pública para obtener todos los barberos (ej. para un cliente que va a agendar)
router.get('/', barberController.getBarberos);

router.put(
    '/:id',
    authenticateToken,
    permitirRoles('admin', 'super_admin'),
    upload, // Aquí usas el middleware de Multer configurado con .single('foto_perfil')
    barberController.updateBarbero
);

router.get('/:id', barberController.getBarberoById);

// Importante: Considera si quieres usar 'authorizeRole' o 'permitirRoles' en las siguientes rutas.
// Si 'authorizeRole' y 'permitirRoles' hacen lo mismo y tienes la opción de usar uno,
// te sugiero mantener la consistencia. Si 'permitirRoles' es el que se conecta con 'req.usuario.role'
// después de la modificación en authMiddleware, entonces deberías usarlo en todas partes.
// Por ahora, para corregir el error actual, solo añadimos la importación de 'permitirRoles'.
router.get('/me/agenda/hoy', authenticateToken, authorizeRole(['admin']), barberController.getAgendaDelDiaBarbero);

router.get('/me/agenda/:fecha', authenticateToken, authorizeRole(['admin']), barberController.getAgendaPorFechaBarbero);

router.get('/me/historial/:year/:month', authenticateToken, authorizeRole(['admin']), barberController.getHistorialBarberoPorMes);

router.get('/me/historial/:year', authenticateToken, authorizeRole(['admin']), barberController.getHistorialBarberoPorAño);

module.exports = router;