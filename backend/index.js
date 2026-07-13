const express = require('express');
const cors = require('cors');
const { pool } = require('./db');
const routes = require('./src/routes');
const errorHandler = require('./src/middleware/errorHandler');
const config = require('./src/config/env');

const app = express();
const PORT = config.port;

app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ status: 'ok', message: 'Kaapi POS API is running' });
});

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', db: 'disconnected', error: err.message });
  }
});

app.use('/v1', routes);

app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
