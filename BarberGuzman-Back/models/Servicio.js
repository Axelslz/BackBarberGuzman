const db = require('../config/db');

class Servicio {
    static async getAll() {
        const [servicios] = await db.query('SELECT id, nombre, descripcion, precio, duracion_minutos, tipo FROM servicios ORDER BY precio ASC');
        return servicios;
    }

    static async getById(id) {
        const [servicio] = await db.query('SELECT id, nombre, descripcion, precio, duracion_minutos, tipo FROM servicios WHERE id = ?', [id]);
        return servicio[0];
    }

    static async create({ nombre, descripcion, precio, duracion_minutos, tipo }) {
        const [result] = await db.query(
            'INSERT INTO servicios (nombre, descripcion, precio, duracion_minutos, tipo) VALUES (?, ?, ?, ?, ?)',
            [nombre, descripcion, precio, duracion_minutos, tipo]
        );
        return { id: result.insertId, nombre, descripcion, precio, duracion_minutos, tipo };
    }
}

module.exports = Servicio;