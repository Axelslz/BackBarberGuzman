const db = require('../config/db');

class Cita {
  static async obtenerTodas() {
    const [citas] = await db.query('SELECT * FROM citas');
    return citas;
  }

  static async crear({ nombre, correo, fecha, hora }) {
    await db.query('INSERT INTO citas (nombre, correo, fecha, hora) VALUES (?, ?, ?, ?)', [nombre, correo, fecha, hora]);
  }
}

module.exports = Cita;
