// controllers/authController.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Usuario = require('../models/Usuario'); // Asegúrate de que este modelo exista
const Barbero = require('../models/Barbero'); // Asegúrate de que este modelo exista

exports.registrar = async (req, res, next) => {
    try {
        const { name, lastname, correo, password } = req.body; // El rol por defecto será 'cliente'

        if (!name || !lastname || !correo || !password) {
            return res.status(400).json({ message: 'Todos los campos son obligatorios para el registro.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Rol por defecto para un nuevo registro es 'cliente'
        const userRole = 'cliente'; 

        const newUser = await Usuario.create({ 
            name, 
            lastname, 
            correo, 
            password: hashedPassword, 
            role: userRole 
        });

        // Genera el token JWT
        const token = jwt.sign({ id: newUser.id, role: newUser.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.status(201).json({ 
            message: 'Usuario registrado exitosamente', 
            token, 
            user: { id: newUser.id, name: newUser.name, lastname: newUser.lastname, correo: newUser.correo, role: newUser.role } 
        });

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
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
        if (user.role === 'admin') { // Si el rol es 'admin', significa que es un barbero
            const barbero = await Barbero.getByUserId(user.id);
            if (barbero) {
                id_barbero = barbero.id;
            } else {
                // Esto debería ser un caso excepcional, un usuario admin sin registro de barbero
                console.warn(`Usuario admin (ID: ${user.id}) no tiene un registro de barbero asociado.`);
                // Opcional: Podrías crear el registro de barbero aquí automáticamente si prefieres
                // const newBarbero = await Barbero.create({ id_usuario: user.id, nombre: user.name, apellido: user.lastname, especialidad: 'General' });
                // id_barbero = newBarbero.id;
            }
        }
        
        // Payload para el token JWT: incluye id, role y, si es barbero, id_barbero.
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
                // Si existe id_barbero, lo incluye en la respuesta del usuario
                ...(id_barbero && { id_barbero: id_barbero }) 
            } 
        });

    } catch (error) {
        console.error('Error al iniciar sesión:', error);
        next(error);
    }
};

exports.getMe = async (req, res, next) => {
    try {
        // req.user ya está disponible por el middleware authenticateToken
        const user = await Usuario.findById(req.user.id); // Obtener todos los datos del usuario
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        let barberoInfo = null;
        if (user.role === 'admin') { // Si es un barbero, buscamos su información de barbero
            barberoInfo = await Barbero.getByUserId(user.id);
        }

        res.status(200).json({ 
            user: { 
                id: user.id, 
                name: user.name, 
                lastname: user.lastname, 
                correo: user.correo, 
                role: user.role,
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
