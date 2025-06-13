// models/Usuario.js
const db = require('../config/db');

class Usuario {
    static async create({ name, lastname, correo, password, role }) {
        const [result] = await db.query(
            'INSERT INTO usuarios (name, lastname, correo, password, role, citas_completadas) VALUES (?, ?, ?, ?, ?, 0)',
            [name, lastname, correo, password, role]
        );
        return { id: result.insertId, name, lastname, correo, role };
    }

    static async getById(id) {
        const [rows] = await db.query('SELECT * FROM usuarios WHERE id = ?', [id]);
        return rows[0]; // Devuelve el primer resultado (el usuario)
    }

    static async findByCorreo(correo) {
        const [rows] = await db.query(`
            SELECT
                u.id, u.name, u.lastname, u.correo, u.password, u.role, u.citas_completadas,
                b.id AS id_barbero, b.especialidad
            FROM usuarios u
            LEFT JOIN barberos b ON u.id = b.id_usuario
            WHERE u.correo = ?
        `, [correo]);
        return rows[0];
    }

    static async findById(id) {
        const [rows] = await db.query(`
            SELECT
                u.id, u.name, u.lastname, u.correo, u.role, u.citas_completadas,
                b.id AS id_barbero, b.especialidad
            FROM usuarios u
            LEFT JOIN barberos b ON u.id = b.id_usuario
            WHERE u.id = ?
        `, [id]);
        return rows[0];
    }

    static async updateRole(id, newRole) {
        const [result] = await db.query('UPDATE usuarios SET role = ? WHERE id = ?', [newRole, id]);
        return result.affectedRows > 0;
    }

    static async incrementarCitasCompletadas(id_cliente) {
        const [result] = await db.query(
            'UPDATE usuarios SET citas_completadas = citas_completadas + 1 WHERE id = ?',
            [id_cliente]
        );
        return result.affectedRows > 0;
    }

    static async getAllUsersWithBarberInfo() {
        const [users] = await db.query(`
            SELECT
                u.id, u.name, u.lastname, u.correo, u.role, u.citas_completadas,
                b.id AS barbero_id, b.especialidad AS barbero_especialidad, b.foto_perfil_url AS barbero_foto
            FROM usuarios u
            LEFT JOIN barberos b ON u.id = b.id_usuario
            ORDER BY u.id ASC
        `);
        return users;
    }
}

module.exports = Usuario;