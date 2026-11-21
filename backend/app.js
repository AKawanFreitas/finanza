// Monta o app Express sem abrir porta, para os testes importarem direto.
const express      = require('express');
const fs           = require('fs');
const path         = require('path');
const cors         = require('cors');
const helmet       = require('helmet');
const crypto       = require('crypto');
const pinoHttp     = require('pino-http');
const logger       = require('./lib/logger');
const { protegerCsrf } = require('./lib/csrf');
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

// Atrás de um proxy reverso (nginx, Caddy, balanceador), TRUST_PROXY=1 faz req.ip ser o do cliente real.
if (process.env.TRUST_PROXY) app.set('trust proxy', /^\d+$/.test(process.env.TRUST_PROXY) ? Number(process.env.TRUST_PROXY) : process.env.TRUST_PROXY);

// Um log por requisição, com id (aceita o X-Request-Id do proxy) devolvido no cabeçalho da resposta.
app.use(pinoHttp({
  logger,
  genReqId: (req, res) => {
    const id = String(req.headers['x-request-id'] || '').slice(0, 64) || crypto.randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  },
  autoLogging: { ignore: req => req.url === '/api/health' },
  customLogLevel: (req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
  serializers: {
    req: req => ({ id: req.id, method: req.method, url: req.url }),
    res: res => ({ status: res.statusCode }),
  },
}));

// Sem HTTPS (COOKIE_SECURE=false, uso local), "upgrade-insecure-requests" faria o navegador tentar https em localhost.
const semHttps = process.env.COOKIE_SECURE === 'false';
app.use(helmet({ contentSecurityPolicy: { directives: { 'upgrade-insecure-requests': semHttps ? null : [] } }, hsts: !semHttps }));

// Em desenvolvimento o front chega pelo proxy do Vite, na mesma origem.
// CORS_ORIGIN libera origens externas específicas, com o cookie de sessão.
if (process.env.CORS_ORIGIN) {
  app.use(cors({ origin: process.env.CORS_ORIGIN.split(',').map(o => o.trim()), credentials: true }));
} else {
  app.use(cors());
}

// Requisições que alteram dados precisam vir do próprio app. Vem antes de qualquer rota (inclusive a de importação).
app.use('/api', protegerCsrf);

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

// Em produção a própria API serve o front compilado (npm run build gera dist/). Sem dist/, só a API responde.
const dist = process.env.STATIC_DIR || path.join(__dirname, '..', 'dist');
if (fs.existsSync(path.join(dist, 'index.html'))) {
  app.use(express.static(dist, {
    index: false,
    setHeaders: (res, arquivo) => {
      // Arquivos em assets/ têm hash no nome: podem ficar em cache para sempre.
      res.setHeader('Cache-Control', arquivo.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'public, max-age=3600');
    },
  }));
  // Qualquer outra rota que não seja da API devolve o app (o React cuida da navegação).
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(dist, 'index.html'));
  });
}

// Erros não tratados viram JSON, sem vazar detalhes internos.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido.' });
  if (err.type === 'entity.too.large')    return res.status(413).json({ error: 'Requisição grande demais.' });
  req.log.error({ err }, 'erro não tratado');
  res.status(500).json({ error: 'Erro interno. Tente novamente.' });
});

module.exports = app;
