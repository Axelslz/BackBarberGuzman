const Cita = require('../models/Cita');

const obtenerCitas = async (req, res, next) => {
  try {
    const citas = await Cita.obtenerTodas();
    res.json(citas);
  } catch (error) {
    next(error); // Manda el error a un middleware de errores
  }
};

const crearCita = async (req, res, next) => {
  try {
    const { nombre, correo, fecha, hora } = req.body;
    await Cita.crear({ nombre, correo, fecha, hora });
    res.json({ mensaje: 'Cita agendada correctamente' });
  } catch (error) {
    next(error);
  }
};

module.exports = { obtenerCitas, crearCita };

