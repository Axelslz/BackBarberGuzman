const db = require('../config/db');

class Barbero {
    static async getAll() {
        const [barberos] = await db.query('SELECT id, nombre, apellido, especialidad, foto_perfil_url FROM barberos');
        return barberos;
    }

    static async getById(id) {
        const [barbero] = await db.query('SELECT id, nombre, apellido, especialidad, foto_perfil_url FROM barberos WHERE id = ?', [id]);
        return barbero[0];
    }

    // Método para insertar barberos iniciales (solo para pruebas/sembrado)
    static async create({ nombre, apellido, especialidad, foto_perfil_url }) {
        const [result] = await db.query(
            'INSERT INTO barberos (nombre, apellido, especialidad, foto_perfil_url) VALUES (?, ?, ?, ?)',
            [nombre, apellido, especialidad, foto_perfil_url]
        );
        return { id: result.insertId, nombre, apellido, especialidad, foto_perfil_url };
    }
}

module.exports = Barbero;