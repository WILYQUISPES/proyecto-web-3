require('dotenv').config();
const express = require('express');
const cors = require('cors');

require('./config/db');

const authRoutes = require('./routes/auth');
const productsRoutes = require('./routes/products');
const suppliersRoutes = require('./routes/suppliers');
const materialsRoutes = require('./routes/materials');
const salesRoutes = require('./routes/sales');
const financeRoutes = require('./routes/finance');
const usersRoutes = require('./routes/users');
const logsRoutes = require('./routes/logs');
const statsRoutes = require('./routes/stats');

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.set('trust proxy', true);
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
  credentials: false
}));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'pasofirme-backend', time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/materials', materialsRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/stats', statsRoutes);

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

app.use((err, req, res, _next) => {
  console.error('[server] error:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`[server] PasoFirme API escuchando en http://localhost:${PORT}`);
});
