const { Pool } = require('pg');
require('dotenv').config();
const bcrypt = require('bcryptjs');

const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function initializeDatabase() {
    let client;
    try {
        client = await db.connect();
        console.log('Conexión a la base de datos PostgreSQL establecida correctamente.');

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
                google_id VARCHAR(255) UNIQUE DEFAULT NULL,
                profile_picture_url VARCHAR(255) DEFAULT NULL,
                telefono VARCHAR(20) DEFAULT NULL
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

        // AQUI ESTÁ LA PARTE CRUCIAL: Modificar la tabla 'usuarios' para agregar el id_barbero
        const checkColumnExistsSql = `
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'usuarios' AND column_name = 'id_barbero';
        `;
        const columnExists = await client.query(checkColumnExistsSql);

        if (columnExists.rowCount === 0) {
            console.log('La columna "id_barbero" no existe, agregándola a la tabla "usuarios"...');
            await client.query(`
                ALTER TABLE usuarios
                ADD COLUMN id_barbero INT NULL,
                ADD CONSTRAINT fk_id_barbero
                    FOREIGN KEY (id_barbero)
                    REFERENCES barberos(id)
                    ON DELETE SET NULL;
            `);
            console.log('Columna "id_barbero" agregada exitosamente.');
        } else {
            console.log('La columna "id_barbero" ya existe. No se realizaron cambios.');
        }

        // Sección de inserción de datos iniciales
        // Se insertarán solo si no hay usuarios existentes.
        const { rows: users } = await client.query('SELECT COUNT(*) AS count FROM usuarios');
        if (users[0].count === '0') {
            console.log('No se encontraron usuarios, insertando datos iniciales...');
            
            const password = await bcrypt.hash('passwordSegura123', 10);

            // Inicia una transacción para asegurar que todo el proceso sea atómico
            await client.query('BEGIN');
            
            try {
                // 1. Crear el usuario que será el super_admin y también el barbero principal
                const superAdminUser = await client.query(
                    'INSERT INTO usuarios (name, lastname, correo, password, role) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                    ['Adrian', 'Guzman', 'guz.art.97@gmail.com', password, 'super_admin']
                );
                const idUsuarioSuperAdmin = superAdminUser.rows[0].id;

                // 2. Crear el perfil de barbero y asociarlo al usuario super_admin
                const perfilBarbero = await client.query(
                    'INSERT INTO barberos (id_usuario, name, lastname,  especialidad) VALUES ($1, $2, $3, $4) RETURNING id',
                    [idUsuarioSuperAdmin, 'Adrian', 'Guzman', 'Cortes Modernos']
                );
                const idPerfilBarbero = perfilBarbero.rows[0].id;

                // 3. Actualizar el usuario super_admin para que apunte al id de su perfil de barbero
                await client.query(
                    'UPDATE usuarios SET id_barbero = $1 WHERE id = $2',
                    [idPerfilBarbero, idUsuarioSuperAdmin]
                );
                console.log(`Usuario Super Admin creado y asociado al perfil de barbero ID: ${idPerfilBarbero}`);

                // Insertar un usuario con rol 'admin' que no es barbero
                const adminUser = await client.query(
                    'INSERT INTO usuarios (name, lastname, correo, password, role) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                    ['Admin', 'Ejemplo', 'admin@example.com', password, 'admin']
                );
                console.log(`Usuario Admin creado con ID: ${adminUser.rows[0].id}`);

                // Insertar datos de 'about_info'
                await client.query(`
                    INSERT INTO about_info (id, titulo, parrafo1, parrafo2)
                    VALUES (1, 'Bienvenidos a nuestra Barbería', 'Somos un equipo de barberos apasionados por el arte del cuidado masculino. Ofrecemos cortes modernos, afeitados clásicos y tratamientos de barba personalizados para que siempre luzcas tu mejor versión.', 'En nuestra barbería, la tradición se encuentra con la innovación. Utilizamos productos de alta calidad y técnicas vanguardistas para garantizar resultados excepcionales y una experiencia inigualable en cada visita. ¡Te esperamos para transformar tu estilo!');
                `);
                console.log('Fila inicial insertada en "about_info".');

                // Insertar servicios iniciales
                await client.query(`
                    INSERT INTO servicios (nombre, descripcion, precio, duracion_minutos) VALUES
                    ('Corte de Cabello', 'Incluye lavado y peinado.', 10.00, 60),
                    ('Afeitado Clásico', 'Con toallas calientes y productos de alta calidad.', 8.00, 45),
                    ('Corte + Afeitado', 'Paquete completo para un cambio de look total.', 15.00, 90);
                `);
                console.log('Servicios iniciales insertados.');
                
                await client.query('COMMIT');
                console.log("¡Datos iniciales creados exitosamente!");

            } catch (initError) {
                await client.query('ROLLBACK');
                console.error('Error al poblar la base de datos, revirtiendo cambios:', initError);
                throw initError;
            }
        } else {
            console.log('Usuarios existentes. No se insertarán datos iniciales.');
        }

    } catch (err) {
        console.error('Error FATAL al inicializar la base de datos:', err.message);
    } finally {
        if (client) {
            client.release();
        }
    }
}

initializeDatabase();

module.exports = {
    query: (text, params) => db.query(text, params),
    client: db
};


