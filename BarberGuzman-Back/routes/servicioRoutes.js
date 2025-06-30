const express = require('express');
const router = express.Router();
const servicioController = require('../controllers/servicioController');

router.get('/', servicioController.getServicios); 
// router.get('/:id', servicioController.getServicioById); // Si necesitas obtener uno solo

module.exports = router;