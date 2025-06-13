// routes/citasRoutes.js
const express = require('express');
const router = express.Router();

const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');

const {
    getDisponibilidadBarbero,
    crearCita,
    getHistorialCitas, // Esta es la función unificada para el historial
    actualizarCita,
} = require('../controllers/citasController'); 

router.get('/disponibilidad', getDisponibilidadBarbero); 
router.post('/', authenticateToken, authorizeRole(['cliente', 'admin']), crearCita);

// Ruta unificada para obtener el historial de citas (para cliente, admin, super_admin)
// El controlador `getHistorialCitas` decidirá qué mostrar según el rol y los query params.
router.get('/', authenticateToken, authorizeRole(['cliente', 'admin', 'super_admin']), getHistorialCitas);

// Si en el frontend tienes un `getAppointmentsByBarberId` llamando a `/citas/barbero/:id`,
// puedes mantener esta ruta si necesitas una distinción explícita,
// pero con la lógica en `getHistorialCitas` y los query params, podría no ser estrictamente necesaria.
// Si la mantienes, asegúrate que getHistorialCitas la reemplace o que haga la lógica correcta.
// POR AHORA, LA RUTA `GET /` ES LA QUE USARÁ EL FRONTEND PARA EL HISTORIAL GENERAL.

router.put('/:id', authenticateToken, authorizeRole(['admin', 'super_admin']), actualizarCita);

module.exports = router;