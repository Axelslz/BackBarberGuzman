// routes/authRoutes.js (COPIA EL CÓDIGO QUE TE DI EN LA RESPUESTA ANTERIOR)
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');

router.post('/registrar', authController.registrar);
router.post('/login', authController.login);
router.get('/me', authenticateToken, authController.getMe);

router.get('/users', authenticateToken, authorizeRole(['super_admin']), authController.getAllUsers);
router.put('/users/:id/role', authenticateToken, authorizeRole(['super_admin']), authController.updateUserRole);

module.exports = router;
