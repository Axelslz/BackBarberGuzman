const express = require('express');
const router = express.Router();

// IMPORTANTE: Importa ambos desde el mismo archivo `middlewares/authMiddleware.js`
// que es donde definimos y exportamos 'authenticateToken' y 'authorizeRole'.
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');

// Asegúrate de que el nombre del archivo 'citasController.js' sea correcto y que
// todas las funciones estén exportadas en ese controlador.
const {
    obtenerCitas,
    crearCita,
    obtenerHistorialCliente,
    actualizarCita,
    obtenerCitasPorDia,
    obtenerCitasPorMes,
    obtenerTotalDelDia
} = require('../controllers/citasController'); // ¡Re-confirma que el archivo se llama "citasController.js"!

// Todos los usuarios autenticados pueden agendar citas
router.post('/', authenticateToken, authorizeRole(['cliente', 'admin']), crearCita);

// Clientes ven su historial personal
router.get('/historial', authenticateToken, authorizeRole(['cliente']), obtenerHistorialCliente);

// Admin actualiza cita (por ID)
router.put('/:id', authenticateToken, authorizeRole(['admin']), actualizarCita);

// Admin obtiene agenda del día
router.get('/dia/:fecha', authenticateToken, authorizeRole(['admin']), obtenerCitasPorDia);

// Admin obtiene agenda del mes
router.get('/mes/:año/:mes', authenticateToken, authorizeRole(['admin']), obtenerCitasPorMes);

// Admin ve total de citas de un día
router.get('/total-dia/:fecha', authenticateToken, authorizeRole(['admin']), obtenerTotalDelDia);

// Si 'obtenerCitas' es para ver TODAS las citas, solo admin debería tener acceso.
router.get('/', authenticateToken, authorizeRole(['admin']), obtenerCitas);

module.exports = router;

