
const jwt = require('jsonwebtoken');

exports.authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Formato: Bearer TOKEN

    if (token == null) {
        return res.status(401).json({ message: 'Acceso denegado. No se proporcionó token.' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.error('Error al verificar token:', err);
            return res.status(403).json({ message: 'Token inválido o expirado.' });
        }
        req.user = user; // Almacena la información del usuario en el objeto de la petición
        next();
    });
};

exports.authorizeRole = (roles) => { // roles puede ser un string 'admin' o un array ['admin', 'barbero']
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