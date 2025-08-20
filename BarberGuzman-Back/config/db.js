const { Pool } = require('pg');
require('dotenv').config();
const bcrypt = require('bcryptjs');

const db = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 5432,
    ssl: {
        rejectUnauthorized: false
    }
});

async function initializeDatabase() {
    try {
        const client = await db.connect();
        console.log('Conexión a la base de datos PostgreSQL establecida correctamente.');

        // Sección de creación de tablas
        // 1. Tabla 'usuarios'
        const createUsersTableSql = `
            CREATE TABLE IF NOT EXISTS usuarios (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                lastname VARCHAR(100) NOT NULL,
                correo VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL DEFAULT 'cliente' CHECK (role IN ('cliente', 'admin', 'super_admin', 'barber')),
                citas_completadas INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                resetPasswordToken VARCHAR(255) DEFAULT NULL,
                resetPasswordExpires TIMESTAMP DEFAULT NULL,
                nombre_cliente VARCHAR(255) NULL,
                google_id VARCHAR(255) UNIQUE DEFAULT NULL,
                profile_picture_url VARCHAR(255) DEFAULT NULL
            );
        `;
        await client.query(createUsersTableSql);
        console.log('Tabla "usuarios" verificada/creada exitosamente.');

        // 2. Tabla 'barberos'
        const createBarbersTableSql = `
            CREATE TABLE IF NOT EXISTS barberos (
                id SERIAL PRIMARY KEY,
                id_usuario INT NOT NULL UNIQUE,
                nombre VARCHAR(100) NOT NULL,
                apellido VARCHAR(100) NOT NULL,
                especialidad VARCHAR(255) DEFAULT NULL,
                foto_perfil_url VARCHAR(255) DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                descripcion TEXT,
                FOREIGN KEY (id_usuario) REFERENCES usuarios(id) ON DELETE CASCADE
            );
        `;
        await client.query(createBarbersTableSql);
        console.log('Tabla "barberos" verificada/creada exitosamente.');

        // 3. Tabla 'servicios'
        const createServicesTableSql = `
            CREATE TABLE IF NOT EXISTS servicios (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL UNIQUE,
                descripcion TEXT,
                precio DECIMAL(10, 2) NOT NULL,
                duracion_minutos INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                tipo VARCHAR(50) NOT NULL DEFAULT 'individual' CHECK (tipo IN ('individual', 'paquete'))
            );
        `;
        await client.query(createServicesTableSql);
        console.log('Tabla "servicios" verificada/creada exitosamente.');

        // 4. Tabla 'citas'
        const createAppointmentsTableSql = `
            CREATE TABLE IF NOT EXISTS citas (
                id SERIAL PRIMARY KEY,
                id_cliente INT NOT NULL,
                id_barbero INT NOT NULL,
                id_servicio INT NOT NULL,
                fecha_cita DATE NOT NULL,
                hora_inicio TIME NOT NULL,
                hora_fin TIME NOT NULL,
                estado VARCHAR(50) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmada', 'cancelada', 'completada')),
                duracion_minutos INT NOT NULL DEFAULT 60,
                contador_actualizado BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (id_cliente) REFERENCES usuarios(id) ON DELETE CASCADE,
                FOREIGN KEY (id_barbero) REFERENCES barberos(id) ON DELETE CASCADE,
                FOREIGN KEY (id_servicio) REFERENCES servicios(id) ON DELETE CASCADE,
                UNIQUE (id_barbero, fecha_cita, hora_inicio)
            );
        `;
        await client.query(createAppointmentsTableSql);
        console.log('Tabla "citas" verificada/creada exitosamente.');

        // 5. Tabla 'horarios_no_disponibles_barberos'
        const createHorariosNoDisponiblesTableSql = `
            CREATE TABLE IF NOT EXISTS horarios_no_disponibles_barberos (
                id SERIAL PRIMARY KEY,
                id_barbero INT NOT NULL,
                fecha DATE NOT NULL,
                hora_inicio TIME DEFAULT NULL,
                hora_fin TIME DEFAULT NULL,
                motivo VARCHAR(255) DEFAULT NULL,
                creado_en TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (id_barbero) REFERENCES barberos(id) ON DELETE CASCADE,
                UNIQUE (id_barbero, fecha, hora_inicio, hora_fin)
            );
        `;
        await client.query(createHorariosNoDisponiblesTableSql);
        console.log('Tabla "horarios_no_disponibles_barberos" verificada/creada exitosamente.');

        // 6. Tabla 'about_info'
        const createAboutInfoTableSql = `
            CREATE TABLE IF NOT EXISTS about_info (
                id SERIAL PRIMARY KEY,
                titulo VARCHAR(255) NOT NULL,
                parrafo1 TEXT,
                parrafo2 TEXT,
                imagen_url1 VARCHAR(255) DEFAULT NULL,
                imagen_url2 VARCHAR(255) DEFAULT NULL,
                imagen_url3 VARCHAR(255) DEFAULT '',
                imagen_url4 VARCHAR(255) DEFAULT '',
                updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
            );
        `;
        await client.query(createAboutInfoTableSql);
        console.log('Tabla "about_info" verificada/creada exitosamente.');

        // Sección de inserción de datos iniciales
        // 1. Verificar si existen usuarios
        const { rows: users } = await client.query('SELECT COUNT(*) AS count FROM usuarios');
        if (users[0].count === 0) {
            console.log('No se encontraron usuarios, insertando datos iniciales...');
            
            // Hashear la contraseña (usa una real, o una temporal)
            const password = await bcrypt.hash('passwordSegura123', 10);

            // Insertar el super_admin
            const superAdmin = await client.query(
                'INSERT INTO usuarios (name, lastname, correo, password, role) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                ['Adrian', 'Guzman', 'guz.art.97@gmail.com', password, 'super_admin']
            );
            console.log(`Usuario Super Admin creado con ID: ${superAdmin.rows[0].id}`);

            // Insertar un usuario con rol 'barber'
            const barberUser = await client.query(
                'INSERT INTO usuarios (name, lastname, correo, password, role) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                ['Adrian', 'Guzman', 'guz.art.97@gmail.com', password, 'barber']
            );
            console.log(`Usuario Barbero creado con ID: ${barberUser.rows[0].id}`);

            // Asociar el usuario barbero con el perfil de barbero
            await client.query(
                'INSERT INTO barberos (id_usuario, nombre, apellido, especialidad) VALUES ($1, $2, $3, $4)',
                [barberUser.rows[0].id, 'Adrian', 'Guzman', 'Cortes Modernos']
            );
            console.log('Perfil de Barbero creado y asociado al usuario.');

        } else {
            console.log('Usuarios existentes. No se insertarán datos iniciales.');
        }

        // 2. Verificar si existen datos en 'about_info'
        const { rows: aboutInfo } = await client.query('SELECT COUNT(*) AS count FROM about_info');
        if (aboutInfo[0].count === 0) {
            await client.query(`
                INSERT INTO about_info (id, titulo, parrafo1, parrafo2, imagen_url1, imagen_url2, imagen_url3, imagen_url4)
                VALUES (1, 'Bienvenidos a nuestra Barbería', 'Somos un equipo de barberos apasionados por el arte del cuidado masculino. Ofrecemos cortes modernos, afeitados clásicos y tratamientos de barba personalizados para que siempre luzcas tu mejor versión.', 'En nuestra barbería, la tradición se encuentra con la innovación. Utilizamos productos de alta calidad y técnicas vanguardistas para garantizar resultados excepcionales y una experiencia inigualable en cada visita. ¡Te esperamos para transformar tu estilo!', '', '', '', '');
            `);
            console.log('Fila inicial insertada en "about_info".');
        }

        client.release();
    } catch (err) {
        console.error('Error FATAL al inicializar la base de datos o crear las tablas:', err.message);
        // process.exit(1); // Descomenta esta línea si quieres que la app se detenga si la conexión falla
    }
}

initializeDatabase();

module.exports = {
    query: (text, params) => db.query(text, params),
    client: db
};
