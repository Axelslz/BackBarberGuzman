const db = require('../config/db');

class Servicio {
    static async getAll() {
        const [servicios] = await db.query('SELECT id, nombre, descripcion, precio, duracion_minutos FROM servicios ORDER BY precio ASC');
        return servicios;
    }

    static async getById(id) {
        const [servicio] = await db.query('SELECT id, nombre, descripcion, precio, duracion_minutos FROM servicios WHERE id = ?', [id]);
        return servicio[0];
    }

    // Método para insertar servicios iniciales (solo para pruebas/sembrado)
    static async create({ nombre, descripcion, precio, duracion_minutos }) {
        const [result] = await db.query(
            'INSERT INTO servicios (nombre, descripcion, precio, duracion_minutos) VALUES (?, ?, ?, ?)',
            [nombre, descripcion, precio, duracion_minutos]
        );
        return { id: result.insertId, nombre, descripcion, precio, duracion_minutos };
    }
}

module.exports = Servicio;