// import express from 'express';
// import cors from 'cors';
// import citasRoutes from './routes/citasRoutes.js';
// import db from './config/database.js';

// const app = express();
// const PORT = process.env.PORT || 5000;

// // Middlewares
// app.use(cors({
//   origin: '*', // puedes cambiar luego por seguridad
// }));
// app.use(express.json());

// // Rutas
// app.use('/api/citas', citasRoutes);

// // Conexión a la base de datos
// db.authenticate()
//   .then(() => console.log('Conectado a la base de datos'))
//   .catch(err => console.log('Error de conexión:', err));

// // Levantar servidor
// app.listen(PORT, () => {
//   console.log(`Servidor corriendo en el puerto ${PORT}`);
// });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const citasRoutes = require('./routes/citasRoutes');
const authRoutes = require('./routes/authRoutes');
const barberRoutes = require('./routes/barberRoutes'); 
const servicioRoutes = require('./routes/servicioRoutes'); 
const errorMiddleware = require('./middlewares/errorMiddleware');
const { startScheduler } = require('./utils/scheduler');
const aboutRoutes = require('./routes/aboutRoutes');
require('dotenv').config();
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(helmet());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/barberos', barberRoutes); 
app.use('/api/servicios', servicioRoutes); 
app.use('/api/citas', citasRoutes);
app.use('/api/about', aboutRoutes);

app.use(errorMiddleware);

app.listen(port, () => {
    console.log(`Servidor corriendo en el puerto ${port}`);
    startScheduler();
});

