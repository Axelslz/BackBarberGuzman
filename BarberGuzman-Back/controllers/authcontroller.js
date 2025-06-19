const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const Usuario = require('../models/Usuario');
const Barbero = require('../models/Barbero');
const emailSender = require('../utils/emailSender');
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

exports.registrar = async (req, res, next) => {
    try {
        const { name, lastname, correo, password } = req.body;

        if (!name || !lastname || !correo || !password) {
            return res.status(400).json({ message: 'Todos los campos son obligatorios para el registro.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const userRole = 'cliente';

        const newUser = await Usuario.create({
            name,
            lastname,
            correo,
            password: hashedPassword,
            role: userRole
        });

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

        let id_barbero = null;
        if (user.role === 'admin') {
            const barbero = await Barbero.getByUserId(user.id);
            if (barbero) {
                id_barbero = barbero.id;
            } else {
                console.warn(`Usuario admin (ID: ${user.id}) no tiene un registro de barbero asociado.`);
            }
        }

        const payload = {
            id: user.id,
            role: user.role,
            ...(id_barbero && { id_barbero: id_barbero })
        };

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
                ...(id_barbero && { id_barbero: id_barbero })
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
            // Si el usuario no existe, regístralo
            console.log(`Usuario con correo ${email} no encontrado, creando nuevo registro.`);
            const firstName = given_name || name.split(' ')[0] || 'Usuario';
            const lastName = family_name || name.split(' ').slice(1).join(' ') || 'Google';

            user = await Usuario.createGoogleUser({
                googleId,
                name: firstName,
                lastname: lastName,
                correo: email,
                profilePicture: picture,
                role: 'cliente'
            });
            isNewUser = true; // Es un nuevo usuario
            console.log(`Nuevo usuario de Google creado: ${user.correo}`);
        } else {
            // Si el usuario existe, actualiza sus datos y asocia google_id si no lo tenía
            if (!user.google_id) {
                await Usuario.updateGoogleId(user.id, googleId);
                console.log(`Usuario existente ${user.correo} asociado con Google ID.`);
            }
            await Usuario.updateProfileFromGoogle(user.id, {
                name: given_name || name.split(' ')[0],
                lastname: family_name || name.split(' ').slice(1).join(' '),
                profilePicture: picture
            });
            // Si ya existe y no tiene contraseña local, también lo consideramos para la redirección
            if (!user.password) { // Assuming 'password' column is NULL for Google users without local password
                isNewUser = true;
                console.log(`Usuario existente ${user.correo} sin contraseña local, se redirigirá para establecer una.`);
            }
        }

        // Si es un usuario nuevo (o existente sin contraseña local), generamos un token temporal para establecer la contraseña
        if (isNewUser) {
            const setupToken = jwt.sign({ id: user.id, purpose: 'setup_password' }, process.env.JWT_SECRET, { expiresIn: '15m' }); // Token de corta duración
            return res.status(200).json({
                message: 'Usuario registrado con Google. Por favor, configura tu contraseña.',
                setupToken: setupToken, // Envía el token de configuración
                user: { // Envía información básica para el contexto de usuario en el frontend
                    id: user.id,
                    name: user.name,
                    lastname: user.lastname,
                    correo: user.correo,
                    role: user.role,
                },
                redirectRequired: true // Indica al frontend que debe redirigir
            });
        } else {
            // Si es un usuario existente con contraseña local, procede con el login normal
            const userProfile = await Usuario.findById(user.id); // Obtener el perfil completo

            let id_barbero = null;
            if (userProfile.role === 'admin') {
                const barbero = await Barbero.getByUserId(userProfile.id);
                if (barbero) {
                    id_barbero = barbero.id;
                }
            }

            const appPayload = {
                id: userProfile.id,
                role: userProfile.role,
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
                redirectRequired: false // No se requiere redirección
            });
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

        // Verificar si el usuario ya tiene una contraseña local (opcional, si quieres forzar solo una vez)
        // if (user.password) {
        //     return res.status(400).json({ message: 'Este usuario ya tiene una contraseña establecida.' });
        // }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await Usuario.updatePassword(user.id, hashedPassword); // Reusa la función de actualización de contraseña

        // Una vez establecida la contraseña, genera un JWT normal para el usuario
        let id_barbero = null;
        if (user.role === 'admin') {
            const barbero = await Barbero.getByUserId(user.id);
            if (barbero) {
                id_barbero = barbero.id;
            }
        }

        const appPayload = {
            id: user.id,
            role: user.role,
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

    } catch (error) {
        console.error('Error al establecer la contraseña:', error);
        next(error);
    }
};


exports.getMe = async (req, res, next) => {
    try {
        const user = await Usuario.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        let barberoInfo = null;
        if (user.role === 'admin') {
            barberoInfo = await Barbero.getByUserId(user.id);
        }

        res.status(200).json({
            user: {
                id: user.id,
                name: user.name,
                lastname: user.lastname,
                correo: user.correo,
                role: user.role,
                citas_completadas: user.citas_completadas || 0,
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
        const { newRole, especialidad } = req.body; // 'especialidad' solo es necesaria si newRole es 'admin'

        if (!newRole) {
            return res.status(400).json({ message: 'El nuevo rol es obligatorio.' });
        }

        // Obtener el usuario actual para saber su rol anterior
        const user = await Usuario.findById(id);
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        let message = `Rol de usuario ${user.correo} actualizado a ${newRole}.`;

        if (newRole === 'admin' && user.role !== 'admin') {
            // Si se cambia a 'admin' Y NO LO ERA antes, crear una entrada en la tabla 'barberos' si no existe
            const existingBarbero = await Barbero.getByUserId(id);
            if (!existingBarbero) {
                if (!especialidad) {
                    return res.status(400).json({ message: 'Especialidad es obligatoria al asignar rol de barbero.' });
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
        } else if (user.role === 'admin' && newRole !== 'admin') {
            // Si el rol anterior era 'admin' Y el nuevo NO lo es, eliminar el registro de barbero
            const existingBarbero = await Barbero.getByUserId(id);
            if (existingBarbero) {
                await Barbero.deleteBarbero(existingBarbero.id); // Elimina el barbero de la tabla barberos
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
            // Es buena práctica no revelar si el correo existe o no por razones de seguridad.
            // Siempre se devuelve un mensaje genérico de éxito.
            return res.status(200).json({ message: 'Si el correo electrónico está registrado, se te enviará un código para restablecer tu contraseña.' });
        }

        // === CAMBIOS AQUÍ ===
        // Generar un token de 5 dígitos numérico
        // Genera un número aleatorio entre 10000 y 99999 (ambos inclusive)
        const resetToken = Math.floor(10000 + Math.random() * 90000).toString();

        // Calcular la fecha de expiración del token (15 minutos a partir de ahora)
        const resetExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos en milisegundos

        // Guardar el token y su expiración en la base de datos para el usuario
        await Usuario.setResetToken(user.id, resetToken, resetExpires);

        // === CAMBIOS AQUÍ: El contenido del correo ahora incluye el código ===
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
            // No revelamos al usuario que el envío del correo falló por seguridad
            res.status(500).json({ message: 'Hubo un problema al intentar enviar el correo. Por favor, intenta de nuevo más tarde.' });
        }

    } catch (error) {
        console.error('Error en forgotPassword:', error);
        next(error);
    }
};

exports.resetPassword = async (req, res, next) => {
    try {
        // === CAMBIOS AQUÍ: Ahora el token viene del cuerpo (body) no de los parámetros (params) ===
        // Esto es porque el frontend enviará el código de 5 dígitos ingresado por el usuario
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ message: 'El código de restablecimiento y la nueva contraseña son obligatorios.' });
        }

        // Buscar el usuario por el token y verificar que no haya expirado
        const user = await Usuario.findByResetToken(token);

        if (!user) {
            return res.status(400).json({ message: 'Código de restablecimiento inválido o expirado.' });
        }

        // Encriptar la nueva contraseña
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Actualizar la contraseña del usuario
        await Usuario.updatePassword(user.id, hashedPassword);

        // Limpiar el token de restablecimiento del usuario en la base de datos
        await Usuario.clearResetToken(user.id);

        res.status(200).json({ message: 'Tu contraseña ha sido restablecida exitosamente.' });

    } catch (error) {
        console.error('Error en resetPassword:', error);
        next(error);
    }
};
