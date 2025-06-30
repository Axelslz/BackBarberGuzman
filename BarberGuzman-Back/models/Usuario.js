const db = require('../config/db');

class Usuario {
    static async create({ name, lastname, correo, password, role }) {
        const [result] = await db.query(
            'INSERT INTO usuarios (name, lastname, correo, password, role, citas_completadas) VALUES (?, ?, ?, ?, ?, 0)',
            [name, lastname, correo, password, role]
        );
        return { id: result.insertId, name, lastname, correo, role };
    }

    static async createGoogleUser({ googleId, name, lastname, correo, profilePicture, role }) {
        const [result] = await db.query(
            'INSERT INTO usuarios (google_id, name, lastname, correo, password, role, citas_completadas, profile_picture_url) VALUES (?, ?, ?, ?, NULL, ?, 0, ?)',
            [googleId, name, lastname, correo, role, profilePicture]
        );
        return { id: result.insertId, google_id: googleId, name, lastname, correo, role, profilePicture };
    }

    static async getById(id) {
        const [rows] = await db.query('SELECT * FROM usuarios WHERE id = ?', [id]);
        return rows[0];
    }

    static async findByCorreo(correo) {
        const [rows] = await db.query(`
            SELECT
                u.id, u.name, u.lastname, u.correo, u.password, u.role, u.citas_completadas, u.google_id, u.profile_picture_url,
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
                u.id, u.name, u.lastname, u.correo, u.role, u.citas_completadas, u.google_id, u.profile_picture_url,
                b.id AS id_barbero, b.especialidad
            FROM usuarios u
            LEFT JOIN barberos b ON u.id = b.id_usuario
            WHERE u.id = ?
        `, [id]);
        return rows[0];
    }

    static async updateGoogleId(id, googleId) {
        const [result] = await db.query(
            'UPDATE usuarios SET google_id = ? WHERE id = ?',
            [googleId, id]
        );
        return result.affectedRows > 0;
    }

    static async updateProfileFromGoogle(id, { name, lastname, profilePicture }) {
        const [result] = await db.query(
            'UPDATE usuarios SET name = ?, lastname = ?, profile_picture_url = ? WHERE id = ?',
            [name, lastname, profilePicture, id]
        );
        return result.affectedRows > 0;
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
                u.id, u.name, u.lastname, u.correo, u.role, u.citas_completadas, u.google_id, u.profile_picture_url,
                b.id AS barbero_id, b.especialidad AS barbero_especialidad, b.foto_perfil_url AS barbero_foto
            FROM usuarios u
            LEFT JOIN barberos b ON u.id = b.id_usuario
            ORDER BY u.id ASC
        `);
        return users;
    }

    static async updatePassword(id, newHashedPassword) {
        const [result] = await db.query(
            'UPDATE usuarios SET password = ? WHERE id = ?',
            [newHashedPassword, id]
        );
        return result.affectedRows > 0;
    }

    static async setResetToken(id, token, expires) {
        const [result] = await db.query(
            'UPDATE usuarios SET resetPasswordToken = ?, resetPasswordExpires = ? WHERE id = ?',
            [token, expires, id]
        );
        return result.affectedRows > 0;
    }

    static async findByResetToken(token) {
        const [rows] = await db.query(
            'SELECT * FROM usuarios WHERE resetPasswordToken = ? AND resetPasswordExpires > ?',
            [token, new Date()]
        );
        return rows[0];
    }

    static async clearResetToken(id) {
        const [result] = await db.query(
            'UPDATE usuarios SET resetPasswordToken = NULL, resetPasswordExpires = NULL WHERE id = ?',
            [id]
        );
        return result.affectedRows > 0;
    }
}

module.exports = Usuario;