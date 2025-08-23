const db = require('../config/db'); 

class Cita {
    static async crear({ id_cliente, id_barbero, id_servicio, fecha_cita, hora_inicio, hora_fin, duracion_minutos, nombre_cliente }) {
        const finalNombreCliente = nombre_cliente ? nombre_cliente : null;
        const result = await db.query(
            'INSERT INTO citas (id_cliente, id_barbero, id_servicio, fecha_cita, hora_inicio, hora_fin, duracion_minutos, estado, nombre_cliente) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
            [id_cliente, id_barbero, id_servicio, fecha_cita, hora_inicio, hora_fin, duracion_minutos, 'pendiente', finalNombreCliente]
        );
        return { id: result.rows[0].id, id_cliente, id_barbero, id_servicio, fecha_cita, hora_inicio, hora_fin, duracion_minutos, estado: 'pendiente', nombre_cliente: finalNombreCliente };
    }

    static async getCitasByBarberoAndDate(idBarbero, fecha) {
        const result = await db.query(
            `SELECT c.*, u.name as cliente_name, u.lastname as cliente_lastname FROM citas c LEFT JOIN usuarios u ON c.id_cliente = u.id WHERE c.id_barbero = $1 AND c.fecha_cita = $2 AND c.estado NOT IN ('cancelada')`,
            [idBarbero, fecha]
        );
        return result.rows;
    }

    // --- FUNCIÓN PRINCIPAL DEL HISTORIAL SIMPLIFICADA ---
    static async getAppointments(whereClause = '', params = []) {
        try {
            const query = `
                SELECT
                    c.id, c.fecha_cita, c.hora_inicio, c.hora_fin, c.estado,
                    c.duracion_minutos, c.id_cliente, c.id_barbero, c.id_servicio,
                    COALESCE(c.nombre_cliente, CONCAT(u_cliente.name, ' ', u_cliente.lastname), 'Cliente Desconocido') AS cliente_nombre,
                    COALESCE(CONCAT(u_barbero.name, ' ', u_barbero.lastname), 'Barbero Desconocido') AS barbero_name,
                    COALESCE(s.nombre, 'Servicio Desconocido') AS servicio_nombre,
                    COALESCE(s.precio, 0.00) AS servicio_precio
                FROM citas c
                LEFT JOIN usuarios u_cliente ON c.id_cliente = u_cliente.id
                LEFT JOIN barberos b ON c.id_barbero = b.id
                LEFT JOIN usuarios u_barbero ON b.id_usuario = u_barbero.id
                LEFT JOIN servicios s ON c.id_servicio = s.id
                ${whereClause}
                ORDER BY c.fecha_cita DESC, c.hora_inicio DESC
            `;
            const result = await db.query(query, params);
            return result.rows;
        } catch (error) {
            console.error("ERROR EN LA CONSULTA SQL de getAppointments:", error);
            throw error;
        }
    }


    static async getById(id) {
        const result = await db.query('SELECT * FROM citas WHERE id = $1', [id]);
        return result.rows[0];
    }

    static async update(id, data) { 
        const fields = Object.keys(data).map((key, index) => `${key} = $${index + 1}`).join(', ');
        const values = Object.values(data);
        const result = await db.query(`UPDATE citas SET ${fields} WHERE id = $${values.length + 1}`, [...values, id]);
        return result.rowCount > 0;
    }

    static async actualizarEstado(id, nuevoEstado) {
        const result = await db.query('UPDATE citas SET estado = $1 WHERE id = $2', [nuevoEstado, id]);
        return result.rowCount > 0;
    }

    static async cancelarCita(id_cita) {
        const result = await db.query("UPDATE citas SET estado = 'cancelada' WHERE id = $1", [id_cita]);
        return result.rowCount > 0;
    }
    

    static async getAll(filterParams = {}) { 
        return this.getAppointments('', [], filterParams);
    }

    static async getAppointmentsByUserId(userId, filterParams = {}) { 
        const whereClause = 'WHERE c.id_cliente = $1';
        const params = [userId];
        return this.getAppointments(whereClause, params, filterParams);
    }

    static async getAppointmentsByBarberId(barberId, filterParams = {}) { 
        const whereClause = 'WHERE c.id_barbero = $1';
        const params = [barberId];
        return this.getAppointments(whereClause, params, filterParams);
    }
}

module.exports = Cita;