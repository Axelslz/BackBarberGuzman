const express = require('express');
const router = express.Router();
const servicioController = require('../controllers/servicioController');

router.get('/', servicioController.getServicios); 

module.exports = router;