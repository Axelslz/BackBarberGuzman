// models/Cita.js (VERSIÓN AJUSTADA)
const db = require('../config/db');
const moment = require('moment-timezone'); // Para manejar bien las horas y fechas (ya lo tenías en el controller)

class Cita {
    static async crear({ id_cliente, id_barbero, id_servicio, fecha_cita, hora_inicio, duracion_minutos }) {
        // Calcular hora_fin
        // Asegúrate de que la zona horaria sea correcta para tu contexto (México)
        // Por ejemplo, "America/Mexico_City", "America/Chihuahua", "America/Cancun", etc.
        const start = moment.tz(`${fecha_cita} ${hora_inicio}`, "YYYY-MM-DD HH:mm", "America/Mexico_City");
        const end = start.clone().add(duracion_minutos, 'minutes'); // Usa .clone() para no modificar 'start'
        const hora_fin = end.format('HH:mm:ss'); // Formato para TIME en MySQL

        const [result] = await db.query(
            'INSERT INTO citas (id_cliente, id_barbero, id_servicio, fecha_cita, hora_inicio, hora_fin, estado) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [id_cliente, id_barbero, id_servicio, fecha_cita, hora_inicio, hora_fin, 'confirmada'] // Estado inicial 'confirmada' o 'pendiente'
        );
        return { id: result.insertId, id_cliente, id_barbero, id_servicio, fecha_cita, hora_inicio, hora_fin, estado: 'confirmada' };
    }

    static async getCitasByBarberoAndDate(id_barbero, fecha_cita) {
        // Obtiene todas las citas para un barbero y fecha específica
        const [citas] = await db.query(
            'SELECT id, id_cliente, id_servicio, hora_inicio, hora_fin, estado FROM citas WHERE id_barbero = ? AND fecha_cita = ?',
            [id_barbero, fecha_cita]
        );
        return citas;
    }

    static async getCitasByCliente(id_cliente) {
        // Obtiene el historial de citas de un cliente, uniendo con barberos y servicios para más detalles
        const [citas] = await db.query(
            `SELECT c.id, c.fecha_cita, c.hora_inicio, c.hora_fin, c.estado,
                    b.nombre AS barbero_nombre, b.apellido AS barbero_apellido,
                    s.nombre AS servicio_nombre, s.precio AS servicio_precio
             FROM citas c
             JOIN barberos b ON c.id_barbero = b.id
             JOIN servicios s ON c.id_servicio = s.id
             WHERE c.id_cliente = ?
             ORDER BY c.fecha_cita DESC, c.hora_inicio DESC`,
            [id_cliente]
        );
        return citas;
    }

    // Métodos para el ADMIN (que ya tenías en tu `models/Cita.js` original, adaptados al nuevo esquema)
    static async obtenerTodas() {
        const [citas] = await db.query(
            `SELECT c.id, c.fecha_cita, c.hora_inicio, c.hora_fin, c.estado,
                    u.name AS cliente_name, u.lastname AS cliente_lastname, u.correo AS cliente_correo,
                    b.nombre AS barbero_nombre, b.apellido AS barbero_apellido,
                    s.nombre AS servicio_nombre, s.precio AS servicio_precio
             FROM citas c
             JOIN usuarios u ON c.id_cliente = u.id
             JOIN barberos b ON c.id_barbero = b.id
             JOIN servicios s ON c.id_servicio = s.id
             ORDER BY c.fecha_cita DESC, c.hora_inicio DESC`
        );
        return citas;
    }

    static async actualizarEstado(id, nuevoEstado) {
        const [result] = await db.query(
            'UPDATE citas SET estado = ? WHERE id = ?',
            [nuevoEstado, id]
        );
        return result.affectedRows > 0;
    }

    static async obtenerPorDia(fecha) {
        const [citas] = await db.query(
            `SELECT c.id, c.fecha_cita, c.hora_inicio, c.hora_fin, c.estado,
                    u.name AS cliente_name, u.lastname AS cliente_lastname, u.correo AS cliente_correo,
                    b.nombre AS barbero_nombre, b.apellido AS barbero_apellido,
                    s.nombre AS servicio_nombre, s.precio AS servicio_precio
             FROM citas c
             JOIN usuarios u ON c.id_cliente = u.id
             JOIN barberos b ON c.id_barbero = b.id
             JOIN servicios s ON c.id_servicio = s.id
             WHERE c.fecha_cita = ?
             ORDER BY c.hora_inicio ASC`,
            [fecha]
        );
        return citas;
    }

    static async obtenerPorMes(año, mes) {
        const [citas] = await db.query(
            `SELECT c.id, c.fecha_cita, c.hora_inicio, c.hora_fin, c.estado,
                    u.name AS cliente_name, u.lastname AS cliente_lastname, u.correo AS cliente_correo,
                    b.nombre AS barbero_nombre, b.apellido AS barbero_apellido,
                    s.nombre AS servicio_nombre, s.precio AS servicio_precio
             FROM citas c
             JOIN usuarios u ON c.id_cliente = u.id
             JOIN barberos b ON c.id_barbero = b.id
             JOIN servicios s ON c.id_servicio = s.id
             WHERE YEAR(c.fecha_cita) = ? AND MONTH(c.fecha_cita) = ?
             ORDER BY c.fecha_cita DESC, c.hora_inicio DESC`,
            [año, mes]
        );
        return citas;
    }

    static async obtenerTotalesPorDia(fecha) {
        const [resultado] = await db.query('SELECT COUNT(*) AS total FROM citas WHERE fecha_cita = ?', [fecha]);
        return resultado[0].total;
    }
}

module.exports = Cita;
