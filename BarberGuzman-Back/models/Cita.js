const db = require('../config/db');

class Cita {
   static async crear({ id_cliente, id_barbero, id_servicio, fecha_cita, hora_inicio, hora_fin, duracion_minutos }) { // <-- Aceptar hora_fin
        const [result] = await db.query(
            'INSERT INTO citas (id_cliente, id_barbero, id_servicio, fecha_cita, hora_inicio, hora_fin, duracion_minutos, estado, contador_actualizado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)', // <-- Agregar hora_fin al INSERT y un '?'
            [id_cliente, id_barbero, id_servicio, fecha_cita, hora_inicio, hora_fin, duracion_minutos, 'pendiente'] // <-- Agregar hora_fin a los valores
        );
        return { id: result.insertId, id_cliente, id_barbero, id_servicio, fecha_cita, hora_inicio, hora_fin, duracion_minutos, estado: 'pendiente' }; // <-- Incluirlo en el retorno
    }

    static async getCitasByBarberoAndDate(id_barbero, fecha_cita) {
        const [rows] = await db.query(
            'SELECT * FROM citas WHERE id_barbero = ? AND fecha_cita = ? AND estado NOT IN ("cancelada", "completada")',
            [id_barbero, fecha_cita]
        );
        return rows;
    }

    static async getById(id) {
        const [rows] = await db.query('SELECT * FROM citas WHERE id = ?', [id]);
        return rows[0];
    }

    static async actualizarEstado(id, nuevoEstado) {
        const [result] = await db.query('UPDATE citas SET estado = ? WHERE id = ?', [nuevoEstado, id]);
        return result.affectedRows > 0;
    }

    static async getCitaByIdWithCountStatus(id) {
        const [rows] = await db.query('SELECT c.*, u.id as id_cliente FROM citas c JOIN usuarios u ON c.id_cliente = u.id WHERE c.id = ?', [id]);
        return rows;
    }

    static async marcarContadorActualizado(id) {
        const [result] = await db.query('UPDATE citas SET contador_actualizado = 1 WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    static async getAppointments(whereClause = '', params = []) {
        const [rows] = await db.query(`
            SELECT
                c.id,
                c.fecha_cita,
                c.hora_inicio,
                DATE_ADD(CONCAT(c.fecha_cita, ' ', c.hora_inicio), INTERVAL c.duracion_minutos MINUTE) AS hora_fin,
                c.estado,
                c.duracion_minutos,
                c.id_cliente,
                c.id_barbero,
                c.id_servicio,
                u_cliente.name AS cliente_name,
                u_cliente.lastname AS cliente_lastname,
                u_barbero.name AS barbero_name,
                u_barbero.lastname AS barbero_lastname,
                s.nombre AS servicio_nombre,
                s.precio AS servicio_precio
            FROM citas c
            JOIN usuarios u_cliente ON c.id_cliente = u_cliente.id
            JOIN barberos b ON c.id_barbero = b.id
            JOIN usuarios u_barbero ON b.id_usuario = u_barbero.id
            JOIN servicios s ON c.id_servicio = s.id
            ${whereClause}
            ORDER BY c.fecha_cita DESC, c.hora_inicio DESC
        `, params);
        return rows;
    }

    static async getAllAppointments(startDate = null, endDate = null) {
        let whereClause = '';
        let params = [];
        if (startDate && endDate) {
            whereClause = 'WHERE c.fecha_cita BETWEEN ? AND ?';
            params = [startDate, endDate];
        }
        return this.getAppointments(whereClause, params);
    }

    static async getAppointmentsByUserId(userId, startDate = null, endDate = null) {
        let whereClause = 'WHERE c.id_cliente = ?';
        let params = [userId];
        if (startDate && endDate) {
            whereClause += ' AND c.fecha_cita BETWEEN ? AND ?';
            params.push(startDate, endDate);
        }
        return this.getAppointments(whereClause, params);
    }

    static async getAppointmentsByBarberId(barberId, startDate = null, endDate = null) {
        let whereClause = 'WHERE c.id_barbero = ?';
        let params = [barberId];
        if (startDate && endDate) {
            whereClause += ' AND c.fecha_cita BETWEEN ? AND ?';
            params.push(startDate, endDate);
        }
        return this.getAppointments(whereClause, params);
    }
}

module.exports = Cita;