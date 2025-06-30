const db = require('../config/db'); 

class About {
    
    static async getAboutInfo() {
        const [info] = await db.query('SELECT titulo, parrafo1, parrafo2, imagen_url1, imagen_url2, imagen_url3, imagen_url4 FROM about_info LIMIT 1');
        return info[0]; 
    }

    static async updateAboutInfo({ titulo, parrafo1, parrafo2, imagen_url1, imagen_url2, imagen_url3, imagen_url4 }) {
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

        if (result.affectedRows === 0) {
            const [insertResult] = await db.query(
                `INSERT INTO about_info (id, titulo, parrafo1, parrafo2, imagen_url1, imagen_url2, imagen_url3, imagen_url4)
                VALUES (1, ?, ?, ?, ?, ?, ?, ?)`, 
                [titulo, parrafo1, parrafo2, imagen_url1, imagen_url2, imagen_url3, imagen_url4]
            );
            return insertResult.insertId === 1; 
        }
        return true;
    }
}

module.exports = About;