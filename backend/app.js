// Monta o app Express sem abrir porta, para os testes importarem direto.
const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const authRoutes   = require('./routes/auth');
const adminRoutes  = require('./routes/admin');
const transactions = require('./routes/transactions');
const recorrentes  = require('./routes/recorrentes');
const categorias   = require('./routes/categorias');
const contas       = require('./routes/contas');
const transferencias = require('./routes/transferencias');
const resumo       = require('./routes/resumo');
const importacao   = require('./routes/importacao');
const orcamentos   = require('./routes/orcamentos');
const exportacao   = require('./routes/exportacao');

const app = express();

app.use(helmet());

// Em desenvolvimento o front chega pelo proxy do Vite, na mesma origem.
// CORS_ORIGIN libera origens externas específicas, com o cookie de sessão.
if (process.env.CORS_ORIGIN) {
  app.use(cors({ origin: process.env.CORS_ORIGIN.split(',').map(o => o.trim()), credentials: true }));
} else {
  app.use(cors());
}

// O arquivo do extrato vai no corpo da requisição: esta rota aceita mais que o limite geral.
app.use('/api/importacao', express.json({ limit: '3mb' }), importacao);

app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth',         authRoutes);
app.use('/api/admin',        adminRoutes);
app.use('/api/transactions', transactions);
app.use('/api/recorrentes',  recorrentes);
app.use('/api/categorias',   categorias);
app.use('/api/contas',       contas);
app.use('/api/transferencias', transferencias);
app.use('/api/resumo',       resumo);
app.use('/api/orcamentos',   orcamentos);
app.use('/api/exportacao',   exportacao);

app.use('/api', (req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));

// Erros não tratados viram JSON, sem vazar detalhes internos.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido.' });
  if (err.type === 'entity.too.large')    return res.status(413).json({ error: 'Requisição grande demais.' });
  console.error(err);
  res.status(500).json({ error: 'Erro interno. Tente novamente.' });
});

module.exports = app;
