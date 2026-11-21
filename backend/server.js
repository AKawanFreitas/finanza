const app = require('./app');
const { iniciarAgendador } = require('./lib/agendador');
const logger = require('./lib/logger');

const PORT = process.env.PORT || 4747;

iniciarAgendador();

app.listen(PORT, () => logger.info({ port: Number(PORT) }, `Backend rodando em http://localhost:${PORT}`));
