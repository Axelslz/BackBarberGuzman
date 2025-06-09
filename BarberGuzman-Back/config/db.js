const mysql = require('mysql2/promise');
require('dotenv').config();

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function initializeDatabase() {
    try {
        const connection = await db.getConnection();
        console.log('Conexión a la base de datos MySQL establecida correctamente.');

        // SQL para crear la tabla 'usuarios' si no existe
        const createUsersTableSql = `
            CREATE TABLE IF NOT EXISTS usuarios (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                lastname VARCHAR(100) NOT NULL,
                correo VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                role ENUM('cliente', 'admin') NOT NULL DEFAULT 'cliente',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;
        await connection.execute(createUsersTableSql);
        console.log('Tabla "usuarios" verificada/creada exitosamente.');

        // SQL para crear la tabla 'barberos' si no existe
        const createBarbersTableSql = `
            CREATE TABLE IF NOT EXISTS barberos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL,
                apellido VARCHAR(100) NOT NULL,
                especialidad VARCHAR(255),
                foto_perfil_url VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;
        await connection.execute(createBarbersTableSql);
        console.log('Tabla "barberos" verificada/creada exitosamente.');

        // SQL para crear la tabla 'servicios' si no existe
        const createServicesTableSql = `
            CREATE TABLE IF NOT EXISTS servicios (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL UNIQUE,
                descripcion TEXT,
                precio DECIMAL(10, 2) NOT NULL,
                duracion_minutos INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;
        await connection.execute(createServicesTableSql);
        console.log('Tabla "servicios" verificada/creada exitosamente.');

        // SQL para crear la tabla 'citas' si no existe
        const createAppointmentsTableSql = `
            CREATE TABLE IF NOT EXISTS citas (
                id INT AUTO_INCREMENT PRIMARY KEY,
                id_cliente INT NOT NULL,
                id_barbero INT NOT NULL,
                id_servicio INT NOT NULL,
                fecha_cita DATE NOT NULL,
                hora_inicio TIME NOT NULL,
                hora_fin TIME NOT NULL,
                estado ENUM('pendiente', 'confirmada', 'cancelada', 'completada') NOT NULL DEFAULT 'pendiente',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (id_cliente) REFERENCES usuarios(id) ON DELETE CASCADE,
                FOREIGN KEY (id_barbero) REFERENCES barberos(id) ON DELETE CASCADE,
                FOREIGN KEY (id_servicio) REFERENCES servicios(id) ON DELETE CASCADE,
                UNIQUE (id_barbero, fecha_cita, hora_inicio) -- Evitar doble reserva para el mismo barbero/hora
            );
        `;
        await connection.execute(createAppointmentsTableSql);
        console.log('Tabla "citas" verificada/creada exitosamente.');

        // SQL para crear la tabla 'about_info' si no existe
        const createAboutInfoTableSql = `
            CREATE TABLE IF NOT EXISTS about_info (
                id INT AUTO_INCREMENT PRIMARY KEY,
                titulo VARCHAR(255) NOT NULL,
                parrafo1 TEXT,
                parrafo2 TEXT,
                imagen_url1 VARCHAR(255),
                imagen_url2 VARCHAR(255),
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            );
        `;
        await connection.execute(createAboutInfoTableSql);
        console.log('Tabla "about_info" verificada/creada exitosamente.');

        // Opcional: Insertar una fila inicial si la tabla está vacía
        const [rows] = await connection.query('SELECT COUNT(*) AS count FROM about_info');
        if (rows[0].count === 0) {
            await connection.execute(`
                INSERT INTO about_info (id, titulo, parrafo1, parrafo2, imagen_url1, imagen_url2)
                VALUES (1, 'Bienvenidos a nuestra Barbería', 'Somos un equipo de barberos apasionados por el arte del cuidado masculino. Ofrecemos cortes modernos, afeitados clásicos y tratamientos de barba personalizados para que siempre luzcas tu mejor versión.', 'En nuestra barbería, la tradición se encuentra con la innovación. Utilizamos productos de alta calidad y técnicas vanguardistas para garantizar resultados excepcionales y una experiencia inigualable en cada visita. ¡Te esperamos para transformar tu estilo!', '', '');
            `);
            console.log('Fila inicial insertada en "about_info".');
        }

        connection.release(); 
    } catch (err) {
        console.error('Error al inicializar la base de datos o crear las tablas:', err.message);
        process.exit(1);
    }
}

initializeDatabase(); 

module.exports = db; 