const permitirRoles = (...roles) => {
    return (req, res, next) => {
      if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ mensaje: 'No tienes permisos para realizar esta acción' });
      }
      next();
    };
  };
  
  module.exports = { permitirRoles };
  