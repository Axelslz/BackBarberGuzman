const express = require('express');
const router = express.Router();
const aboutController = require('../controllers/aboutController');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');
const { upload } = aboutController; 

router.get('/', aboutController.getAboutInfo);
router.post('/', authenticateToken, authorizeRole('super_admin'), upload, aboutController.updateAboutInfo);

module.exports = router;