const db = require('../config/db');

class Usuario {
    static async create({ name, lastname, correo, password, role }) {
        const result = await db.query(
            'INSERT INTO usuarios (name, lastname, correo, password, role, citas_completadas) VALUES ($1, $2, $3, $4, $5, 0) RETURNING id',
            [name, lastname, correo, password, role]
        );
        return { id: result.rows[0].id, name, lastname, correo, role };
    }

    static async createGoogleUser({ googleId, name, lastname, correo, profilePicture, role }) {
        const result = await db.query(
            'INSERT INTO usuarios (google_id, name, lastname, correo, password, role, citas_completadas, profile_picture_url) VALUES ($1, $2, $3, $4, NULL, $5, 0, $6) RETURNING id',
            [googleId, name, lastname, correo, role, profilePicture]
        );
        return { id: result.rows[0].id, google_id: googleId, name, lastname, correo, role, profilePicture };
    }

    static async getById(id) {
        const result = await db.query('SELECT * FROM usuarios WHERE id = $1', [id]);
        return result.rows[0];
    }

    static async findByCorreo(correo) {
        const result = await db.query(`
            SELECT
                u.id, u.name, u.lastname, u.correo, u.password, u.role, u.citas_completadas, u.google_id, u.profile_picture_url,
                b.id AS id_barbero, b.especialidad
            FROM usuarios u
            LEFT JOIN barberos b ON u.id = b.id_usuario
            WHERE u.correo = $1
        `, [correo]);
        return result.rows[0];
    }

    static async findById(id) {
        const result = await db.query(`
            SELECT
                u.id, u.name, u.lastname, u.correo, u.role, u.citas_completadas, u.google_id, u.profile_picture_url,
                b.id AS id_barbero, b.especialidad
            FROM usuarios u
            LEFT JOIN barberos b ON u.id = b.id_usuario
            WHERE u.id = $1
        `, [id]);
        return result.rows[0];
    }

    static async updateProfile(id, data) {
        let query = 'UPDATE usuarios SET ';
        const values = [];
        const fields = [];
        let paramIndex = 1;

        if (data.name !== undefined) {
            fields.push(`name = $${paramIndex++}`);
            values.push(data.name);
        }
        if (data.lastname !== undefined) {
            fields.push(`lastname = $${paramIndex++}`);
            values.push(data.lastname);
        }
        if (data.correo !== undefined) {
            fields.push(`correo = $${paramIndex++}`);
            values.push(data.correo);
        }
        if (data.profilePictureUrl !== undefined) {
            fields.push(`profile_picture_url = $${paramIndex++}`);
            values.push(data.profilePictureUrl);
        }
        if (data.telefono !== undefined) {
            fields.push(`telefono = $${paramIndex++}`);
            values.push(data.telefono);
        }

        if (fields.length === 0) {
            return false;
        }

        query += fields.join(', ');
        query += ' WHERE id = $' + paramIndex;
        values.push(id);
        
        try {
            const result = await db.query(query, values);
            return result.rowCount > 0;
        } catch (error) {
            console.error('Error en updateProfile:', error);
            throw error;
        }
    }

    static async updateGoogleId(id, googleId) {
        const result = await db.query(
            'UPDATE usuarios SET google_id = $1 WHERE id = $2',
            [googleId, id]
        );
        return result.rowCount > 0;
    }

    static async updateProfileFromGoogle(id, { name, lastname, profilePicture }) {
        const result = await db.query(
            'UPDATE usuarios SET name = $1, lastname = $2, profile_picture_url = $3 WHERE id = $4',
            [name, lastname, profilePicture, id]
        );
        return result.rowCount > 0;
    }

    static async updateRole(id, newRole) {
        const result = await db.query('UPDATE usuarios SET role = $1 WHERE id = $2', [newRole, id]);
        return result.rowCount > 0;
    }

    static async incrementarCitasCompletadas(id_cliente) {
        const result = await db.query(
            'UPDATE usuarios SET citas_completadas = citas_completadas + 1 WHERE id = $1',
            [id_cliente]
        );
        return result.rowCount > 0;
    }

    static async getAllUsersWithBarberInfo() {
        const result = await db.query(`
            SELECT
                u.id, u.name, u.lastname, u.correo, u.role, u.citas_completadas, u.google_id, u.profile_picture_url,
                b.id AS barbero_id, b.especialidad AS barbero_especialidad, b.foto_perfil_url AS barbero_foto
            FROM usuarios u
            LEFT JOIN barberos b ON u.id = b.id_usuario
            ORDER BY u.id ASC
        `);
        return result.rows;
    }

    static async updatePassword(id, newHashedPassword) {
        const result = await db.query(
            'UPDATE usuarios SET password = $1 WHERE id = $2',
            [newHashedPassword, id]
        );
        return result.rowCount > 0;
    }

    static async setResetToken(id, token, expires) {
        const result = await db.query(
            'UPDATE usuarios SET resetPasswordToken = $1, resetPasswordExpires = $2 WHERE id = $3',
            [token, expires, id]
        );
        return result.rowCount > 0;
    }

    static async findByResetToken(token) {
        const result = await db.query(
            'SELECT * FROM usuarios WHERE resetPasswordToken = $1 AND resetPasswordExpires > NOW()',
            [token]
        );
        return result.rows[0];
    }

    static async clearResetToken(id) {
        const result = await db.query(
            'UPDATE usuarios SET resetPasswordToken = NULL, resetPasswordExpires = NULL WHERE id = $1',
            [id]
        );
        return result.rowCount > 0;
    }
     static async setRefreshToken(id, refreshToken) {
        const result = await db.query(
            'UPDATE usuarios SET "refreshToken" = $1 WHERE id = $2',
            [refreshToken, id]
        );
        return result.rowCount > 0;
    }

    static async findByRefreshToken(refreshToken) {
        const result = await db.query('SELECT * FROM usuarios WHERE "refreshToken" = $1', [refreshToken]);
        return result.rows[0];
    }

    static async clearRefreshToken(id) {
        const result = await db.query('UPDATE usuarios SET "refreshToken" = NULL WHERE id = $1', [id]);
        return result.rowCount > 0;
    }

    static async updateBarberoId(userId, barberoId) {
        const result = await db.query(
            'UPDATE usuarios SET id_barbero = $1 WHERE id = $2',
            [barberoId, userId]
        );
        return result.rowCount > 0;
    }
}

module.exports = Usuario;



