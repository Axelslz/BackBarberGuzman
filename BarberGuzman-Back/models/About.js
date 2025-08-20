const db = require('../config/db'); 

class About {
    
    static async getAboutInfo() {
        // En PostgreSQL, el resultado de una consulta está en 'result.rows'
        const result = await db.query('SELECT titulo, parrafo1, parrafo2, imagen_url1, imagen_url2, imagen_url3, imagen_url4 FROM about_info LIMIT 1');
        return result.rows[0]; 
    }

    static async updateAboutInfo({ titulo, parrafo1, parrafo2, imagen_url1, imagen_url2, imagen_url3, imagen_url4 }) {
        // Usa placeholders de PostgreSQL ($1, $2, etc.)
        const result = await db.query(
            `UPDATE about_info SET
                titulo = $1,
                parrafo1 = $2,
                parrafo2 = $3,
                imagen_url1 = $4,
                imagen_url2 = $5,
                imagen_url3 = $6,
                imagen_url4 = $7
            WHERE id = 1`,
            [titulo, parrafo1, parrafo2, imagen_url1, imagen_url2, imagen_url3, imagen_url4]
        );

        // Usa 'rowCount' en lugar de 'affectedRows'
        if (result.rowCount === 0) {
            // Usa placeholders de PostgreSQL ($1, $2, etc.)
            const insertResult = await db.query(
                `INSERT INTO about_info (id, titulo, parrafo1, parrafo2, imagen_url1, imagen_url2, imagen_url3, imagen_url4)
                VALUES (1, $1, $2, $3, $4, $5, $6, $7)`, 
                [titulo, parrafo1, parrafo2, imagen_url1, imagen_url2, imagen_url3, imagen_url4]
            );
            // En PostgreSQL, el ID de inserción se obtiene con 'RETURNING'
            // En este caso, el ID es fijo (1), por lo que solo verificamos la inserción
            return insertResult.rowCount === 1; 
        }
        return true;
    }
}

module.exports = About;