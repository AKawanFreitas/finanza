const express      = require('express');
const cors         = require('cors');
const authRoutes   = require('./routes/auth');
const adminRoutes  = require('./routes/admin');
const transactions = require('./routes/transactions');
const recorrentes  = require('./routes/recorrentes');
const categorias   = require('./routes/categorias');
const { limparExpiradas } = require('./lib/auth');

const app  = express();
const PORT = process.env.PORT || 4747;

// Em desenvolvimento o front chega pelo proxy do Vite, na mesma origem.
// CORS_ORIGIN libera origens externas específicas, com o cookie de sessão.
if (process.env.CORS_ORIGIN) {
  app.use(cors({ origin: process.env.CORS_ORIGIN.split(',').map(o => o.trim()), credentials: true }));
} else {
  app.use(cors());
}

app.use(express.json({ limit: '100kb' }));

app.use('/api/auth',         authRoutes);
app.use('/api/admin',        adminRoutes);
app.use('/api/transactions', transactions);
app.use('/api/recorrentes',  recorrentes);
app.use('/api/categorias',   categorias);

limparExpiradas();
setInterval(limparExpiradas, 6 * 60 * 60e3).unref();

app.listen(PORT, () => console.log(`Backend rodando em http://localhost:${PORT}`));
