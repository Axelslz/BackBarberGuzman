const errorMiddleware = (err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
      mensaje: 'Ocurrió un error en el servidor',
      error: err.message
    });
  };
  
  module.exports = errorMiddleware;
  