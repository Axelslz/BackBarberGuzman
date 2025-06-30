const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const Usuario = require('../models/Usuario');
const Barbero = require('../models/Barbero'); // Asegúrate de que el modelo Barbero se importe correctamente
const emailSender = require('../utils/emailSender');
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Función auxiliar para obtener id_barbero, usada en varios lugares
const getBarberoIdForUser = async (userId, userRole) => {
    let barberoId = null;
    // Solo si el rol es 'barber', 'admin' o 'super_admin' buscamos un id_barbero asociado
    if (['barber', 'admin', 'super_admin'].includes(userRole)) {
        const barbero = await Barbero.getByUserId(userId);
        if (barbero) {
            barberoId = barbero.id;
        } else {
            // Esto es un console.warn si un admin/super_admin no tiene perfil de barbero
            // Es informativo, no un error que deba detener la ejecución
            if (userRole !== 'barber') { // Solo advertir si no es un rol de barbero primario
                console.warn(`Usuario ${userRole} (ID: ${userId}) no tiene un registro de barbero asociado.`);
            }
        }
    }
    return barberoId;
};


exports.registrar = async (req, res, next) => {
    try {
        const { name, lastname, correo, password } = req.body;

        if (!name || !lastname || !correo || !password) {
            return res.status(400).json({ message: 'Todos los campos son obligatorios para el registro.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const userRole = 'cliente'; // Por defecto, se registra como cliente

        const newUser = await Usuario.create({
            name,
            lastname,
            correo,
            password: hashedPassword,
            role: userRole
        });

        // Al registrar un nuevo cliente, no hay id_barbero asociado.
        const token = jwt.sign({ id: newUser.id, role: newUser.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.status(201).json({
            message: 'Usuario registrado exitosamente',
            token,
            user: { id: newUser.id, name: newUser.name, lastname: newUser.lastname, correo: newUser.correo, role: newUser.role }
        });

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
            return res.status(409).json({ message: 'El correo electrónico ya está registrado.' });
        }
        console.error('Error al registrar usuario:', error);
        next(error);
    }
};

exports.login = async (req, res, next) => {
    try {
        const { correo, password } = req.body;

        const user = await Usuario.findByCorreo(correo);
        if (!user) {
            return res.status(400).json({ message: 'Credenciales inválidas.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Credenciales inválidas.' });
        }

        // --- INICIO DE LA CORRECCIÓN CRÍTICA ---
        const id_barbero = await getBarberoIdForUser(user.id, user.role);

        const payload = {
            id: user.id,
            role: user.role,
            name: user.name, // Añadimos name y lastname al payload
            lastname: user.lastname, // para que esten disponibles en req.user
            ...(id_barbero && { id_barbero: id_barbero }) // Solo añade si id_barbero no es null
        };
        // --- FIN DE LA CORRECCIÓN CRÍTICA ---

        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.status(200).json({
            message: 'Inicio de sesión exitoso',
            token,
            user: {
                id: user.id,
                name: user.name,
                lastname: user.lastname,
                correo: user.correo,
                role: user.role,
                citas_completadas: user.citas_completadas || 0, // Asegúrate de que este campo exista en tu modelo Usuario si lo quieres aquí
                ...(id_barbero && { id_barbero: id_barbero }) // Solo añade si id_barbero no es null
            }
        });

    } catch (error) {
        console.error('Error al iniciar sesión:', error);
        next(error);
    }
};

exports.googleLogin = async (req, res, next) => {
    try {
        const { googleToken } = req.body;

        if (!googleToken) {
            return res.status(400).json({ message: 'No se proporcionó el token de Google.' });
        }

        const ticket = await googleClient.verifyIdToken({
            idToken: googleToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const { sub: googleId, email, name, given_name, family_name, picture } = payload;

        let user = await Usuario.findByCorreo(email);
        let isNewUser = false; // Bandera para saber si es un nuevo usuario

        if (!user) {
            console.log(`Usuario con correo ${email} no encontrado, creando nuevo registro.`);
            const firstName = given_name || name.split(' ')[0] || 'Usuario';
            const lastName = family_name || name.split(' ').slice(1).join(' ') || 'Google';

            user = await Usuario.createGoogleUser({
                googleId,
                name: firstName,
                lastname: lastName,
                correo: email,
                profilePicture: picture,
                role: 'cliente' // Los usuarios de Google por defecto son clientes
            });
            isNewUser = true;
            console.log(`Nuevo usuario de Google creado: ${user.correo}`);
        } else {
            if (!user.google_id) {
                await Usuario.updateGoogleId(user.id, googleId);
                console.log(`Usuario existente ${user.correo} asociado con Google ID.`);
            }
            // Actualizar datos del perfil con info más reciente de Google
            await Usuario.updateProfileFromGoogle(user.id, {
                name: given_name || name.split(' ')[0],
                lastname: family_name || name.split(' ').slice(1).join(' '),
                profilePicture: picture
            });

            // Si es un usuario existente pero no tiene contraseña local, sigue siendo considerado para "establecer contraseña"
            if (!user.password) {
                isNewUser = true; // Forzar redirección para establecer contraseña
                console.log(`Usuario existente ${user.correo} sin contraseña local, se redirigirá para establecer una.`);
            }
        }

        if (isNewUser) {
            // Genera un token temporal para establecer la contraseña
            const setupToken = jwt.sign({ id: user.id, purpose: 'setup_password' }, process.env.JWT_SECRET, { expiresIn: '15m' });
            return res.status(200).json({
                message: 'Usuario registrado con Google. Por favor, configura tu contraseña.',
                setupToken: setupToken,
                user: {
                    id: user.id,
                    name: user.name,
                    lastname: user.lastname,
                    correo: user.correo,
                    role: user.role,
                },
                redirectRequired: true
            });
        } else {
            // --- INICIO DE LA CORRECCIÓN CRÍTICA para usuarios de Google existentes ---
            // Si es un usuario existente con contraseña local, procede con el login normal
            // Necesitamos obtener el perfil completo de la DB para asegurarnos de tener el rol actual
            const userProfile = await Usuario.findById(user.id);

            const id_barbero = await getBarberoIdForUser(userProfile.id, userProfile.role);

            const appPayload = {
                id: userProfile.id,
                role: userProfile.role,
                name: userProfile.name, // Añadimos name y lastname al payload
                lastname: userProfile.lastname,
                ...(id_barbero && { id_barbero: id_barbero })
            };
            const appToken = jwt.sign(appPayload, process.env.JWT_SECRET, { expiresIn: '1h' });

            res.status(200).json({
                message: 'Inicio de sesión con Google exitoso',
                token: appToken,
                user: {
                    id: userProfile.id,
                    name: userProfile.name,
                    lastname: userProfile.lastname,
                    correo: userProfile.correo,
                    role: userProfile.role,
                    citas_completadas: userProfile.citas_completadas || 0,
                    ...(id_barbero && { id_barbero: id_barbero })
                },
                redirectRequired: false
            });
            // --- FIN DE LA CORRECCIÓN CRÍTICA ---
        }

    } catch (error) {
        console.error('Error en Google Login:', error);
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'El token de Google ha expirado.' });
        } else if (error.message.includes('No matching audience') || error.message.includes('Invalid token signature')) {
            return res.status(401).json({ message: 'Token de Google inválido.' });
        }
        next(error);
    }
};

// NUEVA FUNCIÓN PARA ESTABLECER LA CONTRASEÑA INICIAL
exports.setPassword = async (req, res, next) => {
    try {
        const { setupToken, newPassword } = req.body;

        if (!setupToken || !newPassword) {
            return res.status(400).json({ message: 'Token de configuración y nueva contraseña son obligatorios.' });
        }

        let decoded;
        try {
            decoded = jwt.verify(setupToken, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(401).json({ message: 'Token de configuración inválido o expirado.' });
        }

        if (decoded.purpose !== 'setup_password') {
            return res.status(403).json({ message: 'Token de propósito incorrecto.' });
        }

        const user = await Usuario.findById(decoded.id);
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await Usuario.updatePassword(user.id, hashedPassword);

        // --- INICIO DE LA CORRECCIÓN CRÍTICA ---
        // Una vez establecida la contraseña, genera un JWT normal para el usuario
        const id_barbero = await getBarberoIdForUser(user.id, user.role);

        const appPayload = {
            id: user.id,
            role: user.role,
            name: user.name, // Añadimos name y lastname al payload
            lastname: user.lastname,
            ...(id_barbero && { id_barbero: id_barbero })
        };
        const appToken = jwt.sign(appPayload, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.status(200).json({
            message: 'Contraseña establecida exitosamente. Inicio de sesión automático.',
            token: appToken,
            user: {
                id: user.id,
                name: user.name,
                lastname: user.lastname,
                correo: user.correo,
                role: user.role,
                citas_completadas: user.citas_completadas || 0,
                ...(id_barbero && { id_barbero: id_barbero })
            }
        });
        // --- FIN DE LA CORRECCIÓN CRÍTICA ---

    } catch (error) {
        console.error('Error al establecer la contraseña:', error);
        next(error);
    }
};


exports.getMe = async (req, res, next) => {
    try {
        // En este punto, req.user ya viene del JWT decodificado por authenticateToken
        // que ya incluye id_barbero si se seteó al login.
        // Solo necesitamos buscar el usuario completo de la DB para otros detalles.
        const user = await Usuario.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        // El id_barbero ya debería estar en req.user si el token fue generado correctamente.
        // Pero para asegurar que los datos del barbero (ej. especialidad) estén completos
        // si el usuario es un barbero/admin con perfil de barbero, los obtenemos de nuevo.
        let barberoInfo = null;
        if (req.user.id_barbero) { // Si el token ya tenía id_barbero
             barberoInfo = await Barbero.getById(req.user.id_barbero);
        } else { // Si no lo tenía, pero el rol es uno que podría tenerlo
            barberoInfo = await getBarberoIdForUser(user.id, user.role); // Usamos la función auxiliar
            if (barberoInfo) {
                barberoInfo = await Barbero.getById(barberoInfo); // Obtener el objeto completo del barbero
            }
        }


        res.status(200).json({
            user: {
                id: user.id,
                name: user.name,
                lastname: user.lastname,
                correo: user.correo,
                role: user.role,
                citas_completadas: user.citas_completadas || 0,
                // Si barberoInfo existe, adjuntamos su ID y especialidad
                ...(barberoInfo && { id_barbero: barberoInfo.id, especialidad: barberoInfo.especialidad })
            }
        });
    } catch (error) {
        console.error('Error al obtener perfil:', error);
        next(error);
    }
};

// *** NUEVOS CONTROLADORES PARA SUPER_ADMIN ***

exports.getAllUsers = async (req, res, next) => {
    try {
        // Solo super_admin puede acceder a esta ruta (autorizado por middleware)
        const users = await Usuario.getAllUsersWithBarberInfo();
        res.status(200).json(users);
    } catch (error) {
        console.error('Error al obtener todos los usuarios:', error);
        next(error);
    }
};

exports.updateUserRole = async (req, res, next) => {
    try {
        const { id } = req.params; // ID del usuario a actualizar
        const { newRole, especialidad } = req.body; // 'especialidad' solo es necesaria si newRole es 'admin' o 'barber'

        if (!newRole) {
            return res.status(400).json({ message: 'El nuevo rol es obligatorio.' });
        }

        const user = await Usuario.findById(id);
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        let message = `Rol de usuario ${user.correo} actualizado a ${newRole}.`;

        const isChangingToAdminOrBarber = (newRole === 'admin' || newRole === 'barber') && !(user.role === 'admin' || user.role === 'barber');
        const isChangingFromAdminOrBarber = !(newRole === 'admin' || newRole === 'barber') && (user.role === 'admin' || user.role === 'barber');

        if (isChangingToAdminOrBarber) {
            const existingBarbero = await Barbero.getByUserId(id);
            if (!existingBarbero) {
                if (!especialidad) {
                    return res.status(400).json({ message: 'Especialidad es obligatoria al asignar rol de barbero o admin con perfil de barbero.' });
                }
                await Barbero.create({
                    id_usuario: id,
                    nombre: user.name,
                    apellido: user.lastname,
                    especialidad: especialidad
                });
                message += ' Registro de barbero creado.';
            } else {
                message += ' Ya tenía un registro de barbero asociado.';
            }
        } else if (isChangingFromAdminOrBarber) {
            const existingBarbero = await Barbero.getByUserId(id);
            if (existingBarbero) {
                // Considera si realmente quieres ELIMINAR el registro de barbero.
                // A veces, solo se "desactiva" o se mantiene por historial.
                // Por ahora, lo eliminamos como tu código original.
                await Barbero.deleteBarbero(existingBarbero.id);
                message += ' Registro de barbero eliminado.';
            }
        }

        // Actualizar el rol en la tabla de usuarios
        await Usuario.updateRole(id, newRole);

        res.status(200).json({ message: message });

    } catch (error) {
        console.error('Error al actualizar rol de usuario:', error);
        next(error);
    }
};

// --- NUEVAS FUNCIONES PARA EL RESTABLECIMIENTO DE CONTRASEÑA ---

exports.forgotPassword = async (req, res, next) => {
    try {
        const { correo } = req.body;

        if (!correo) {
            return res.status(400).json({ message: 'Por favor, proporciona tu correo electrónico.' });
        }

        const user = await Usuario.findByCorreo(correo);
        if (!user) {
            return res.status(200).json({ message: 'Si el correo electrónico está registrado, se te enviará un código para restablecer tu contraseña.' });
        }

        const resetToken = Math.floor(10000 + Math.random() * 90000).toString();
        const resetExpires = new Date(Date.now() + 15 * 60 * 1000);

        await Usuario.setResetToken(user.id, resetToken, resetExpires);

        const emailContent = `
            <h1>Restablecimiento de Contraseña para BarberGuzman</h1>
            <p>Has solicitado restablecer tu contraseña. Tu código de restablecimiento es:</p>
            <h2 style="color: #007bff; font-size: 24px;">${resetToken}</h2>
            <p>Ingresa este código en la aplicación para restablecer tu contraseña.</p>
            <p>Este código es válido por 15 minutos.</p>
            <p>Si no solicitaste esto, por favor, ignora este correo.</p>
        `;

        try {
            await emailSender.sendEmail(user.correo, 'Código de Restablecimiento de Contraseña de BarberGuzman', emailContent);
            res.status(200).json({ message: 'Si el correo electrónico está registrado, se te enviará un código para restablecer tu contraseña.' });
        } catch (emailError) {
            console.error('Error al enviar el correo de restablecimiento:', emailError);
            res.status(500).json({ message: 'Hubo un problema al intentar enviar el correo. Por favor, intenta de nuevo más tarde.' });
        }

    } catch (error) {
        console.error('Error en forgotPassword:', error);
        next(error);
    }
};

exports.resetPassword = async (req, res, next) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ message: 'El código de restablecimiento y la nueva contraseña son obligatorios.' });
        }

        const user = await Usuario.findByResetToken(token);

        if (!user) {
            return res.status(400).json({ message: 'Código de restablecimiento inválido o expirado.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await Usuario.updatePassword(user.id, hashedPassword);
        await Usuario.clearResetToken(user.id);

        res.status(200).json({ message: 'Tu contraseña ha sido restablecida exitosamente.' });

    } catch (error) {
        console.error('Error en resetPassword:', error);
        next(error);
    }
};
