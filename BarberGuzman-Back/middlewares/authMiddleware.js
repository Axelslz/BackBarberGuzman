const jwt = require('jsonwebtoken');

exports.authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        return res.status(401).json({ message: 'Acceso denegado. No se proporcionó token.' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decodedUser) => {
        if (err) {
            
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'Token expirado. Refresque la sesión.', isExpired: true });
            }
            if (err.name === 'JsonWebTokenError') {
                return res.status(403).json({ message: 'Token inválido. Acceso denegado.' });
            }
            return res.sendStatus(403); 
        }
        req.user = decodedUser;
        next();
    });
};

exports.authorizeRole = (roles) => {
    return (req, res, next) => {
        
        if (!req.user || !req.user.role) {
            return res.status(403).json({ message: 'Acceso denegado. Rol no definido en el token.' });
        }

        const requiredRoles = Array.isArray(roles) ? roles : [roles];

        if (!requiredRoles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Acceso denegado. No tienes el rol requerido.' });
        }
        next();
    };
};