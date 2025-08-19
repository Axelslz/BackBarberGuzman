const express = require('express');
const router = express.Router();
const authController = require('../controllers/authcontroller');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');
const { uploadUserProfileImage } = require('../middlewares/uploadMiddleware'); // Importa el middleware de subida

router.post('/registrar', authController.registrar);
router.post('/login', authController.login);
router.post('/google', authController.googleLogin);
router.post('/set-password', authController.setPassword);
router.get('/me', authenticateToken, authController.getMe);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

router.put('/profile', authenticateToken, uploadUserProfileImage, authController.updateUserProfile);

// Rutas para super_admin
router.get('/users', authenticateToken, authorizeRole(['super_admin']), authController.getAllUsers);
router.put('/users/:id/role', authenticateToken, authorizeRole(['super_admin']), authController.updateUserRole);

module.exports = router;
