const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const Usuario = require('../models/Usuario');
const Barbero = require('../models/Barbero');
const emailSender = require('../utils/emailSender');
const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const cloudinary = require('../config/cloudinaryConfig');

const getBarberoIdForUser = async (userId, userRole) => {
    let barberoId = null;

    if (['barber', 'admin', 'super_admin'].includes(userRole)) {
        const barbero = await Barbero.getByUserId(userId);
        if (barbero) {
            barberoId = barbero.id;
        } else {

            const user = await Usuario.findById(userId);
            if (user) {
                const newBarbero = await Barbero.create({
                    id_usuario: userId,
                    nombre: user.name,
                    apellido: user.lastname,
                    especialidad: user.role 
                });
                barberoId = newBarbero.id;
                await Usuario.updateBarberoId(userId, barberoId);
                console.log(`Perfil de barbero creado automáticamente para el usuario ${user.correo}`);
            }
        }
    }
    return barberoId;
};

const getPublicIdFromCloudinaryUrl = (url) => {
    if (!url) return null;
    try {
        const urlParts = url.split('/');
        const uploadIndex = urlParts.indexOf('upload');
        if (uploadIndex > -1 && urlParts.length > uploadIndex + 1) {
            const pathAfterUpload = urlParts.slice(uploadIndex + 1).join('/');
            return pathAfterUpload.split('.')[0];
        }
    } catch (e) {
        console.error('Error al parsear URL de Cloudinary:', e);
    }
    return null;
};

const generateTokens = (payload) => {
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
    return { accessToken, refreshToken };
};


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
  
        const tokens = generateTokens({ id: newUser.id, role: newUser.role });

        await Usuario.setRefreshToken(newUser.id, tokens.refreshToken);

        res.status(201).json({
            message: 'Usuario registrado exitosamente',
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            user: { id: newUser.id, name: newUser.name, lastname: newUser.lastname, correo: newUser.correo, role: newUser.role }
        });

    } catch (error) {
        if (error.code === '23505') { 
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

        const id_barbero = await getBarberoIdForUser(user.id, user.role);

        const payload = {
            id: user.id,
            role: user.role,
            name: user.name,
            lastname: user.lastname,
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
                citas_completadas: user.citas_completadas || 0,
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
        let isNewUser = false;

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
                role: 'cliente'
            });
            isNewUser = true;
            console.log(`Nuevo usuario de Google creado: ${user.correo}`);
        } else {
            if (!user.google_id) {
                await Usuario.updateGoogleId(user.id, googleId);
                console.log(`Usuario existente ${user.correo} asociado con Google ID.`);
            }
            await Usuario.updateProfileFromGoogle(user.id, {
                name: given_name || name.split(' ')[0],
                lastname: family_name || name.split(' ').slice(1).join(' '),
                profilePicture: picture
            });

            if (!user.password) {
                isNewUser = true;
                console.log(`Usuario existente ${user.correo} sin contraseña local, se redirigirá para establecer una.`);
            }
        }

        if (isNewUser) {
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

            const userProfile = await Usuario.findById(user.id);

            const id_barbero = await getBarberoIdForUser(userProfile.id, userProfile.role);

            const appPayload = {
                id: userProfile.id,
                role: userProfile.role,
                name: userProfile.name,
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

        const id_barbero = await getBarberoIdForUser(user.id, user.role);

        const appPayload = {
            id: user.id,
            role: user.role,
            name: user.name,
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

    } catch (error) {
        console.error('Error al establecer la contraseña:', error);
        next(error);
    }
};

exports.updateProfile = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const updates = req.body;

        console.log('Datos recibidos para actualizar el perfil:', updates);
        console.log('Archivo subido:', req.file);

        let profilePictureUrl = updates.profilePictureUrl;

        if (req.file && req.file.path) {
            const user = await Usuario.findById(userId);
            if (user && user.profile_picture_url) {
                const publicIdToDelete = getPublicIdFromCloudinaryUrl(user.profile_picture_url);
                if (publicIdToDelete) {
                    try {
                        await cloudinary.uploader.destroy(publicIdToDelete);
                    } catch (destroyError) {
                        console.warn('Advertencia: No se pudo eliminar la imagen antigua de Cloudinary:', destroyError.message);
                    }
                }
            }
            profilePictureUrl = req.file.path;
        }

        if (Object.keys(updates).length === 0 && !req.file) {
            return res.status(400).json({ message: 'No se proporcionaron datos para actualizar el perfil.' });
        }

        const updated = await Usuario.updateProfile(userId, { ...updates, profilePictureUrl });

        if (updated) {
            const user = await Usuario.findById(userId);
            return res.status(200).json({
                message: 'Perfil actualizado exitosamente.',
                user: {
                    id: user.id,
                    name: user.name,
                    lastname: user.lastname,
                    correo: user.correo,
                    role: user.role,
                    profile_picture_url: user.profile_picture_url
                }
            });
        } else {
            return res.status(404).json({ message: 'Usuario no encontrado o no se pudo actualizar.' });
        }
    } catch (error) {
        console.error('Error al actualizar el perfil:', error);
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
        if (req.user.id_barbero) {
             barberoInfo = await Barbero.getById(req.user.id_barbero);
        } else {
            barberoInfo = await getBarberoIdForUser(user.id, user.role);
            if (barberoInfo) {
                barberoInfo = await Barbero.getById(barberoInfo);
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
                profileImage: user.profile_picture_url,
                ...(barberoInfo && { id_barbero: barberoInfo.id, especialidad: barberoInfo.especialidad })
            }
        });
    } catch (error) {
        console.error('Error al obtener perfil:', error);
        next(error);
    }
};

exports.getAllUsers = async (req, res, next) => {
    try {
        const users = await Usuario.getAllUsersWithBarberInfo();
        res.status(200).json(users);
    } catch (error) {
        console.error('Error al obtener todos los usuarios:', error);
        next(error);
    }
};

exports.updateUserRole = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { newRole, especialidad } = req.body;

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
                const newBarbero = await Barbero.create({
                    id_usuario: id,
                    nombre: user.name,
                    apellido: user.lastname,
                    especialidad: especialidad
                });
                await Usuario.updateBarberoId(id, newBarbero.id);
                message += ' Registro de barbero creado y asociado.';
            } else {
                message += ' Ya tenía un registro de barbero asociado.';
            }
        } else if (isChangingFromAdminOrBarber) {
            const existingBarbero = await Barbero.getByUserId(id);
            if (existingBarbero) {
                await Barbero.deleteBarbero(existingBarbero.id);
                await Usuario.updateBarberoId(id, null);
                message += ' Registro de barbero eliminado.';
            }
        }

        await Usuario.updateRole(id, newRole);

        res.status(200).json({ message: message });

    } catch (error) {
        console.error('Error al actualizar rol de usuario:', error);
        next(error);
    }
};

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

exports.refreshToken = async (req, res, next) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(401).json({ message: 'Token de actualización no proporcionado.' });
    }

    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const user = await Usuario.findByRefreshToken(refreshToken);

        if (!user) {
            return res.status(403).json({ message: 'Token de actualización inválido o no encontrado.' });
        }

        const id_barbero = await getBarberoIdForUser(user.id, user.role);
        const newPayload = {
            id: user.id,
            role: user.role,
            name: user.name,
            lastname: user.lastname,
            ...(id_barbero && { id_barbero: id_barbero })
        };

        const newAccessToken = jwt.sign(newPayload, process.env.JWT_SECRET, { expiresIn: '15m' });

        res.status(200).json({ accessToken: newAccessToken });

    } catch (error) {
        console.error('Error al refrescar el token:', error);
        return res.status(403).json({ message: 'Token de actualización inválido.' });
    }
};

exports.logout = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ message: 'No se proporcionó token de actualización.' });
        }

        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        await Usuario.clearRefreshToken(decoded.id);

        res.status(200).json({ message: 'Sesión cerrada exitosamente.' });

    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        next(error);
    }
};




