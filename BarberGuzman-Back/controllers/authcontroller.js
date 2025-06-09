const Usuario = require('../models/Usuario');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const registrar = async (req, res, next) => {
    try {
        const { name, lastname, correo, password, confirmPassword } = req.body; // No esperamos role ni id_barbero aquí

        if (password !== confirmPassword) {
            return res.status(400).json({ mensaje: 'Las contraseñas no coinciden' });
        }

        const usuarioExistente = await Usuario.buscarPorCorreo(correo);
        if (usuarioExistente) {
            return res.status(400).json({ mensaje: 'El correo ya está registrado' });
        }

        // El rol por defecto será 'cliente' desde el modelo.
        const nuevoUsuario = await Usuario.crear({ name, lastname, correo, password });

        const token = jwt.sign(
            { id: nuevoUsuario.id, role: nuevoUsuario.role }, // nuevoUsuario.role será 'cliente'
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.status(201).json({
            mensaje: 'Usuario registrado exitosamente',
            token,
            usuario: {
                id: nuevoUsuario.id,
                name: nuevoUsuario.name,
                correo: nuevoUsuario.correo,
                role: nuevoUsuario.role
            }
        });
    } catch (error) {
        console.error('Error en registro:', error);
        next(error);
    }
};


const login = async (req, res, next) => {
    try {
        const { correo, password } = req.body;

        const usuario = await Usuario.buscarPorCorreo(correo);

        if (!usuario) {
            return res.status(400).json({ mensaje: 'Credenciales inválidas' });
        }

        const passwordValido = await bcrypt.compare(password, usuario.password);

        if (!passwordValido) {
            return res.status(400).json({ mensaje: 'Credenciales inválidas' });
        }

        // Incluir id_barbero en el token si el usuario tiene uno asociado
        const tokenPayload = {
            id: usuario.id,
            role: usuario.role,
        };

        // ESTA ES LA PARTE CRUCIAL: Si el usuario logueado tiene un id_barbero en la DB,
        // lo agregamos al payload del token.
        if (usuario.id_barbero) {
            tokenPayload.id_barbero = usuario.id_barbero;
        }

        const token = jwt.sign(
            tokenPayload, // Usamos el payload modificado
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({
            mensaje: 'Login exitoso',
            token,
            usuario: {
                id: usuario.id,
                name: usuario.name,
                correo: usuario.correo,
                role: usuario.role,
                id_barbero: usuario.id_barbero // Devolvemos también el id_barbero si existe
            }
        });
    } catch (error) {
        next(error);
    }
};

const getMe = async (req, res, next) => {
    try {
        // req.user viene del middleware authenticateToken y contiene el ID del usuario
        const usuarioId = req.user.id;

        const usuario = await Usuario.buscarPorId(usuarioId); // <- Necesitarás un método buscarPorId en Usuario.js

        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
        }

        // Devolvemos la información relevante del usuario
        res.json({
            id: usuario.id,
            name: usuario.name,
            lastname: usuario.lastname,
            correo: usuario.correo,
            role: usuario.role,
            id_barbero: usuario.id_barbero,
            citas_completadas: usuario.citas_completadas // <- Aquí está el contador
        });
    } catch (error) {
        console.error('Error al obtener perfil del usuario:', error);
        next(error);
    }
};

module.exports = { registrar, login, getMe};
