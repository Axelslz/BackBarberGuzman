const Usuario = require('../models/Usuario');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const registrar = async (req, res, next) => {
  try {
    const { name, lastname, correo, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      return res.status(400).json({ mensaje: 'Las contraseñas no coinciden' });
    }

    const usuarioExistente = await Usuario.buscarPorCorreo(correo);
    if (usuarioExistente) {
      return res.status(400).json({ mensaje: 'El correo ya está registrado' });
    }

    await Usuario.crear({ name, lastname, correo, password });

    res.json({ mensaje: 'Usuario registrado exitosamente' });
  } catch (error) {
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
  
      // Aquí generamos el token
      const token = jwt.sign(
        { id: usuario.id, role: usuario.role },  // <-- Incluimos el id y role
        process.env.JWT_SECRET,                 // <-- Secret que pondremos en .env
        { expiresIn: '8h' }                      // <-- El token durará 8 horas
      );
  
      res.json({
        mensaje: 'Login exitoso',
        token, // <-- Aquí enviamos también el token
        usuario: {
          id: usuario.id,
          name: usuario.name,
          correo: usuario.correo,
          role: usuario.role
        }
      });
    } catch (error) {
      next(error);
    }
  };

module.exports = { registrar, login };
