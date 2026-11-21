// Logs em JSON, uma linha por evento (fácil de filtrar em qualquer coletor).
// Nível: LOG_LEVEL, ou "info" (e "silent" nos testes). Cookies e cabeçalhos de autenticação nunca são registrados.
const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
  base: { app: 'finanza' },
  redact: { paths: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'], censor: '[oculto]' },
});

module.exports = logger;
