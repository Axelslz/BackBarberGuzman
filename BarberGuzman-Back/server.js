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
const chatBotRoutes = require('./routes/chatBotRoutes'); 
require('dotenv').config();
const path = require('path');
const bodyParser = require('body-parser'); 
const app = express();
const port = process.env.PORT || 3000;

const corsOptions = {
  origin: 'https://guzmanbarberweb.netlify.app/'
};
app.use(cors(corsOptions));

app.use(helmet());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false })); 
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/barberos', barberRoutes);
app.use('/api/servicios', servicioRoutes);
app.use('/api/citas', citasRoutes);
app.use('/api/about', aboutRoutes);
app.use('/api/chatbot', chatBotRoutes); 

app.use(errorMiddleware);

app.listen(port, () => {
    console.log(`Servidor corriendo en el puerto ${port}`);
    startScheduler();
});
