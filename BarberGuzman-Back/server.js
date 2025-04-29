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
const errorMiddleware = require('./middlewares/errorMiddleware');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(helmet());
app.use(express.json());

app.use('/api/citas', citasRoutes);
app.use('/api/auth', authRoutes);

app.use(errorMiddleware);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Servidor corriendo en el puerto ${PORT}`));

