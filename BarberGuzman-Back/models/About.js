// models/About.js
const db = require('../config/db'); // Asegúrate de que esta ruta es correcta

class About {
    /**
     * Obtiene la información de la sección "Sobre Mí".
     * Ahora selecciona hasta 4 URLs de imágenes.
     */
    static async getAboutInfo() {
        const [info] = await db.query('SELECT titulo, parrafo1, parrafo2, imagen_url1, imagen_url2, imagen_url3, imagen_url4 FROM about_info LIMIT 1');
        return info[0]; // Retorna el primer y único resultado
    }

    /**
     * Actualiza la información de la sección "Sobre Mí".
     * Ahora actualiza/inserta hasta 4 URLs de imágenes.
     */
    static async updateAboutInfo({ titulo, parrafo1, parrafo2, imagen_url1, imagen_url2, imagen_url3, imagen_url4 }) {
        // Primero, intentar actualizar la fila existente (ID 1)
        const [result] = await db.query(
            `UPDATE about_info SET
                titulo = ?,
                parrafo1 = ?,
                parrafo2 = ?,
                imagen_url1 = ?,
                imagen_url2 = ?,
                imagen_url3 = ?, -- ¡NUEVO CAMPO!
                imagen_url4 = ?  -- ¡NUEVO CAMPO!
            WHERE id = 1`,
            [titulo, parrafo1, parrafo2, imagen_url1, imagen_url2, imagen_url3, imagen_url4]
        );

        // Si no se actualizó ninguna fila (es decir, no existía), la insertamos
        if (result.affectedRows === 0) {
            const [insertResult] = await db.query(
                `INSERT INTO about_info (id, titulo, parrafo1, parrafo2, imagen_url1, imagen_url2, imagen_url3, imagen_url4)
                VALUES (1, ?, ?, ?, ?, ?, ?, ?)`, 
                [titulo, parrafo1, parrafo2, imagen_url1, imagen_url2, imagen_url3, imagen_url4]
            );
            return insertResult.insertId === 1; // Retorna true si se insertó con éxito el ID 1
        }
        return true; // Retorna true si se actualizó con éxito
    }
}

module.exports = About;