const db = require('../config/db');
const bcrypt = require('bcryptjs');

class Usuario {
    // El método crear ahora solo maneja los campos de registro de un cliente normal
    static async crear({ name, lastname, correo, password }) { // Eliminamos role y id_barbero de aquí
        const hashedPassword = await bcrypt.hash(password, 10);
        // El role se establece por defecto a 'cliente' en la BD si no se especifica,
        // o se asume aquí que siempre será 'cliente' para este método de registro.
        const [result] = await db.query(
            'INSERT INTO usuarios (name, lastname, correo, password, role) VALUES (?, ?, ?, ?, ?)',
            [name, lastname, correo, hashedPassword, 'cliente'] // Siempre 'cliente' por defecto en el registro
        );
        return { id: result.insertId, name, lastname, correo, role: 'cliente' }; // Devolvemos el ID del nuevo usuario
    }

    // Aseguramos que id_barbero y role se seleccionen en la búsqueda
    static async buscarPorCorreo(correo) {
        // Seleccionamos TODOS los campos relevantes, incluyendo id_barbero y role
        const [usuarios] = await db.query('SELECT id, name, lastname, correo, password, role, id_barbero FROM usuarios WHERE correo = ?', [correo]);
        return usuarios[0];
    }

    // Puedes añadir un método si lo necesitas para actualizar el rol y el id_barbero manualmente
    // static async actualizarRolYBarbero(id, role, id_barbero) {
    //     await db.query('UPDATE usuarios SET role = ?, id_barbero = ? WHERE id = ?', [role, id_barbero, id]);
    // }
}

module.exports = Usuario;
