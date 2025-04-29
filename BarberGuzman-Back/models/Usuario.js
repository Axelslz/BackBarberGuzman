const db = require('../config/db');
const bcrypt = require('bcryptjs');

class Usuario {
  static async crear({ name, lastname, correo, password, role = 'cliente' }) {
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query(
      'INSERT INTO usuarios (name, lastname, correo, password, role) VALUES (?, ?, ?, ?, ?)',
      [name, lastname, correo, hashedPassword, role]
    );
  }

  static async buscarPorCorreo(correo) {
    const [usuarios] = await db.query('SELECT * FROM usuarios WHERE correo = ?', [correo]);
    return usuarios[0];
  }
}

module.exports = Usuario;
