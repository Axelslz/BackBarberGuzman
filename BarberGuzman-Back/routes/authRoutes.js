const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');
const multer = require('multer');

const upload = multer({ dest: 'uploads/' });

router.post('/registrar', authController.registrar);
router.post('/login', authController.login);
router.post('/google', authController.googleLogin);
router.post('/set-password', authController.setPassword);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

router.post('/refresh-token', authController.refreshToken);
router.post('/logout', authController.logout);

router.get('/me', authMiddleware.authenticateToken, authController.getMe);
router.get('/users', authMiddleware.authenticateToken, authMiddleware.authorizeRole(['super_admin', 'admin']), authController.getAllUsers);

router.put('/profile', authMiddleware.authenticateToken, upload.single('profilePhoto'), authController.updateProfile);
router.put('/users/:id/role', authMiddleware.authenticateToken, authMiddleware.authorizeRole(['super_admin']), authController.updateUserRole);


module.exports = router;
