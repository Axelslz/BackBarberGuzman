const express = require('express');
const router = express.Router();
const authController = require('../controllers/authcontroller');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');
const { uploadUserProfileImage } = require('../middlewares/uploadMiddleware');

router.post('/registrar', authController.registrar);
router.post('/login', authController.login);
router.post('/google', authController.googleLogin);
router.post('/set-password', authController.setPassword);
router.get('/me', authenticateToken, authController.getMe);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/refresh-token', authController.refreshToken);
router.post('/logout', authController.logout);
router.put('/profile', authenticateToken, uploadUserProfileImage, authController.updateProfile);

router.get('/users', authenticateToken, authorizeRole(['super_admin']), authController.getAllUsers);
router.put('/users/:id/role', authenticateToken, authorizeRole(['super_admin']), authController.updateUserRole);

module.exports = router;

