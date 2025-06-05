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


        connection.release(); 
    } catch (err) {
        console.error('Error al inicializar la base de datos o crear las tablas:', err.message);
        process.exit(1);
    }
}

initializeDatabase(); 

module.exports = db; 