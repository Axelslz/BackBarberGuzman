const dbBarbero = require('../config/db');

class Barbero {
    static async create({ id_usuario, nombre, apellido, especialidad, foto_perfil_url = null }) {
        const result = await dbBarbero.query(
            'INSERT INTO barberos (id_usuario, nombre, apellido, especialidad, foto_perfil_url) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [id_usuario, nombre, apellido, especialidad, foto_perfil_url]
        );
        // Usa 'result.rows[0].id' para obtener el ID de la nueva fila en pg
        return { id: result.rows[0].id, id_usuario, nombre, apellido, especialidad, foto_perfil_url };
    }

    static async getById(id) {
        const result = await dbBarbero.query('SELECT * FROM barberos WHERE id = $1', [id]);
        return result.rows[0];
    }

    static async getByUserId(id_usuario) {
        const result = await dbBarbero.query('SELECT * FROM barberos WHERE id_usuario = $1', [id_usuario]);
        return result.rows[0];
    }

    static async getAll() {
        const result = await dbBarbero.query('SELECT * FROM barberos');
        return result.rows;
    }

    static async getAllBarbersWithUserDetails() {
        const result = await dbBarbero.query(`
            SELECT
                b.id AS id_barbero,
                u.id AS id_usuario,
                u.name,
                u.lastname,
                u.correo,
                b.especialidad,
                b.foto_perfil_url,
                b.descripcion
            FROM barberos b
            JOIN usuarios u ON b.id_usuario = u.id
            ORDER BY u.name ASC
        `);
        return result.rows;
    }

    static async deleteBarbero(id) {
        const result = await dbBarbero.query('DELETE FROM barberos WHERE id = $1', [id]);
        return result.rowCount > 0;
    }

    static async updateBarbero(id, { nombre, apellido, especialidad, foto_perfil_url, descripcion }) {
        let query = 'UPDATE barberos SET ';
        const params = [];
        const updates = [];
        let paramCount = 1;

        if (nombre !== undefined) {
            updates.push(`nombre = $${paramCount++}`);
            params.push(nombre);
        }
        if (apellido !== undefined) {
            updates.push(`apellido = $${paramCount++}`);
            params.push(apellido);
        }
        if (especialidad !== undefined) {
            updates.push(`especialidad = $${paramCount++}`);
            params.push(especialidad);
        }
        if (foto_perfil_url !== undefined) {
            updates.push(`foto_perfil_url = $${paramCount++}`);
            params.push(foto_perfil_url);
        }
        if (descripcion !== undefined) { 
            updates.push(`descripcion = $${paramCount++}`);
            params.push(descripcion);
        }

        if (updates.length === 0) {
            return false; 
        }

        query += updates.join(', ') + ` WHERE id = $${paramCount}`;
        params.push(id);

        const result = await dbBarbero.query(query, params);
        return result.rowCount > 0;
    }

    static async addUnavailableTime({ id_barbero, fecha, hora_inicio = null, hora_fin = null, motivo = null }) {
        const result = await dbBarbero.query(
            'INSERT INTO horarios_no_disponibles_barberos (id_barbero, fecha, hora_inicio, hora_fin, motivo) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [id_barbero, fecha, hora_inicio, hora_fin, motivo]
        );
        return { id: result.rows[0].id, id_barbero, fecha, hora_inicio, hora_fin, motivo };
    }

    static async getUnavailableTimesByBarberoAndDate(id_barbero, fecha) {
        const result = await dbBarbero.query(
            'SELECT * FROM horarios_no_disponibles_barberos WHERE id_barbero = $1 AND fecha = $2',
            [id_barbero, fecha]
        );
        return result.rows;
    }

    static async deleteUnavailableTime(id) {
        const result = await dbBarbero.query(
            'DELETE FROM horarios_no_disponibles_barberos WHERE id = $1',
            [id]
        );
        return result.rowCount > 0;
    }

    static async getUnavailableTimeById(id) {
        const result = await dbBarbero.query('SELECT * FROM horarios_no_disponibles_barberos WHERE id = $1', [id]);
        return result.rows[0];
    }
}

module.exports = Barbero;
