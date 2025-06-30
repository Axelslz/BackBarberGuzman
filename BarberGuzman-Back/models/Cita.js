const db = require('../config/db'); 

class Cita {
    static async crear({ id_cliente, id_barbero, id_servicio, fecha_cita, hora_inicio, hora_fin, duracion_minutos }) {
        const [result] = await db.query(
            'INSERT INTO citas (id_cliente, id_barbero, id_servicio, fecha_cita, hora_inicio, hora_fin, duracion_minutos, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [id_cliente, id_barbero, id_servicio, fecha_cita, hora_inicio, hora_fin, duracion_minutos, 'pendiente']
        );
        return { id: result.insertId, id_cliente, id_barbero, id_servicio, fecha_cita, hora_inicio, hora_fin, duracion_minutos, estado: 'pendiente', contador_actualizado: 0 };
    }

    static async getCitasByBarberoAndDate(idBarbero, fecha) {
        try {
            const [rows] = await db.query(
                `SELECT c.*, u.name as cliente_name, u.lastname as cliente_lastname
                 FROM citas c
                 JOIN usuarios u ON c.id_cliente = u.id
                 WHERE c.id_barbero = ? AND c.fecha_cita = ? AND c.estado NOT IN ("cancelada", "completada")`,
                [idBarbero, fecha]
            );
            return rows;
        } catch (error) {
            console.error('Error al obtener citas por barbero y fecha:', error);
            throw error;
        }
    }

    static async getById(id) {
        const [rows] = await db.query('SELECT * FROM citas WHERE id = ?', [id]);
        return rows[0];
    }

    static async update(id, data) { 
        const fields = Object.keys(data).map(key => `${key} = ?`).join(', ');
        const values = Object.values(data);
        values.push(id); 

        const [result] = await db.query(`UPDATE citas SET ${fields} WHERE id = ?`, values);
        return result.affectedRows > 0;
    }


    static async actualizarEstado(id, nuevoEstado) {
        const [result] = await db.query('UPDATE citas SET estado = ? WHERE id = ?', [nuevoEstado, id]);
        return result.affectedRows > 0;
    }

    static async cancelarCita(id_cita) {
        const [result] = await db.query('UPDATE citas SET estado = "cancelada" WHERE id = ?', [id_cita]);
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

    static async getAll() { 
        return this.getAppointments('', []);
    }

    static async getAppointmentsByUserId(userId) { 
        let whereClause = 'WHERE c.id_cliente = ?';
        let params = [userId];
        return this.getAppointments(whereClause, params);
    }

    static async getAppointmentsByBarberId(barberId) { 
        let whereClause = 'WHERE c.id_barbero = ?';
        let params = [barberId];
        return this.getAppointments(whereClause, params);
    }
}

module.exports = Cita;