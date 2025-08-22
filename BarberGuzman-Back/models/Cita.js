const dbCita = require('../config/db'); 

class Cita {
   static async crear({ id_cliente, id_barbero, id_servicio, fecha_cita, hora_inicio, hora_fin, duracion_minutos, nombre_cliente }) {
        const finalNombreCliente = nombre_cliente ? nombre_cliente : null;

        const result = await dbCita.query(
            'INSERT INTO citas (id_cliente, id_barbero, id_servicio, fecha_cita, hora_inicio, hora_fin, duracion_minutos, estado, nombre_cliente) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
            [id_cliente, id_barbero, id_servicio, fecha_cita, hora_inicio, hora_fin, duracion_minutos, 'pendiente', finalNombreCliente]
        );
        return { id: result.rows[0].id, id_cliente, id_barbero, id_servicio, fecha_cita, hora_inicio, hora_fin, duracion_minutos, estado: 'pendiente', nombre_cliente: finalNombreCliente };
    }

    static async getCitasByBarberoAndDate(idBarbero, fecha) {
        try {
            const result = await dbCita.query(
                `SELECT c.*, u.name as cliente_name, u.lastname as cliente_lastname
                 FROM citas c
                 JOIN usuarios u ON c.id_cliente = u.id
                 WHERE c.id_barbero = $1 AND c.fecha_cita = $2 AND c.estado NOT IN ('cancelada', 'completada')`,
                [idBarbero, fecha]
            );
            return result.rows;
        } catch (error) {
            console.error('Error al obtener citas por barbero y fecha:', error);
            throw error;
        }
    }

    static async getById(id) {
        const result = await dbCita.query('SELECT * FROM citas WHERE id = $1', [id]);
        return result.rows[0];
    }

    static async update(id, data) { 
        const fields = Object.keys(data).map((key, index) => `${key} = $${index + 1}`).join(', ');
        const values = Object.values(data);
        values.push(id); 

        const result = await dbCita.query(`UPDATE citas SET ${fields} WHERE id = $${values.length}`, values);
        return result.rowCount > 0;
    }

    static async actualizarEstado(id, nuevoEstado) {
        const result = await dbCita.query('UPDATE citas SET estado = $1 WHERE id = $2', [nuevoEstado, id]);
        return result.rowCount > 0;
    }

    static async cancelarCita(id_cita) {
        const result = await dbCita.query('UPDATE citas SET estado = \'cancelada\' WHERE id = $1', [id_cita]);
        return result.rowCount > 0;
    }

    static async getCitaByIdWithCountStatus(id) {
        const result = await dbCita.query('SELECT c.*, u.id as id_cliente FROM citas c JOIN usuarios u ON c.id_cliente = u.id WHERE c.id = $1', [id]);
        return result.rows;
    }

    static async marcarContadorActualizado(id) {
        const result = await dbCita.query('UPDATE citas SET contador_actualizado = 1 WHERE id = $1', [id]);
        return result.rowCount > 0;
    }

    static async getAppointments(whereClause = '', params = []) {
        const result = await dbCita.query(`
            SELECT
                c.id,
                c.fecha_cita,
                c.hora_inicio,
                (c.fecha_cita::timestamp + c.hora_inicio::time + (c.duracion_minutos * interval '1 minute')) AS hora_fin,
                c.estado,
                c.duracion_minutos,
                c.id_cliente,
                c.id_barbero,
                c.id_servicio,
                COALESCE(c.nombre_cliente, CONCAT(u_cliente.name, ' ', u_cliente.lastname)) AS cliente_nombre,
                u_cliente.name AS cliente_name,
                u_cliente.lastname AS cliente_lastname,
                u_barbero.name AS barbero_name,
                u_barbero.lastname AS barbero_lastname,
                s.nombre AS servicio_nombre,
                s.precio AS servicio_precio
            FROM citas c
            -- CAMBIO 1: JOIN a LEFT JOIN para no perder citas si el cliente se borra
            LEFT JOIN usuarios u_cliente ON c.id_cliente = u_cliente.id
            -- CAMBIO 2: JOIN a LEFT JOIN para no perder citas si el barbero se borra
            LEFT JOIN barberos b ON c.id_barbero = b.id
            -- CAMBIO 3: JOIN a LEFT JOIN para no perder citas si el usuario del barbero se borra
            LEFT JOIN usuarios u_barbero ON b.id_usuario = u_barbero.id
            -- CAMBIO 4: JOIN a LEFT JOIN para no perder citas si el servicio se borra
            LEFT JOIN servicios s ON c.id_servicio = s.id
            ${whereClause}
            ORDER BY c.fecha_cita DESC, c.hora_inicio DESC
        `, params);
        return result.rows;
    }

    static async getAll() { 
        return this.getAppointments('', []);
    }

    static async getAppointmentsByUserId(userId) { 
        let whereClause = 'WHERE c.id_cliente = $1';
        let params = [userId];
        return this.getAppointments(whereClause, params);
    }

    static async getAppointmentsByBarberId(barberId) { 
        let whereClause = 'WHERE c.id_barbero = $1';
        let params = [barberId];
        return this.getAppointments(whereClause, params);
    }
}

module.exports = Cita;