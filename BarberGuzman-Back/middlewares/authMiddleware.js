// middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

exports.authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; 

    if (token == null) {
        return res.status(401).json({ message: 'Acceso denegado. No se proporcionó token.' });
    }

    jwt.verify(token, process.env.JWT_SECRET, async (err, user) => {
        if (err) return res.sendStatus(403); // Token inválido

        // *** AÑADIR ESTO ***
        // Buscar el usuario en la base de datos para obtener el rol actualizado
        try {
            const fullUser = await Usuario.getById(user.id); // Asumiendo que tu token tiene el ID del usuario
            if (!fullUser) {
                return res.status(403).json({ message: 'Usuario no encontrado.' });
            }
            req.usuario = fullUser; // Adjuntar el objeto completo del usuario (con role) a la solicitud
            req.user = user; // Mantener req.user si lo usas en otras partes para el payload del token
            next();
        } catch (dbError) {
            console.error('Error al buscar usuario en DB para autenticación:', dbError);
            res.sendStatus(500); // Error interno del servidor
        }
    });
};

exports.authorizeRole = (roles) => { 
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(403).json({ message: 'Acceso denegado. Rol no definido.' });
        }
        
        const requiredRoles = Array.isArray(roles) ? roles : [roles];

        if (!requiredRoles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Acceso denegado. No tienes el rol requerido.' });
        }
        next();
    };
};