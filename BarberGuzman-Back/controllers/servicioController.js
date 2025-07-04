const Servicio = require('../models/Servicio');

exports.getServicios = async (req, res, next) => {
    try {
        const servicios = await Servicio.getAll();
        res.status(200).json(servicios);
    } catch (error) {
        console.error('Error al obtener servicios:', error);
        next(error);
    }
};
