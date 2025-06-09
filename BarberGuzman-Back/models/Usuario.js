const db = require('../config/db');
const bcrypt = require('bcryptjs');

class Usuario {
    static async crear({ name, lastname, correo, password }) {
        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await db.query(
            // Ahora insertamos con el valor por defecto de citas_completadas
            'INSERT INTO usuarios (name, lastname, correo, password, role, citas_completadas) VALUES (?, ?, ?, ?, ?, ?)',
            [name, lastname, correo, hashedPassword, 'cliente', 0] // 0 por defecto
        );
        return { id: result.insertId, name, lastname, correo, role: 'cliente', citas_completadas: 0 };
    }

    static async buscarPorCorreo(correo) {
        // Asegúrate de seleccionar también 'citas_completadas'
        const [usuarios] = await db.query('SELECT id, name, lastname, correo, password, role, id_barbero, citas_completadas FROM usuarios WHERE correo = ?', [correo]);
        return usuarios[0];
    }

    // Nuevo método para incrementar el contador de citas completadas
    static async incrementarCitasCompletadas(id_usuario) {
        await db.query(
            'UPDATE usuarios SET citas_completadas = citas_completadas + 1 WHERE id = ?',
            [id_usuario]
        );
    }
    static async buscarPorId(id) {
        // Asegúrate de seleccionar todas las columnas relevantes, incluyendo citas_completadas
        const [usuarios] = await db.query('SELECT id, name, lastname, correo, password, role, id_barbero, citas_completadas FROM usuarios WHERE id = ?', [id]);
        return usuarios[0];
    }
}

module.exports = Usuario;