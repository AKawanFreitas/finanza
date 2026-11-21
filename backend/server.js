// O .env precisa ser lido antes de qualquer outro módulo (db.js lê DB_PATH ao ser carregado).
require('./lib/env').carregarEnv();

const app = require('./app');
const { iniciarAgendador } = require('./lib/agendador');
const logger = require('./lib/logger');
const { criarContasIniciais } = require('./lib/bootstrap');

const PORT = process.env.PORT || 4747;

try { criarContasIniciais(); } catch (err) { logger.error({ err }, 'falha ao criar as contas iniciais'); }
iniciarAgendador();

app.listen(PORT, () => logger.info({ port: Number(PORT) }, `Backend rodando em http://localhost:${PORT}`));
