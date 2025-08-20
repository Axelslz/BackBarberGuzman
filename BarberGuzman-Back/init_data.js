const Usuario = require('./models/Usuario');
const Barbero = require('./models/Barbero');
const db = require('./config/db'); // Asume que tienes una conexión a la BD en config/db.js
const bcrypt = require('bcryptjs');

async function initData() {
    try {
        console.log("Iniciando la siembra de datos...");

        // 1. Hashear las contraseñas
        const hashedPassword = await bcrypt.hash('password-segura', 10);

        // 2. Crear los usuarios
        const superAdminUser = await Usuario.create({
            name: 'Adrian',
            lastname: 'Guzman',
            correo: 'guz.art.97@gmail.com',
            password: hashedPassword,
            role: 'super_admin'
        });
        console.log(`Usuario Super Admin creado con ID: ${superAdminUser.id}`);

        const barberUser = await Usuario.create({
            name: 'Adrian',
            lastname: 'Guzman',
            correo: 'guz.art.97@gmail.com',
            password: hashedPassword,
            role: 'barber'
        });
        console.log(`Usuario Barbero creado con ID: ${barberUser.id}`);

        // 3. Asociar el usuario barbero con el perfil de barbero
        const barberProfile = await Barbero.create({
            id_usuario: barberUser.id,
            nombre: barberUser.name,
            apellido: barberUser.lastname,
            especialidad: 'Corte Clásico',
            foto_perfil_url: null
        });
        console.log(`Perfil de Barbero creado con ID: ${barberProfile.id}`);

        console.log("¡Datos iniciales creados exitosamente!");

    } catch (error) {
        console.error('Error al poblar la base de datos:', error);
    } finally {
        // Asegúrate de cerrar la conexión de la base de datos si es necesario
        db.end();
    }
}

initData();