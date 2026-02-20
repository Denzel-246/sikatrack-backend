// ============================================================
// server.js — SikaTrack Backend
// ============================================================
require('dotenv').config();

const express  = require('express');
const cors     = require('cors');
const app      = express();
const PORT     = process.env.PORT || 3000;

/* ── Middleware ── */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ── Routes ── */
app.use('/auth',     require('./routes/auth'));
app.use('/sales',    require('./routes/sales'));
app.use('/expenses', require('./routes/expenses'));
app.use('/inventory',require('./routes/inventory'));
app.use('/payments', require('./routes/payments'));

/* ── Health check ── */
app.get('/', (req, res) => {
  res.json({
    app:     'SikaTrack API',
    version: '2.0.0',
    status:  'running',
    time:    new Date().toISOString()
  });
});

/* ── 404 handler ── */
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

/* ── Error handler ── */
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong' });
});

/* ── Start server ── */
app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════╗
  ║   SikaTrack API — Running! 🇬🇭   ║
  ║   http://localhost:${PORT}          ║
  ╚══════════════════════════════════╝
  `);
});

module.exports = app;
