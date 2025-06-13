// models/About.js
const db = require('../config/db');

class About {
    /**
     * Obtiene la información de la sección "Sobre Mí".
     * Dado que es una tabla con una única fila, siempre buscamos la primera.
     */
    static async getAboutInfo() {
        const [info] = await db.query('SELECT titulo, parrafo1, parrafo2, imagen_url1, imagen_url2 FROM about_info LIMIT 1');
        return info[0]; // Retorna el primer y único resultado
    }

    /**
     * Actualiza la información de la sección "Sobre Mí".
     * Se espera que siempre se actualice la fila con ID 1 (asumiendo que es la única).
     * Si no existe, se inserta.
     * Los campos imagen_url1 e imagen_url2 ahora contendrán URLs de Cloudinary.
     */
    static async updateAboutInfo({ titulo, parrafo1, parrafo2, imagen_url1, imagen_url2 }) {
        // Primero, intentar actualizar la fila existente (ID 1)
        const [result] = await db.query(
            `UPDATE about_info SET titulo = ?, parrafo1 = ?, parrafo2 = ?, imagen_url1 = ?, imagen_url2 = ? WHERE id = 1`,
            [titulo, parrafo1, parrafo2, imagen_url1, imagen_url2]
        );

        // Si no se actualizó ninguna fila (es decir, no existía), la insertamos
        if (result.affectedRows === 0) {
            const [insertResult] = await db.query(
                `INSERT INTO about_info (id, titulo, parrafo1, parrafo2, imagen_url1, imagen_url2) VALUES (1, ?, ?, ?, ?, ?)`,
                [titulo, parrafo1, parrafo2, imagen_url1, imagen_url2]
            );
            return insertResult.insertId === 1; // Retorna true si se insertó con éxito el ID 1
        }
        return true; // Retorna true si se actualizó con éxito
    }
}

module.exports = About;