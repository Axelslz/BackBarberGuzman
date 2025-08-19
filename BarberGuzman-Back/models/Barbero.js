const db = require('../config/db');

class Barbero {
    static async create({ id_usuario, nombre, apellido, especialidad, foto_perfil_url = null }) {
        const [result] = await db.query(
            'INSERT INTO barberos (id_usuario, nombre, apellido, especialidad, foto_perfil_url) VALUES (?, ?, ?, ?, ?)',
            [id_usuario, nombre, apellido, especialidad, foto_perfil_url]
        );
        return { id: result.insertId, id_usuario, nombre, apellido, especialidad, foto_perfil_url };
    }

    static async getById(id) {
        const [rows] = await db.query('SELECT * FROM barberos WHERE id = ?', [id]);
        return rows[0];
    }

    static async getByUserId(id_usuario) {
        const [rows] = await db.query('SELECT * FROM barberos WHERE id_usuario = ?', [id_usuario]);
        return rows[0];
    }

    static async getAll() {
        const [barberos] = await db.query('SELECT * FROM barberos');
        return barberos;
    }

    static async getAllBarbersWithUserDetails() {
        const [rows] = await db.query(`
            SELECT
                b.id AS id_barbero,
                u.id AS id_usuario,
                u.name,
                u.lastname,
                u.correo,
                b.especialidad,
                b.foto_perfil_url,
                b.descripcion // AÑADIR ESTO: Campo de descripción
            FROM barberos b
            JOIN usuarios u ON b.id_usuario = u.id
            ORDER BY u.name ASC
        `);
        return rows;
    }

    static async deleteBarbero(id) {
        const [result] = await db.query('DELETE FROM barberos WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    static async updateBarbero(id, { nombre, apellido, especialidad, foto_perfil_url, descripcion }) {
        let query = 'UPDATE barberos SET ';
        const params = [];
        const updates = [];

        if (nombre !== undefined) {
            updates.push('nombre = ?');
            params.push(nombre);
        }
        if (apellido !== undefined) {
            updates.push('apellido = ?');
            params.push(apellido);
        }
        if (especialidad !== undefined) {
            updates.push('especialidad = ?');
            params.push(especialidad);
        }
        if (foto_perfil_url !== undefined) {
            updates.push('foto_perfil_url = ?');
            params.push(foto_perfil_url);
        }
        if (descripcion !== undefined) { 
            updates.push('descripcion = ?');
            params.push(descripcion);
        }

        if (updates.length === 0) {
            return false; 
        }

        query += updates.join(', ') + ' WHERE id = ?';
        params.push(id);

        const [result] = await db.query(query, params);
        return result.affectedRows > 0;
    }

    // Nuevo método para agregar un horario no disponible
    static async addUnavailableTime({ id_barbero, fecha, hora_inicio = null, hora_fin = null, motivo = null }) {
        const [result] = await db.query(
            'INSERT INTO horarios_no_disponibles_barberos (id_barbero, fecha, hora_inicio, hora_fin, motivo) VALUES (?, ?, ?, ?, ?)',
            [id_barbero, fecha, hora_inicio, hora_fin, motivo]
        );
        return { id: result.insertId, id_barbero, fecha, hora_inicio, hora_fin, motivo };
    }

    static async getUnavailableTimesByBarberoAndDate(id_barbero, fecha) {
        const [rows] = await db.query(
            'SELECT * FROM horarios_no_disponibles_barberos WHERE id_barbero = ? AND fecha = ?',
            [id_barbero, fecha]
        );
        return rows;
    }

    static async deleteUnavailableTime(id) {
        const [result] = await db.query(
            'DELETE FROM horarios_no_disponibles_barberos WHERE id = ?',
            [id]
        );
        return result.affectedRows > 0;
    }

    static async getUnavailableTimeById(id) {
        const [rows] = await db.query('SELECT * FROM horarios_no_disponibles_barberos WHERE id = ?', [id]);
        return rows[0];
    }
}

module.exports = Barbero;