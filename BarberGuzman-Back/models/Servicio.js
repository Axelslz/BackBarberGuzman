const dbServicio = require('../config/db');

class Servicio {
    static async getAll() {
        const result = await dbServicio.query('SELECT id, nombre, descripcion, precio, duracion_minutos, tipo FROM servicios ORDER BY precio ASC');
        return result.rows;    
    }

    static async getById(id) {
        const result = await dbServicio.query('SELECT id, nombre, descripcion, precio, duracion_minutos, tipo FROM servicios WHERE id = $1', [id]);
        return result.rows[0];
    }

    static async create({ nombre, descripcion, precio, duracion_minutos, tipo }) {
        const result = await dbServicio.query(
            'INSERT INTO servicios (nombre, descripcion, precio, duracion_minutos, tipo) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [nombre, descripcion, precio, duracion_minutos, tipo]
        );
        return { id: result.rows[0].id, nombre, descripcion, precio, duracion_minutos, tipo };
    }
}

module.exports = Servicio;