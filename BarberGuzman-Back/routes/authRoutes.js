const express = require('express');
const router = express.Router();
const authController = require('../controllers/authcontroller');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');

router.post('/registrar', authController.registrar);
router.post('/login', authController.login);
router.post('/google', authController.googleLogin);
router.post('/set-password', authController.setPassword);
router.get('/me', authenticateToken, authController.getMe);

// Rutas para restablecer contraseña
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// Rutas para super_admin
router.get('/users', authenticateToken, authorizeRole(['super_admin']), authController.getAllUsers);
router.put('/users/:id/role', authenticateToken, authorizeRole(['super_admin']), authController.updateUserRole);

module.exports = router;